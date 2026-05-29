import type { AgentRuntimeContext } from "@/lib/application/agents/build-agent-runtime-context";
import type {
  AgentCapability,
  AgentCapabilityExecutionResult,
} from "@/lib/application/agents/agent-capabilities";
import type { ContinuationPolicyDecision } from "@/lib/application/agents/continuation-policy";

export type AgentPlanRiskLevel = "low" | "medium" | "high";
export type AgentPlanStepStatus = "pending" | "ready" | "blocked";

export type AgentExecutionPlanStep = {
  id: string;
  title: string;
  description: string;
  status: AgentPlanStepStatus;
  risk_level: AgentPlanRiskLevel;
  requires_human_review: boolean;
};

export type AgentExecutionPlan = {
  plan_id: string;
  agent_name: string;
  capability_id: string;
  objective: string;
  steps: AgentExecutionPlanStep[];
  recommended_next_step: string;
  stop_condition: string;
  risk_level: AgentPlanRiskLevel;
  requires_human_review: boolean;
};

type BuildAgentExecutionPlanInput = {
  runtimeContext: AgentRuntimeContext;
  selectedCapability: AgentCapability;
  capabilityResult: AgentCapabilityExecutionResult;
  continuationPolicy?: ContinuationPolicyDecision | null;
};

type PlanStepTemplate = {
  title: string;
  description: string;
  risk_level?: AgentPlanRiskLevel;
  requires_human_review?: boolean;
};

type AgentPlanRule = {
  objective: string;
  steps: PlanStepTemplate[];
  recommended_next_step: string;
  stop_condition: string;
  risk_level: AgentPlanRiskLevel;
  requires_human_review: boolean;
};

export function buildAgentExecutionPlan({
  runtimeContext,
  selectedCapability,
  capabilityResult,
  continuationPolicy = null,
}: BuildAgentExecutionPlanInput): AgentExecutionPlan {
  const agentName = runtimeContext.assigned_agent.name;
  const rulePlan = resolvePlanRule({
    runtimeContext,
    capabilityResult,
    continuationPolicy,
  });
  const riskLevel = resolvePlanRiskLevel({
    ruleRiskLevel: rulePlan.risk_level,
    runtimeContext,
    continuationPolicy,
  });
  const requiresHumanReview =
    rulePlan.requires_human_review ||
    continuationPolicy?.requires_human_review === true ||
    riskLevel === "high";
  const steps = rulePlan.steps.map((step, index) => ({
    id: `step_${index + 1}`,
    title: step.title,
    description: step.description,
    status: "pending" as const,
    risk_level: step.risk_level ?? riskLevel,
    requires_human_review:
      step.requires_human_review ?? requiresHumanReview,
  }));

  return {
    plan_id: buildPlanId({
      runtimeContext,
      capabilityId: selectedCapability.id,
    }),
    agent_name: agentName,
    capability_id: selectedCapability.id,
    objective: rulePlan.objective,
    steps,
    recommended_next_step:
      capabilityResult.recommended_next_action ??
      rulePlan.recommended_next_step,
    stop_condition: rulePlan.stop_condition,
    risk_level: riskLevel,
    requires_human_review: requiresHumanReview,
  };
}

function resolvePlanRule({
  runtimeContext,
  capabilityResult,
  continuationPolicy,
}: {
  runtimeContext: AgentRuntimeContext;
  capabilityResult: AgentCapabilityExecutionResult;
  continuationPolicy: ContinuationPolicyDecision | null;
}): AgentPlanRule {
  const agentName = runtimeContext.assigned_agent.name;

  if (
    agentName === "Operations Agent" &&
    runtimeContext.human_review_context?.status === "approved"
  ) {
    return {
      objective: "Resume approved operations work in one controlled step.",
      recommended_next_step:
        capabilityResult.recommended_next_action ??
        "Resume the approved operations workflow.",
      stop_condition:
        continuationPolicy?.allowed === true
          ? "Stop after creating the controlled continuation queue item and wait for manual continuation."
          : "Stop after recording the plan and wait for the next manual action.",
      risk_level: continuationPolicy?.risk_level ?? "low",
      requires_human_review:
        continuationPolicy?.requires_human_review ?? true,
      steps: [
        {
          title: "Resume approved work",
          description:
            "Use the approved human review context as the boundary for the next operations action.",
        },
        {
          title: "Confirm ownership",
          description:
            "Confirm the work item remains assigned to Operations Agent before continuing.",
        },
        {
          title: "Create follow-up execution item",
          description:
            "Create or reuse the internal follow-up execution item for the approved next action.",
        },
        {
          title: "Wait for controlled continuation",
          description:
            "Stop after the follow-up item is queued and require manual controlled continuation.",
        },
      ],
    };
  }

  if (agentName === "SDR Agent") {
    return {
      objective: "Advance lead qualification with one deterministic next step.",
      recommended_next_step:
        capabilityResult.recommended_next_action ??
        "Ask one focused qualification question.",
      stop_condition:
        "Stop after updating the lead qualification state recommendation.",
      risk_level: "low" as const,
      requires_human_review: false,
      steps: [
        {
          title: "Qualify lead",
          description:
            "Review deterministic lead signals such as status, intent, urgency, and available memory.",
        },
        {
          title: "Ask next qualification question",
          description:
            "Prepare one focused qualification question for the next manual interaction.",
        },
        {
          title: "Update lead state",
          description:
            "Record the recommended qualification state transition without external outreach.",
        },
      ],
    };
  }

  if (agentName === "Research Agent") {
    return {
      objective: "Clarify missing account context before progression.",
      recommended_next_step:
        capabilityResult.recommended_next_action ??
        "Collect missing account context before continuing.",
      stop_condition:
        "Stop after queuing the research follow-up recommendation.",
      risk_level: "low" as const,
      requires_human_review: false,
      steps: [
        {
          title: "Identify missing info",
          description:
            "List the deterministic information gaps found in the runtime context.",
        },
        {
          title: "Summarize account context",
          description:
            "Summarize known account facts from memory and timeline context.",
        },
        {
          title: "Queue research follow-up",
          description:
            "Recommend an internal research follow-up without external actions.",
        },
      ],
    };
  }

  if (agentName === "Closer Agent") {
    const riskExists = hasDealRisk(runtimeContext, capabilityResult);

    return {
      objective: "Prepare the next proposal step with explicit risk handling.",
      recommended_next_step:
        capabilityResult.recommended_next_action ??
        "Confirm proposal scope, stakeholders, and decision timing.",
      stop_condition: riskExists
        ? "Stop after requesting approval for the identified deal risk."
        : "Stop after preparing the proposal next-step recommendation.",
      risk_level: riskExists ? ("medium" as const) : ("low" as const),
      requires_human_review: riskExists,
      steps: [
        {
          title: "Prepare proposal next step",
          description:
            "Define the next internal proposal action without sending a proposal.",
        },
        {
          title: "Identify deal risk",
          description:
            "Check objections, risk memory, safety flags, and review notes for proposal risk.",
          risk_level: riskExists ? "medium" : "low",
          requires_human_review: riskExists,
        },
        {
          title: "Request approval if risk exists",
          description:
            "Require human approval before continuing if deal risk is present.",
          risk_level: riskExists ? "medium" : "low",
          requires_human_review: riskExists,
        },
      ],
    };
  }

  return {
    objective: "Summarize runtime context and recommend the next safe step.",
    recommended_next_step:
      capabilityResult.recommended_next_action ??
      "Review the runtime context and choose the next manual action.",
    stop_condition:
      "Stop after recommending the next safe manual action.",
    risk_level: "low" as const,
    requires_human_review: false,
    steps: [
      {
        title: "Summarize context",
        description:
          "Summarize the deterministic runtime context available for this work item.",
      },
      {
        title: "Recommend next safe step",
        description:
          "Recommend one safe next step without external actions or autonomous continuation.",
      },
    ],
  };
}

function resolvePlanRiskLevel({
  ruleRiskLevel,
  runtimeContext,
  continuationPolicy,
}: {
  ruleRiskLevel: AgentPlanRiskLevel;
  runtimeContext: AgentRuntimeContext;
  continuationPolicy: ContinuationPolicyDecision | null;
}) {
  if (continuationPolicy?.risk_level) {
    return continuationPolicy.risk_level;
  }

  if (runtimeContext.safety_flags.includes("stale_review")) {
    return "medium";
  }

  return ruleRiskLevel;
}

function hasDealRisk(
  runtimeContext: AgentRuntimeContext,
  capabilityResult: AgentCapabilityExecutionResult
) {
  return (
    runtimeContext.memory_context.risks.length > 0 ||
    runtimeContext.memory_context.objections.length > 0 ||
    runtimeContext.safety_flags.includes("stale_review") ||
    /\brisk|objection|concern|blocked|approval\b/i.test(
      [
        capabilityResult.result.summary,
        ...capabilityResult.result.evidence,
        runtimeContext.human_review_context?.review_notes,
      ]
        .filter(Boolean)
        .join(" ")
    )
  );
}

function buildPlanId({
  runtimeContext,
  capabilityId,
}: {
  runtimeContext: AgentRuntimeContext;
  capabilityId: string;
}) {
  return [
    "plan",
    slugify(runtimeContext.assigned_agent.name),
    capabilityId,
    runtimeContext.queue_item.id,
  ].join("_");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
