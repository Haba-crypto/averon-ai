import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgentExecutionPlan } from "@/lib/application/agents/agent-planning";
import type { AgentRuntimeContext } from "@/lib/application/agents/build-agent-runtime-context";
import type { ExecutionOutcomeEvaluation } from "@/lib/application/agents/outcome-evaluation";
import type { PolicyGovernanceDecision } from "@/lib/application/agents/policy-governance";
import type { WorkPriorityDecision } from "@/lib/application/execution-queue/priority-scheduling";
import { getOpenAIClient } from "@/lib/ai/openai";

export const REASONING_VERSION = "reasoning_proposal_v1";
const OPENAI_REASONING_MODEL = "gpt-4.1-mini";

export type ReasoningProviderName = "deterministic" | "openai";

export type ReasoningAction = {
  id: string;
  type: "internal_note" | "recommendation" | "question" | "risk_flag";
  title: string;
  description: string;
  risk_level: "low" | "medium" | "high";
  requires_human_review: boolean;
};

export type ReasoningProposal = {
  proposal_id: string;
  reasoning_summary: string;
  confidence_score: number;
  recommended_strategy: string;
  proposed_actions: ReasoningAction[];
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
  name: ReasoningProviderName;
  generateProposal(input: ReasoningProposalInput): Promise<ReasoningProposal>;
};

export type ReasoningProposalGovernanceResult = {
  accepted: boolean;
  rejected_actions: ReasoningAction[];
  accepted_actions: ReasoningAction[];
  governance_notes: string[];
};

export type ReasoningProposalGenerationResult = {
  provider: ReasoningProviderName;
  proposal: ReasoningProposal;
  fallback_used: boolean;
  fallback_reason: string | null;
  schema_valid: boolean;
};

export type PersistedReasoningProposal = {
  provider: ReasoningProviderName;
  proposal: ReasoningProposal;
  governance: ReasoningProposalGovernanceResult;
  fallback_used: boolean;
  fallback_reason: string | null;
  schema_valid: boolean;
};

export type PersistReasoningProposalInput = {
  supabase: SupabaseClient;
  organizationId: string;
  agentExecutionId: string;
  agentId?: string | null;
  workItemId?: string | null;
  reasoningResult: ReasoningProposalGenerationResult;
  proposalGovernance: ReasoningProposalGovernanceResult;
  processedAt?: string;
};

type AgentDecisionRow = {
  id: string;
};

const UNSAFE_ACTION_PATTERN =
  /\b(send|email|sms|message customer|outreach|external|api call|webhook|openai|gpt|llm|model call|execute capability|process queue|queue processing|create task|create work item|work generation|autonomous|loop)\b/i;

export class DeterministicMockReasoningProvider implements ReasoningProvider {
  name: ReasoningProviderName = "deterministic";

  async generateProposal(
    input: ReasoningProposalInput
  ): Promise<ReasoningProposal> {
    return buildDeterministicProposal(input);
  }
}

export class ReasoningProposalSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReasoningProposalSchemaError";
  }
}

type OpenAIResponsesClient = {
  responses: {
    create(input: {
      model: string;
      input: Array<{ role: "system" | "user"; content: string }>;
      temperature: number;
      text: { format: { type: "json_object" } };
    }): Promise<unknown>;
  };
};

export class OpenAIReasoningProvider implements ReasoningProvider {
  name: ReasoningProviderName = "openai";

  constructor(
    private readonly client: OpenAIResponsesClient | null = null,
    private readonly model = process.env.AVERON_REASONING_MODEL ??
      OPENAI_REASONING_MODEL
  ) {}

  async generateProposal(
    input: ReasoningProposalInput
  ): Promise<ReasoningProposal> {
    const client = this.client ?? getOpenAIClient();
    const response = await client.responses.create({
      model: this.model,
      input: [
        {
          role: "system",
          content: buildReasoningSystemPrompt(),
        },
        {
          role: "user",
          content: JSON.stringify(buildCompactRuntimeContext(input)),
        },
      ],
      temperature: 0,
      text: { format: { type: "json_object" } },
    });
    const content = extractOpenAIText(response);
    const rawProposal = parseStrictReasoningProposalJson(content);

    return normalizeStrictReasoningProposal(rawProposal, input);
  }
}

export function selectReasoningProvider(
  env?: { AVERON_REASONING_PROVIDER?: string }
): ReasoningProvider {
  const providerName =
    env?.AVERON_REASONING_PROVIDER ??
    process.env["AVERON_REASONING_PROVIDER"];

  return providerName === "openai"
    ? new OpenAIReasoningProvider()
    : new DeterministicMockReasoningProvider();
}

export async function generateReasoningProposal(
  input: ReasoningProposalInput & {
    provider?: ReasoningProvider;
  }
) {
  const result = await generateReasoningProposalWithMetadata(input);

  return result.proposal;
}

export async function generateReasoningProposalWithMetadata({
  provider = selectReasoningProvider(),
  ...input
}: ReasoningProposalInput & {
  provider?: ReasoningProvider;
}): Promise<ReasoningProposalGenerationResult> {
  try {
    const proposal = await provider.generateProposal(input);

    return {
      provider: provider.name,
      proposal,
      fallback_used: false,
      fallback_reason: null,
      schema_valid: true,
    };
  } catch (error: unknown) {
    if (provider.name !== "openai") {
      throw error;
    }

    const fallbackProvider = new DeterministicMockReasoningProvider();
    const fallbackProposal = await fallbackProvider.generateProposal(input);

    return {
      provider: fallbackProvider.name,
      proposal: fallbackProposal,
      fallback_used: true,
      fallback_reason: getErrorMessage(error),
      schema_valid: false,
    };
  }
}

export function evaluateReasoningProposal({
  proposal,
  governanceResult,
}: {
  proposal: ReasoningProposal;
  governanceResult: PolicyGovernanceDecision;
}): ReasoningProposalGovernanceResult {
  const acceptedActions: ReasoningAction[] = [];
  const rejectedActions: ReasoningAction[] = [];
  const governanceNotes: string[] = [
    "Reasoning proposal evaluated as proposal-only.",
    "No actions were executed by the reasoning layer.",
  ];

  for (const action of proposal.proposed_actions) {
    const actionText = [
      action.id,
      action.type,
      action.title,
      action.description,
    ].join(" ");
    const unsafe = UNSAFE_ACTION_PATTERN.test(actionText);
    const unsafeContinuation =
      /\bcontinue execution|resume execution|continue\b/i.test(actionText) &&
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
  reasoningResult,
  proposalGovernance,
  processedAt = new Date().toISOString(),
}: PersistReasoningProposalInput) {
  const reasoningProposal = reasoningResult.proposal;
  const persistedReasoningProposal: PersistedReasoningProposal = {
    provider: reasoningResult.provider,
    proposal: reasoningProposal,
    governance: proposalGovernance,
    fallback_used: reasoningResult.fallback_used,
    fallback_reason: reasoningResult.fallback_reason,
    schema_valid: reasoningResult.schema_valid,
  };
  const outcome = {
    proposal_id: reasoningProposal.proposal_id,
    provider: reasoningResult.provider,
    schema_valid: reasoningResult.schema_valid,
    fallback_used: reasoningResult.fallback_used,
    fallback_reason: reasoningResult.fallback_reason,
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
        phase: 33,
        ...outcome,
        reasoning_proposal: persistedReasoningProposal,
        proposal_governance: proposalGovernance,
        openai_called: reasoningResult.provider === "openai",
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

export function buildPersistedReasoningProposal({
  reasoningResult,
  proposalGovernance,
}: {
  reasoningResult: ReasoningProposalGenerationResult;
  proposalGovernance: ReasoningProposalGovernanceResult;
}): PersistedReasoningProposal {
  return {
    provider: reasoningResult.provider,
    proposal: reasoningResult.proposal,
    governance: proposalGovernance,
    fallback_used: reasoningResult.fallback_used,
    fallback_reason: reasoningResult.fallback_reason,
    schema_valid: reasoningResult.schema_valid,
  };
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
    proposed_actions: rule.actions.map((action, index) =>
      buildReasoningAction(action, index)
    ),
    proposed_plan_changes: [],
    proposed_risks: [],
    requires_human_review:
      governanceResult.human_review_required ||
      executionPlan.requires_human_review ||
      outcomeEvaluation.escalation_recommended,
    reasoning_version: REASONING_VERSION,
  };
}

function buildReasoningAction(value: string, index: number): ReasoningAction {
  const unsafe = UNSAFE_ACTION_PATTERN.test(value);

  return {
    id: `deterministic_action_${index + 1}`,
    type: unsafe ? "risk_flag" : "recommendation",
    title: value,
    description: value,
    risk_level: unsafe ? "high" : "low",
    requires_human_review: unsafe,
  };
}

function buildReasoningSystemPrompt() {
  return [
    "You are AVERON's sandboxed reasoning provider.",
    "You are not allowed to execute actions.",
    "You are not allowed to send messages or emails.",
    "You are not allowed to create tasks, work items, or queue items.",
    "You are not allowed to call external APIs or trigger tools.",
    "You are only allowed to propose internal recommendations for human review.",
    "Unsafe actions must be represented as risk_flag proposed_actions.",
    "Output JSON only.",
    "The JSON object must have exactly these keys: reasoning_summary, confidence_score, recommended_strategy, proposed_actions, proposed_plan_changes, proposed_risks, requires_human_review.",
    "Each proposed action must have exactly these keys: id, type, title, description, risk_level, requires_human_review.",
    "proposed_plan_changes and proposed_risks must be empty arrays.",
  ].join("\n");
}

function buildCompactRuntimeContext({
  runtimeContext,
  governanceResult,
  priorityResult,
  outcomeEvaluation,
  executionPlan,
}: ReasoningProposalInput) {
  return {
    runtime_context: {
      assigned_agent: {
        name: runtimeContext.assigned_agent.name,
        role: runtimeContext.assigned_agent.role,
      },
      queue_item: {
        id: runtimeContext.queue_item.id,
        work_item_id: runtimeContext.work_item.id,
        reason: runtimeContext.queue_item.queue_reason,
        next_action: runtimeContext.queue_item.next_action,
      },
      work_item: {
        id: runtimeContext.work_item.id,
        type: runtimeContext.work_item.type,
        status: runtimeContext.work_item.status,
        ownership_status: runtimeContext.work_item.ownership_status,
      },
      human_review: runtimeContext.human_review_context
        ? {
            status: runtimeContext.human_review_context.status,
            outcome: runtimeContext.human_review_context.review_outcome,
          }
        : null,
    },
    governance: {
      allowed: governanceResult.allowed,
      blocked: governanceResult.blocked,
      human_review_required: governanceResult.human_review_required,
      autonomy_level: governanceResult.autonomy_level,
      risk_level: governanceResult.risk_level,
      policy_reason: governanceResult.policy_reason,
    },
    priority: priorityResult
      ? {
          priority_score: priorityResult.priority_score,
          risk_score: priorityResult.risk_score,
          scheduling_bucket: priorityResult.scheduling_bucket,
        }
      : null,
    outcome: {
      status: outcomeEvaluation.outcome_status,
      success_score: outcomeEvaluation.success_score,
      escalation_recommended: outcomeEvaluation.escalation_recommended,
    },
    execution_plan: {
      step_count: executionPlan.steps.length,
      risk_level: executionPlan.risk_level,
      requires_human_review: executionPlan.requires_human_review,
      recommended_next_step: executionPlan.recommended_next_step,
    },
  };
}

type StrictReasoningProposalJson = Omit<
  ReasoningProposal,
  "proposal_id" | "reasoning_version"
>;

function parseStrictReasoningProposalJson(
  value: string
): StrictReasoningProposalJson {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ReasoningProposalSchemaError("OpenAI reasoning output was not valid JSON.");
  }

  return validateStrictReasoningProposal(parsed);
}

function validateStrictReasoningProposal(
  value: unknown
): StrictReasoningProposalJson {
  if (!isRecord(value)) {
    throw new ReasoningProposalSchemaError("OpenAI reasoning output must be a JSON object.");
  }

  assertExactKeys(value, [
    "reasoning_summary",
    "confidence_score",
    "recommended_strategy",
    "proposed_actions",
    "proposed_plan_changes",
    "proposed_risks",
    "requires_human_review",
  ]);

  if (
    typeof value.reasoning_summary !== "string" ||
    typeof value.recommended_strategy !== "string" ||
    typeof value.requires_human_review !== "boolean" ||
    typeof value.confidence_score !== "number" ||
    !Number.isFinite(value.confidence_score) ||
    value.confidence_score < 0 ||
    value.confidence_score > 100 ||
    !Array.isArray(value.proposed_actions) ||
    !Array.isArray(value.proposed_plan_changes) ||
    !Array.isArray(value.proposed_risks)
  ) {
    throw new ReasoningProposalSchemaError("OpenAI reasoning output failed schema validation.");
  }

  if (
    value.proposed_plan_changes.length > 0 ||
    value.proposed_risks.length > 0
  ) {
    throw new ReasoningProposalSchemaError("OpenAI reasoning output may not propose plan changes or risks outside proposed_actions.");
  }

  const proposedActions = value.proposed_actions.map((action) =>
    validateStrictReasoningAction(action)
  );

  return {
    reasoning_summary: value.reasoning_summary,
    confidence_score: value.confidence_score,
    recommended_strategy: value.recommended_strategy,
    proposed_actions: proposedActions,
    proposed_plan_changes: [],
    proposed_risks: [],
    requires_human_review: value.requires_human_review,
  };
}

function validateStrictReasoningAction(value: unknown): ReasoningAction {
  if (!isRecord(value)) {
    throw new ReasoningProposalSchemaError("OpenAI proposed action must be an object.");
  }

  assertExactKeys(value, [
    "id",
    "type",
    "title",
    "description",
    "risk_level",
    "requires_human_review",
  ]);

  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    typeof value.requires_human_review !== "boolean" ||
    !isReasoningActionType(value.type) ||
    !isRiskLevel(value.risk_level)
  ) {
    throw new ReasoningProposalSchemaError("OpenAI proposed action failed schema validation.");
  }

  return {
    id: value.id,
    type: value.type,
    title: value.title,
    description: value.description,
    risk_level: value.risk_level,
    requires_human_review: value.requires_human_review,
  };
}

function normalizeStrictReasoningProposal(
  proposal: StrictReasoningProposalJson,
  input: ReasoningProposalInput
): ReasoningProposal {
  return {
    ...proposal,
    proposal_id: buildProposalId(input.runtimeContext),
    confidence_score: Math.round(proposal.confidence_score),
    reasoning_version: REASONING_VERSION,
  };
}

function extractOpenAIText(response: unknown) {
  if (isRecord(response) && typeof response.output_text === "string") {
    return response.output_text;
  }

  throw new ReasoningProposalSchemaError("OpenAI reasoning response did not include output_text.");
}

function assertExactKeys(
  value: Record<string, unknown>,
  expectedKeys: string[]
) {
  const actualKeys = Object.keys(value).sort();
  const sortedExpected = [...expectedKeys].sort();
  const sameLength = actualKeys.length === sortedExpected.length;
  const sameKeys =
    sameLength &&
    actualKeys.every((key, index) => key === sortedExpected[index]);

  if (!sameKeys) {
    throw new ReasoningProposalSchemaError("OpenAI reasoning output contained fields outside the schema.");
  }
}

function isReasoningActionType(
  value: unknown
): value is ReasoningAction["type"] {
  return (
    value === "internal_note" ||
    value === "recommendation" ||
    value === "question" ||
    value === "risk_flag"
  );
}

function isRiskLevel(value: unknown): value is ReasoningAction["risk_level"] {
  return value === "low" || value === "medium" || value === "high";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Reasoning provider failed.";
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
