import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AGENT_RUNTIME_CONTEXT_VERSION,
  buildAgentRuntimeContext,
  summarizeAgentRuntimeContext,
  type AgentRuntimeContext,
} from "@/lib/application/agents/build-agent-runtime-context";
import {
  executeAgentCapability,
  selectAgentCapability,
  type AgentCapabilityExecutionResult,
} from "@/lib/application/agents/agent-capabilities";
import {
  buildAgentExecutionPlan,
  type AgentExecutionPlan,
} from "@/lib/application/agents/agent-planning";
import {
  translateExecutionPlanToWork,
  type PlanTranslationResult,
} from "@/lib/application/agents/plan-translation";
import {
  applyCapabilitySideEffects,
  type CapabilitySideEffectsResult,
} from "@/lib/application/agents/capability-side-effects";
import {
  generateFollowUpWork,
  type WorkGenerationResult,
} from "@/lib/application/agents/work-generation";
import {
  evaluateExecutionOutcome,
  persistExecutionOutcomeFeedback,
  type ExecutionOutcomeEvaluation,
} from "@/lib/application/agents/outcome-evaluation";
import {
  evaluatePolicyGovernance,
  type PolicyGovernanceDecision,
} from "@/lib/application/agents/policy-governance";
import {
  DeterministicMockReasoningProvider,
  evaluateReasoningProposal,
  generateReasoningProposalWithMetadata,
  buildPersistedReasoningProposal,
  persistReasoningProposalDecision,
  type ReasoningProposal,
  type ReasoningProposalGenerationResult,
  type ReasoningProposalGovernanceResult,
  type PersistedReasoningProposal,
} from "@/lib/application/agents/reasoning-proposal";
import {
  evaluateReasoningProposalQuality,
  persistReasoningEvaluationDecision,
  type ReasoningProposalQualityEvaluation,
} from "@/lib/application/agents/reasoning-evaluation";
import {
  deriveReasoningLearningSignal,
  persistReasoningLearningSignal,
  type ReasoningLearningSignal,
} from "@/lib/application/agents/reasoning-learning";
import {
  buildReasoningStrategyContext,
  persistStrategyMemoryRetrievedDecision,
  retrieveReasoningStrategyMemory,
  type ReasoningStrategyContext,
  type ReasoningStrategyMemoryRetrieval,
} from "@/lib/application/agents/reasoning-strategy-memory";
import type { ExecutionQueueItem } from "@/lib/application/execution-queue/create-execution-queue-item";
import {
  compareQueueItemsByPriority,
  evaluateAndPersistWorkPriority,
  isBlockedPriority,
  type WorkPriorityDecision,
} from "@/lib/application/execution-queue/priority-scheduling";

type ProcessNextExecutionQueueItemInput = {
  supabase: SupabaseClient;
  organizationId: string;
  queueItemId?: string | null;
};

type WorkItemRow = {
  id: string;
  type?: string | null;
  status: string;
  owner_type: string | null;
  owner_agent_id: string | null;
  owner_agent_name: string | null;
  owner_agent_role: string | null;
  ownership_status: string | null;
  last_owner_change_reason?: string | null;
};

type AgentRow = {
  id: string;
  key: string | null;
  name: string;
  description: string | null;
  config: Record<string, unknown> | null;
};

type AgentExecutionRow = {
  id: string;
  status: string;
};

type AgentDecisionRow = {
  id: string;
};

type ProcessedQueueItem = ExecutionQueueItem & {
  failure_reason?: string | null;
  lease_owner?: string | null;
  lease_until?: string | null;
  retry_count?: number | null;
  last_error?: string | null;
  failed_at?: string | null;
};

type ProcessStageName =
  | "claimQueueItemStage"
  | "buildRuntimeContextStage"
  | "evaluateGovernanceStage"
  | "executeCapabilityStage"
  | "applySideEffectsStage"
  | "generateWorkStage"
  | "createExecutionPlanStage"
  | "translatePlanStage"
  | "evaluateOutcomeStage"
  | "generateReasoningProposalStage"
  | "completeQueueItemStage"
  | "failQueueItemStage";

type StageFailure = {
  stage: ProcessStageName;
  message: string;
  recoverable: boolean;
  terminal: boolean;
};

type StageResult<T> =
  | {
      ok: true;
      stage: ProcessStageName;
      idempotency_key: string;
      output: T;
    }
  | {
      ok: false;
      stage: ProcessStageName;
      idempotency_key: string;
      error: StageFailure;
    };

type RuntimeContextStageOutput = {
  queueItem: ProcessedQueueItem;
  workItem: WorkItemRow;
  assignedAgent: AgentRow | null;
  agentName: string;
  agentRole: string | null;
  nextAction: string;
  processedAt: string;
  runtimeContext: AgentRuntimeContext;
  runtimeContextSummary: ReturnType<typeof summarizeAgentRuntimeContext>;
  agentExecution: AgentExecutionRow;
};

type GovernanceStageOutput = {
  selectedCapability: ReturnType<typeof selectAgentCapability>;
  policyGovernance: PolicyGovernanceDecision;
  policyGovernanceDecision: AgentDecisionRow;
};

type CapabilityStageOutput = {
  capabilityExecution: AgentCapabilityExecutionResult;
};

type SideEffectsStageOutput = {
  sideEffectsResult: CapabilitySideEffectsResult | null;
  sideEffectsError: string | null;
};

type WorkGenerationStageOutput = {
  workGenerationResult: WorkGenerationResult | null;
  workGenerationError: string | null;
};

type ExecutionPlanStageOutput = {
  executionPlan: AgentExecutionPlan;
  planDecision: AgentDecisionRow;
};

type PlanTranslationStageOutput = {
  planTranslationResult: PlanTranslationResult | null;
  planTranslationError: string | null;
};

type OutcomeStageOutput = {
  outcomeEvaluation: ExecutionOutcomeEvaluation;
  outcomeFeedback: unknown;
};

type ReasoningStageOutput = {
  strategyMemoryRetrieval: ReasoningStrategyMemoryRetrieval;
  strategyMemoryContext: ReasoningStrategyContext;
  strategyMemoryDecision: AgentDecisionRow;
  reasoningProposal: ReasoningProposal;
  reasoningResult: ReasoningProposalGenerationResult;
  persistedReasoningProposal: PersistedReasoningProposal;
  reasoningProposalGovernance: ReasoningProposalGovernanceResult;
  reasoningProposalDecision: AgentDecisionRow;
  reasoningEvaluation: ReasoningProposalQualityEvaluation;
  reasoningEvaluationDecision: AgentDecisionRow;
  reasoningLearningSignal: ReasoningLearningSignal;
  reasoningLearningFeedback: unknown;
};

const EXECUTION_QUEUE_SELECT_COLUMNS = [
  "id",
  "organization_id",
  "work_item_id",
  "review_id",
  "source_decision_id",
  "assigned_agent_id",
  "assigned_agent_name",
  "status",
  "priority",
  "queue_reason",
  "failure_reason",
  "next_action",
  "metadata",
  "created_at",
  "updated_at",
  "started_at",
  "completed_at",
  "lease_owner",
  "lease_until",
  "retry_count",
  "last_error",
  "failed_at",
];

export class ExecutionQueueEmptyError extends Error {
  constructor() {
    super("No ready execution queue item found");
    this.name = "ExecutionQueueEmptyError";
  }
}

export async function processNextExecutionQueueItem({
  supabase,
  organizationId,
  queueItemId = null,
}: ProcessNextExecutionQueueItemInput) {
  let claimedQueueItem: ProcessedQueueItem | null = null;
  let agentExecutionId: string | null = null;
  let failedStage: ProcessStageName | null = null;

  try {
    const claim = await claimQueueItemStage({
      supabase,
      organizationId,
      queueItemId,
    });
    if (!claim.ok) {
      if (claim.error.recoverable) {
        throw new ExecutionQueueEmptyError();
      }
      throw stageResultError(claim.error);
    }
    claimedQueueItem = claim.output.queueItem;

    const context = await buildRuntimeContextStage({
      supabase,
      organizationId,
      queueItem: claimedQueueItem,
    });
    if (!context.ok) {
      failedStage = context.stage;
      throw stageResultError(context.error);
    }
    agentExecutionId = context.output.agentExecution.id;

    const governance = await evaluateGovernanceStage({
      supabase,
      organizationId,
      context: context.output,
    });
    if (!governance.ok) {
      failedStage = governance.stage;
      throw stageResultError(governance.error);
    }

    if (governance.output.policyGovernance.blocked) {
      const failedQueueItem = await failQueueItemStage({
        supabase,
        organizationId,
        queueItem: claimedQueueItem,
        stage: "evaluateGovernanceStage",
        failureReason: governance.output.policyGovernance.policy_reason,
        terminal: true,
      });
      await completeBlockedAgentExecution({
        supabase,
        organizationId,
        agentExecutionId,
        queueItem: claimedQueueItem,
        agentName: context.output.agentName,
        policyGovernance: governance.output.policyGovernance,
        policyGovernanceDecisionId:
          governance.output.policyGovernanceDecision.id,
        idempotencyKeys: collectIdempotencyKeys([
          claim,
          context,
          governance,
          failedQueueItem,
        ]),
        processedAt: context.output.processedAt,
      });

      return {
        success: false,
        result: "policy_blocked" as const,
        queue_item: {
          ...claimedQueueItem,
          status: "failed",
          failure_reason: governance.output.policyGovernance.policy_reason,
          last_error: governance.output.policyGovernance.policy_reason,
          failed_at: failedQueueItem.ok
            ? failedQueueItem.output.queueItem.failed_at
            : context.output.processedAt,
          completed_at: context.output.processedAt,
          updated_at: context.output.processedAt,
        },
        agent_execution_id: agentExecutionId,
        agent_decision_id: governance.output.policyGovernanceDecision.id,
        policy_governance: governance.output.policyGovernance,
        idempotency_keys: collectIdempotencyKeys([
          claim,
          context,
          governance,
          failedQueueItem,
        ]),
        openai_called: false,
        processed_count: 1,
      };
    }

    const capability = await executeCapabilityStage({
      organizationId,
      context: context.output,
      governance: governance.output,
    });
    if (!capability.ok) {
      failedStage = capability.stage;
      throw stageResultError(capability.error);
    }

    const sideEffects = await applySideEffectsStage({
      supabase,
      organizationId,
      context: context.output,
      capability: capability.output,
    });
    if (!sideEffects.ok) {
      failedStage = sideEffects.stage;
      throw stageResultError(sideEffects.error);
    }

    const workGeneration = await generateWorkStage({
      supabase,
      organizationId,
      context: context.output,
      capability: capability.output,
    });
    if (!workGeneration.ok) {
      failedStage = workGeneration.stage;
      throw stageResultError(workGeneration.error);
    }

    const planning = await createExecutionPlanStage({
      supabase,
      organizationId,
      context: context.output,
      governance: governance.output,
      capability: capability.output,
      workGeneration: workGeneration.output,
    });
    if (!planning.ok) {
      failedStage = planning.stage;
      throw stageResultError(planning.error);
    }

    const translation = await translatePlanStage({
      supabase,
      organizationId,
      context: context.output,
      planning: planning.output,
    });
    if (!translation.ok) {
      failedStage = translation.stage;
      throw stageResultError(translation.error);
    }

    const agentDecision = await createCapabilityDecision({
      supabase,
      organizationId,
      queueItem: claimedQueueItem,
      assignedAgent: context.output.assignedAgent,
      agentExecutionId,
      agentName: context.output.agentName,
      capabilityExecution: capability.output.capabilityExecution,
      sideEffectsResult: sideEffects.output.sideEffectsResult,
      sideEffectsError: sideEffects.output.sideEffectsError,
      workGenerationResult: workGeneration.output.workGenerationResult,
      workGenerationError: workGeneration.output.workGenerationError,
      runtimeContextSummary: context.output.runtimeContextSummary,
      processedAt: context.output.processedAt,
      idempotencyKeys: collectIdempotencyKeys([
        claim,
        context,
        governance,
        capability,
        sideEffects,
        workGeneration,
        planning,
        translation,
      ]),
    });

    const completion = await completeQueueItemStage({
      supabase,
      organizationId,
      queueItem: claimedQueueItem,
      idempotencyKeys: collectIdempotencyKeys([
        claim,
        context,
        governance,
        capability,
        sideEffects,
        workGeneration,
        planning,
        translation,
      ]),
    });
    if (!completion.ok) {
      failedStage = completion.stage;
      throw stageResultError(completion.error);
    }

    const outcome = await evaluateOutcomeStage({
      supabase,
      organizationId,
      context: context.output,
      capability: capability.output,
      sideEffects: sideEffects.output,
      workGeneration: workGeneration.output,
      planning: planning.output,
      translation: translation.output,
      completedQueueItem: completion.output.queueItem,
    });
    if (!outcome.ok) {
      failedStage = outcome.stage;
      throw stageResultError(outcome.error);
    }

    const reasoning = await generateReasoningProposalStage({
      supabase,
      organizationId,
      context: context.output,
      governance: governance.output,
      planning: planning.output,
      completedQueueItem: completion.output.queueItem,
      outcome: outcome.output,
    });
    if (!reasoning.ok) {
      failedStage = reasoning.stage;
      throw stageResultError(reasoning.error);
    }

    await completeAgentExecution({
      supabase,
      organizationId,
      agentExecutionId,
      queueItem: completion.output.queueItem,
      decisionId: agentDecision.id,
      agentName: context.output.agentName,
      capabilityExecution: capability.output.capabilityExecution,
      sideEffectsResult: sideEffects.output.sideEffectsResult,
      sideEffectsError: sideEffects.output.sideEffectsError,
      workGenerationResult: workGeneration.output.workGenerationResult,
      workGenerationError: workGeneration.output.workGenerationError,
      planTranslationResult: translation.output.planTranslationResult,
      planTranslationError: translation.output.planTranslationError,
      executionPlan: planning.output.executionPlan,
      planDecisionId: planning.output.planDecision.id,
      policyGovernance: governance.output.policyGovernance,
      policyGovernanceDecisionId:
        governance.output.policyGovernanceDecision.id,
      outcomeEvaluation: outcome.output.outcomeEvaluation,
      persistedReasoningProposal: reasoning.output.persistedReasoningProposal,
      reasoningProposalGovernance:
        reasoning.output.reasoningProposalGovernance,
      reasoningProposalDecisionId:
        reasoning.output.reasoningProposalDecision.id,
      reasoningEvaluation: reasoning.output.reasoningEvaluation,
      reasoningEvaluationDecisionId:
        reasoning.output.reasoningEvaluationDecision.id,
      reasoningLearningSignal: reasoning.output.reasoningLearningSignal,
      strategyMemoryContext: {
        retrieval_id: reasoning.output.strategyMemoryRetrieval.retrieval_id,
        retrieval_score:
          reasoning.output.strategyMemoryRetrieval.retrieval_score,
        strategy_summary:
          reasoning.output.strategyMemoryRetrieval.strategy_summary,
        adaptation_summary:
          reasoning.output.strategyMemoryContext.adaptation_summary,
        recommended_strategies:
          reasoning.output.strategyMemoryContext.recommended_strategies,
        strategies_to_avoid:
          reasoning.output.strategyMemoryContext.strategies_to_avoid,
      },
      idempotencyKeys: collectIdempotencyKeys([
        claim,
        context,
        governance,
        capability,
        sideEffects,
        workGeneration,
        planning,
        translation,
        completion,
        outcome,
        reasoning,
      ]),
      processedAt: context.output.processedAt,
    });

    const updatedWorkItem = await updateProcessedWorkItem({
      supabase,
      organizationId,
      workItem: context.output.workItem,
      assignedAgent: context.output.assignedAgent,
      agentName: context.output.agentName,
      agentRole: context.output.agentRole,
      processedAt: context.output.processedAt,
    });

    return {
      success: true,
      result: "processed" as const,
      queue_item: completion.output.queueItem,
      agent_execution_id: agentExecutionId,
      agent_decision_id: agentDecision.id,
      work_item: updatedWorkItem,
      capability: {
        capability_id: capability.output.capabilityExecution.capability_id,
        capability_name: capability.output.capabilityExecution.capability_name,
      },
      next_action:
        capability.output.capabilityExecution.recommended_next_action,
      side_effects: sideEffects.output.sideEffectsResult,
      side_effects_error: sideEffects.output.sideEffectsError,
      work_generation: workGeneration.output.workGenerationResult,
      work_generation_error: workGeneration.output.workGenerationError,
      plan_translation: translation.output.planTranslationResult,
      plan_translation_error: translation.output.planTranslationError,
      execution_plan: planning.output.executionPlan,
      policy_governance: governance.output.policyGovernance,
      policy_governance_decision_id:
        governance.output.policyGovernanceDecision.id,
      outcome_evaluation: outcome.output.outcomeEvaluation,
      reasoning_proposal: reasoning.output.persistedReasoningProposal,
      reasoning_proposal_governance:
        reasoning.output.reasoningProposalGovernance,
      reasoning_proposal_decision_id:
        reasoning.output.reasoningProposalDecision.id,
      reasoning_evaluation: reasoning.output.reasoningEvaluation,
      reasoning_evaluation_decision_id:
        reasoning.output.reasoningEvaluationDecision.id,
      reasoning_learning_signal: reasoning.output.reasoningLearningSignal,
      strategy_memory_context: reasoning.output.strategyMemoryContext,
      outcome_feedback: outcome.output.outcomeFeedback,
      idempotency_keys: collectIdempotencyKeys([
        claim,
        context,
        governance,
        capability,
        sideEffects,
        workGeneration,
        planning,
        translation,
        completion,
        outcome,
        reasoning,
      ]),
      openai_called: false,
      processed_count: 1,
    };
  } catch (error: unknown) {
    const failureReason = getErrorMessage(error);

    if (claimedQueueItem) {
      await failQueueItemStage({
        supabase,
        organizationId,
        queueItem: claimedQueueItem,
        stage: failedStage ?? "failQueueItemStage",
        failureReason,
        terminal: true,
      });
    }

    if (agentExecutionId) {
      await markAgentExecutionFailed({
        supabase,
        organizationId,
        agentExecutionId,
        failureReason,
      });
    }

    throw error;
  }
}

export async function claimQueueItemStage({
  supabase,
  organizationId,
  queueItemId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItemId: string | null;
}): Promise<StageResult<{ queueItem: ProcessedQueueItem }>> {
  const stage = "claimQueueItemStage";
  const idempotencyKey = buildStageIdempotencyKey({
    stage,
    organizationId,
    queueItemId,
  });

  try {
    const queueItem = await claimNextQueueItem({
      supabase,
      organizationId,
      queueItemId,
      idempotencyKey,
    });

    return stageOk(stage, idempotencyKey, { queueItem });
  } catch (error: unknown) {
    return stageFailed(stage, idempotencyKey, error, {
      recoverable: error instanceof ExecutionQueueEmptyError,
      terminal: !(error instanceof ExecutionQueueEmptyError),
    });
  }
}

export async function buildRuntimeContextStage({
  supabase,
  organizationId,
  queueItem,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ProcessedQueueItem;
}): Promise<StageResult<RuntimeContextStageOutput>> {
  const stage = "buildRuntimeContextStage";
  const idempotencyKey = buildStageIdempotencyKey({
    stage,
    organizationId,
    queueItemId: queueItem.id,
  });

  try {
    const [workItem, assignedAgent] = await Promise.all([
      loadWorkItem({
        supabase,
        organizationId,
        workItemId: queueItem.work_item_id,
      }),
      loadAssignedAgent({
        supabase,
        organizationId,
        agentId: queueItem.assigned_agent_id,
        agentName: queueItem.assigned_agent_name,
      }),
    ]);
    const agentName =
      assignedAgent?.name ?? queueItem.assigned_agent_name ?? "Operations Agent";
    const agentRole = getAgentRole(assignedAgent);
    const nextAction =
      queueItem.next_action ??
      "Record controlled queue processing and wait for the next manual action.";
    const processedAt = new Date().toISOString();
    const runtimeContext = await buildAgentRuntimeContext({
      supabase,
      organizationId,
      queueItemId: queueItem.id,
      workItemId: queueItem.work_item_id,
      assignedAgentName: agentName,
    });
    const runtimeContextSummary = summarizeAgentRuntimeContext(runtimeContext);
    const agentExecution = await createAgentExecution({
      supabase,
      organizationId,
      queueItem,
      workItem,
      assignedAgent,
      agentName,
      agentRole,
      runtimeContext,
      runtimeContextSummary,
      nextAction,
      processedAt,
      idempotencyKey,
    });

    return stageOk(stage, idempotencyKey, {
      queueItem,
      workItem,
      assignedAgent,
      agentName,
      agentRole,
      nextAction,
      processedAt,
      runtimeContext,
      runtimeContextSummary,
      agentExecution,
    });
  } catch (error: unknown) {
    return stageFailed(stage, idempotencyKey, error, {
      recoverable: false,
      terminal: true,
    });
  }
}

export async function evaluateGovernanceStage({
  supabase,
  organizationId,
  context,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  context: RuntimeContextStageOutput;
}): Promise<StageResult<GovernanceStageOutput>> {
  const stage = "evaluateGovernanceStage";
  const idempotencyKey = buildStageIdempotencyKey({
    stage,
    organizationId,
    queueItemId: context.queueItem.id,
  });

  try {
    const selectedCapability = selectAgentCapability(context.runtimeContext);
    const policyGovernance = evaluatePolicyGovernance({
      organizationId,
      runtimeContext: context.runtimeContext,
      selectedCapability,
    });
    const policyGovernanceDecision = await createPolicyGovernanceDecision({
      supabase,
      organizationId,
      queueItem: context.queueItem,
      assignedAgent: context.assignedAgent,
      agentExecutionId: context.agentExecution.id,
      agentName: context.agentName,
      policyGovernance,
      processedAt: context.processedAt,
      idempotencyKey,
    });

    return stageOk(stage, idempotencyKey, {
      selectedCapability,
      policyGovernance,
      policyGovernanceDecision,
    });
  } catch (error: unknown) {
    return stageFailed(stage, idempotencyKey, error, {
      recoverable: false,
      terminal: true,
    });
  }
}

export async function executeCapabilityStage({
  organizationId,
  context,
  governance,
}: {
  organizationId: string;
  context: RuntimeContextStageOutput;
  governance: GovernanceStageOutput;
}): Promise<StageResult<CapabilityStageOutput>> {
  const stage = "executeCapabilityStage";
  const idempotencyKey = buildStageIdempotencyKey({
    stage,
    organizationId,
    queueItemId: context.queueItem.id,
  });

  try {
    const capabilityExecution = executeAgentCapability({
      organizationId,
      agentExecutionId: context.agentExecution.id,
      runtimeContext: context.runtimeContext,
      capability: governance.selectedCapability,
    });

    return stageOk(stage, idempotencyKey, { capabilityExecution });
  } catch (error: unknown) {
    return stageFailed(stage, idempotencyKey, error, {
      recoverable: false,
      terminal: true,
    });
  }
}

export async function applySideEffectsStage({
  supabase,
  organizationId,
  context,
  capability,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  context: RuntimeContextStageOutput;
  capability: CapabilityStageOutput;
}): Promise<StageResult<SideEffectsStageOutput>> {
  const stage = "applySideEffectsStage";
  const idempotencyKey = buildStageIdempotencyKey({
    stage,
    organizationId,
    queueItemId: context.queueItem.id,
  });

  try {
    const sideEffectsResult = await applyCapabilitySideEffects({
      supabase,
      organizationId,
      workItemId: context.queueItem.work_item_id,
      agentExecutionId: context.agentExecution.id,
      capabilityResult: capability.capabilityExecution,
      runtimeContext: context.runtimeContext,
      agentId: context.assignedAgent?.id ?? context.queueItem.assigned_agent_id,
      agentName: context.agentName,
      processedAt: context.processedAt,
    });

    return stageOk(stage, idempotencyKey, {
      sideEffectsResult,
      sideEffectsError: null,
    });
  } catch (error: unknown) {
    const sideEffectsError = getErrorMessage(error);
    console.error("CAPABILITY SIDE EFFECTS FAILED", {
      organizationId,
      workItemId: context.queueItem.work_item_id,
      agentExecutionId: context.agentExecution.id,
      capabilityId: capability.capabilityExecution.capability_id,
      error,
    });

    return stageOk(stage, idempotencyKey, {
      sideEffectsResult: null,
      sideEffectsError,
    });
  }
}

export async function generateWorkStage({
  supabase,
  organizationId,
  context,
  capability,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  context: RuntimeContextStageOutput;
  capability: CapabilityStageOutput;
}): Promise<StageResult<WorkGenerationStageOutput>> {
  const stage = "generateWorkStage";
  const idempotencyKey = buildStageIdempotencyKey({
    stage,
    organizationId,
    queueItemId: context.queueItem.id,
  });

  try {
    const workGenerationResult = await generateFollowUpWork({
      supabase,
      organizationId,
      parentWorkItemId: context.queueItem.work_item_id,
      agentExecutionId: context.agentExecution.id,
      capabilityId: capability.capabilityExecution.capability_id,
      capabilityResult: capability.capabilityExecution,
      runtimeContext: context.runtimeContext,
      processedAt: context.processedAt,
    });

    return stageOk(stage, idempotencyKey, {
      workGenerationResult,
      workGenerationError: null,
    });
  } catch (error: unknown) {
    const workGenerationError = getErrorMessage(error);
    console.error("WORK GENERATION FAILED", {
      organizationId,
      parentWorkItemId: context.queueItem.work_item_id,
      agentExecutionId: context.agentExecution.id,
      capabilityId: capability.capabilityExecution.capability_id,
      error,
    });

    return stageOk(stage, idempotencyKey, {
      workGenerationResult: null,
      workGenerationError,
    });
  }
}

export async function createExecutionPlanStage({
  supabase,
  organizationId,
  context,
  governance,
  capability,
  workGeneration,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  context: RuntimeContextStageOutput;
  governance: GovernanceStageOutput;
  capability: CapabilityStageOutput;
  workGeneration: WorkGenerationStageOutput;
}): Promise<StageResult<ExecutionPlanStageOutput>> {
  const stage = "createExecutionPlanStage";
  const idempotencyKey = buildStageIdempotencyKey({
    stage,
    organizationId,
    queueItemId: context.queueItem.id,
  });

  try {
    const executionPlan = buildAgentExecutionPlan({
      runtimeContext: context.runtimeContext,
      selectedCapability: governance.selectedCapability,
      capabilityResult: capability.capabilityExecution,
      continuationPolicy:
        workGeneration.workGenerationResult?.continuation_policy ?? null,
    });
    const planDecision = await createAgentExecutionPlanDecision({
      supabase,
      organizationId,
      queueItem: context.queueItem,
      assignedAgent: context.assignedAgent,
      agentExecutionId: context.agentExecution.id,
      executionPlan,
      processedAt: context.processedAt,
      idempotencyKey,
    });

    return stageOk(stage, idempotencyKey, { executionPlan, planDecision });
  } catch (error: unknown) {
    return stageFailed(stage, idempotencyKey, error, {
      recoverable: false,
      terminal: true,
    });
  }
}

export async function translatePlanStage({
  supabase,
  organizationId,
  context,
  planning,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  context: RuntimeContextStageOutput;
  planning: ExecutionPlanStageOutput;
}): Promise<StageResult<PlanTranslationStageOutput>> {
  const stage = "translatePlanStage";
  const idempotencyKey = buildStageIdempotencyKey({
    stage,
    organizationId,
    queueItemId: context.queueItem.id,
  });

  try {
    const planTranslationResult = await translateExecutionPlanToWork({
      supabase,
      organizationId,
      parentWorkItemId: context.queueItem.work_item_id,
      agentExecutionId: context.agentExecution.id,
      executionPlan: planning.executionPlan,
      runtimeContext: context.runtimeContext,
      processedAt: context.processedAt,
    });

    await createExecutionPlanTranslatedDecision({
      supabase,
      organizationId,
      queueItem: context.queueItem,
      assignedAgent: context.assignedAgent,
      agentExecutionId: context.agentExecution.id,
      executionPlan: planning.executionPlan,
      translationResult: planTranslationResult,
      processedAt: context.processedAt,
      idempotencyKey,
    });

    return stageOk(stage, idempotencyKey, {
      planTranslationResult,
      planTranslationError: null,
    });
  } catch (error: unknown) {
    const planTranslationError = getErrorMessage(error);
    console.error("PLAN TRANSLATION FAILED", {
      organizationId,
      parentWorkItemId: context.queueItem.work_item_id,
      agentExecutionId: context.agentExecution.id,
      planId: planning.executionPlan.plan_id,
      error,
    });

    return stageOk(stage, idempotencyKey, {
      planTranslationResult: null,
      planTranslationError,
    });
  }
}

export async function evaluateOutcomeStage({
  supabase,
  organizationId,
  context,
  capability,
  sideEffects,
  workGeneration,
  planning: _planning,
  translation,
  completedQueueItem,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  context: RuntimeContextStageOutput;
  capability: CapabilityStageOutput;
  sideEffects: SideEffectsStageOutput;
  workGeneration: WorkGenerationStageOutput;
  planning: ExecutionPlanStageOutput;
  translation: PlanTranslationStageOutput;
  completedQueueItem: ProcessedQueueItem;
}): Promise<StageResult<OutcomeStageOutput>> {
  const stage = "evaluateOutcomeStage";
  const idempotencyKey = buildStageIdempotencyKey({
    stage,
    organizationId,
    queueItemId: context.queueItem.id,
  });

  try {
    void _planning;
    const outcomeEvaluation = evaluateExecutionOutcome({
      organizationId,
      agentExecution: {
        id: context.agentExecution.id,
        status: "succeeded",
      },
      runtimeContext: context.runtimeContext,
      capabilityResult: capability.capabilityExecution,
      sideEffectsResult: sideEffects.sideEffectsResult,
      sideEffectsError: sideEffects.sideEffectsError,
      planTranslationResult: translation.planTranslationResult,
      planTranslationError: translation.planTranslationError,
      workGenerationResult: workGeneration.workGenerationResult,
      workGenerationError: workGeneration.workGenerationError,
      continuationPolicy:
        workGeneration.workGenerationResult?.continuation_policy ?? null,
      queueItem: completedQueueItem,
      workItem: context.workItem,
    });
    const outcomeFeedback = await persistExecutionOutcomeFeedback({
      supabase,
      organizationId,
      agentExecutionId: context.agentExecution.id,
      agentId: context.assignedAgent?.id ?? context.queueItem.assigned_agent_id,
      workItemId: context.queueItem.work_item_id,
      outcomeEvaluation,
      processedAt: context.processedAt,
    });

    return stageOk(stage, idempotencyKey, {
      outcomeEvaluation,
      outcomeFeedback,
    });
  } catch (error: unknown) {
    return stageFailed(stage, idempotencyKey, error, {
      recoverable: false,
      terminal: true,
    });
  }
}

export async function generateReasoningProposalStage({
  supabase,
  organizationId,
  context,
  governance,
  planning,
  completedQueueItem,
  outcome,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  context: RuntimeContextStageOutput;
  governance: GovernanceStageOutput;
  planning: ExecutionPlanStageOutput;
  completedQueueItem: ProcessedQueueItem;
  outcome: OutcomeStageOutput;
}): Promise<StageResult<ReasoningStageOutput>> {
  const stage = "generateReasoningProposalStage";
  const idempotencyKey = buildStageIdempotencyKey({
    stage,
    organizationId,
    queueItemId: context.queueItem.id,
  });

  try {
    const priorityResult = extractPriorityDecision(completedQueueItem);
    const capabilityId = planning.executionPlan.capability_id;
    const strategyMemoryRetrieval = await retrieveReasoningStrategyMemory({
      supabase,
      organizationId,
      runtimeContext: context.runtimeContext,
      agentName: context.agentName,
      capabilityId,
    });
    const strategyMemoryContext = buildReasoningStrategyContext({
      retrievedMemory: strategyMemoryRetrieval,
      runtimeContext: context.runtimeContext,
      governanceResult: governance.policyGovernance,
    });
    const strategyMemoryDecision =
      await persistStrategyMemoryRetrievedDecision({
        supabase,
        organizationId,
        agentExecutionId: context.agentExecution.id,
        agentId:
          context.assignedAgent?.id ?? context.queueItem.assigned_agent_id,
        workItemId: context.queueItem.work_item_id,
        retrievedMemory: strategyMemoryRetrieval,
        strategyContext: strategyMemoryContext,
        processedAt: context.processedAt,
      });
    const reasoningInput = {
      runtimeContext: context.runtimeContext,
      governanceResult: governance.policyGovernance,
      priorityResult,
      outcomeEvaluation: outcome.outcomeEvaluation,
      executionPlan: planning.executionPlan,
      strategyContext: strategyMemoryContext,
    };
    const deterministicResult = await generateReasoningProposalWithMetadata({
      ...reasoningInput,
      provider: new DeterministicMockReasoningProvider(),
    });
    const reasoningResult = await generateReasoningProposalWithMetadata(
      reasoningInput
    );
    const reasoningProposalGovernance = evaluateReasoningProposal({
      proposal: reasoningResult.proposal,
      governanceResult: governance.policyGovernance,
    });
    const persistedReasoningProposal = buildPersistedReasoningProposal({
      reasoningResult,
      proposalGovernance: reasoningProposalGovernance,
    });
    const reasoningProposalDecision = await persistReasoningProposalDecision({
      supabase,
      organizationId,
      agentExecutionId: context.agentExecution.id,
      agentId: context.assignedAgent?.id ?? context.queueItem.assigned_agent_id,
      workItemId: context.queueItem.work_item_id,
      reasoningResult,
      proposalGovernance: reasoningProposalGovernance,
      processedAt: context.processedAt,
    });
    const reasoningEvaluation = evaluateReasoningProposalQuality({
      runtimeContext: context.runtimeContext,
      deterministicProposal: deterministicResult.proposal,
      llmProposal:
        reasoningResult.provider === "openai" ? reasoningResult.proposal : null,
      governanceResult: governance.policyGovernance,
      outcomeEvaluation: outcome.outcomeEvaluation,
    });
    const reasoningEvaluationDecision =
      await persistReasoningEvaluationDecision({
        supabase,
        organizationId,
        agentExecutionId: context.agentExecution.id,
        agentId:
          context.assignedAgent?.id ?? context.queueItem.assigned_agent_id,
        workItemId: context.queueItem.work_item_id,
        evaluation: reasoningEvaluation,
        runtimeContext: context.runtimeContext,
        reasoningProposal: reasoningResult.proposal,
        executionPlan: planning.executionPlan,
        processedAt: context.processedAt,
      });
    const reasoningLearningSignal = deriveReasoningLearningSignal({
      reasoningProposal: reasoningResult.proposal,
      reasoningEvaluation,
      outcomeEvaluation: outcome.outcomeEvaluation,
      humanReviewContext: context.runtimeContext.human_review_context,
      executionPlan: planning.executionPlan,
      runtimeContext: context.runtimeContext,
    });
    const reasoningLearningFeedback = await persistReasoningLearningSignal({
      supabase,
      organizationId,
      agentExecutionId: context.agentExecution.id,
      agentId: context.assignedAgent?.id ?? context.queueItem.assigned_agent_id,
      workItemId: context.queueItem.work_item_id,
      learningSignal: reasoningLearningSignal,
      runtimeContext: context.runtimeContext,
      reasoningProposal: reasoningResult.proposal,
      reasoningEvaluation,
      outcomeEvaluation: outcome.outcomeEvaluation,
      executionPlan: planning.executionPlan,
      processedAt: context.processedAt,
    });

    return stageOk(stage, idempotencyKey, {
      strategyMemoryRetrieval,
      strategyMemoryContext,
      strategyMemoryDecision,
      reasoningProposal: reasoningResult.proposal,
      reasoningResult,
      persistedReasoningProposal,
      reasoningProposalGovernance,
      reasoningProposalDecision,
      reasoningEvaluation,
      reasoningEvaluationDecision,
      reasoningLearningSignal,
      reasoningLearningFeedback,
    });
  } catch (error: unknown) {
    return stageFailed(stage, idempotencyKey, error, {
      recoverable: false,
      terminal: true,
    });
  }
}

export async function completeQueueItemStage({
  supabase,
  organizationId,
  queueItem,
  idempotencyKeys,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ProcessedQueueItem;
  idempotencyKeys: Record<string, string>;
}): Promise<StageResult<{ queueItem: ProcessedQueueItem }>> {
  const stage = "completeQueueItemStage";
  const idempotencyKey = buildStageIdempotencyKey({
    stage,
    organizationId,
    queueItemId: queueItem.id,
  });

  try {
    const completedQueueItem = await markQueueItemCompleted({
      supabase,
      organizationId,
      queueItem,
      completedAt: new Date().toISOString(),
      idempotencyKeys: {
        ...idempotencyKeys,
        queue_completion_key: idempotencyKey,
      },
    });

    return stageOk(stage, idempotencyKey, { queueItem: completedQueueItem });
  } catch (error: unknown) {
    return stageFailed(stage, idempotencyKey, error, {
      recoverable: false,
      terminal: true,
    });
  }
}

export async function failQueueItemStage({
  supabase,
  organizationId,
  queueItem,
  stage: failedStage,
  failureReason,
  terminal,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ProcessedQueueItem;
  stage: ProcessStageName;
  failureReason: string;
  terminal: boolean;
}): Promise<StageResult<{ queueItem: ProcessedQueueItem }>> {
  const stage = "failQueueItemStage";
  const idempotencyKey = buildStageIdempotencyKey({
    stage,
    organizationId,
    queueItemId: queueItem.id,
  });

  try {
    const failedQueueItem = await markQueueItemFailed({
      supabase,
      organizationId,
      queueItem,
      failedStage,
      failureReason,
      terminal,
      idempotencyKey,
    });

    return stageOk(stage, idempotencyKey, { queueItem: failedQueueItem });
  } catch (error: unknown) {
    return stageFailed(stage, idempotencyKey, error, {
      recoverable: false,
      terminal: true,
    });
  }
}

async function claimNextQueueItem({
  supabase,
  organizationId,
  queueItemId,
  idempotencyKey,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItemId: string | null;
  idempotencyKey: string;
}) {
  const candidate = await findReadyQueueItem({
    supabase,
    organizationId,
    queueItemId,
  });

  if (!candidate) {
    throw new ExecutionQueueEmptyError();
  }

  const startedAt = new Date().toISOString();
  const leaseUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const leaseOwner = `queue-orchestrator:${organizationId}`;
  const query = supabase
    .from("execution_queue")
    .update({
      status: "in_progress",
      started_at: startedAt,
      updated_at: startedAt,
      failure_reason: null,
      last_error: null,
      failed_at: null,
      lease_owner: leaseOwner,
      lease_until: leaseUntil,
      retry_count: candidate.retry_count ?? 0,
      metadata: {
        ...(candidate.metadata ?? {}),
        queue_claim_key: idempotencyKey,
        runtime_hardening: {
          ...getMetadataRecord(
            candidate.metadata ?? {},
            "runtime_hardening"
          ),
          queue_claim_key: idempotencyKey,
          claimed_at: startedAt,
          lease_owner: leaseOwner,
          lease_until: leaseUntil,
        },
      },
    })
    .eq("id", candidate.id)
    .eq("organization_id", organizationId)
    .eq("status", "ready");

  const { data, error } = await query
    .select(EXECUTION_QUEUE_SELECT_COLUMNS.join(", "))
    .maybeSingle<ProcessedQueueItem>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ExecutionQueueEmptyError();
  }

  return data;
}

async function findReadyQueueItem({
  supabase,
  organizationId,
  queueItemId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItemId: string | null;
}) {
  let query = supabase
    .from("execution_queue")
    .select(EXECUTION_QUEUE_SELECT_COLUMNS.join(", "))
    .eq("organization_id", organizationId)
    .eq("status", "ready");

  if (queueItemId) {
    query = query.eq("id", queueItemId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: true })
    .limit(queueItemId ? 1 : 25);

  if (error) {
    throw error;
  }

  const candidates = (data ?? []) as unknown as ProcessedQueueItem[];
  const prioritizedCandidates = await Promise.all(
    candidates.map(async (candidate) => {
      const priorityResult = await evaluateAndPersistWorkPriority({
        supabase,
        organizationId,
        queueItem: candidate,
      });

      return priorityResult.queue_item as ProcessedQueueItem;
    })
  );

  const sortedCandidates = prioritizedCandidates
    .filter((candidate) => !isBlockedPriority(candidate))
    .sort(compareQueueItemsByPriority);

  return sortedCandidates[0] ?? null;
}

async function loadWorkItem({
  supabase,
  organizationId,
  workItemId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
}) {
  const { data, error } = await supabase
    .from("work_items")
    .select(
      [
        "id",
        "type",
        "status",
        "owner_type",
        "owner_agent_id",
        "owner_agent_name",
        "owner_agent_role",
        "ownership_status",
        "last_owner_change_reason",
      ].join(", ")
    )
    .eq("id", workItemId)
    .eq("organization_id", organizationId)
    .maybeSingle<WorkItemRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Work item not found for execution queue item");
  }

  return data;
}

async function loadAssignedAgent({
  supabase,
  organizationId,
  agentId,
  agentName,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  agentId: string | null;
  agentName: string | null;
}) {
  if (agentId) {
    const { data, error } = await supabase
      .from("agents")
      .select("id, key, name, description, config")
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .maybeSingle<AgentRow>();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }
  }

  if (!agentName) {
    return null;
  }

  const { data, error } = await supabase
    .from("agents")
    .select("id, key, name, description, config")
    .eq("name", agentName)
    .eq("organization_id", organizationId)
    .maybeSingle<AgentRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function createAgentExecution({
  supabase,
  organizationId,
  queueItem,
  workItem,
  assignedAgent,
  agentName,
  agentRole,
  runtimeContext,
  runtimeContextSummary,
  nextAction,
  processedAt,
  idempotencyKey,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ProcessedQueueItem;
  workItem: WorkItemRow;
  assignedAgent: AgentRow | null;
  agentName: string;
  agentRole: string | null;
  runtimeContext: AgentRuntimeContext;
  runtimeContextSummary: ReturnType<typeof summarizeAgentRuntimeContext>;
  nextAction: string;
  processedAt: string;
  idempotencyKey: string;
}) {
  const { data, error } = await supabase
    .from("agent_executions")
    .insert({
      organization_id: organizationId,
      agent_id: assignedAgent?.id ?? queueItem.assigned_agent_id,
      agent_name: agentName,
      agent_role: agentRole,
      work_item_id: queueItem.work_item_id,
      status: "running",
      input: {
        source: "execution_queue",
        queue_item_id: queueItem.id,
        work_item_id: queueItem.work_item_id,
        review_id: queueItem.review_id,
        source_decision_id: queueItem.source_decision_id,
        next_action: nextAction,
        runtime_context_version: AGENT_RUNTIME_CONTEXT_VERSION,
        runtime_context: runtimeContext,
        runtime_context_summary: runtimeContextSummary,
      },
      metadata: {
        source: "queue_orchestrator",
        phase: 21,
        queue_item_id: queueItem.id,
        work_item_id: queueItem.work_item_id,
        assigned_agent_name: agentName,
        agent_identity: buildAgentIdentityMetadata(assignedAgent, agentName),
        previous_work_item_status: workItem.status,
        previous_ownership_status: workItem.ownership_status,
        runtime_context_version: AGENT_RUNTIME_CONTEXT_VERSION,
        runtime_context_key: idempotencyKey,
        openai_called: false,
      },
      started_at: processedAt,
      created_at: processedAt,
      updated_at: processedAt,
    })
    .select("id, status")
    .single<AgentExecutionRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function createCapabilityDecision({
  supabase,
  organizationId,
  queueItem,
  assignedAgent,
  agentExecutionId,
  agentName,
  capabilityExecution,
  sideEffectsResult,
  sideEffectsError,
  workGenerationResult,
  workGenerationError,
  runtimeContextSummary,
  processedAt,
  idempotencyKeys,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ProcessedQueueItem;
  assignedAgent: AgentRow | null;
  agentExecutionId: string;
  agentName: string;
  capabilityExecution: AgentCapabilityExecutionResult;
  sideEffectsResult: CapabilitySideEffectsResult | null;
  sideEffectsError: string | null;
  workGenerationResult: WorkGenerationResult | null;
  workGenerationError: string | null;
  runtimeContextSummary: ReturnType<typeof summarizeAgentRuntimeContext>;
  processedAt: string;
  idempotencyKeys?: Record<string, string>;
}) {
  const decision = {
    queue_item_id: queueItem.id,
    work_item_id: queueItem.work_item_id,
    assigned_agent_name: agentName,
    capability_id: capabilityExecution.capability_id,
    capability_name: capabilityExecution.capability_name,
    result: capabilityExecution.result,
    recommended_next_action:
      capabilityExecution.recommended_next_action,
    created_tasks: capabilityExecution.created_tasks ?? [],
    created_decisions: capabilityExecution.created_decisions ?? [],
    side_effects_result: sideEffectsResult,
    side_effects_error: sideEffectsError,
    work_generation_result: workGenerationResult,
    work_generation_error: workGenerationError,
    runtime_context_summary: runtimeContextSummary,
    processed_at: processedAt,
  };

  const { data, error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: agentExecutionId,
      agent_id: assignedAgent?.id ?? queueItem.assigned_agent_id,
      work_item_id: queueItem.work_item_id,
      decision_type: "capability_executed",
      decision: {
        outcome: decision,
      },
      rationale: `${agentName} executed ${capabilityExecution.capability_id}.`,
      confidence: 1,
      metadata: {
        source: "queue_orchestrator",
        phase: 21,
        ...decision,
        agent_identity: buildAgentIdentityMetadata(assignedAgent, agentName),
        runtime_context_version: AGENT_RUNTIME_CONTEXT_VERSION,
        idempotency_keys: idempotencyKeys ?? null,
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

async function createPolicyGovernanceDecision({
  supabase,
  organizationId,
  queueItem,
  assignedAgent,
  agentExecutionId,
  agentName,
  policyGovernance,
  processedAt,
  idempotencyKey,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ProcessedQueueItem;
  assignedAgent: AgentRow | null;
  agentExecutionId: string;
  agentName: string;
  policyGovernance: PolicyGovernanceDecision;
  processedAt: string;
  idempotencyKey: string;
}) {
  const outcome = {
    queue_item_id: queueItem.id,
    work_item_id: queueItem.work_item_id,
    assigned_agent_name: agentName,
    allowed: policyGovernance.allowed,
    blocked: policyGovernance.blocked,
    human_review_required: policyGovernance.human_review_required,
    escalation_required: policyGovernance.escalation_required,
    autonomy_level: policyGovernance.autonomy_level,
    risk_level: policyGovernance.risk_level,
    policy_reason: policyGovernance.policy_reason,
    policy_checks: policyGovernance.policy_checks,
    processed_at: processedAt,
  };

  const { data, error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: agentExecutionId,
      agent_id: assignedAgent?.id ?? queueItem.assigned_agent_id,
      work_item_id: queueItem.work_item_id,
      decision_type: "policy_governance_evaluated",
      decision: {
        outcome,
      },
      rationale: policyGovernance.policy_reason,
      confidence: 1,
      metadata: {
        source: "policy_governance",
        phase: 30,
        ...outcome,
        agent_identity: buildAgentIdentityMetadata(assignedAgent, agentName),
        governance_key: idempotencyKey,
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

async function createAgentExecutionPlanDecision({
  supabase,
  organizationId,
  queueItem,
  assignedAgent,
  agentExecutionId,
  executionPlan,
  processedAt,
  idempotencyKey,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ProcessedQueueItem;
  assignedAgent: AgentRow | null;
  agentExecutionId: string;
  executionPlan: AgentExecutionPlan;
  processedAt: string;
  idempotencyKey: string;
}) {
  const outcome = {
    plan_id: executionPlan.plan_id,
    agent_name: executionPlan.agent_name,
    capability_id: executionPlan.capability_id,
    step_count: executionPlan.steps.length,
    risk_level: executionPlan.risk_level,
    requires_human_review: executionPlan.requires_human_review,
    recommended_next_step: executionPlan.recommended_next_step,
  };

  const { data, error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: agentExecutionId,
      agent_id: assignedAgent?.id ?? queueItem.assigned_agent_id,
      work_item_id: queueItem.work_item_id,
      decision_type: "agent_execution_plan_created",
      decision: {
        outcome,
      },
      rationale: `${executionPlan.agent_name} created a ${executionPlan.steps.length}-step execution plan.`,
      confidence: 1,
      metadata: {
        source: "agent_planning",
        phase: 26,
        queue_item_id: queueItem.id,
        work_item_id: queueItem.work_item_id,
        ...outcome,
        execution_plan: executionPlan,
        agent_identity: buildAgentIdentityMetadata(
          assignedAgent,
          executionPlan.agent_name
        ),
        planning_key: idempotencyKey,
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

async function createExecutionPlanTranslatedDecision({
  supabase,
  organizationId,
  queueItem,
  assignedAgent,
  agentExecutionId,
  executionPlan,
  translationResult,
  processedAt,
  idempotencyKey,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ProcessedQueueItem;
  assignedAgent: AgentRow | null;
  agentExecutionId: string;
  executionPlan: AgentExecutionPlan;
  translationResult: PlanTranslationResult;
  processedAt: string;
  idempotencyKey: string;
}) {
  const outcome = {
    plan_id: executionPlan.plan_id,
    created_task_ids: translationResult.created_tasks,
    created_work_item_ids: translationResult.created_work_items,
    created_queue_item_ids: translationResult.created_queue_items,
    skipped_steps: translationResult.skipped_steps,
    skipped_duplicates: translationResult.skipped_duplicates,
    translated_step_count: translationResult.created_tasks.length,
    processed_at: processedAt,
  };

  const { data, error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: agentExecutionId,
      agent_id: assignedAgent?.id ?? queueItem.assigned_agent_id,
      work_item_id: queueItem.work_item_id,
      decision_type: "execution_plan_translated",
      decision: {
        outcome,
      },
      rationale: `${executionPlan.agent_name} translated ${translationResult.created_tasks.length} plan steps into internal work.`,
      confidence: 1,
      metadata: {
        source: "plan_translation",
        phase: 27,
        queue_item_id: queueItem.id,
        work_item_id: queueItem.work_item_id,
        agent_name: executionPlan.agent_name,
        capability_id: executionPlan.capability_id,
        ...outcome,
        agent_identity: buildAgentIdentityMetadata(
          assignedAgent,
          executionPlan.agent_name
        ),
        plan_translation_key: idempotencyKey,
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

async function completeAgentExecution({
  supabase,
  organizationId,
  agentExecutionId,
  queueItem,
  decisionId,
  agentName,
  capabilityExecution,
  sideEffectsResult,
  sideEffectsError,
  workGenerationResult,
  workGenerationError,
  planTranslationResult,
  planTranslationError,
  executionPlan,
  planDecisionId,
  policyGovernance,
  policyGovernanceDecisionId,
  outcomeEvaluation,
  persistedReasoningProposal,
  reasoningProposalGovernance,
  reasoningProposalDecisionId,
  reasoningEvaluation,
  reasoningEvaluationDecisionId,
  reasoningLearningSignal,
  strategyMemoryContext,
  idempotencyKeys,
  processedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  agentExecutionId: string;
  queueItem: ProcessedQueueItem;
  decisionId: string;
  agentName: string;
  capabilityExecution: AgentCapabilityExecutionResult;
  sideEffectsResult: CapabilitySideEffectsResult | null;
  sideEffectsError: string | null;
  workGenerationResult: WorkGenerationResult | null;
  workGenerationError: string | null;
  planTranslationResult: PlanTranslationResult | null;
  planTranslationError: string | null;
  executionPlan: AgentExecutionPlan;
  planDecisionId: string;
  policyGovernance: PolicyGovernanceDecision;
  policyGovernanceDecisionId: string;
  outcomeEvaluation: ExecutionOutcomeEvaluation;
  persistedReasoningProposal: PersistedReasoningProposal;
  reasoningProposalGovernance: ReasoningProposalGovernanceResult;
  reasoningProposalDecisionId: string;
  reasoningEvaluation: ReasoningProposalQualityEvaluation;
  reasoningEvaluationDecisionId: string;
  reasoningLearningSignal: ReasoningLearningSignal;
  strategyMemoryContext: {
    retrieval_id: string;
    retrieval_score: number;
    strategy_summary: string;
    adaptation_summary: string;
    recommended_strategies: string[];
    strategies_to_avoid: string[];
  };
  idempotencyKeys: Record<string, string>;
  processedAt: string;
}) {
  const { error } = await supabase
    .from("agent_executions")
    .update({
      status: "succeeded",
      output: {
        result: "capability_executed",
        queue_item_id: queueItem.id,
        work_item_id: queueItem.work_item_id,
        agent_decision_id: decisionId,
        agent_execution_plan_decision_id: planDecisionId,
        assigned_agent_name: agentName,
        capability_id: capabilityExecution.capability_id,
        capability_name: capabilityExecution.capability_name,
        capability_result: capabilityExecution.result,
        recommended_next_action:
          capabilityExecution.recommended_next_action,
        created_tasks: capabilityExecution.created_tasks ?? [],
        created_decisions: capabilityExecution.created_decisions ?? [],
        side_effects_result: sideEffectsResult,
        side_effects_error: sideEffectsError,
        work_generation_result: workGenerationResult,
        work_generation_error: workGenerationError,
        plan_translation_result: planTranslationResult,
        plan_translation_error: planTranslationError,
        execution_plan: executionPlan,
        policy_governance: policyGovernance,
        policy_governance_decision_id: policyGovernanceDecisionId,
        outcome_evaluation: outcomeEvaluation,
        reasoning_proposal: persistedReasoningProposal,
        reasoning_proposal_governance: reasoningProposalGovernance,
        reasoning_proposal_decision_id: reasoningProposalDecisionId,
        reasoning_evaluation: reasoningEvaluation,
        reasoning_evaluation_decision_id: reasoningEvaluationDecisionId,
        reasoning_learning_signal: reasoningLearningSignal,
        strategy_memory_context: strategyMemoryContext,
        idempotency_keys: idempotencyKeys,
      },
      completed_at: processedAt,
      updated_at: processedAt,
    })
    .eq("id", agentExecutionId)
    .eq("organization_id", organizationId);

  if (error) {
    throw error;
  }
}

async function completeBlockedAgentExecution({
  supabase,
  organizationId,
  agentExecutionId,
  queueItem,
  agentName,
  policyGovernance,
  policyGovernanceDecisionId,
  idempotencyKeys,
  processedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  agentExecutionId: string;
  queueItem: ProcessedQueueItem;
  agentName: string;
  policyGovernance: PolicyGovernanceDecision;
  policyGovernanceDecisionId: string;
  idempotencyKeys: Record<string, string>;
  processedAt: string;
}) {
  const { error } = await supabase
    .from("agent_executions")
    .update({
      status: "failed",
      output: {
        result: "policy_blocked",
        queue_item_id: queueItem.id,
        work_item_id: queueItem.work_item_id,
        assigned_agent_name: agentName,
        policy_governance: policyGovernance,
        policy_governance_decision_id: policyGovernanceDecisionId,
        capability_executed: false,
        idempotency_keys: idempotencyKeys,
      },
      error: {
        message: policyGovernance.policy_reason,
      },
      completed_at: processedAt,
      updated_at: processedAt,
    })
    .eq("id", agentExecutionId)
    .eq("organization_id", organizationId);

  if (error) {
    throw error;
  }
}

async function markQueueItemCompleted({
  supabase,
  organizationId,
  queueItem,
  completedAt,
  idempotencyKeys,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ProcessedQueueItem;
  completedAt: string;
  idempotencyKeys: Record<string, string>;
}) {
  const { data, error } = await supabase
    .from("execution_queue")
    .update({
      status: "completed",
      completed_at: completedAt,
      updated_at: completedAt,
      failure_reason: null,
      last_error: null,
      lease_until: null,
      metadata: {
        ...(queueItem.metadata ?? {}),
        ...idempotencyKeys,
        runtime_hardening: {
          ...getMetadataRecord(queueItem.metadata ?? {}, "runtime_hardening"),
          ...idempotencyKeys,
          completed_at: completedAt,
        },
      },
    })
    .eq("id", queueItem.id)
    .eq("organization_id", organizationId)
    .select(EXECUTION_QUEUE_SELECT_COLUMNS.join(", "))
    .single<ProcessedQueueItem>();

  if (error) {
    throw error;
  }

  return data;
}

async function updateProcessedWorkItem({
  supabase,
  organizationId,
  workItem,
  assignedAgent,
  agentName,
  agentRole,
  processedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItem: WorkItemRow;
  assignedAgent: AgentRow | null;
  agentName: string;
  agentRole: string | null;
  processedAt: string;
}) {
  const completed = workItem.status === "completed";
  const { data, error } = await supabase
    .from("work_items")
    .update({
      status: completed ? "completed" : "in_progress",
      owner_type: "ai",
      owner_agent_id: assignedAgent?.id ?? workItem.owner_agent_id,
      owner_agent_name: agentName,
      owner_agent_role: agentRole ?? workItem.owner_agent_role,
      ownership_status: completed ? "completed" : "active",
      last_owner_change_at: processedAt,
      last_owner_change_reason:
        "execution queue item processed by queue orchestrator",
      updated_at: processedAt,
    })
    .eq("id", workItem.id)
    .eq("organization_id", organizationId)
    .select(
      [
        "id",
        "status",
        "owner_type",
        "owner_agent_id",
        "owner_agent_name",
        "owner_agent_role",
        "ownership_status",
      ].join(", ")
    )
    .single<WorkItemRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function markQueueItemFailed({
  supabase,
  organizationId,
  queueItem,
  failedStage,
  failureReason,
  terminal,
  idempotencyKey,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ProcessedQueueItem;
  failedStage: ProcessStageName;
  failureReason: string;
  terminal: boolean;
  idempotencyKey: string;
}) {
  const failedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("execution_queue")
    .update({
      status: "failed",
      failure_reason: failureReason,
      last_error: failureReason,
      failed_at: failedAt,
      completed_at: failedAt,
      updated_at: failedAt,
      lease_until: null,
      metadata: {
        ...(queueItem.metadata ?? {}),
        failed_stage: failedStage,
        terminal_error: terminal,
        queue_failure_key: idempotencyKey,
        runtime_hardening: {
          ...getMetadataRecord(queueItem.metadata ?? {}, "runtime_hardening"),
          failed_stage: failedStage,
          last_error: failureReason,
          terminal_error: terminal,
          queue_failure_key: idempotencyKey,
          failed_at: failedAt,
        },
      },
    })
    .eq("id", queueItem.id)
    .eq("organization_id", organizationId)
    .select(EXECUTION_QUEUE_SELECT_COLUMNS.join(", "))
    .maybeSingle<ProcessedQueueItem>();

  if (error) {
    console.error("QUEUE ORCHESTRATOR FAILED TO MARK QUEUE ITEM FAILED", {
      queueItemId: queueItem.id,
      organizationId,
      error,
    });
  }

  return (
    data ?? {
      ...queueItem,
      status: "failed",
      failure_reason: failureReason,
      last_error: failureReason,
      failed_at: failedAt,
      completed_at: failedAt,
      updated_at: failedAt,
    }
  );
}

async function markAgentExecutionFailed({
  supabase,
  organizationId,
  agentExecutionId,
  failureReason,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  agentExecutionId: string;
  failureReason: string;
}) {
  const failedAt = new Date().toISOString();
  const { error } = await supabase
    .from("agent_executions")
    .update({
      status: "failed",
      error: {
        message: failureReason,
      },
      completed_at: failedAt,
      updated_at: failedAt,
    })
    .eq("id", agentExecutionId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("QUEUE ORCHESTRATOR FAILED TO MARK EXECUTION FAILED", {
      agentExecutionId,
      organizationId,
      error,
    });
  }
}

function buildAgentIdentityMetadata(
  assignedAgent: AgentRow | null,
  agentName: string
) {
  return {
    agent_id: assignedAgent?.id ?? null,
    agent_key: assignedAgent?.key ?? null,
    agent_name: agentName,
    agent_role: getAgentRole(assignedAgent),
    description: assignedAgent?.description ?? null,
  };
}

function getAgentRole(agent: AgentRow | null) {
  const role = agent?.config?.role;

  return typeof role === "string" ? role : null;
}

function extractPriorityDecision(
  queueItem: ProcessedQueueItem
): WorkPriorityDecision | null {
  const metadata = queueItem.metadata ?? {};
  const priorityScore = getMetadataNumber(metadata, "priority_score");
  const urgencyScore = getMetadataNumber(metadata, "urgency_score");
  const businessImpactScore = getMetadataNumber(
    metadata,
    "business_impact_score"
  );
  const riskScore = getMetadataNumber(metadata, "risk_score");
  const schedulingBucket = metadata.scheduling_bucket;
  const recommendedExecutionOrder = getMetadataNumber(
    metadata,
    "recommended_execution_order"
  );
  const rationale = metadata.priority_rationale;
  const signals = metadata.priority_signals;

  if (
    priorityScore === null ||
    urgencyScore === null ||
    businessImpactScore === null ||
    riskScore === null ||
    !(
      schedulingBucket === "now" ||
      schedulingBucket === "next" ||
      schedulingBucket === "later" ||
      schedulingBucket === "blocked"
    ) ||
    recommendedExecutionOrder === null ||
    typeof rationale !== "string" ||
    !Array.isArray(signals)
  ) {
    return null;
  }

  return {
    priority_score: priorityScore,
    urgency_score: urgencyScore,
    business_impact_score: businessImpactScore,
    risk_score: riskScore,
    scheduling_bucket: schedulingBucket,
    recommended_execution_order: recommendedExecutionOrder,
    rationale,
    signals: signals as WorkPriorityDecision["signals"],
  };
}

function stageOk<T>(
  stage: ProcessStageName,
  idempotencyKey: string,
  output: T
): StageResult<T> {
  return {
    ok: true,
    stage,
    idempotency_key: idempotencyKey,
    output,
  };
}

function stageFailed<T>(
  stage: ProcessStageName,
  idempotencyKey: string,
  error: unknown,
  semantics: Pick<StageFailure, "recoverable" | "terminal">
): StageResult<T> {
  return {
    ok: false,
    stage,
    idempotency_key: idempotencyKey,
    error: {
      stage,
      message: getErrorMessage(error),
      recoverable: semantics.recoverable,
      terminal: semantics.terminal,
    },
  };
}

function stageResultError(error: StageFailure) {
  const result = new Error(error.message);
  result.name = "ExecutionQueueStageError";

  return result;
}

function buildStageIdempotencyKey({
  stage,
  organizationId,
  queueItemId,
}: {
  stage: ProcessStageName;
  organizationId: string;
  queueItemId: string | null;
}) {
  return `${stage}:${organizationId}:${queueItemId ?? "next"}`;
}

function collectIdempotencyKeys(
  stages: Array<StageResult<unknown>>
): Record<string, string> {
  return stages.reduce<Record<string, string>>((keys, stage) => {
    keys[getIdempotencyMetadataKey(stage.stage)] = stage.idempotency_key;
    return keys;
  }, {});
}

function getIdempotencyMetadataKey(stage: ProcessStageName) {
  const keys: Record<ProcessStageName, string> = {
    claimQueueItemStage: "queue_claim_key",
    buildRuntimeContextStage: "runtime_context_key",
    evaluateGovernanceStage: "governance_key",
    executeCapabilityStage: "capability_execution_key",
    applySideEffectsStage: "side_effects_key",
    generateWorkStage: "work_generation_key",
    createExecutionPlanStage: "planning_key",
    translatePlanStage: "plan_translation_key",
    evaluateOutcomeStage: "outcome_key",
    generateReasoningProposalStage: "reasoning_key",
    completeQueueItemStage: "queue_completion_key",
    failQueueItemStage: "queue_failure_key",
  };

  return keys[stage];
}

function getMetadataRecord(
  metadata: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const value = metadata[key];

  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getMetadataNumber(
  metadata: Record<string, unknown>,
  key: string
) {
  const value = metadata[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Queue orchestrator processing failed";
}
