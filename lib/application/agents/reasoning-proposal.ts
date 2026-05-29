import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgentExecutionPlan } from "@/lib/application/agents/agent-planning";
import type { AgentRuntimeContext } from "@/lib/application/agents/build-agent-runtime-context";
import type { ExecutionOutcomeEvaluation } from "@/lib/application/agents/outcome-evaluation";
import type { PolicyGovernanceDecision } from "@/lib/application/agents/policy-governance";
import type { WorkPriorityDecision } from "@/lib/application/execution-queue/priority-scheduling";

export const REASONING_VERSION = "reasoning_proposal_v1";

export type ReasoningProposal = {
  proposal_id: string;
  reasoning_summary: string;
  confidence_score: number;
  recommended_strategy: string;
  proposed_actions: string[];
  proposed_plan_changes: string[];
  proposed_risks: string[];
  requires_human_review: boolean;
  reasoning_version: string;
};

export type ReasoningProposalInput = {
  runtimeContext: AgentRuntimeContext;
  governanceResult: PolicyGovernanceDecision;
  priorityResult?: WorkPriorityDecision | null;
  outcomeEvaluation: ExecutionOutcomeEvaluation;
  executionPlan: AgentExecutionPlan;
};

export type ReasoningProvider = {
  generateProposal(input: ReasoningProposalInput): Promise<ReasoningProposal>;
};

export type ReasoningProposalGovernanceResult = {
  accepted: boolean;
  rejected_actions: string[];
  accepted_actions: string[];
  governance_notes: string[];
};

export type PersistReasoningProposalInput = {
  supabase: SupabaseClient;
  organizationId: string;
  agentExecutionId: string;
  agentId?: string | null;
  workItemId?: string | null;
  reasoningProposal: ReasoningProposal;
  proposalGovernance: ReasoningProposalGovernanceResult;
  processedAt?: string;
};

type AgentDecisionRow = {
  id: string;
};

const UNSAFE_ACTION_PATTERN =
  /\b(send|email|sms|message customer|outreach|external|api call|webhook|openai|gpt|llm|model call|execute capability|process queue|queue processing|create task|create work item|work generation|autonomous|loop)\b/i;

export class DeterministicMockReasoningProvider implements ReasoningProvider {
  async generateProposal(
    input: ReasoningProposalInput
  ): Promise<ReasoningProposal> {
    return buildDeterministicProposal(input);
  }
}

export async function generateReasoningProposal({
  provider = new DeterministicMockReasoningProvider(),
  ...input
}: ReasoningProposalInput & {
  provider?: ReasoningProvider;
}) {
  return provider.generateProposal(input);
}

export function evaluateReasoningProposal({
  proposal,
  governanceResult,
}: {
  proposal: ReasoningProposal;
  governanceResult: PolicyGovernanceDecision;
}): ReasoningProposalGovernanceResult {
  const acceptedActions: string[] = [];
  const rejectedActions: string[] = [];
  const governanceNotes: string[] = [
    "Reasoning proposal evaluated as proposal-only.",
    "No actions were executed by the reasoning layer.",
  ];

  for (const action of proposal.proposed_actions) {
    const unsafe = UNSAFE_ACTION_PATTERN.test(action);
    const unsafeContinuation =
      /\bcontinue execution|resume execution|continue\b/i.test(action) &&
      (governanceResult.blocked ||
        governanceResult.autonomy_level === "blocked");
    const highRisk =
      governanceResult.risk_level === "high" &&
      !proposal.requires_human_review;

    if (unsafe || unsafeContinuation || highRisk) {
      rejectedActions.push(action);
      continue;
    }

    acceptedActions.push(action);
  }

  if (rejectedActions.length > 0) {
    governanceNotes.push(
      `${rejectedActions.length} proposed action(s) rejected by governance.`
    );
  }

  if (acceptedActions.length > 0) {
    governanceNotes.push(
      `${acceptedActions.length} safe proposal action(s) accepted for human review.`
    );
  }

  if (proposal.requires_human_review || governanceResult.human_review_required) {
    governanceNotes.push("Human review remains required before execution.");
  }

  return {
    accepted: acceptedActions.length > 0 && rejectedActions.length === 0,
    rejected_actions: rejectedActions,
    accepted_actions: acceptedActions,
    governance_notes: governanceNotes,
  };
}

export async function persistReasoningProposalDecision({
  supabase,
  organizationId,
  agentExecutionId,
  agentId = null,
  workItemId = null,
  reasoningProposal,
  proposalGovernance,
  processedAt = new Date().toISOString(),
}: PersistReasoningProposalInput) {
  const outcome = {
    proposal_id: reasoningProposal.proposal_id,
    confidence_score: reasoningProposal.confidence_score,
    strategy: reasoningProposal.recommended_strategy,
    accepted_actions: proposalGovernance.accepted_actions,
    rejected_actions: proposalGovernance.rejected_actions,
    governance_notes: proposalGovernance.governance_notes,
  };

  const { data, error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: agentExecutionId,
      agent_id: agentId,
      work_item_id: workItemId,
      decision_type: "reasoning_proposal_created",
      decision: {
        outcome,
      },
      rationale: reasoningProposal.reasoning_summary,
      confidence: reasoningProposal.confidence_score / 100,
      metadata: {
        source: "reasoning_proposal",
        phase: 31,
        ...outcome,
        reasoning_proposal: reasoningProposal,
        proposal_governance: proposalGovernance,
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

function buildDeterministicProposal({
  runtimeContext,
  governanceResult,
  priorityResult,
  outcomeEvaluation,
  executionPlan,
}: ReasoningProposalInput): ReasoningProposal {
  const agentName = runtimeContext.assigned_agent.name;
  const rule = resolveAgentRule(agentName, runtimeContext);
  const confidenceScore = calculateConfidenceScore({
    governanceResult,
    priorityResult,
    outcomeEvaluation,
    executionPlan,
  });

  return {
    proposal_id: buildProposalId(runtimeContext),
    reasoning_summary: `${agentName} reasoning proposal: ${rule.summary}`,
    confidence_score: confidenceScore,
    recommended_strategy: rule.strategy,
    proposed_actions: rule.actions,
    proposed_plan_changes: rule.planChanges,
    proposed_risks: rule.risks,
    requires_human_review:
      governanceResult.human_review_required ||
      executionPlan.requires_human_review ||
      outcomeEvaluation.escalation_recommended,
    reasoning_version: REASONING_VERSION,
  };
}

function resolveAgentRule(
  agentName: string,
  runtimeContext: AgentRuntimeContext
) {
  if (
    agentName === "Operations Agent" &&
    runtimeContext.human_review_context?.status === "approved"
  ) {
    return {
      summary:
        "approved review and controlled continuation context support a proposal to continue internally.",
      strategy: "continue approved operations with ownership verification",
      actions: ["continue execution", "verify ownership", "monitor outcome"],
      planChanges: ["keep continuation bounded to the approved execution plan"],
      risks: ["ownership may have changed", "outcome may require renewed review"],
    };
  }

  if (agentName === "SDR Agent") {
    return {
      summary:
        "lead qualification context should be clarified before progression.",
      strategy: "qualify lead before advancing the opportunity",
      actions: [
        "qualify lead",
        "identify missing qualification data",
        "recommend next question",
      ],
      planChanges: ["prioritize one qualification question before next stage"],
      risks: ["qualification data may be incomplete"],
    };
  }

  if (agentName === "Research Agent") {
    return {
      summary:
        "available context should be compared against missing information signals.",
      strategy: "fill account and requirement gaps before execution",
      actions: ["identify information gaps", "propose research areas"],
      planChanges: ["add internal research clarification before progression"],
      risks: ["research confidence may be limited by missing memory"],
    };
  }

  if (agentName === "Closer Agent") {
    return {
      summary:
        "deal context should be checked for objections and proposal risk.",
      strategy: "de-risk the next proposal step",
      actions: [
        "identify objections",
        "identify deal risks",
        "recommend next proposal step",
      ],
      planChanges: ["require human review before any risky proposal movement"],
      risks: ["stakeholder objection may block proposal acceptance"],
    };
  }

  return {
    summary: "runtime context supports only a safe manual next-step proposal.",
    strategy: "summarize context for human review",
    actions: ["summarize current context", "recommend next safe manual step"],
    planChanges: ["keep plan proposal-only"],
    risks: ["agent-specific reasoning rule was not found"],
  };
}

function calculateConfidenceScore({
  governanceResult,
  priorityResult,
  outcomeEvaluation,
  executionPlan,
}: Pick<
  ReasoningProposalInput,
  "governanceResult" | "priorityResult" | "outcomeEvaluation" | "executionPlan"
>) {
  let score = 72;

  if (governanceResult.allowed) score += 8;
  if (governanceResult.blocked) score -= 28;
  if (governanceResult.human_review_required) score -= 5;
  if (executionPlan.steps.length >= 3) score += 4;
  if (outcomeEvaluation.outcome_status === "successful") score += 8;
  if (outcomeEvaluation.outcome_status === "partial") score -= 6;
  if (outcomeEvaluation.outcome_status === "blocked") score -= 18;
  if ((priorityResult?.priority_score ?? 0) >= 70) score += 4;
  if ((priorityResult?.risk_score ?? 0) >= 70) score -= 8;

  return Math.max(0, Math.min(100, score));
}

function buildProposalId(runtimeContext: AgentRuntimeContext) {
  return [
    "reasoning",
    slugify(runtimeContext.assigned_agent.name),
    runtimeContext.queue_item.id,
  ].join("_");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
