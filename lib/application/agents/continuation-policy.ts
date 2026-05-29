import type { AgentRuntimeContext } from "@/lib/application/agents/build-agent-runtime-context";
import type { AgentCapabilityExecutionResult } from "@/lib/application/agents/agent-capabilities";

export type ContinuationMode = "manual" | "guarded" | "blocked";
export type ContinuationRiskLevel = "low" | "medium" | "high";

export type ContinuationPolicyCheck = {
  check: string;
  passed: boolean;
  reason: string;
};

export type ContinuationPolicyDecision = {
  allowed: boolean;
  mode: ContinuationMode;
  reason: string;
  risk_level: ContinuationRiskLevel;
  requires_human_review: boolean;
  max_steps_allowed: number;
  policy_checks: ContinuationPolicyCheck[];
};

type EvaluateContinuationPolicyInput = {
  organizationId: string;
  queueItem: {
    id?: string | null;
    assigned_agent_id?: string | null;
    assigned_agent_name?: string | null;
    queue_reason?: string | null;
    next_action?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  workItem: {
    id?: string | null;
    priority?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  runtimeContext: AgentRuntimeContext;
  capabilityResult: AgentCapabilityExecutionResult;
  generatedWork: {
    created_work_items?: string[];
    created_queue_items?: string[];
    skipped_duplicates?: unknown[];
  } | null;
};

const MAX_CONTINUATION_STEPS = 3;

export function evaluateContinuationPolicy({
  organizationId,
  queueItem,
  workItem,
  runtimeContext,
  capabilityResult,
  generatedWork,
}: EvaluateContinuationPolicyInput): ContinuationPolicyDecision {
  const riskLevel = resolveRiskLevel(workItem);
  const requiresHumanReview = Boolean(runtimeContext.queue_item.review_id);
  const humanReviewStatus =
    runtimeContext.human_review_context?.status ?? null;
  const continuationDepth = resolveContinuationDepth(queueItem);
  const externalActionDetected = hasExternalActionSignals({
    queueItem,
    workItem,
    capabilityResult,
  });
  const openaiRequired = hasOpenAiSignals({
    queueItem,
    workItem,
    capabilityResult,
  });
  const checks: ContinuationPolicyCheck[] = [
    {
      check: "organization_present",
      passed: Boolean(organizationId),
      reason: organizationId
        ? "Organization scope is present."
        : "Organization scope is missing.",
    },
    {
      check: "generated_work_present",
      passed: Boolean(workItem?.id),
      reason: workItem?.id
        ? "Generated work item is present."
        : "Generated work item is missing.",
    },
    {
      check: "assigned_agent_present",
      passed: Boolean(
        queueItem?.assigned_agent_id || queueItem?.assigned_agent_name
      ),
      reason:
        queueItem?.assigned_agent_id || queueItem?.assigned_agent_name
          ? "Generated queue item has an assigned agent."
          : "Generated queue item is missing an assigned agent.",
    },
    {
      check: "internal_only",
      passed: !externalActionDetected,
      reason: externalActionDetected
        ? "External action was detected."
        : "Continuation remains internal-only.",
    },
    {
      check: "no_external_side_effect",
      passed: !externalActionDetected,
      reason: externalActionDetected
        ? "External side effect was requested."
        : "No external side effect was requested.",
    },
    {
      check: "no_openai_call_required",
      passed: !openaiRequired,
      reason: openaiRequired
        ? "OpenAI use was requested or required."
        : "No OpenAI call is required.",
    },
    {
      check: "work_item_risk_not_high",
      passed: riskLevel !== "high",
      reason:
        riskLevel === "high"
          ? "Generated work item is high risk."
          : `Generated work item risk is ${riskLevel}.`,
    },
    {
      check: "human_review_approved_if_needed",
      passed:
        !requiresHumanReview || humanReviewStatus === "approved",
      reason: !requiresHumanReview
        ? "No human review is required for this continuation."
        : humanReviewStatus === "approved"
          ? "Required human review is approved."
          : `Required human review is ${humanReviewStatus ?? "missing"}.`,
    },
    {
      check: "continuation_depth_within_limit",
      passed: continuationDepth <= MAX_CONTINUATION_STEPS,
      reason:
        continuationDepth <= MAX_CONTINUATION_STEPS
          ? `Continuation depth ${continuationDepth} is within the safe limit.`
          : `Continuation depth ${continuationDepth} exceeds the safe limit.`,
    },
    {
      check: "generated_queue_item_recorded",
      passed: Boolean(
        queueItem?.id || generatedWork?.created_queue_items?.length
      ),
      reason:
        queueItem?.id || generatedWork?.created_queue_items?.length
          ? "Generated queue item is recorded."
          : "Generated queue item is missing.",
    },
  ];

  const failedChecks = checks.filter((check) => !check.passed);
  const allowed = failedChecks.length === 0;

  return {
    allowed,
    mode: allowed ? "manual" : "blocked",
    reason: allowed
      ? `Continuation is allowed in manual mode with ${riskLevel} risk.`
      : failedChecks[0]?.reason ?? "Continuation is blocked by policy.",
    risk_level: riskLevel,
    requires_human_review: requiresHumanReview,
    max_steps_allowed: MAX_CONTINUATION_STEPS,
    policy_checks: checks,
  };
}

function resolveContinuationDepth(
  queueItem: EvaluateContinuationPolicyInput["queueItem"]
) {
  const rawDepth = queueItem?.metadata?.continuation_depth;

  return typeof rawDepth === "number" && Number.isFinite(rawDepth)
    ? rawDepth
    : 1;
}

function resolveRiskLevel(
  workItem: EvaluateContinuationPolicyInput["workItem"]
): ContinuationRiskLevel {
  const riskLevel = workItem?.metadata?.risk_level;

  if (riskLevel === "high" || riskLevel === "medium") {
    return riskLevel;
  }

  return "low";
}

function hasExternalActionSignals({
  queueItem,
  workItem,
  capabilityResult,
}: Pick<
  EvaluateContinuationPolicyInput,
  "queueItem" | "workItem" | "capabilityResult"
>) {
  const metadata = {
    ...workItem?.metadata,
    ...queueItem?.metadata,
  };

  if (
    metadata.external_action === true ||
    metadata.external_side_effect_requested === true
  ) {
    return true;
  }

  return /\b(send|email|webhook|api call|external|outreach|publish)\b/i.test(
    [
      queueItem?.queue_reason,
      queueItem?.next_action,
      capabilityResult.recommended_next_action,
      capabilityResult.result.summary,
      ...capabilityResult.result.evidence,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function hasOpenAiSignals({
  queueItem,
  workItem,
  capabilityResult,
}: Pick<
  EvaluateContinuationPolicyInput,
  "queueItem" | "workItem" | "capabilityResult"
>) {
  const metadata = {
    ...workItem?.metadata,
    ...queueItem?.metadata,
  };

  if (
    metadata.openai_required === true ||
    metadata.requires_openai === true
  ) {
    return true;
  }

  return /\b(openai|gpt|llm|model call|chat completion)\b/i.test(
    [
      queueItem?.queue_reason,
      queueItem?.next_action,
      capabilityResult.recommended_next_action,
      capabilityResult.result.summary,
      ...capabilityResult.result.evidence,
    ]
      .filter(Boolean)
      .join(" ")
  );
}
