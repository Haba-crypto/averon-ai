import type { AgentCapability } from "@/lib/application/agents/agent-capabilities";
import type { AgentExecutionPlan } from "@/lib/application/agents/agent-planning";
import type { AgentRuntimeContext } from "@/lib/application/agents/build-agent-runtime-context";
import type { ContinuationPolicyDecision } from "@/lib/application/agents/continuation-policy";
import type { ExecutionOutcomeEvaluation } from "@/lib/application/agents/outcome-evaluation";

export type PolicyAutonomyLevel =
  | "manual"
  | "assisted"
  | "guarded"
  | "blocked";
export type PolicyRiskLevel = "low" | "medium" | "high";

export type PolicyGovernanceCheck = {
  check: string;
  passed: boolean;
  reason: string;
};

export type PolicyGovernanceDecision = {
  allowed: boolean;
  blocked: boolean;
  human_review_required: boolean;
  escalation_required: boolean;
  autonomy_level: PolicyAutonomyLevel;
  risk_level: PolicyRiskLevel;
  policy_reason: string;
  policy_checks: PolicyGovernanceCheck[];
};

type EvaluatePolicyGovernanceInput = {
  organizationId: string;
  runtimeContext: AgentRuntimeContext | null;
  selectedCapability?: AgentCapability | null;
  executionPlan?: AgentExecutionPlan | null;
  priorityResult?: Record<string, unknown> | null;
  continuationPolicy?: ContinuationPolicyDecision | null;
  outcomeEvaluation?: ExecutionOutcomeEvaluation | null;
};

const REVIEW_REQUIRED_PATTERN =
  /\b(legal|compliance|security|contract|procurement|approval|approve|approved|signoff|risk review)\b/i;
const EXTERNAL_SIDE_EFFECT_PATTERN =
  /\b(send|email|message|sms|outreach|webhook|publish|post|external api|api call|contact customer|notify customer)\b/i;
const OPENAI_PATTERN =
  /\b(openai|gpt|llm|model call|chat completion|responses api)\b/i;

export function evaluatePolicyGovernance({
  organizationId,
  runtimeContext,
  selectedCapability = null,
  executionPlan = null,
  priorityResult = null,
  continuationPolicy = null,
  outcomeEvaluation = null,
}: EvaluatePolicyGovernanceInput): PolicyGovernanceDecision {
  const riskLevel = resolveRiskLevel({
    runtimeContext,
    executionPlan,
    priorityResult,
    continuationPolicy,
  });
  const metadata = collectMetadata(runtimeContext);
  const reviewStatus = runtimeContext?.human_review_context?.status ?? null;
  const reviewOutcome =
    runtimeContext?.human_review_context?.review_outcome ?? null;
  const textSignals = buildSignalText({
    runtimeContext,
    selectedCapability,
    executionPlan,
    continuationPolicy,
    outcomeEvaluation,
  });
  const reviewSignals = REVIEW_REQUIRED_PATTERN.test(textSignals);
  const externalSideEffectRequested =
    metadata.external_side_effect_requested === true ||
    metadata.external_action === true ||
    metadata.requires_external_action === true ||
    EXTERNAL_SIDE_EFFECT_PATTERN.test(textSignals);
  const emailOrMessageRequested =
    metadata.email_sending_requested === true ||
    metadata.message_sending_requested === true ||
    /\b(send email|email customer|send message|message customer|sms)\b/i.test(
      textSignals
    );
  const openaiRequired =
    metadata.openai_required === true ||
    metadata.requires_openai === true ||
    OPENAI_PATTERN.test(textSignals);
  const openaiAllowed = metadata.openai_allowed === true;
  const humanApproved = reviewStatus === "approved";
  const rejectedReview =
    reviewStatus === "rejected" ||
    /\breject|blocked|denied\b/i.test(reviewOutcome ?? "");
  const staleReview = runtimeContext?.safety_flags.includes("stale_review") ?? false;
  const missingHumanReview =
    runtimeContext?.safety_flags.includes("missing_human_review") ?? true;
  const continuationBlocked =
    continuationPolicy?.allowed === false ||
    continuationPolicy?.mode === "blocked" ||
    metadata.continuation_allowed === false ||
    metadata.continuation_mode === "blocked";
  const blockedOwnership =
    runtimeContext?.ownership.ownership_status === "blocked" ||
    runtimeContext?.work_item.ownership_status === "blocked";
  const missingWorkItem = !runtimeContext?.work_item?.id;
  const missingAssignedAgent = !(
    runtimeContext?.queue_item.assigned_agent_id ||
    runtimeContext?.queue_item.assigned_agent_name
  );
  const requiresHumanReview =
    reviewSignals ||
    riskLevel === "high" ||
    staleReview ||
    executionPlan?.requires_human_review === true ||
    continuationPolicy?.requires_human_review === true ||
    metadata.human_review_required === true ||
    metadata.requires_human_review === true;

  const checks: PolicyGovernanceCheck[] = [
    check("organization_present", Boolean(organizationId), "Organization scope is present.", "Organization scope is missing."),
    check("work_item_present", !missingWorkItem, "Work item is present.", "Work item is missing."),
    check("assigned_agent_present", !missingAssignedAgent, "Assigned agent is present.", "Assigned agent is missing."),
    check("ownership_not_blocked", !blockedOwnership, "Ownership is not blocked.", "Ownership is blocked."),
    check("review_not_rejected", !rejectedReview, "Human review is not rejected.", "Human review is rejected."),
    check("internal_only", !externalSideEffectRequested, "Action remains internal-only.", "External side effect was requested."),
    check("no_email_or_message_send", !emailOrMessageRequested, "No email or message send was requested.", "Email or message sending was requested."),
    check("openai_allowed_if_required", !openaiRequired || openaiAllowed, "No disallowed OpenAI call is required.", "OpenAI is required but not explicitly allowed."),
    check("continuation_policy_allows", !continuationBlocked, "Continuation policy allows processing.", "Continuation policy blocked processing."),
    check("high_risk_has_human_review", riskLevel !== "high" || humanApproved, "High-risk work has human approval or is not high risk.", "High-risk work is missing human approval."),
    check("required_review_present", !requiresHumanReview || !missingHumanReview, "Required human review is present.", "Required human review is missing."),
    check("required_review_approved", !requiresHumanReview || humanApproved, "Required human review is approved.", "Required human review is not approved."),
  ];
  const failedChecks = checks.filter((policyCheck) => !policyCheck.passed);
  const blocked = failedChecks.some((policyCheck) =>
    [
      "organization_present",
      "work_item_present",
      "assigned_agent_present",
      "ownership_not_blocked",
      "review_not_rejected",
      "internal_only",
      "no_email_or_message_send",
      "openai_allowed_if_required",
      "continuation_policy_allows",
      "high_risk_has_human_review",
      "required_review_approved",
    ].includes(policyCheck.check)
  );
  const allowed = !blocked;
  const humanReviewRequired = requiresHumanReview;
  const escalationRequired =
    riskLevel === "high" ||
    blockedOwnership ||
    rejectedReview ||
    externalSideEffectRequested ||
    emailOrMessageRequested;

  return {
    allowed,
    blocked,
    human_review_required: humanReviewRequired,
    escalation_required: escalationRequired,
    autonomy_level: resolveAutonomyLevel({
      allowed,
      humanApproved,
      riskLevel,
      externalSideEffectRequested,
      emailOrMessageRequested,
      continuationPolicy,
    }),
    risk_level: riskLevel,
    policy_reason:
      failedChecks[0]?.reason ??
      buildAllowedReason({ humanApproved, riskLevel, continuationPolicy }),
    policy_checks: checks,
  };
}

function check(
  name: string,
  passed: boolean,
  passedReason: string,
  failedReason: string
): PolicyGovernanceCheck {
  return {
    check: name,
    passed,
    reason: passed ? passedReason : failedReason,
  };
}

function resolveAutonomyLevel({
  allowed,
  humanApproved,
  riskLevel,
  externalSideEffectRequested,
  emailOrMessageRequested,
  continuationPolicy,
}: {
  allowed: boolean;
  humanApproved: boolean;
  riskLevel: PolicyRiskLevel;
  externalSideEffectRequested: boolean;
  emailOrMessageRequested: boolean;
  continuationPolicy: ContinuationPolicyDecision | null;
}): PolicyAutonomyLevel {
  if (!allowed) {
    return "blocked";
  }

  if (!humanApproved) {
    return "manual";
  }

  if (
    continuationPolicy?.allowed === true &&
    continuationPolicy.mode !== "blocked" &&
    !externalSideEffectRequested &&
    !emailOrMessageRequested
  ) {
    return "guarded";
  }

  if (riskLevel === "low" || riskLevel === "medium") {
    return "assisted";
  }

  return "manual";
}

function buildAllowedReason({
  humanApproved,
  riskLevel,
  continuationPolicy,
}: {
  humanApproved: boolean;
  riskLevel: PolicyRiskLevel;
  continuationPolicy: ContinuationPolicyDecision | null;
}) {
  const autonomy =
    humanApproved && continuationPolicy?.allowed === true
      ? "guarded"
      : humanApproved
        ? "assisted"
        : "manual";

  return `Policy governance allowed ${riskLevel}-risk work in ${autonomy} mode.`;
}

function resolveRiskLevel({
  runtimeContext,
  executionPlan,
  priorityResult,
  continuationPolicy,
}: Pick<
  EvaluatePolicyGovernanceInput,
  | "runtimeContext"
  | "executionPlan"
  | "priorityResult"
  | "continuationPolicy"
>): PolicyRiskLevel {
  const metadata = collectMetadata(runtimeContext);
  const explicitRisk =
    normalizeRisk(metadata.risk_level) ??
    normalizeRisk(executionPlan?.risk_level) ??
    normalizeRisk(continuationPolicy?.risk_level);

  if (explicitRisk) {
    return explicitRisk;
  }

  const riskScore =
    getNumber(metadata, "risk_score") ?? getNumber(priorityResult, "risk_score");

  if (typeof riskScore === "number") {
    if (riskScore >= 70) {
      return "high";
    }

    if (riskScore >= 35) {
      return "medium";
    }
  }

  const textSignals = buildSignalText({ runtimeContext });

  if (/\b(legal|compliance|security|contract|procurement)\b/i.test(textSignals)) {
    return "high";
  }

  if (/\b(approval|proposal|budget|risk)\b/i.test(textSignals)) {
    return "medium";
  }

  return "low";
}

function normalizeRisk(value: unknown): PolicyRiskLevel | null {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : null;
}

function collectMetadata(runtimeContext: AgentRuntimeContext | null) {
  return {
    ...(runtimeContext?.queue_item.metadata ?? {}),
  };
}

function buildSignalText({
  runtimeContext,
  selectedCapability,
  executionPlan,
  continuationPolicy,
  outcomeEvaluation,
}: Partial<EvaluatePolicyGovernanceInput>) {
  return [
    runtimeContext?.queue_item.queue_reason,
    runtimeContext?.queue_item.next_action,
    runtimeContext?.recommended_next_action,
    runtimeContext?.work_item.type,
    runtimeContext?.work_item.status,
    runtimeContext?.work_item.ownership_status,
    runtimeContext?.work_item.last_owner_change_reason,
    runtimeContext?.human_review_context?.review_title,
    runtimeContext?.human_review_context?.review_summary,
    runtimeContext?.human_review_context?.recommended_action,
    runtimeContext?.human_review_context?.review_outcome,
    runtimeContext?.human_review_context?.review_notes,
    selectedCapability?.id,
    selectedCapability?.name,
    selectedCapability?.description,
    executionPlan?.recommended_next_step,
    continuationPolicy?.reason,
    outcomeEvaluation?.feedback_summary,
  ]
    .filter(Boolean)
    .join(" ");
}

function getNumber(
  value: Record<string, unknown> | null | undefined,
  key: string
) {
  const rawValue = value?.[key];

  return typeof rawValue === "number" && Number.isFinite(rawValue)
    ? rawValue
    : null;
}
