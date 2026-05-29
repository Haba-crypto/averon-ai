import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgentExecutionPlan } from "@/lib/application/agents/agent-planning";
import type { AgentRuntimeContext } from "@/lib/application/agents/build-agent-runtime-context";
import type { ExecutionOutcomeEvaluation } from "@/lib/application/agents/outcome-evaluation";
import type { ReasoningProposalQualityEvaluation } from "@/lib/application/agents/reasoning-evaluation";
import type { ReasoningProposal } from "@/lib/application/agents/reasoning-proposal";

export type ReasoningLearningSignalType =
  | "positive"
  | "neutral"
  | "negative"
  | "needs_more_data";

export type ReasoningLearningSignal = {
  learning_signal_id: string;
  proposal_id: string | null;
  signal_type: ReasoningLearningSignalType;
  usefulness_score: number;
  safety_score: number;
  outcome_alignment_score: number;
  human_alignment_score: number;
  strategy_effectiveness_score: number;
  summary: string;
  lessons: string[];
  recommended_adjustments: string[];
};

export type HumanReviewContextLike = {
  status?: string | null;
  review_outcome?: string | null;
  review_notes?: string | null;
} | null;

export type DeriveReasoningLearningSignalInput = {
  reasoningProposal?: ReasoningProposal | null;
  reasoningEvaluation?: ReasoningProposalQualityEvaluation | null;
  outcomeEvaluation?: ExecutionOutcomeEvaluation | null;
  humanReviewContext?: HumanReviewContextLike;
  executionPlan?: AgentExecutionPlan | null;
  runtimeContext?: AgentRuntimeContext | null;
};

export type PersistReasoningLearningSignalInput = {
  supabase: SupabaseClient;
  organizationId: string;
  agentExecutionId: string;
  agentId?: string | null;
  workItemId?: string | null;
  learningSignal: ReasoningLearningSignal;
  runtimeContext?: AgentRuntimeContext | null;
  reasoningProposal?: ReasoningProposal | null;
  reasoningEvaluation?: ReasoningProposalQualityEvaluation | null;
  outcomeEvaluation?: ExecutionOutcomeEvaluation | null;
  executionPlan?: AgentExecutionPlan | null;
  processedAt?: string;
};

type AgentDecisionRow = {
  id: string;
};

type MemoryEntryRow = {
  id: string;
};

export function deriveReasoningLearningSignal({
  reasoningProposal = null,
  reasoningEvaluation = null,
  outcomeEvaluation = null,
  humanReviewContext = null,
  executionPlan = null,
  runtimeContext = null,
}: DeriveReasoningLearningSignalInput): ReasoningLearningSignal {
  const proposalId = reasoningProposal?.proposal_id ?? null;

  if (!reasoningProposal || !reasoningEvaluation || !outcomeEvaluation) {
    return {
      learning_signal_id: buildLearningSignalId({
        proposalId,
        runtimeContext,
        fallback: "missing_data",
      }),
      proposal_id: proposalId,
      signal_type: "needs_more_data",
      usefulness_score: normalizeScore(reasoningEvaluation?.usefulness_score),
      safety_score: normalizeScore(reasoningEvaluation?.safety_score),
      outcome_alignment_score: 0,
      human_alignment_score: calculateHumanAlignmentScore(humanReviewContext),
      strategy_effectiveness_score: 0,
      summary:
        "Reasoning learning signal needs more data because proposal, evaluation, or downstream outcome is missing.",
      lessons: ["Wait for downstream outcome evidence before learning."],
      recommended_adjustments: [
        "Re-evaluate this reasoning proposal after execution outcome is available.",
      ],
    };
  }

  const unsafeProposal = hasUnsafeReasoningSignal(reasoningEvaluation);
  const humanRejected = isHumanRejectedOrOverridden(humanReviewContext);
  const escalationOrRetry =
    outcomeEvaluation.retry_recommended ||
    outcomeEvaluation.escalation_recommended;
  const outcomeAlignmentScore = calculateOutcomeAlignmentScore(
    outcomeEvaluation
  );
  const humanAlignmentScore = calculateHumanAlignmentScore(humanReviewContext);
  const safetyScore = normalizeScore(reasoningEvaluation.safety_score);
  const usefulnessScore = calculateUsefulnessScore({
    reasoningEvaluation,
    outcomeEvaluation,
  });
  const strategyEffectivenessScore = calculateStrategyEffectivenessScore({
    reasoningEvaluation,
    outcomeEvaluation,
    humanAlignmentScore,
    executionPlan,
  });
  const signalType = resolveSignalType({
    reasoningEvaluation,
    outcomeEvaluation,
    safetyScore,
    unsafeProposal,
    humanRejected,
    escalationOrRetry,
  });
  const summary = buildSummary({
    signalType,
    usefulnessScore,
    safetyScore,
    outcomeAlignmentScore,
    humanAlignmentScore,
    strategyEffectivenessScore,
    outcomeEvaluation,
  });

  return {
    learning_signal_id: buildLearningSignalId({
      proposalId,
      runtimeContext,
      fallback: reasoningEvaluation.evaluation_id,
    }),
    proposal_id: proposalId,
    signal_type: signalType,
    usefulness_score: usefulnessScore,
    safety_score: safetyScore,
    outcome_alignment_score: outcomeAlignmentScore,
    human_alignment_score: humanAlignmentScore,
    strategy_effectiveness_score: strategyEffectivenessScore,
    summary,
    lessons: buildLessons({
      signalType,
      reasoningEvaluation,
      outcomeEvaluation,
      unsafeProposal,
      humanRejected,
    }),
    recommended_adjustments: buildRecommendedAdjustments({
      signalType,
      reasoningEvaluation,
      outcomeEvaluation,
      unsafeProposal,
      humanRejected,
    }),
  };
}

export async function persistReasoningLearningSignal({
  supabase,
  organizationId,
  agentExecutionId,
  agentId = null,
  workItemId = null,
  learningSignal,
  runtimeContext = null,
  reasoningProposal = null,
  reasoningEvaluation = null,
  outcomeEvaluation = null,
  executionPlan = null,
  processedAt = new Date().toISOString(),
}: PersistReasoningLearningSignalInput) {
  const decision = await createReasoningLearningDecision({
    supabase,
    organizationId,
    agentExecutionId,
    agentId,
    workItemId,
    learningSignal,
    runtimeContext,
    reasoningProposal,
    reasoningEvaluation,
    outcomeEvaluation,
    executionPlan,
    processedAt,
  });
  const memoryEntry = await upsertReasoningLearningMemoryEntry({
    supabase,
    organizationId,
    agentExecutionId,
    agentId,
    workItemId,
    learningSignal,
    runtimeContext,
    reasoningProposal,
    reasoningEvaluation,
    outcomeEvaluation,
    executionPlan,
    processedAt,
  });

  return {
    decision_id: decision.id,
    memory_entry_id: memoryEntry?.id ?? null,
  };
}

async function createReasoningLearningDecision({
  supabase,
  organizationId,
  agentExecutionId,
  agentId,
  workItemId,
  learningSignal,
  processedAt,
}: Required<PersistReasoningLearningSignalInput>) {
  const { data, error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: agentExecutionId,
      agent_id: agentId,
      work_item_id: workItemId,
      decision_type: "reasoning_learning_signal_created",
      decision: {
        outcome: learningSignal,
      },
      rationale: learningSignal.summary,
      confidence: learningSignal.strategy_effectiveness_score / 100,
      metadata: {
        source: "reasoning_learning",
        phase: 35,
        ...learningSignal,
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

async function upsertReasoningLearningMemoryEntry({
  supabase,
  organizationId,
  agentExecutionId,
  agentId,
  workItemId,
  learningSignal,
  runtimeContext,
  reasoningProposal,
  reasoningEvaluation,
  outcomeEvaluation,
  executionPlan,
  processedAt,
}: Required<PersistReasoningLearningSignalInput>) {
  if (!workItemId || !learningSignal.proposal_id) {
    return null;
  }

  const key = `reasoning_learning:${learningSignal.proposal_id}`;
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

  const memoryPayload = {
    content: learningSignal.summary,
    metadata: buildReasoningLearningMemoryMetadata({
      learningSignal,
      runtimeContext,
      reasoningProposal,
      reasoningEvaluation,
      outcomeEvaluation,
      executionPlan,
    }),
    updated_at: processedAt,
  };

  if (existing) {
    const { error } = await supabase
      .from("memory_entries")
      .update(memoryPayload)
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
      ...memoryPayload,
      created_at: processedAt,
    })
    .select("id")
    .single<MemoryEntryRow>();

  if (error) {
    throw error;
  }

  return data;
}

function buildReasoningLearningMemoryMetadata({
  learningSignal,
  runtimeContext,
  reasoningProposal,
  reasoningEvaluation,
  outcomeEvaluation,
  executionPlan,
}: {
  learningSignal: ReasoningLearningSignal;
  runtimeContext: AgentRuntimeContext | null;
  reasoningProposal: ReasoningProposal | null;
  reasoningEvaluation: ReasoningProposalQualityEvaluation | null;
  outcomeEvaluation: ExecutionOutcomeEvaluation | null;
  executionPlan: AgentExecutionPlan | null;
}) {
  return {
    source: "reasoning_learning",
    signal_type: learningSignal.signal_type,
    usefulness_score: learningSignal.usefulness_score,
    strategy_effectiveness_score:
      learningSignal.strategy_effectiveness_score,
    proposal_id: learningSignal.proposal_id,
    agent_name: runtimeContext?.assigned_agent.name ?? null,
    capability_id: executionPlan?.capability_id ?? null,
    work_item_type: runtimeContext?.work_item.type ?? null,
    proposal_strategy: reasoningProposal?.recommended_strategy ?? null,
    outcome_status: outcomeEvaluation?.outcome_status ?? null,
    verdict: reasoningEvaluation?.verdict ?? null,
  };
}

function resolveSignalType({
  reasoningEvaluation,
  outcomeEvaluation,
  safetyScore,
  unsafeProposal,
  humanRejected,
  escalationOrRetry,
}: {
  reasoningEvaluation: ReasoningProposalQualityEvaluation;
  outcomeEvaluation: ExecutionOutcomeEvaluation;
  safetyScore: number;
  unsafeProposal: boolean;
  humanRejected: boolean;
  escalationOrRetry: boolean;
}): ReasoningLearningSignalType {
  if (
    reasoningEvaluation.verdict === "rejected" ||
    outcomeEvaluation.outcome_status === "failed" ||
    outcomeEvaluation.outcome_status === "blocked" ||
    unsafeProposal ||
    humanRejected ||
    escalationOrRetry
  ) {
    return "negative";
  }

  if (
    reasoningEvaluation.verdict === "accepted" &&
    outcomeEvaluation.outcome_status === "successful" &&
    safetyScore >= 80
  ) {
    return "positive";
  }

  if (
    outcomeEvaluation.outcome_status === "partial" ||
    outcomeEvaluation.outcome_status === "needs_review" ||
    reasoningEvaluation.verdict === "needs_review"
  ) {
    return "neutral";
  }

  return "neutral";
}

function calculateUsefulnessScore({
  reasoningEvaluation,
  outcomeEvaluation,
}: {
  reasoningEvaluation: ReasoningProposalQualityEvaluation;
  outcomeEvaluation: ExecutionOutcomeEvaluation;
}) {
  return clampScore(
    Math.round(
      reasoningEvaluation.usefulness_score * 0.62 +
        outcomeEvaluation.success_score * 0.38 -
        (outcomeEvaluation.retry_recommended ? 12 : 0) -
        (outcomeEvaluation.escalation_recommended ? 16 : 0)
    )
  );
}

function calculateOutcomeAlignmentScore(
  outcomeEvaluation: ExecutionOutcomeEvaluation
) {
  const statusModifier = {
    successful: 8,
    partial: -8,
    needs_review: -16,
    failed: -36,
    blocked: -44,
  }[outcomeEvaluation.outcome_status];

  return clampScore(
    outcomeEvaluation.success_score +
      statusModifier -
      (outcomeEvaluation.retry_recommended ? 12 : 0) -
      (outcomeEvaluation.escalation_recommended ? 16 : 0)
  );
}

function calculateHumanAlignmentScore(
  humanReviewContext: HumanReviewContextLike
) {
  if (!humanReviewContext) {
    return 100;
  }

  const status = normalizeText(humanReviewContext.status);
  const outcome = normalizeText(humanReviewContext.review_outcome);
  const notes = normalizeText(humanReviewContext.review_notes);
  const combined = [status, outcome, notes].join(" ");

  if (/\b(reject|rejected|override|overrode|blocked|declined)\b/.test(combined)) {
    return 15;
  }

  if (/\b(approve|approved|accepted|confirmed)\b/.test(combined)) {
    return 95;
  }

  if (status === "pending" || status === "in_review") {
    return 55;
  }

  return 75;
}

function calculateStrategyEffectivenessScore({
  reasoningEvaluation,
  outcomeEvaluation,
  humanAlignmentScore,
  executionPlan,
}: {
  reasoningEvaluation: ReasoningProposalQualityEvaluation;
  outcomeEvaluation: ExecutionOutcomeEvaluation;
  humanAlignmentScore: number;
  executionPlan: AgentExecutionPlan | null;
}) {
  const planRiskPenalty =
    executionPlan?.risk_level === "high"
      ? 12
      : executionPlan?.risk_level === "medium"
        ? 6
        : 0;

  return clampScore(
    Math.round(
      reasoningEvaluation.quality_score * 0.34 +
        reasoningEvaluation.usefulness_score * 0.22 +
        outcomeEvaluation.success_score * 0.28 +
        humanAlignmentScore * 0.16 -
        planRiskPenalty -
        (outcomeEvaluation.escalation_recommended ? 14 : 0)
    )
  );
}

function hasUnsafeReasoningSignal(
  reasoningEvaluation: ReasoningProposalQualityEvaluation
) {
  return (
    reasoningEvaluation.safety_score < 55 ||
    reasoningEvaluation.comparison_to_deterministic
      .introduced_unsafe_actions ||
    reasoningEvaluation.comparison_to_deterministic
      .preserved_internal_boundaries === false ||
    reasoningEvaluation.evaluation_signals.some(
      (signal) =>
        signal.severity === "critical" &&
        /\b(unsafe|boundary|policy)\b/i.test(
          [signal.signal, signal.reason].join(" ")
        )
    )
  );
}

function isHumanRejectedOrOverridden(
  humanReviewContext: HumanReviewContextLike
) {
  if (!humanReviewContext) {
    return false;
  }

  return /\b(reject|rejected|override|overrode|blocked|declined)\b/.test(
    [
      humanReviewContext.status,
      humanReviewContext.review_outcome,
      humanReviewContext.review_notes,
    ]
      .map(normalizeText)
      .join(" ")
  );
}

function buildSummary({
  signalType,
  usefulnessScore,
  safetyScore,
  outcomeAlignmentScore,
  humanAlignmentScore,
  strategyEffectivenessScore,
  outcomeEvaluation,
}: {
  signalType: ReasoningLearningSignalType;
  usefulnessScore: number;
  safetyScore: number;
  outcomeAlignmentScore: number;
  humanAlignmentScore: number;
  strategyEffectivenessScore: number;
  outcomeEvaluation: ExecutionOutcomeEvaluation;
}) {
  if (signalType === "positive") {
    return `Reasoning learning signal: positive, usefulness score ${usefulnessScore}.`;
  }

  if (signalType === "negative") {
    return "Reasoning learning signal: negative, adjustment recommended.";
  }

  if (signalType === "needs_more_data") {
    return "Reasoning learning signal: needs more data before adjustment.";
  }

  return [
    `Reasoning learning signal: neutral for ${outcomeEvaluation.outcome_status} outcome.`,
    `Safety ${safetyScore}, outcome alignment ${outcomeAlignmentScore}, human alignment ${humanAlignmentScore}, strategy effectiveness ${strategyEffectivenessScore}.`,
  ].join(" ");
}

function buildLessons({
  signalType,
  reasoningEvaluation,
  outcomeEvaluation,
  unsafeProposal,
  humanRejected,
}: {
  signalType: ReasoningLearningSignalType;
  reasoningEvaluation: ReasoningProposalQualityEvaluation;
  outcomeEvaluation: ExecutionOutcomeEvaluation;
  unsafeProposal: boolean;
  humanRejected: boolean;
}) {
  if (signalType === "positive") {
    return [
      "Accepted reasoning aligned with successful downstream execution.",
      "Safe proposal-only recommendations can be retained for similar work-item context.",
    ];
  }

  if (signalType === "negative") {
    const lessons = [
      "Reasoning did not produce a reliable downstream signal for this context.",
    ];

    if (reasoningEvaluation.verdict === "rejected" || unsafeProposal) {
      lessons.push("Unsafe or rejected reasoning should reduce future trust.");
    }

    if (humanRejected) {
      lessons.push("Human rejection or override should dominate learning.");
    }

    if (
      outcomeEvaluation.outcome_status === "failed" ||
      outcomeEvaluation.outcome_status === "blocked"
    ) {
      lessons.push("Failed or blocked outcomes should not reinforce strategy.");
    }

    return lessons;
  }

  if (signalType === "needs_more_data") {
    return ["Learning requires both reasoning evaluation and downstream outcome."];
  }

  return [
    "Reasoning may have been useful, but downstream evidence was partial or inconclusive.",
  ];
}

function buildRecommendedAdjustments({
  signalType,
  reasoningEvaluation,
  outcomeEvaluation,
  unsafeProposal,
  humanRejected,
}: {
  signalType: ReasoningLearningSignalType;
  reasoningEvaluation: ReasoningProposalQualityEvaluation;
  outcomeEvaluation: ExecutionOutcomeEvaluation;
  unsafeProposal: boolean;
  humanRejected: boolean;
}) {
  if (signalType === "positive") {
    return [
      "Keep the current proposal-only strategy for similar safe contexts.",
    ];
  }

  if (signalType === "neutral") {
    return [
      "Collect more downstream outcome evidence before changing strategy.",
    ];
  }

  if (signalType === "needs_more_data") {
    return [
      "Wait for outcome evaluation before updating reasoning confidence.",
    ];
  }

  const adjustments = [
    "Reduce confidence in this reasoning pattern for future similar context.",
  ];

  if (reasoningEvaluation.verdict === "rejected" || unsafeProposal) {
    adjustments.push("Strengthen safety filtering around proposed actions.");
  }

  if (humanRejected) {
    adjustments.push("Prefer human decision context over reasoning recommendation.");
  }

  if (
    outcomeEvaluation.retry_recommended ||
    outcomeEvaluation.escalation_recommended
  ) {
    adjustments.push("Require clearer escalation and retry evidence before reuse.");
  }

  return adjustments;
}

function buildLearningSignalId({
  proposalId,
  runtimeContext,
  fallback,
}: {
  proposalId: string | null;
  runtimeContext: AgentRuntimeContext | null;
  fallback: string;
}) {
  return [
    "reasoning_learning",
    proposalId ?? fallback,
    runtimeContext?.queue_item.id ?? "no_queue",
  ]
    .join("_")
    .replace(/[^a-zA-Z0-9_:-]+/g, "_");
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function normalizeScore(value: number | null | undefined) {
  return clampScore(value ?? 0);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
