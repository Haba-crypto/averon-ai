import type { AgentRuntimeContext } from "@/lib/application/agents/build-agent-runtime-context";

export type AgentCapabilityId =
  | "prepare_follow_up_task"
  | "summarize_review_decision"
  | "mark_execution_ready"
  | "qualify_lead_next_step"
  | "propose_discovery_question"
  | "summarize_account_context"
  | "identify_missing_information"
  | "prepare_proposal_next_step"
  | "summarize_deal_risk"
  | "generic_next_step";

export type AgentCapabilityResult = {
  summary: string;
  evidence: string[];
  safety_flags: string[];
};

export type AgentCapabilityExecutionResult = {
  capability_id: AgentCapabilityId;
  capability_name: string;
  result: AgentCapabilityResult;
  recommended_next_action: string;
  created_tasks?: [];
  created_decisions?: [];
};

export type AgentCapability = {
  id: AgentCapabilityId;
  name: string;
  agent_name: string;
  description: string;
  input_schema_shape: Record<string, string>;
  handler: (
    runtimeContext: AgentRuntimeContext
  ) => AgentCapabilityExecutionResult;
};

type ExecuteAgentCapabilityInput = {
  organizationId: string;
  agentExecutionId: string;
  runtimeContext: AgentRuntimeContext;
  capability?: AgentCapability | null;
};

const BASE_INPUT_SCHEMA = {
  organization_id: "string",
  queue_item: "object",
  work_item: "object",
  assigned_agent: "object",
  human_review_context: "object|null",
  memory_context: "object",
  recommended_next_action: "string|null",
  safety_flags: "string[]",
};

export const AGENT_CAPABILITY_REGISTRY: AgentCapability[] = [
  {
    id: "prepare_follow_up_task",
    name: "Prepare Follow-up Task",
    agent_name: "Operations Agent",
    description:
      "Prepare a deterministic follow-up task recommendation without creating the task.",
    input_schema_shape: BASE_INPUT_SCHEMA,
    handler: (context) =>
      buildResult({
        context,
        capabilityId: "prepare_follow_up_task",
        capabilityName: "Prepare Follow-up Task",
        summary: "Prepared a follow-up task recommendation for manual review.",
        recommendedNextAction:
          context.recommended_next_action ??
          "Review the work item and create a follow-up task if still needed.",
        evidence: [
          context.queue_item.queue_reason,
          context.work_item.last_owner_change_reason,
        ],
      }),
  },
  {
    id: "summarize_review_decision",
    name: "Summarize Review Decision",
    agent_name: "Operations Agent",
    description:
      "Summarize the approved human review decision and preserve the recommended next action.",
    input_schema_shape: BASE_INPUT_SCHEMA,
    handler: (context) =>
      buildResult({
        context,
        capabilityId: "summarize_review_decision",
        capabilityName: "Summarize Review Decision",
        summary: buildReviewDecisionSummary(context),
        recommendedNextAction:
          context.human_review_context?.recommended_action ??
          context.recommended_next_action ??
          "Continue the approved operations workflow.",
        evidence: [
          context.human_review_context?.review_title,
          context.human_review_context?.review_outcome,
          context.human_review_context?.review_notes,
          context.queue_item.queue_reason,
        ],
      }),
  },
  {
    id: "mark_execution_ready",
    name: "Mark Execution Ready",
    agent_name: "Operations Agent",
    description:
      "Confirm the queue item is ready for a controlled single-step execution resume.",
    input_schema_shape: BASE_INPUT_SCHEMA,
    handler: (context) =>
      buildResult({
        context,
        capabilityId: "mark_execution_ready",
        capabilityName: "Mark Execution Ready",
        summary:
          "Confirmed the work item is ready for a controlled execution resume.",
        recommendedNextAction:
          context.recommended_next_action ??
          "Resume the next approved execution step.",
        evidence: [
          context.ownership.ownership_status,
          context.queue_item.next_action,
          context.work_item.last_owner_change_reason,
        ],
      }),
  },
  {
    id: "qualify_lead_next_step",
    name: "Qualify Lead Next Step",
    agent_name: "SDR Agent",
    description:
      "Choose the next deterministic lead qualification step from lead and memory context.",
    input_schema_shape: BASE_INPUT_SCHEMA,
    handler: (context) =>
      buildResult({
        context,
        capabilityId: "qualify_lead_next_step",
        capabilityName: "Qualify Lead Next Step",
        summary: "Prepared the next lead qualification step.",
        recommendedNextAction:
          context.recommended_next_action ??
          "Ask one focused qualification question before advancing the lead.",
        evidence: [
          context.lead?.status,
          numberToString(context.lead?.intent_score),
          context.lead?.urgency,
        ],
      }),
  },
  {
    id: "propose_discovery_question",
    name: "Propose Discovery Question",
    agent_name: "SDR Agent",
    description:
      "Suggest one deterministic discovery question for incomplete qualification context.",
    input_schema_shape: BASE_INPUT_SCHEMA,
    handler: (context) =>
      buildResult({
        context,
        capabilityId: "propose_discovery_question",
        capabilityName: "Propose Discovery Question",
        summary:
          "Prepared a discovery question to clarify the prospect's immediate need.",
        recommendedNextAction:
          "Ask what outcome the prospect needs most from the next conversation.",
        evidence: [context.lead?.status, context.queue_item.queue_reason],
      }),
  },
  {
    id: "summarize_account_context",
    name: "Summarize Account Context",
    agent_name: "Research Agent",
    description:
      "Summarize known account context from deterministic runtime memory.",
    input_schema_shape: BASE_INPUT_SCHEMA,
    handler: (context) =>
      buildResult({
        context,
        capabilityId: "summarize_account_context",
        capabilityName: "Summarize Account Context",
        summary: "Summarized available account context from runtime memory.",
        recommendedNextAction:
          context.recommended_next_action ??
          "Use known account context to clarify requirements.",
        evidence: collectMemoryEvidence(context),
      }),
  },
  {
    id: "identify_missing_information",
    name: "Identify Missing Information",
    agent_name: "Research Agent",
    description:
      "Identify missing information that blocks confident account progression.",
    input_schema_shape: BASE_INPUT_SCHEMA,
    handler: (context) =>
      buildResult({
        context,
        capabilityId: "identify_missing_information",
        capabilityName: "Identify Missing Information",
        summary:
          "Identified missing information required before progressing the work item.",
        recommendedNextAction:
          context.recommended_next_action ??
          "Collect the missing lead, review, or account context before continuing.",
        evidence: context.safety_flags,
      }),
  },
  {
    id: "prepare_proposal_next_step",
    name: "Prepare Proposal Next Step",
    agent_name: "Closer Agent",
    description:
      "Prepare the next proposal step without generating or sending a proposal.",
    input_schema_shape: BASE_INPUT_SCHEMA,
    handler: (context) =>
      buildResult({
        context,
        capabilityId: "prepare_proposal_next_step",
        capabilityName: "Prepare Proposal Next Step",
        summary:
          "Prepared the next proposal step from the current review and deal context.",
        recommendedNextAction:
          context.recommended_next_action ??
          "Confirm proposal scope, stakeholders, and decision timing.",
        evidence: [
          context.human_review_context?.review_summary,
          context.human_review_context?.recommended_action,
          ...collectMemoryEvidence(context),
        ],
      }),
  },
  {
    id: "summarize_deal_risk",
    name: "Summarize Deal Risk",
    agent_name: "Closer Agent",
    description:
      "Summarize known deal risks from objections, risk memory, and review notes.",
    input_schema_shape: BASE_INPUT_SCHEMA,
    handler: (context) =>
      buildResult({
        context,
        capabilityId: "summarize_deal_risk",
        capabilityName: "Summarize Deal Risk",
        summary: "Summarized known deal risk signals.",
        recommendedNextAction:
          context.recommended_next_action ??
          "Address the clearest risk before asking for commitment.",
        evidence: [
          ...context.memory_context.risks.map((entry) => entry.content),
          ...context.memory_context.objections.map(
            (entry) => entry.content
          ),
          context.human_review_context?.review_notes,
        ],
      }),
  },
  {
    id: "generic_next_step",
    name: "Generic Next Step",
    agent_name: "Any Agent",
    description:
      "Fallback deterministic next-step recommendation when no specific capability rule matches.",
    input_schema_shape: BASE_INPUT_SCHEMA,
    handler: (context) =>
      buildResult({
        context,
        capabilityId: "generic_next_step",
        capabilityName: "Generic Next Step",
        summary: "Prepared a generic next-step recommendation.",
        recommendedNextAction:
          context.recommended_next_action ??
          "Review the runtime context and choose the next manual action.",
        evidence: [
          context.queue_item.queue_reason,
          context.work_item.last_owner_change_reason,
        ],
      }),
  },
];

export function selectAgentCapability(
  runtimeContext: AgentRuntimeContext
) {
  const agentName = runtimeContext.assigned_agent.name;
  const textSignals = buildSearchText(runtimeContext);

  if (
    agentName === "Operations Agent" &&
    runtimeContext.human_review_context?.status === "approved"
  ) {
    return getCapability("summarize_review_decision");
  }

  if (
    agentName === "Operations Agent" &&
    runtimeContext.ownership.ownership_status === "ready_to_resume"
  ) {
    return getCapability("mark_execution_ready");
  }

  if (agentName === "SDR Agent" && hasLeadQualificationContext(runtimeContext)) {
    return getCapability("qualify_lead_next_step");
  }

  if (
    agentName === "Research Agent" &&
    hasMissingInformationFlags(runtimeContext)
  ) {
    return getCapability("identify_missing_information");
  }

  if (
    agentName === "Closer Agent" &&
    (runtimeContext.human_review_context || /\bproposal|review\b/i.test(textSignals))
  ) {
    return getCapability("prepare_proposal_next_step");
  }

  if (agentName === "Operations Agent") {
    return getCapability("summarize_review_decision");
  }

  return getCapability("generic_next_step");
}

export function executeAgentCapability({
  organizationId,
  agentExecutionId,
  runtimeContext,
  capability,
}: ExecuteAgentCapabilityInput) {
  const selectedCapability = capability ?? selectAgentCapability(runtimeContext);
  const execution = selectedCapability.handler(runtimeContext);

  return {
    ...execution,
    result: {
      ...execution.result,
      organization_id: organizationId,
      agent_execution_id: agentExecutionId,
    },
    created_tasks: execution.created_tasks ?? [],
    created_decisions: execution.created_decisions ?? [],
  };
}

function getCapability(id: AgentCapabilityId) {
  const capability = AGENT_CAPABILITY_REGISTRY.find(
    (candidate) => candidate.id === id
  );

  if (!capability) {
    throw new Error(`Agent capability not found: ${id}`);
  }

  return capability;
}

function buildResult({
  context,
  capabilityId,
  capabilityName,
  summary,
  recommendedNextAction,
  evidence,
}: {
  context: AgentRuntimeContext;
  capabilityId: AgentCapabilityId;
  capabilityName: string;
  summary: string;
  recommendedNextAction: string;
  evidence: Array<string | null | undefined>;
}): AgentCapabilityExecutionResult {
  return {
    capability_id: capabilityId,
    capability_name: capabilityName,
    result: {
      summary,
      evidence: evidence.filter((item): item is string => Boolean(item)),
      safety_flags: context.safety_flags,
    },
    recommended_next_action: recommendedNextAction,
    created_tasks: [],
    created_decisions: [],
  };
}

function buildReviewDecisionSummary(context: AgentRuntimeContext) {
  const review = context.human_review_context;

  if (!review) {
    return "No human review context was available; preserved the safest next action.";
  }

  return `Human review ${review.status ?? "recorded"}: ${
    review.review_outcome ?? review.review_summary ?? "decision captured"
  }.`;
}

function hasLeadQualificationContext(context: AgentRuntimeContext) {
  const searchText = buildSearchText(context);

  return (
    Boolean(context.lead) ||
    /\bqualif|lead|discovery|intent|urgency\b/i.test(searchText)
  );
}

function hasMissingInformationFlags(context: AgentRuntimeContext) {
  return (
    context.safety_flags.length > 0 ||
    /\bmissing|unknown|research|requirement|constraint\b/i.test(
      buildSearchText(context)
    )
  );
}

function collectMemoryEvidence(context: AgentRuntimeContext) {
  return [
    ...context.memory_context.facts,
    ...context.memory_context.preferences,
    ...context.memory_context.risks,
    ...context.memory_context.decisions,
    ...context.memory_context.summaries,
  ].map((entry) => entry.content);
}

function buildSearchText(context: AgentRuntimeContext) {
  return [
    context.queue_item.queue_reason,
    context.queue_item.next_action,
    context.work_item.type,
    context.work_item.last_owner_change_reason,
    context.human_review_context?.review_title,
    context.human_review_context?.review_summary,
    context.human_review_context?.recommended_action,
    context.human_review_context?.review_notes,
  ]
    .filter(Boolean)
    .join(" ");
}

function numberToString(value: number | null | undefined) {
  return typeof value === "number" ? String(value) : null;
}
