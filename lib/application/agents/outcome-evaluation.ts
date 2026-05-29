import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgentCapabilityExecutionResult } from "@/lib/application/agents/agent-capabilities";
import type { AgentRuntimeContext } from "@/lib/application/agents/build-agent-runtime-context";
import type { ContinuationPolicyDecision } from "@/lib/application/agents/continuation-policy";
import type { PlanTranslationResult } from "@/lib/application/agents/plan-translation";
import type { CapabilitySideEffectsResult } from "@/lib/application/agents/capability-side-effects";
import type { WorkGenerationResult } from "@/lib/application/agents/work-generation";
import type { WorkPriorityDecision } from "@/lib/application/execution-queue/priority-scheduling";

export type OutcomeStatus =
  | "successful"
  | "partial"
  | "failed"
  | "blocked"
  | "needs_review";

export type OutcomeFailureCategory =
  | null
  | "missing_context"
  | "side_effect_failed"
  | "work_generation_failed"
  | "policy_blocked"
  | "human_review_required"
  | "unknown";

export type OutcomeEvaluationSignal = {
  signal: string;
  severity: "positive" | "info" | "warning" | "critical";
  reason: string;
};

export type ExecutionOutcomeEvaluation = {
  success_score: number;
  outcome_status: OutcomeStatus;
  failure_category: OutcomeFailureCategory;
  retry_recommended: boolean;
  escalation_recommended: boolean;
  feedback_summary: string;
  signals: OutcomeEvaluationSignal[];
};

type AgentExecutionLike = {
  id: string;
  status?: string | null;
  output?: Record<string, unknown> | null;
  error?: unknown;
};

type QueueItemLike = {
  id?: string | null;
  status?: string | null;
  failure_reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

type WorkItemLike = {
  id?: string | null;
  ownership_status?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type EvaluateExecutionOutcomeInput = {
  organizationId: string;
  agentExecution: AgentExecutionLike;
  runtimeContext: AgentRuntimeContext;
  capabilityResult: AgentCapabilityExecutionResult | null;
  sideEffectsResult: CapabilitySideEffectsResult | null;
  sideEffectsError?: string | null;
  planTranslationResult: PlanTranslationResult | null;
  planTranslationError?: string | null;
  workGenerationResult: WorkGenerationResult | null;
  workGenerationError?: string | null;
  priorityResult?: WorkPriorityDecision | null;
  continuationPolicy?: ContinuationPolicyDecision | null;
  queueItem?: QueueItemLike | null;
  workItem?: WorkItemLike | null;
};

export type PersistExecutionOutcomeInput = {
  supabase: SupabaseClient;
  organizationId: string;
  agentExecutionId: string;
  agentId?: string | null;
  workItemId?: string | null;
  outcomeEvaluation: ExecutionOutcomeEvaluation;
  processedAt?: string;
};

type AgentDecisionRow = {
  id: string;
};

type MemoryEntryRow = {
  id: string;
};

export function evaluateExecutionOutcome({
  organizationId,
  agentExecution,
  runtimeContext,
  capabilityResult,
  sideEffectsResult,
  sideEffectsError = null,
  planTranslationResult,
  planTranslationError = null,
  workGenerationResult,
  workGenerationError = null,
  priorityResult = null,
  continuationPolicy = null,
  queueItem = null,
  workItem = null,
}: EvaluateExecutionOutcomeInput): ExecutionOutcomeEvaluation {
  const signals: OutcomeEvaluationSignal[] = [];
  const capabilityExecuted = Boolean(capabilityResult?.capability_id);
  const queueCompleted =
    queueItem?.status === "completed" ||
    runtimeContext.queue_item.status === "completed";
  const executionFailed = agentExecution.status === "failed";
  const capabilityFailed = Boolean(
    capabilityResult?.result.safety_flags.includes("capability_failed")
  );
  const sideEffectsFailed = Boolean(sideEffectsError);
  const workGenerationFailed = Boolean(workGenerationError);
  const workGenerated = Boolean(
    workGenerationResult &&
      (workGenerationResult.created_work_items.length > 0 ||
        workGenerationResult.created_queue_items.length > 0 ||
        workGenerationResult.skipped_duplicates.length > 0)
  );
  const planTranslationFailed = Boolean(planTranslationError);
  const policyBlocked =
    continuationPolicy?.allowed === false ||
    continuationPolicy?.mode === "blocked" ||
    queueItem?.metadata?.continuation_policy_allowed === false;
  const ownershipBlocked =
    workItem?.ownership_status === "blocked" ||
    runtimeContext.ownership.ownership_status === "blocked";
  const rejectedHumanReview =
    runtimeContext.human_review_context?.status === "rejected";
  const highRisk =
    continuationPolicy?.risk_level === "high" ||
    (typeof priorityResult?.risk_score === "number" &&
      priorityResult.risk_score >= 80) ||
    workItem?.metadata?.risk_level === "high";
  const humanReviewStatus =
    runtimeContext.human_review_context?.status ?? null;
  const requiresHumanReview =
    (continuationPolicy?.requires_human_review === true &&
      humanReviewStatus !== "approved") ||
    humanReviewStatus === "pending";
  const safetyFlags = capabilityResult?.result.safety_flags ?? [];
  const staleOrMissingReview = safetyFlags.some((flag) =>
    ["stale_review", "missing_human_review"].includes(flag)
  );
  const skippedSideEffects = Boolean(
    sideEffectsResult &&
      sideEffectsResult.created_tasks.length === 0 &&
      sideEffectsResult.created_work_items.length === 0 &&
      sideEffectsResult.created_memory_entries.length === 0 &&
      sideEffectsResult.skipped_duplicates.length > 0
  );
  const skippedPlanSteps = Boolean(
    planTranslationResult?.skipped_steps.length
  );

  pushSignal(signals, organizationId, "organization_present");
  pushSignal(signals, agentExecution.id, "agent_execution_present");
  pushSignal(signals, capabilityExecuted, "capability_executed");
  pushSignal(signals, queueCompleted, "queue_completed");
  signals.push({
    signal: "work_generation_checked",
    severity: workGenerated || workGenerationResult ? "info" : "warning",
    reason:
      workGenerated || workGenerationResult
        ? "Work generation completed deterministically."
        : "No work generation result was recorded.",
  });

  if (sideEffectsFailed) {
    signals.push({
      signal: "side_effects_error",
      severity: "critical",
      reason: sideEffectsError ?? "Side effects failed.",
    });
  }

  if (workGenerationFailed) {
    signals.push({
      signal: "work_generation_error",
      severity: "critical",
      reason: workGenerationError ?? "Work generation failed.",
    });
  }

  if (planTranslationFailed) {
    signals.push({
      signal: "plan_translation_error",
      severity: "warning",
      reason: planTranslationError ?? "Plan translation failed.",
    });
  }

  if (policyBlocked || ownershipBlocked || rejectedHumanReview) {
    signals.push({
      signal: "blocked",
      severity: "critical",
      reason: resolveBlockedReason({
        continuationPolicy,
        ownershipBlocked,
        rejectedHumanReview,
      }),
    });
  }

  if (highRisk || requiresHumanReview || staleOrMissingReview) {
    signals.push({
      signal: "human_review_needed",
      severity: "warning",
      reason: resolveReviewReason({
        highRisk,
        requiresHumanReview,
        staleOrMissingReview,
      }),
    });
  }

  if (skippedSideEffects) {
    signals.push({
      signal: "side_effects_partial",
      severity: "warning",
      reason: "Side effects were skipped because duplicate work already exists.",
    });
  }

  if (skippedPlanSteps) {
    signals.push({
      signal: "plan_steps_skipped",
      severity: "warning",
      reason: "Plan translation skipped one or more non-translatable steps.",
    });
  }

  const outcomeStatus = resolveOutcomeStatus({
    executionFailed,
    capabilityExecuted,
    capabilityFailed,
    sideEffectsFailed,
    workGenerationFailed,
    planTranslationFailed,
    policyBlocked,
    ownershipBlocked,
    rejectedHumanReview,
    highRisk,
    requiresHumanReview,
    staleOrMissingReview,
    skippedSideEffects,
    skippedPlanSteps,
    queueCompleted,
  });
  const failureCategory = resolveFailureCategory({
    outcomeStatus,
    capabilityExecuted,
    sideEffectsFailed,
    workGenerationFailed,
    planTranslationFailed,
    policyBlocked,
    ownershipBlocked,
    rejectedHumanReview,
    requiresHumanReview,
    staleOrMissingReview,
  });
  const successScore = calculateSuccessScore({
    outcomeStatus,
    queueCompleted,
    sideEffectsFailed,
    workGenerationFailed,
    planTranslationFailed,
    skippedSideEffects,
    skippedPlanSteps,
    highRisk,
    requiresHumanReview,
  });

  return {
    success_score: successScore,
    outcome_status: outcomeStatus,
    failure_category: failureCategory,
    retry_recommended:
      outcomeStatus === "partial" ||
      failureCategory === "side_effect_failed" ||
      failureCategory === "work_generation_failed" ||
      failureCategory === "missing_context",
    escalation_recommended:
      outcomeStatus === "blocked" ||
      outcomeStatus === "needs_review" ||
      failureCategory === "human_review_required",
    feedback_summary: buildFeedbackSummary({
      outcomeStatus,
      successScore,
      failureCategory,
    }),
    signals,
  };
}

export async function persistExecutionOutcomeFeedback({
  supabase,
  organizationId,
  agentExecutionId,
  agentId = null,
  workItemId = null,
  outcomeEvaluation,
  processedAt = new Date().toISOString(),
}: PersistExecutionOutcomeInput) {
  const decision = await createOutcomeDecision({
    supabase,
    organizationId,
    agentExecutionId,
    agentId,
    workItemId,
    outcomeEvaluation,
    processedAt,
  });
  const memoryEntry = await upsertOutcomeMemoryEntry({
    supabase,
    organizationId,
    agentExecutionId,
    agentId,
    workItemId,
    outcomeEvaluation,
    processedAt,
  });

  return {
    decision_id: decision.id,
    memory_entry_id: memoryEntry?.id ?? null,
  };
}

async function createOutcomeDecision({
  supabase,
  organizationId,
  agentExecutionId,
  agentId,
  workItemId,
  outcomeEvaluation,
  processedAt,
}: Required<PersistExecutionOutcomeInput>) {
  const { data, error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: agentExecutionId,
      agent_id: agentId,
      work_item_id: workItemId,
      decision_type: "outcome_evaluated",
      decision: {
        outcome: outcomeEvaluation,
      },
      rationale: outcomeEvaluation.feedback_summary,
      confidence: 1,
      metadata: {
        source: "outcome_evaluation",
        phase: 29,
        ...outcomeEvaluation,
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

async function upsertOutcomeMemoryEntry({
  supabase,
  organizationId,
  agentExecutionId,
  agentId,
  workItemId,
  outcomeEvaluation,
  processedAt,
}: Required<PersistExecutionOutcomeInput>) {
  if (!workItemId || outcomeEvaluation.outcome_status === "failed") {
    return null;
  }

  const key = `outcome:${agentExecutionId}`;
  const { data: existing, error: selectError } = await supabase
    .from("memory_entries")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("scope", "work_item")
    .eq("key", key)
    .maybeSingle<MemoryEntryRow>();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    const { error } = await supabase
      .from("memory_entries")
      .update({
        content: outcomeEvaluation.feedback_summary,
        metadata: buildOutcomeMemoryMetadata(outcomeEvaluation),
        updated_at: processedAt,
      })
      .eq("id", existing.id)
      .eq("organization_id", organizationId);

    if (error) {
      throw error;
    }

    return existing;
  }

  const { data, error } = await supabase
    .from("memory_entries")
    .insert({
      organization_id: organizationId,
      agent_id: agentId,
      work_item_id: workItemId,
      source_agent_execution_id: agentExecutionId,
      scope: "work_item",
      key,
      content: outcomeEvaluation.feedback_summary,
      metadata: buildOutcomeMemoryMetadata(outcomeEvaluation),
      created_at: processedAt,
      updated_at: processedAt,
    })
    .select("id")
    .single<MemoryEntryRow>();

  if (error) {
    throw error;
  }

  return data;
}

function buildOutcomeMemoryMetadata(
  outcomeEvaluation: ExecutionOutcomeEvaluation
) {
  return {
    source: "outcome_evaluation",
    outcome_status: outcomeEvaluation.outcome_status,
    success_score: outcomeEvaluation.success_score,
    retry_recommended: outcomeEvaluation.retry_recommended,
    escalation_recommended: outcomeEvaluation.escalation_recommended,
  };
}

function resolveOutcomeStatus({
  executionFailed,
  capabilityExecuted,
  capabilityFailed,
  sideEffectsFailed,
  workGenerationFailed,
  planTranslationFailed,
  policyBlocked,
  ownershipBlocked,
  rejectedHumanReview,
  highRisk,
  requiresHumanReview,
  staleOrMissingReview,
  skippedSideEffects,
  skippedPlanSteps,
  queueCompleted,
}: {
  executionFailed: boolean;
  capabilityExecuted: boolean;
  capabilityFailed: boolean;
  sideEffectsFailed: boolean;
  workGenerationFailed: boolean;
  planTranslationFailed: boolean;
  policyBlocked: boolean;
  ownershipBlocked: boolean;
  rejectedHumanReview: boolean;
  highRisk: boolean;
  requiresHumanReview: boolean;
  staleOrMissingReview: boolean;
  skippedSideEffects: boolean;
  skippedPlanSteps: boolean;
  queueCompleted: boolean;
}): OutcomeStatus {
  if (policyBlocked || ownershipBlocked || rejectedHumanReview) {
    return "blocked";
  }

  if (highRisk || requiresHumanReview || staleOrMissingReview) {
    return "needs_review";
  }

  if (
    executionFailed ||
    !capabilityExecuted ||
    capabilityFailed ||
    sideEffectsFailed ||
    workGenerationFailed ||
    planTranslationFailed
  ) {
    return "failed";
  }

  if (skippedSideEffects || skippedPlanSteps || !queueCompleted) {
    return "partial";
  }

  return "successful";
}

function resolveFailureCategory({
  outcomeStatus,
  capabilityExecuted,
  sideEffectsFailed,
  workGenerationFailed,
  planTranslationFailed,
  policyBlocked,
  ownershipBlocked,
  rejectedHumanReview,
  requiresHumanReview,
  staleOrMissingReview,
}: {
  outcomeStatus: OutcomeStatus;
  capabilityExecuted: boolean;
  sideEffectsFailed: boolean;
  workGenerationFailed: boolean;
  planTranslationFailed: boolean;
  policyBlocked: boolean;
  ownershipBlocked: boolean;
  rejectedHumanReview: boolean;
  requiresHumanReview: boolean;
  staleOrMissingReview: boolean;
}) {
  if (outcomeStatus === "successful" || outcomeStatus === "partial") {
    return null;
  }

  if (policyBlocked || ownershipBlocked || rejectedHumanReview) {
    return "policy_blocked";
  }

  if (requiresHumanReview || staleOrMissingReview) {
    return "human_review_required";
  }

  if (!capabilityExecuted || planTranslationFailed) {
    return "missing_context";
  }

  if (sideEffectsFailed) {
    return "side_effect_failed";
  }

  if (workGenerationFailed) {
    return "work_generation_failed";
  }

  return "unknown";
}

function calculateSuccessScore({
  outcomeStatus,
  queueCompleted,
  sideEffectsFailed,
  workGenerationFailed,
  planTranslationFailed,
  skippedSideEffects,
  skippedPlanSteps,
  highRisk,
  requiresHumanReview,
}: {
  outcomeStatus: OutcomeStatus;
  queueCompleted: boolean;
  sideEffectsFailed: boolean;
  workGenerationFailed: boolean;
  planTranslationFailed: boolean;
  skippedSideEffects: boolean;
  skippedPlanSteps: boolean;
  highRisk: boolean;
  requiresHumanReview: boolean;
}) {
  let score = 92;

  if (!queueCompleted) score -= 18;
  if (skippedSideEffects) score -= 12;
  if (skippedPlanSteps) score -= 14;
  if (sideEffectsFailed) score -= 35;
  if (workGenerationFailed) score -= 35;
  if (planTranslationFailed) score -= 25;
  if (highRisk) score -= 20;
  if (requiresHumanReview) score -= 18;

  if (outcomeStatus === "blocked") score = Math.min(score, 35);
  if (outcomeStatus === "failed") score = Math.min(score, 40);
  if (outcomeStatus === "needs_review") score = Math.min(score, 68);
  if (outcomeStatus === "partial") score = Math.min(score, 78);

  return Math.max(0, Math.min(100, score));
}

function buildFeedbackSummary({
  outcomeStatus,
  successScore,
  failureCategory,
}: {
  outcomeStatus: OutcomeStatus;
  successScore: number;
  failureCategory: OutcomeFailureCategory;
}) {
  const retryText =
    outcomeStatus === "partial" || outcomeStatus === "failed"
      ? " Retry is recommended after resolving the recorded issue."
      : "";
  const categoryText = failureCategory
    ? ` Failure category: ${failureCategory}.`
    : "";

  return `Outcome Evaluated: ${outcomeStatus} with score ${successScore}.${categoryText}${retryText}`;
}

function resolveBlockedReason({
  continuationPolicy,
  ownershipBlocked,
  rejectedHumanReview,
}: {
  continuationPolicy: ContinuationPolicyDecision | null;
  ownershipBlocked: boolean;
  rejectedHumanReview: boolean;
}) {
  if (rejectedHumanReview) {
    return "Human review rejected the continuation.";
  }

  if (ownershipBlocked) {
    return "Work item ownership is blocked.";
  }

  return continuationPolicy?.reason ?? "Continuation policy blocked execution.";
}

function resolveReviewReason({
  highRisk,
  requiresHumanReview,
  staleOrMissingReview,
}: {
  highRisk: boolean;
  requiresHumanReview: boolean;
  staleOrMissingReview: boolean;
}) {
  if (staleOrMissingReview) {
    return "Safety flags indicate stale or missing human review.";
  }

  if (requiresHumanReview) {
    return "Execution requires human review before it can be considered complete.";
  }

  return highRisk
    ? "Execution outcome is high risk."
    : "Execution needs review.";
}

function pushSignal(
  signals: OutcomeEvaluationSignal[],
  condition: unknown,
  signal: string
) {
  signals.push({
    signal,
    severity: condition ? "positive" : "critical",
    reason: condition ? `${signal} passed.` : `${signal} failed.`,
  });
}
