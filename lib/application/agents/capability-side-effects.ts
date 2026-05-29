import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgentRuntimeContext } from "@/lib/application/agents/build-agent-runtime-context";
import type {
  AgentCapabilityExecutionResult,
  AgentCapabilityId,
} from "@/lib/application/agents/agent-capabilities";

export type CapabilitySideEffectsResult = {
  created_tasks: string[];
  created_work_items: string[];
  created_decisions: string[];
  created_memory_entries: string[];
  updated_work_item: boolean;
  skipped_duplicates: Array<{
    type: "task";
    id: string;
    reason: string;
  }>;
};

type ApplyCapabilitySideEffectsInput = {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
  agentExecutionId: string;
  capabilityResult: AgentCapabilityExecutionResult;
  runtimeContext: AgentRuntimeContext;
  agentId?: string | null;
  agentName?: string | null;
  processedAt?: string;
};

type TaskRow = {
  id: string;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
};

type AgentDecisionRow = {
  id: string;
};

const OPEN_TASK_STATUSES = new Set([
  "pending",
  "approved",
  "escalated",
  "blocked",
]);

const TASK_SIDE_EFFECTS: Partial<
  Record<
    AgentCapabilityId,
    {
      title: string;
      description: string;
      priority: "normal" | "high";
    }
  >
> = {
  summarize_review_decision: {
    title: "Continue execution after human approval",
    description:
      "Internal follow-up created after an approved human review so execution can continue safely.",
    priority: "high",
  },
  qualify_lead_next_step: {
    title: "Ask next qualification question",
    description:
      "Internal SDR task to ask one focused qualification question before advancing the lead.",
    priority: "normal",
  },
  identify_missing_information: {
    title: "Research missing information",
    description:
      "Internal research task to collect missing information before the work item progresses.",
    priority: "normal",
  },
  prepare_proposal_next_step: {
    title: "Prepare proposal next step",
    description:
      "Internal closer task to prepare the next proposal step without sending external communications.",
    priority: "normal",
  },
};

export async function applyCapabilitySideEffects({
  supabase,
  organizationId,
  workItemId,
  agentExecutionId,
  capabilityResult,
  runtimeContext,
  agentId = null,
  agentName = null,
  processedAt = new Date().toISOString(),
}: ApplyCapabilitySideEffectsInput): Promise<CapabilitySideEffectsResult> {
  const result: CapabilitySideEffectsResult = {
    created_tasks: [],
    created_work_items: [],
    created_decisions: [],
    created_memory_entries: [],
    updated_work_item: false,
    skipped_duplicates: [],
  };
  const taskConfig = TASK_SIDE_EFFECTS[capabilityResult.capability_id];

  if (taskConfig) {
    const existingTask = await findExistingOpenTask({
      supabase,
      organizationId,
      workItemId,
      capabilityId: capabilityResult.capability_id,
    });

    if (existingTask) {
      result.skipped_duplicates.push({
        type: "task",
        id: existingTask.id,
        reason: "open_task_exists_for_work_item_and_capability",
      });
    } else {
      const task = await createInternalTask({
        supabase,
        organizationId,
        workItemId,
        agentExecutionId,
        agentId,
        agentName: agentName ?? runtimeContext.assigned_agent.name,
        runtimeContext,
        capabilityResult,
        taskConfig,
        processedAt,
      });

      result.created_tasks.push(task.id);
    }
  }

  const decision = await createSideEffectsDecision({
    supabase,
    organizationId,
    workItemId,
    agentExecutionId,
    agentId,
    agentName: agentName ?? runtimeContext.assigned_agent.name,
    capabilityResult,
    result,
    processedAt,
  });

  result.created_decisions.push(decision.id);

  await updateSideEffectsDecisionCreatedIds({
    supabase,
    organizationId,
    decisionId: decision.id,
    result,
    capabilityResult,
    workItemId,
    agentName: agentName ?? runtimeContext.assigned_agent.name,
    processedAt,
  });

  return result;
}

async function findExistingOpenTask({
  supabase,
  organizationId,
  workItemId,
  capabilityId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
  capabilityId: AgentCapabilityId;
}) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, status, metadata")
    .eq("organization_id", organizationId)
    .eq("work_item_id", workItemId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as TaskRow[]).find((task) => {
    const status = task.status ?? "pending";

    return (
      OPEN_TASK_STATUSES.has(status) &&
      task.metadata?.source === "capability_side_effect" &&
      task.metadata?.capability_id === capabilityId
    );
  });
}

async function createInternalTask({
  supabase,
  organizationId,
  workItemId,
  agentExecutionId,
  agentId,
  agentName,
  runtimeContext,
  capabilityResult,
  taskConfig,
  processedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
  agentExecutionId: string;
  agentId: string | null;
  agentName: string;
  runtimeContext: AgentRuntimeContext;
  capabilityResult: AgentCapabilityExecutionResult;
  taskConfig: {
    title: string;
    description: string;
    priority: "normal" | "high";
  };
  processedAt: string;
}) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      organization_id: organizationId,
      lead_id: runtimeContext.lead?.id ?? null,
      work_item_id: workItemId,
      title: taskConfig.title,
      task: taskConfig.title,
      description: taskConfig.description,
      priority: taskConfig.priority,
      status: "pending",
      assigned_agent: agentName,
      metadata: {
        source: "capability_side_effect",
        capability_id: capabilityResult.capability_id,
        capability_name: capabilityResult.capability_name,
        agent_execution_id: agentExecutionId,
        agent_id: agentId,
        work_item_id: workItemId,
        recommended_next_action:
          capabilityResult.recommended_next_action,
        openai_called: false,
      },
      created_at: processedAt,
      updated_at: processedAt,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw error;
  }

  return data;
}

async function createSideEffectsDecision({
  supabase,
  organizationId,
  workItemId,
  agentExecutionId,
  agentId,
  agentName,
  capabilityResult,
  result,
  processedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
  agentExecutionId: string;
  agentId: string | null;
  agentName: string;
  capabilityResult: AgentCapabilityExecutionResult;
  result: CapabilitySideEffectsResult;
  processedAt: string;
}) {
  const outcome = buildDecisionOutcome({
    workItemId,
    agentName,
    capabilityResult,
    result,
    processedAt,
  });

  const { data, error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: agentExecutionId,
      agent_id: agentId,
      work_item_id: workItemId,
      decision_type: "capability_side_effects_applied",
      decision: {
        outcome,
      },
      rationale: `${agentName} applied safe internal side effects for ${capabilityResult.capability_id}.`,
      confidence: 1,
      metadata: {
        source: "capability_side_effects",
        phase: 22,
        ...outcome,
        openai_called: false,
      },
      created_at: processedAt,
    })
    .select("id")
    .single<AgentDecisionRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function updateSideEffectsDecisionCreatedIds({
  supabase,
  organizationId,
  decisionId,
  result,
  capabilityResult,
  workItemId,
  agentName,
  processedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  decisionId: string;
  result: CapabilitySideEffectsResult;
  capabilityResult: AgentCapabilityExecutionResult;
  workItemId: string;
  agentName: string;
  processedAt: string;
}) {
  const { error } = await supabase
    .from("agent_decisions")
    .update({
      decision: {
        outcome: {
          work_item_id: workItemId,
          assigned_agent_name: agentName,
          capability_id: capabilityResult.capability_id,
          capability_name: capabilityResult.capability_name,
          created_task_ids: result.created_tasks,
          created_work_item_ids: result.created_work_items,
          created_decision_ids: result.created_decisions,
          created_memory_entry_ids: result.created_memory_entries,
          updated_work_item: result.updated_work_item,
          skipped_duplicates: result.skipped_duplicates,
          processed_at: processedAt,
        },
      },
      metadata: {
        source: "capability_side_effects",
        phase: 22,
        work_item_id: workItemId,
        assigned_agent_name: agentName,
        capability_id: capabilityResult.capability_id,
        capability_name: capabilityResult.capability_name,
        created_task_ids: result.created_tasks,
        created_work_item_ids: result.created_work_items,
        created_decision_ids: result.created_decisions,
        created_memory_entry_ids: result.created_memory_entries,
        updated_work_item: result.updated_work_item,
        skipped_duplicates: result.skipped_duplicates,
        processed_at: processedAt,
        openai_called: false,
      },
    })
    .eq("id", decisionId)
    .eq("organization_id", organizationId);

  if (error) {
    throw error;
  }
}

function buildDecisionOutcome({
  workItemId,
  agentName,
  capabilityResult,
  result,
  processedAt,
}: {
  workItemId: string;
  agentName: string;
  capabilityResult: AgentCapabilityExecutionResult;
  result: CapabilitySideEffectsResult;
  processedAt: string;
}) {
  return {
    work_item_id: workItemId,
    assigned_agent_name: agentName,
    capability_id: capabilityResult.capability_id,
    capability_name: capabilityResult.capability_name,
    created_task_ids: result.created_tasks,
    created_work_item_ids: result.created_work_items,
    created_decision_ids: result.created_decisions,
    created_memory_entry_ids: result.created_memory_entries,
    updated_work_item: result.updated_work_item,
    skipped_duplicates: result.skipped_duplicates,
    processed_at: processedAt,
  };
}
