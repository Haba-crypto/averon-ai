import type { SupabaseClient } from "@supabase/supabase-js";
import type OpenAI from "openai";

import { selectObjectionPlaybookOverlay } from "@/lib/ai/agents/revenue-playbook";
import { routeRevenueAgentDecision } from "@/lib/ai/agents/revenue-router";
import { deriveConversationStrategy } from "@/lib/ai/agents/revenue-strategy";
import { getOpenAIClient } from "@/lib/ai/openai";
import { buildRevenueChatPrompt } from "@/lib/ai/prompts/revenue-chat";
import type { LeadRecord, RevenueAction } from "@/lib/domain/leads/types";
import {
  buildAgentExecutionIdentityFields,
  resolveAgentIdentityForChat,
  serializeAgentIdentity,
  type ResolvedAgentIdentity,
} from "@/lib/application/agents/agent-identity";
import {
  decideAgentHandoff,
  isAgentHandoffTarget,
  type HandoffDecision,
} from "@/lib/application/agents/handoff-decision";
import { createHumanReview } from "@/lib/application/human-reviews/create-human-review";
import { extractAndStoreConversationMemory } from "@/lib/application/memory/conversation-memory-extraction";
import {
  countRelevantMemoryEntries,
  createEmptyRelevantMemory,
  formatRelevantMemoryForPrompt,
  getRelevantMemoryEntryIds,
  retrieveRelevantMemory,
  type RelevantMemory,
} from "@/lib/application/memory/memory-retrieval";
import { routeOperationalWork } from "@/lib/application/workflow-actions/operational-routing";
import { resolveWorkItemForLead } from "@/lib/application/work-items/resolve-work-item-for-lead";
import {
  isWorkItemOwnerEmpty,
  updateWorkItemOwnership,
  type WorkItemOwnerType,
} from "@/lib/application/work-items/update-work-item-ownership";

type RespondToLeadMessageInput = {
  supabase: SupabaseClient;
  leadId: string;
  message: string;
  organizationId: string;
};

type LeadUpdate = {
  intent_score: number;
  status: string;
  ai_notes: string;
  urgency: string;
  recommendation: string;
  deal_risk: string;
  close_probability: number;
};

type ConversationTurn = {
  role: string | null;
  message: string | null;
};

const RECENT_CONVERSATION_LIMIT = 10;
const CHAT_MODEL = "gpt-4.1-mini";

type AgentExecutionRecord = {
  id: string;
};

type WorkItemReference = {
  id: string;
  owner_type?: string | null;
  owner_agent_id?: string | null;
  owner_user_id?: string | null;
};

type LatestAgentExecutionReference = {
  id: string;
  agent_name: string | null;
};

export async function respondToLeadMessage({
  supabase,
  leadId,
  message,
  organizationId,
}: RespondToLeadMessageInput) {
  let agentExecution: AgentExecutionRecord | null = null;
  let memoryExtractionResult: {
    candidateCount: number;
    insertedCount: number;
  } | null = null;
  let relevantMemory: RelevantMemory = createEmptyRelevantMemory();
  let memoryContextUsed = "";
  let memoryEntryIds: string[] = [];
  let memoryRetrievalError: unknown = null;

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .single<LeadRecord>();

  if (leadError) {
    throw leadError;
  }

  const workItem = await tryResolveWorkItemForLead(leadId, {
    supabase,
    organizationId,
  });

  const { error: userMessageError } = await supabase
    .from("conversations")
    .insert({
      lead_id: leadId,
      organization_id: organizationId,
      role: "user",
      message,
    });

  if (userMessageError) {
    throw userMessageError;
  }

  const agentRoutingDecision = routeRevenueAgentDecision(message);
  const activeAgent = agentRoutingDecision.selectedAgent;
  const latestAgentExecution =
    workItem === null
      ? null
      : await tryLoadLatestAgentExecutionForWorkItem({
          supabase,
          organizationId,
          workItemId: workItem.id,
        });
  const handoffSourceAgent = resolveHandoffSourceAgent({
    activeAgent,
    latestAgentExecution,
  });
  const initialHandoffDecision = decideAgentHandoff({
    sourceAgent: handoffSourceAgent,
    message,
  });
  const handoffDecision = await resolveHandoffDecisionTarget({
    supabase,
    organizationId,
    decision: initialHandoffDecision,
  });
  const agentIdentity = await resolveAgentIdentityForChat({
    supabase,
    organizationId,
    activeAgent,
  });
  const serializedAgentIdentity =
    serializeAgentIdentity(agentIdentity);
  await tryAssignRoutedWorkItemOwnership({
    supabase,
    organizationId,
    workItem,
    activeAgent,
    agentIdentity,
    reason: agentRoutingDecision.rationale,
  });
  const openai = getOpenAIClient();
  const recentConversationTurns =
    await loadRecentConversationTurns({
      supabase,
      leadId,
      organizationId,
    });
  const strategy = deriveConversationStrategy({
    lead,
    latestMessage: message,
    recentConversationTurns,
  });
  const playbookOverlay = selectObjectionPlaybookOverlay({
    latestMessage: message,
    recentConversationTurns,
    strategy,
  });
  try {
    relevantMemory = await retrieveRelevantMemory({
      supabase,
      organizationId,
      leadId,
      workItemId: workItem?.id ?? null,
      latestUserMessage: message,
    });
    memoryContextUsed =
      formatRelevantMemoryForPrompt(relevantMemory);
    memoryEntryIds = getRelevantMemoryEntryIds(relevantMemory);
  } catch (error) {
    memoryRetrievalError = error;
    console.error("MEMORY RETRIEVAL FAILED", {
      leadId,
      organizationId,
      workItemId: workItem?.id ?? null,
      error,
    });
  }

  const systemPrompt = buildRevenueChatPrompt({
    activeAgent,
    agentIdentityContext: agentIdentity?.identityContext,
    lead,
    strategy,
    playbookOverlay,
    memoryContext: memoryContextUsed,
  });
  const startedAt = new Date();

  try {
    agentExecution = await createAgentExecution({
      supabase,
      organizationId,
      workItem,
      startedAt,
      agentIdentity,
      input: {
        source: "api.chat",
        lead_id: leadId,
        latest_message: message,
        active_agent: activeAgent,
        agent_routing: agentRoutingDecision,
        handoff: {
          source_agent: handoffSourceAgent,
          latest_agent_execution_id: latestAgentExecution?.id ?? null,
          decision: handoffDecision,
        },
        agent_identity: serializedAgentIdentity,
        model: CHAT_MODEL,
        lead_snapshot: lead,
        recent_conversation_turns: recentConversationTurns,
        strategy,
        playbook_overlay: playbookOverlay,
        memory_context_used: memoryContextUsed,
        memory_entry_ids: memoryEntryIds,
        memory_retrieval: {
          count: countRelevantMemoryEntries(relevantMemory),
          failed: Boolean(memoryRetrievalError),
          error: memoryRetrievalError
            ? serializeError(memoryRetrievalError)
            : null,
        },
        system_prompt: systemPrompt,
      },
    });

    await createAgentDecision({
      supabase,
      organizationId,
      workItem,
      agentExecution,
      decisionType: "handoff",
      rationale: buildHandoffRationale({
        sourceAgent: handoffSourceAgent,
        decision: handoffDecision,
      }),
      confidence: handoffDecision.confidence,
      outcome: {
        should_handoff: handoffDecision.should_handoff,
        source_agent: handoffSourceAgent,
        target_agent: handoffDecision.target_agent,
        reason: handoffDecision.reason,
        confidence: handoffDecision.confidence,
        work_item_id: workItem?.id ?? null,
        continued_current_execution: true,
      },
      metadata: {
        source: "api.chat",
        lead_id: leadId,
        should_handoff: handoffDecision.should_handoff,
        source_agent: handoffSourceAgent,
        target_agent: handoffDecision.target_agent,
        reason: handoffDecision.reason,
        confidence: handoffDecision.confidence,
        latest_agent_execution_id:
          latestAgentExecution?.id ?? null,
        active_agent: activeAgent,
        agent_identity: serializedAgentIdentity,
      },
    });

    await tryUpdateHandoffOwnership({
      supabase,
      organizationId,
      workItem,
      agentExecution,
      sourceAgent: handoffSourceAgent,
      handoffDecision,
    });

    await createAgentDecision({
      supabase,
      organizationId,
      workItem,
      agentExecution,
      decisionType: "agent_routing",
      rationale: agentRoutingDecision.rationale,
      confidence: agentRoutingDecision.confidence,
      outcome: {
        selected_agent: agentRoutingDecision.selected_agent,
        active_agent: activeAgent,
        scores: agentRoutingDecision.scores,
        matched_signals: agentRoutingDecision.matched_signals,
        rationale: agentRoutingDecision.rationale,
        confidence: agentRoutingDecision.confidence,
        agent_identity: serializedAgentIdentity,
      },
      metadata: {
        source: "api.chat",
        lead_id: leadId,
        selected_agent: agentRoutingDecision.selected_agent,
        scores: agentRoutingDecision.scores,
        matched_signals: agentRoutingDecision.matched_signals,
        agent_identity: serializedAgentIdentity,
      },
    });

    await createAgentDecision({
      supabase,
      organizationId,
      workItem,
      agentExecution,
      decisionType: "memory_retrieval",
      rationale: buildMemoryRetrievalRationale({
        memoryCount: countRelevantMemoryEntries(relevantMemory),
        memoryEntryIds,
        failed: Boolean(memoryRetrievalError),
      }),
      confidence: memoryRetrievalError ? 0.1 : 0.7,
      outcome: {
        memory_count: countRelevantMemoryEntries(relevantMemory),
        memory_entry_ids: memoryEntryIds,
        memory_context_used: memoryContextUsed,
      },
      metadata: {
        source: "api.chat",
        lead_id: leadId,
        work_item_id: workItem?.id ?? null,
        agent_identity: serializedAgentIdentity,
        retrieval_reason:
          "Retrieved same-lead and same-work-item memory before response generation using recency and exact keyword overlap.",
        failed: Boolean(memoryRetrievalError),
        error: memoryRetrievalError
          ? serializeError(memoryRetrievalError)
          : null,
      },
    });

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...recentConversationTurns,
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "No response";

    const { error: assistantMessageError } = await supabase
      .from("conversations")
      .insert({
        lead_id: leadId,
        organization_id: organizationId,
        role: "assistant",
        message: reply,
      });

    if (assistantMessageError) {
      throw assistantMessageError;
    }

    const actions: RevenueAction[] = [];

    async function logAction(action: RevenueAction) {
      actions.push(action);

      const { error } = await supabase.from("ai_events").insert({
        lead_id: leadId,
        organization_id: organizationId,
        ...(workItem ? { work_item_id: workItem.id } : {}),
        type: action.type,
        message: action.message,
      });

      if (error) {
        throw error;
      }
    }

    const leadUpdate = await analyzeRevenueSignals({
      lead,
      message,
      activeAgent,
      logAction,
    });

    await createAgentDecision({
      supabase,
      organizationId,
      workItem,
      agentExecution,
      decisionType: "lead_state_update",
      rationale: buildLeadUpdateRationale(leadUpdate, actions),
      confidence: estimateLeadUpdateConfidence(actions),
      outcome: leadUpdate,
      metadata: {
        source: "api.chat",
        lead_id: leadId,
        active_agent: activeAgent,
        agent_routing: agentRoutingDecision,
        handoff: handoffDecision,
        agent_identity: serializedAgentIdentity,
        action_count: actions.length,
      },
    });

    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update(leadUpdate)
      .eq("id", leadId)
      .eq("organization_id", organizationId);

    if (leadUpdateError) {
      throw leadUpdateError;
    }

    const { data: updatedLead, error: updatedLeadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("organization_id", organizationId)
      .single<LeadRecord>();

    if (updatedLeadError) {
      throw updatedLeadError;
    }

    try {
      const result = await extractAndStoreConversationMemory({
        supabase,
        organizationId,
        leadId,
        workItemId: workItem?.id ?? null,
        sourceAgentExecutionId: agentExecution?.id ?? null,
        lead: updatedLead,
        conversationMessages: recentConversationTurns.map((turn) => ({
          role: String(turn.role),
          content:
            typeof turn.content === "string" ? turn.content : "",
        })),
        latestAiResponse: reply,
      });

      memoryExtractionResult = {
        candidateCount: result.candidates.length,
        insertedCount: result.insertedCount,
      };
    } catch (error) {
      console.error("MEMORY EXTRACTION FAILED", {
        leadId,
        organizationId,
        workItemId: workItem?.id ?? null,
        error,
      });
    }

    await logAction({
      type: "memory",
      message: memoryExtractionResult
        ? `AI memory updated (${memoryExtractionResult.insertedCount} new)`
        : "AI memory update skipped",
    });

    await logAction({
      type: "agent",
      message: `${activeAgent} active`,
    });

    await logAction({
      type: "urgency",
      message: `Urgency level: ${leadUpdate.urgency}`,
    });

    await logAction({
      type: "probability",
      message: `Close probability: ${leadUpdate.close_probability}%`,
    });

    await logAction({
      type: "recommendation",
      message: leadUpdate.recommendation,
    });

    try {
      const routingResult = await routeOperationalWork({
        supabase,
        organizationId,
        leadId,
        leadState: leadUpdate,
        latestMessage: message,
      });

      if (routingResult.routed) {
        await logAction({
          type: "queue_routing",
          message: `${routingResult.reason} Routed to ${routingResult.status}.`,
        });
      }
    } catch (error) {
      console.error("OPERATIONAL ROUTING FAILED", {
        leadId,
        organizationId,
        error,
      });
    }

    await completeAgentExecution({
      supabase,
      organizationId,
      agentExecution,
      status: "succeeded",
      output: {
        source: "api.chat",
        lead_id: leadId,
        work_item_id: workItem?.id ?? null,
        active_agent: activeAgent,
        agent_identity: serializedAgentIdentity,
        handoff: {
          source_agent: handoffSourceAgent,
          latest_agent_execution_id:
            latestAgentExecution?.id ?? null,
          decision: handoffDecision,
        },
        model: completion.model || CHAT_MODEL,
        timing_ms: new Date().getTime() - startedAt.getTime(),
        reply,
        lead_update: leadUpdate,
        updated_lead: updatedLead,
        memory_retrieval: {
          count: countRelevantMemoryEntries(relevantMemory),
          memory_entry_ids: memoryEntryIds,
          failed: Boolean(memoryRetrievalError),
        },
        memory_extraction: memoryExtractionResult,
        actions,
        usage: completion.usage ?? null,
        finish_reason: completion.choices?.[0]?.finish_reason ?? null,
      },
    });

    return {
      reply,
      activeAgent,
      lead: updatedLead,
      actions,
    };
  } catch (error) {
    if (agentExecution) {
      await completeAgentExecution({
        supabase,
        organizationId,
        agentExecution,
        status: "failed",
        output: null,
        error,
      });
    }

    throw error;
  }
}

async function createAgentExecution({
  supabase,
  organizationId,
  workItem,
  startedAt,
  agentIdentity,
  input,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItem: WorkItemReference | null;
  startedAt: Date;
  agentIdentity: ResolvedAgentIdentity | null;
  input: Record<string, unknown>;
}) {
  const executionIdentityFields =
    buildAgentExecutionIdentityFields(agentIdentity);
  const { data, error } = await supabase
    .from("agent_executions")
    .insert({
      organization_id: organizationId,
      agent_id: executionIdentityFields.agent_id,
      agent_name: executionIdentityFields.agent_name,
      agent_role: executionIdentityFields.agent_role,
      work_item_id: workItem?.id ?? null,
      status: "running",
      input,
      metadata: executionIdentityFields.metadata,
      started_at: startedAt.toISOString(),
    })
    .select("id")
    .single<AgentExecutionRecord>();

  if (error) {
    console.error("AGENT EXECUTION GRAPH WRITE FAILED", {
      organizationId,
      workItemId: workItem?.id ?? null,
      error,
    });

    return null;
  }

  return data;
}

async function completeAgentExecution({
  supabase,
  organizationId,
  agentExecution,
  status,
  output,
  error,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  agentExecution: AgentExecutionRecord | null;
  status: "succeeded" | "failed";
  output: Record<string, unknown> | null;
  error?: unknown;
}) {
  if (!agentExecution) {
    return;
  }

  const { error: updateError } = await supabase
    .from("agent_executions")
    .update({
      status,
      output,
      error: error ? serializeError(error) : null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", agentExecution.id)
    .eq("organization_id", organizationId);

  if (updateError) {
    console.error("AGENT EXECUTION GRAPH UPDATE FAILED", {
      organizationId,
      agentExecutionId: agentExecution.id,
      status,
      error: updateError,
    });
  }
}

async function createAgentDecision({
  supabase,
  organizationId,
  workItem,
  agentExecution,
  decisionType,
  rationale,
  confidence,
  outcome,
  metadata,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItem: WorkItemReference | null;
  agentExecution: AgentExecutionRecord | null;
  decisionType: string;
  rationale: string;
  confidence: number;
  outcome: Record<string, unknown>;
  metadata: Record<string, unknown>;
}) {
  if (!agentExecution) {
    return;
  }

  const { error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: agentExecution.id,
      agent_id: getAgentIdFromDecisionMetadata(metadata),
      work_item_id: workItem?.id ?? null,
      decision_type: decisionType,
      decision: {
        outcome,
      },
      rationale,
      confidence,
      metadata,
    });

  if (error) {
    console.error("AGENT DECISION GRAPH WRITE FAILED", {
      organizationId,
      agentExecutionId: agentExecution.id,
      workItemId: workItem?.id ?? null,
      decisionType,
      error,
    });
  }
}

async function tryResolveWorkItemForLead(
  leadId: string,
  options: {
    supabase: SupabaseClient;
    organizationId: string;
  }
) {
  try {
    return await resolveWorkItemForLead(leadId, options);
  } catch (error) {
    console.error("WORK ITEM RESOLUTION FAILED", {
      leadId,
      organizationId: options.organizationId,
      error,
    });

    return null;
  }
}

async function tryLoadLatestAgentExecutionForWorkItem({
  supabase,
  organizationId,
  workItemId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
}): Promise<LatestAgentExecutionReference | null> {
  try {
    const { data, error } = await supabase
      .from("agent_executions")
      .select("id, agent_name")
      .eq("work_item_id", workItemId)
      .eq("organization_id", organizationId)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle<LatestAgentExecutionReference>();

    if (error) {
      throw error;
    }

    return data ?? null;
  } catch (error) {
    console.error("LATEST AGENT EXECUTION LOOKUP FAILED", {
      organizationId,
      workItemId,
      error,
    });

    return null;
  }
}

async function resolveHandoffDecisionTarget({
  supabase,
  organizationId,
  decision,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  decision: HandoffDecision;
}): Promise<HandoffDecision> {
  if (
    !decision.should_handoff ||
    !isAgentHandoffTarget(decision.target_agent)
  ) {
    return decision;
  }

  try {
    const targetIdentity = await resolveAgentIdentityForChat({
      supabase,
      organizationId,
      activeAgent: decision.target_agent,
    });

    if (targetIdentity) {
      return decision;
    }
  } catch (error) {
    console.error("HANDOFF TARGET RESOLUTION FAILED", {
      organizationId,
      targetAgent: decision.target_agent,
      error,
    });
  }

  return {
    should_handoff: false,
    target_agent: null,
    reason: `Handoff target ${decision.target_agent} could not be resolved; current agent continues.`,
    confidence: 0.2,
  };
}

async function tryAssignRoutedWorkItemOwnership({
  supabase,
  organizationId,
  workItem,
  activeAgent,
  agentIdentity,
  reason,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItem: WorkItemReference | null;
  activeAgent: string;
  agentIdentity: ResolvedAgentIdentity | null;
  reason: string;
}) {
  if (!workItem) {
    return;
  }

  if (
    !isWorkItemOwnerEmpty({
      owner_type: normalizeWorkItemOwnerType(workItem.owner_type),
      owner_agent_id: workItem.owner_agent_id ?? null,
      owner_user_id: workItem.owner_user_id ?? null,
    })
  ) {
    return;
  }

  try {
    await updateWorkItemOwnership({
      supabase,
      workItemId: workItem.id,
      organizationId,
      ownerType: "ai",
      ownerAgentId: agentIdentity?.agentId ?? null,
      ownerAgentName:
        agentIdentity?.profile.name ?? activeAgent,
      ownerAgentRole: agentIdentity?.profile.role ?? null,
      reason,
      sourceAgent: null,
      targetAgent: {
        id: agentIdentity?.agentId ?? null,
        name: agentIdentity?.profile.name ?? activeAgent,
        role: agentIdentity?.profile.role ?? null,
      },
    });
  } catch (error) {
    console.error("WORK ITEM OWNERSHIP ASSIGNMENT FAILED", {
      organizationId,
      workItemId: workItem.id,
      activeAgent,
      error,
    });
  }
}

function normalizeWorkItemOwnerType(
  ownerType: string | null | undefined
): WorkItemOwnerType {
  if (
    ownerType === "ai" ||
    ownerType === "human" ||
    ownerType === "shared" ||
    ownerType === "unassigned"
  ) {
    return ownerType;
  }

  return "unassigned";
}

function resolveHandoffSourceAgent({
  activeAgent,
  latestAgentExecution,
}: {
  activeAgent: string;
  latestAgentExecution: LatestAgentExecutionReference | null;
}) {
  if (activeAgent === "Operations Agent") {
    return activeAgent;
  }

  return latestAgentExecution?.agent_name ?? activeAgent;
}

async function tryUpdateHandoffOwnership({
  supabase,
  organizationId,
  workItem,
  agentExecution,
  sourceAgent,
  handoffDecision,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItem: WorkItemReference | null;
  agentExecution: AgentExecutionRecord | null;
  sourceAgent: string;
  handoffDecision: HandoffDecision;
}) {
  if (!workItem || !handoffDecision.should_handoff) {
    return;
  }

  try {
    if (handoffDecision.target_agent === "Human Review") {
      await createHumanReview({
        supabase,
        organizationId,
        workItemId: workItem.id,
        sourceAgent,
        reviewType: "handoff",
        reviewReason: handoffDecision.reason,
        priority: "high",
        agentExecutionId: agentExecution?.id ?? null,
      });

      return;
    }

    if (!isAgentHandoffTarget(handoffDecision.target_agent)) {
      return;
    }

    const targetIdentity = await resolveAgentIdentityForChat({
      supabase,
      organizationId,
      activeAgent: handoffDecision.target_agent,
    });

    await updateWorkItemOwnership({
      supabase,
      workItemId: workItem.id,
      organizationId,
      ownerType: "ai",
      ownerAgentId: targetIdentity?.agentId ?? null,
      ownerAgentName:
        targetIdentity?.profile.name ??
        handoffDecision.target_agent,
      ownerAgentRole: targetIdentity?.profile.role ?? null,
      reason: handoffDecision.reason,
      sourceAgent,
      targetAgent: {
        id: targetIdentity?.agentId ?? null,
        name:
          targetIdentity?.profile.name ??
          handoffDecision.target_agent,
        role: targetIdentity?.profile.role ?? null,
      },
    });
  } catch (error) {
    console.error("WORK ITEM HANDOFF OWNERSHIP UPDATE FAILED", {
      organizationId,
      workItemId: workItem.id,
      sourceAgent,
      targetAgent: handoffDecision.target_agent,
      error,
    });

    if (handoffDecision.target_agent === "Human Review") {
      try {
        await updateWorkItemOwnership({
          supabase,
          workItemId: workItem.id,
          organizationId,
          ownerType: "human",
          reason: handoffDecision.reason,
          sourceAgent,
          targetAgent: "Human Review",
        });
      } catch (ownershipError) {
        console.error("HUMAN REVIEW FALLBACK OWNERSHIP UPDATE FAILED", {
          organizationId,
          workItemId: workItem.id,
          sourceAgent,
          error: ownershipError,
        });
      }
    }
  }
}

function buildHandoffRationale({
  sourceAgent,
  decision,
}: {
  sourceAgent: string;
  decision: HandoffDecision;
}) {
  if (!decision.should_handoff) {
    return decision.reason;
  }

  if (decision.target_agent === "Human Review") {
    return `${sourceAgent} requested Human Review. ${decision.reason}`;
  }

  return `${sourceAgent} handed work to ${decision.target_agent}. ${decision.reason}`;
}

function buildLeadUpdateRationale(
  leadUpdate: LeadUpdate,
  actions: RevenueAction[]
) {
  if (actions.length === 0) {
    return "No explicit revenue signals detected; preserved the current lead posture.";
  }

  const signalTypes = actions
    .map((action) => action.type)
    .filter((type, index, types) => types.indexOf(type) === index)
    .join(", ");

  return `Detected ${signalTypes}; updated lead status to ${leadUpdate.status}, urgency to ${leadUpdate.urgency}, and close probability to ${leadUpdate.close_probability}%.`;
}

function estimateLeadUpdateConfidence(actions: RevenueAction[]) {
  if (actions.length >= 3) {
    return 0.82;
  }

  if (actions.length > 0) {
    return 0.68;
  }

  return 0.55;
}

function buildMemoryRetrievalRationale({
  memoryCount,
  memoryEntryIds,
  failed,
}: {
  memoryCount: number;
  memoryEntryIds: string[];
  failed: boolean;
}) {
  if (failed) {
    return "Memory retrieval failed; chat response generation continued without retrieved memory.";
  }

  if (memoryCount === 0) {
    return "No relevant same-lead or same-work-item memory was available for this response.";
  }

  return `Retrieved ${memoryCount} memory entries before response generation: ${memoryEntryIds.join(", ")}.`;
}

function getAgentIdFromDecisionMetadata(
  metadata: Record<string, unknown>
) {
  const identity = metadata.agent_identity;

  if (
    identity &&
    typeof identity === "object" &&
    "agent_id" in identity &&
    typeof identity.agent_id === "string"
  ) {
    return identity.agent_id;
  }

  return null;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

async function loadRecentConversationTurns({
  supabase,
  leadId,
  organizationId,
}: {
  supabase: SupabaseClient;
  leadId: string;
  organizationId: string;
}): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("role, message")
    .eq("lead_id", leadId)
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: false,
    })
    .limit(RECENT_CONVERSATION_LIMIT);

  if (error) {
    throw error;
  }

  return ((data ?? []) as ConversationTurn[])
    .reverse()
    .flatMap((turn) => {
      if (
        turn.role !== "user" &&
        turn.role !== "assistant"
      ) {
        return [];
      }

      if (!turn.message) {
        return [];
      }

      return [
        {
          role: turn.role,
          content: turn.message,
        },
      ];
    });
}

async function analyzeRevenueSignals({
  lead,
  message,
  activeAgent,
  logAction,
}: {
  lead: LeadRecord | null;
  message: string;
  activeAgent: string;
  logAction: (action: RevenueAction) => Promise<void>;
}): Promise<LeadUpdate> {
  const lower = message.toLowerCase();

  let intentScore = lead?.intent_score ?? 0;
  let status = lead?.status ?? "new";
  let aiNotes = lead?.ai_notes ?? "";
  let urgency = lead?.urgency ?? "low";
  let recommendation =
    lead?.recommendation ?? "Continue qualification.";
  let dealRisk = lead?.deal_risk ?? "low";
  let closeProbability = lead?.close_probability ?? 10;

  if (
    lower.includes("demo") ||
    lower.includes("pricing") ||
    lower.includes("integration")
  ) {
    intentScore += 15;
    closeProbability += 12;
    urgency = "high";
    status = "qualified";
    recommendation = "Schedule enterprise demo immediately.";
    aiNotes += "\nDetected high buying intent.";

    await logAction({
      type: "intent",
      message: "Detected high buying intent",
    });

    await logAction({
      type: "pipeline",
      message: "Pipeline moved to qualified",
    });

    await logAction({
      type: "task",
      message: "High-intent work routed to execution queue",
    });
  }

  if (
    lower.includes("enterprise") ||
    lower.includes("team") ||
    lower.includes("scale")
  ) {
    intentScore += 10;
    closeProbability += 8;
    urgency = "medium";
    recommendation = "Push enterprise expansion conversation.";
    aiNotes += "\nEnterprise expansion potential detected.";

    await logAction({
      type: "enterprise",
      message: "Enterprise expansion potential detected",
    });
  }

  if (
    lower.includes("later") ||
    lower.includes("not now") ||
    lower.includes("budget")
  ) {
    dealRisk = "medium";
    closeProbability -= 10;
    recommendation = "Address timing and budget objections.";

    await logAction({
      type: "risk",
      message: "Potential deal risk detected",
    });
  }

  if (activeAgent === "Research Agent") {
    aiNotes += "\nResearch agent activated.";

    await logAction({
      type: "research",
      message: "Research agent analyzing company intelligence",
    });
  }

  if (activeAgent === "Operations Agent") {
    recommendation =
      "Focus on routing, ownership, and execution follow-through.";

    await logAction({
      type: "operations",
      message: "Operations agent coordinating workflow execution",
    });
  }

  closeProbability = Math.max(
    5,
    Math.min(closeProbability, 95)
  );

  return {
    intent_score: intentScore,
    status,
    ai_notes: aiNotes,
    urgency,
    recommendation,
    deal_risk: dealRisk,
    close_probability: closeProbability,
  };
}
