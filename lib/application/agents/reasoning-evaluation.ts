import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgentRuntimeContext } from "@/lib/application/agents/build-agent-runtime-context";
import type { ExecutionOutcomeEvaluation } from "@/lib/application/agents/outcome-evaluation";
import type { PolicyGovernanceDecision } from "@/lib/application/agents/policy-governance";
import type {
  ReasoningProposal,
  ReasoningProviderName,
} from "@/lib/application/agents/reasoning-proposal";

export type ReasoningEvaluationVerdict =
  | "accepted"
  | "needs_review"
  | "rejected";

export type ReasoningEvaluationSignal = {
  signal: string;
  severity: "positive" | "info" | "warning" | "critical";
  reason: string;
};

export type ReasoningEvaluationComparison = {
  deterministic_action_count: number;
  evaluated_action_count: number;
  added_specificity: boolean;
  added_specificity_score: number;
  introduced_unsafe_actions: boolean;
  increased_risk: boolean;
  preserved_internal_boundaries: boolean;
  recommendation: string;
};

export type ReasoningProposalQualityEvaluation = {
  evaluation_id: string;
  evaluated_provider: ReasoningProviderName;
  quality_score: number;
  safety_score: number;
  usefulness_score: number;
  specificity_score: number;
  policy_alignment_score: number;
  risk_score: number;
  verdict: ReasoningEvaluationVerdict;
  rationale: string;
  comparison_to_deterministic: ReasoningEvaluationComparison;
  evaluation_signals: ReasoningEvaluationSignal[];
};

export type EvaluateReasoningProposalQualityInput = {
  runtimeContext: AgentRuntimeContext;
  deterministicProposal: ReasoningProposal;
  llmProposal?: ReasoningProposal | null;
  governanceResult: PolicyGovernanceDecision;
  outcomeEvaluation?: ExecutionOutcomeEvaluation | null;
};

export type PersistReasoningEvaluationInput = {
  supabase: SupabaseClient;
  organizationId: string;
  agentExecutionId: string;
  agentId?: string | null;
  workItemId?: string | null;
  evaluation: ReasoningProposalQualityEvaluation;
  processedAt?: string;
};

type AgentDecisionRow = {
  id: string;
};

const UNSAFE_ACTION_PATTERN =
  /\b(send|email|sms|message customer|outreach|external|api call|webhook|openai|gpt|llm|model call|execute capability|process queue|queue processing|create task|create work item|work generation|autonomous|loop)\b/i;
const INTERNAL_ONLY_PATTERN =
  /\b(internal|review|summarize|recommend|identify|flag|clarify|document|monitor|human)\b/i;

export function evaluateReasoningProposalQuality({
  runtimeContext,
  deterministicProposal,
  llmProposal = null,
  governanceResult,
  outcomeEvaluation = null,
}: EvaluateReasoningProposalQualityInput): ReasoningProposalQualityEvaluation {
  const evaluatedProposal = llmProposal ?? deterministicProposal;
  const evaluatedProvider: ReasoningProviderName = llmProposal
    ? "openai"
    : "deterministic";
  const signals: ReasoningEvaluationSignal[] = [];
  const comparison = compareToDeterministic({
    deterministicProposal,
    evaluatedProposal,
  });
  const unsafeActionCount = countUnsafeActions(evaluatedProposal);
  const highRiskActionCount = evaluatedProposal.proposed_actions.filter(
    (action) => action.risk_level === "high"
  ).length;
  const mediumRiskActionCount = evaluatedProposal.proposed_actions.filter(
    (action) => action.risk_level === "medium"
  ).length;
  const reviewRequired =
    evaluatedProposal.requires_human_review ||
    evaluatedProposal.proposed_actions.some(
      (action) => action.requires_human_review
    ) ||
    governanceResult.human_review_required ||
    outcomeEvaluation?.escalation_recommended === true;
  const actionCount = evaluatedProposal.proposed_actions.length;

  pushSignal(
    signals,
    unsafeActionCount === 0,
    "no_unsafe_actions",
    unsafeActionCount === 0
      ? "No unsafe proposed actions were detected."
      : `${unsafeActionCount} unsafe proposed action(s) were detected.`
  );
  pushSignal(
    signals,
    governanceResult.allowed && !governanceResult.blocked,
    "policy_governance_aligned",
    governanceResult.policy_reason
  );
  pushSignal(
    signals,
    comparison.preserved_internal_boundaries,
    "internal_boundaries_preserved",
    comparison.preserved_internal_boundaries
      ? "The proposal remains internal-only."
      : "The proposal crosses internal-only boundaries."
  );
  signals.push({
    signal: "specificity_compared",
    severity: comparison.added_specificity ? "positive" : "info",
    reason: comparison.added_specificity
      ? "The evaluated proposal adds useful specificity over the deterministic proposal."
      : "The evaluated proposal does not add meaningful specificity over the deterministic proposal.",
  });

  const safetyScore = clampScore(
    96 -
      unsafeActionCount * 45 -
      highRiskActionCount * 18 -
      mediumRiskActionCount * 8 -
      (comparison.introduced_unsafe_actions ? 30 : 0) -
      (governanceResult.blocked ? 35 : 0)
  );
  const policyAlignmentScore = clampScore(
    92 +
      (governanceResult.allowed ? 6 : -24) -
      (governanceResult.blocked ? 45 : 0) -
      (governanceResult.human_review_required && !reviewRequired ? 20 : 0) -
      (comparison.preserved_internal_boundaries ? 0 : 35)
  );
  const usefulnessScore = clampScore(
    58 +
      Math.min(actionCount, 4) * 8 +
      Math.round(evaluatedProposal.confidence_score * 0.12) +
      (outcomeEvaluation?.outcome_status === "successful" ? 8 : 0) -
      (outcomeEvaluation?.outcome_status === "blocked" ? 16 : 0) -
      (actionCount === 0 ? 28 : 0)
  );
  const specificityScore = clampScore(
    46 +
      calculateSpecificityScore(evaluatedProposal) +
      comparison.added_specificity_score
  );
  const riskScore = clampScore(
    unsafeActionCount * 35 +
      highRiskActionCount * 24 +
      mediumRiskActionCount * 14 +
      (governanceResult.risk_level === "high" ? 30 : 0) +
      (governanceResult.risk_level === "medium" ? 16 : 0) +
      (comparison.increased_risk ? 18 : 0) +
      (governanceResult.blocked ? 32 : 0)
  );
  const qualityScore = clampScore(
    Math.round(
      safetyScore * 0.32 +
        policyAlignmentScore * 0.24 +
        usefulnessScore * 0.22 +
        specificityScore * 0.22 -
        riskScore * 0.12
    )
  );
  const verdict = resolveVerdict({
    safetyScore,
    policyAlignmentScore,
    usefulnessScore,
    riskScore,
    unsafeActionCount,
    governanceResult,
    reviewRequired,
  });

  return {
    evaluation_id: buildEvaluationId(runtimeContext, evaluatedProvider),
    evaluated_provider: evaluatedProvider,
    quality_score: qualityScore,
    safety_score: safetyScore,
    usefulness_score: usefulnessScore,
    specificity_score: specificityScore,
    policy_alignment_score: policyAlignmentScore,
    risk_score: riskScore,
    verdict,
    rationale: buildRationale({
      verdict,
      qualityScore,
      safetyScore,
      policyAlignmentScore,
      riskScore,
      unsafeActionCount,
      comparison,
    }),
    comparison_to_deterministic: comparison,
    evaluation_signals: signals,
  };
}

export async function persistReasoningEvaluationDecision({
  supabase,
  organizationId,
  agentExecutionId,
  agentId = null,
  workItemId = null,
  evaluation,
  processedAt = new Date().toISOString(),
}: PersistReasoningEvaluationInput) {
  const outcome = {
    evaluation_id: evaluation.evaluation_id,
    evaluated_provider: evaluation.evaluated_provider,
    quality_score: evaluation.quality_score,
    safety_score: evaluation.safety_score,
    usefulness_score: evaluation.usefulness_score,
    specificity_score: evaluation.specificity_score,
    policy_alignment_score: evaluation.policy_alignment_score,
    risk_score: evaluation.risk_score,
    verdict: evaluation.verdict,
    comparison_to_deterministic: evaluation.comparison_to_deterministic,
    rationale: evaluation.rationale,
  };
  const { data, error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: agentExecutionId,
      agent_id: agentId,
      work_item_id: workItemId,
      decision_type: "reasoning_evaluated",
      decision: {
        outcome,
      },
      rationale: evaluation.rationale,
      confidence: evaluation.quality_score / 100,
      metadata: {
        source: "reasoning_evaluation",
        phase: 34,
        ...outcome,
        evaluation_signals: evaluation.evaluation_signals,
        reasoning_evaluation: evaluation,
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

function compareToDeterministic({
  deterministicProposal,
  evaluatedProposal,
}: {
  deterministicProposal: ReasoningProposal;
  evaluatedProposal: ReasoningProposal;
}): ReasoningEvaluationComparison {
  const deterministicSpecificity = calculateSpecificityScore(
    deterministicProposal
  );
  const evaluatedSpecificity = calculateSpecificityScore(evaluatedProposal);
  const deterministicRisk = calculateProposalRisk(deterministicProposal);
  const evaluatedRisk = calculateProposalRisk(evaluatedProposal);
  const introducedUnsafeActions =
    countUnsafeActions(evaluatedProposal) > countUnsafeActions(deterministicProposal);
  const preservedInternalBoundaries = evaluatedProposal.proposed_actions.every(
    (action) => {
      const text = actionText(action);

      return !UNSAFE_ACTION_PATTERN.test(text) || action.type === "risk_flag";
    }
  );
  const addedSpecificityScore = Math.max(
    0,
    Math.min(22, evaluatedSpecificity - deterministicSpecificity)
  );
  const addedSpecificity = addedSpecificityScore >= 6;
  const increasedRisk = evaluatedRisk > deterministicRisk + 8;

  return {
    deterministic_action_count: deterministicProposal.proposed_actions.length,
    evaluated_action_count: evaluatedProposal.proposed_actions.length,
    added_specificity: addedSpecificity,
    added_specificity_score: addedSpecificityScore,
    introduced_unsafe_actions: introducedUnsafeActions,
    increased_risk: increasedRisk,
    preserved_internal_boundaries: preservedInternalBoundaries,
    recommendation: buildComparisonRecommendation({
      addedSpecificity,
      introducedUnsafeActions,
      increasedRisk,
      preservedInternalBoundaries,
    }),
  };
}

function calculateSpecificityScore(proposal: ReasoningProposal) {
  const actionScore = proposal.proposed_actions.reduce((score, action) => {
    const text = actionText(action);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const internal = INTERNAL_ONLY_PATTERN.test(text) ? 2 : 0;

    return score + Math.min(8, Math.floor(wordCount / 4)) + internal;
  }, 0);
  const strategyWordCount = proposal.recommended_strategy
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.min(34, actionScore + Math.min(10, strategyWordCount));
}

function calculateProposalRisk(proposal: ReasoningProposal) {
  return proposal.proposed_actions.reduce((score, action) => {
    if (UNSAFE_ACTION_PATTERN.test(actionText(action))) {
      return score + 35;
    }

    if (action.risk_level === "high") {
      return score + 24;
    }

    if (action.risk_level === "medium") {
      return score + 14;
    }

    return score + 4;
  }, proposal.requires_human_review ? 8 : 0);
}

function countUnsafeActions(proposal: ReasoningProposal) {
  return proposal.proposed_actions.filter((action) =>
    UNSAFE_ACTION_PATTERN.test(actionText(action))
  ).length;
}

function resolveVerdict({
  safetyScore,
  policyAlignmentScore,
  usefulnessScore,
  riskScore,
  unsafeActionCount,
  governanceResult,
  reviewRequired,
}: {
  safetyScore: number;
  policyAlignmentScore: number;
  usefulnessScore: number;
  riskScore: number;
  unsafeActionCount: number;
  governanceResult: PolicyGovernanceDecision;
  reviewRequired: boolean;
}) {
  if (
    unsafeActionCount > 0 ||
    governanceResult.blocked ||
    safetyScore < 55 ||
    policyAlignmentScore < 55
  ) {
    return "rejected";
  }

  if (
    riskScore >= 35 ||
    reviewRequired ||
    usefulnessScore < 62 ||
    safetyScore < 78 ||
    policyAlignmentScore < 75
  ) {
    return "needs_review";
  }

  return "accepted";
}

function buildRationale({
  verdict,
  qualityScore,
  safetyScore,
  policyAlignmentScore,
  riskScore,
  unsafeActionCount,
  comparison,
}: {
  verdict: ReasoningEvaluationVerdict;
  qualityScore: number;
  safetyScore: number;
  policyAlignmentScore: number;
  riskScore: number;
  unsafeActionCount: number;
  comparison: ReasoningEvaluationComparison;
}) {
  if (verdict === "rejected") {
    return unsafeActionCount > 0
      ? `Reasoning evaluation rejected the proposal because ${unsafeActionCount} unsafe action(s) were detected.`
      : `Reasoning evaluation rejected the proposal due to low safety or policy alignment.`;
  }

  if (verdict === "needs_review") {
    return `Reasoning evaluation needs review due to medium risk or ambiguity. Quality ${qualityScore}, risk ${riskScore}.`;
  }

  return comparison.added_specificity
    ? `Reasoning evaluation accepted the proposal with quality ${qualityScore}; it adds useful specificity while preserving safety.`
    : `Reasoning evaluation accepted the proposal with quality ${qualityScore}, safety ${safetyScore}, and policy alignment ${policyAlignmentScore}.`;
}

function buildComparisonRecommendation({
  addedSpecificity,
  introducedUnsafeActions,
  increasedRisk,
  preservedInternalBoundaries,
}: {
  addedSpecificity: boolean;
  introducedUnsafeActions: boolean;
  increasedRisk: boolean;
  preservedInternalBoundaries: boolean;
}) {
  if (introducedUnsafeActions || !preservedInternalBoundaries) {
    return "Reject evaluated proposal; it violates reasoning sandbox boundaries.";
  }

  if (increasedRisk) {
    return "Require human review before considering evaluated proposal.";
  }

  if (addedSpecificity) {
    return "Evaluated proposal improves deterministic reasoning and remains proposal-only.";
  }

  return "Evaluated proposal is comparable to deterministic reasoning.";
}

function buildEvaluationId(
  runtimeContext: AgentRuntimeContext,
  evaluatedProvider: ReasoningProviderName
) {
  return [
    "reasoning_evaluation",
    evaluatedProvider,
    runtimeContext.queue_item.id,
  ].join("_");
}

function pushSignal(
  signals: ReasoningEvaluationSignal[],
  condition: boolean,
  signal: string,
  reason: string
) {
  signals.push({
    signal,
    severity: condition ? "positive" : "critical",
    reason,
  });
}

function actionText(action: ReasoningProposal["proposed_actions"][number]) {
  return [action.id, action.type, action.title, action.description].join(" ");
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
