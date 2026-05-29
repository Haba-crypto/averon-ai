import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type WorkItemTimelineItem = {
  id: string;
  type:
    | "ai_event"
    | "agent_execution"
    | "agent_decision"
    | "execution_queue"
    | "human_review"
    | "memory_entry";
  source:
    | "ai_events"
    | "agent_executions"
    | "agent_decisions"
    | "execution_queue"
    | "human_reviews"
    | "memory_entries";
  title: string;
  message: string | null;
  status: string | null;
  agent_id: string | null;
  confidence: number | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

export type WorkItemTimelinePage = {
  items: WorkItemTimelineItem[];
  limit: number;
  offset: number | null;
  next_offset: number | null;
  cursor: string | null;
  next_cursor: string | null;
  has_more: boolean;
};

export class WorkItemTimelineNotFoundError extends Error {
  constructor() {
    super("Work item not found");
    this.name = "WorkItemTimelineNotFoundError";
  }
}

export async function listWorkItemTimeline({
  supabase,
  workItemId,
  organizationId,
  limit = DEFAULT_LIMIT,
  offset,
  cursor,
}: {
  supabase: SupabaseClient;
  workItemId: string;
  organizationId: string;
  limit?: number;
  offset?: number;
  cursor?: string | null;
}): Promise<WorkItemTimelinePage> {
  const pageLimit = normalizeLimit(limit);
  const pageOffset = normalizeOffset(offset);
  const queryLimit = pageLimit + pageOffset + 1;

  const { data: workItem, error: workItemError } = await supabase
    .from("work_items")
    .select("id")
    .eq("id", workItemId)
    .eq("organization_id", organizationId)
    .maybeSingle<{ id: string }>();

  if (workItemError) {
    throw workItemError;
  }

  if (!workItem) {
    throw new WorkItemTimelineNotFoundError();
  }

  const [
    aiEventsResult,
    agentExecutionsResult,
    agentDecisionsResult,
    executionQueueResult,
    humanReviewsResult,
    memoryEntriesResult,
  ] = await Promise.all([
    listAiEventRows({
      supabase,
      workItemId,
      organizationId,
      limit: queryLimit,
      cursor,
    }),
    listAgentExecutionRows({
      supabase,
      workItemId,
      organizationId,
      limit: queryLimit,
      cursor,
    }),
    listAgentDecisionRows({
      supabase,
      workItemId,
      organizationId,
      limit: queryLimit,
      cursor,
    }),
    listExecutionQueueRows({
      supabase,
      workItemId,
      organizationId,
      limit: queryLimit,
      cursor,
    }),
    listHumanReviewRows({
      supabase,
      workItemId,
      organizationId,
      limit: queryLimit,
      cursor,
    }),
    listMemoryEntryRows({
      supabase,
      workItemId,
      organizationId,
      limit: queryLimit,
      cursor,
    }),
  ]);

  const normalizedItems = [
    ...aiEventsResult.map(normalizeAiEvent),
    ...agentExecutionsResult.map(normalizeAgentExecution),
    ...agentDecisionsResult.map(normalizeAgentDecision),
    ...executionQueueResult.map(normalizeExecutionQueue),
    ...humanReviewsResult.map(normalizeHumanReview),
    ...memoryEntriesResult.map(normalizeMemoryEntry),
  ].sort(compareTimelineItems);

  const pagedItems = normalizedItems.slice(
    pageOffset,
    pageOffset + pageLimit
  );
  const hasMore = normalizedItems.length > pageOffset + pageLimit;
  const lastItem = pagedItems[pagedItems.length - 1] ?? null;

  return {
    items: pagedItems,
    limit: pageLimit,
    offset: cursor ? null : pageOffset,
    next_offset:
      !cursor && hasMore ? pageOffset + pageLimit : null,
    cursor: cursor ?? null,
    next_cursor: hasMore && lastItem ? lastItem.created_at : null,
    has_more: hasMore,
  };
}

type TimelineQueryOptions = {
  supabase: SupabaseClient;
  workItemId: string;
  organizationId: string;
  limit: number;
  cursor?: string | null;
};

type AiEventRow = {
  id: string;
  type: string | null;
  message: string | null;
  lead_id?: string | null;
  work_item_id: string | null;
  created_at: string;
};

type AgentExecutionRow = {
  id: string;
  agent_id: string | null;
  agent_name: string | null;
  agent_role: string | null;
  workflow_run_id: string | null;
  workflow_step_id: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
};

type AgentDecisionRow = {
  id: string;
  agent_execution_id: string | null;
  agent_id: string | null;
  decision_type: string;
  decision: Record<string, unknown> | null;
  rationale: string | null;
  confidence: number | string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type HumanReviewRow = {
  id: string;
  agent_execution_id: string | null;
  agent_decision_id: string | null;
  requested_by: string | null;
  reviewer_user_id: string | null;
  source_agent_id: string | null;
  source_agent_name: string | null;
  status: string | null;
  review_type: string | null;
  review_reason: string | null;
  review_title: string | null;
  review_summary: string | null;
  review_context: Record<string, unknown> | null;
  recommended_action: string | null;
  priority: string | null;
  decision: string | null;
  requested_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_outcome: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string | null;
};

type ExecutionQueueRow = {
  id: string;
  review_id: string | null;
  source_decision_id: string | null;
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  status: string | null;
  priority: string | null;
  queue_reason: string | null;
  next_action: string | null;
  created_at: string;
  updated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type MemoryEntryRow = {
  id: string;
  agent_id: string | null;
  lead_id: string | null;
  source_agent_execution_id: string | null;
  scope: string | null;
  key: string | null;
  content: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string | null;
};

async function listAiEventRows(options: TimelineQueryOptions) {
  let query = options.supabase
    .from("ai_events")
    .select("id, type, message, lead_id, work_item_id, created_at")
    .eq("work_item_id", options.workItemId)
    .eq("organization_id", options.organizationId)
    .order("created_at", {
      ascending: false,
    })
    .limit(options.limit);

  if (options.cursor) {
    query = query.lt("created_at", options.cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as AiEventRow[];
}

async function listAgentExecutionRows(options: TimelineQueryOptions) {
  let query = options.supabase
    .from("agent_executions")
    .select(
      [
        "id",
        "agent_id",
        "agent_name",
        "agent_role",
        "workflow_run_id",
        "workflow_step_id",
        "status",
        "metadata",
        "error",
        "started_at",
        "completed_at",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .eq("work_item_id", options.workItemId)
    .eq("organization_id", options.organizationId)
    .order("created_at", {
      ascending: false,
    })
    .limit(options.limit);

  if (options.cursor) {
    query = query.lt("created_at", options.cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as AgentExecutionRow[];
}

async function listAgentDecisionRows(options: TimelineQueryOptions) {
  let query = options.supabase
    .from("agent_decisions")
    .select(
      [
        "id",
        "agent_execution_id",
        "agent_id",
        "decision_type",
        "decision",
        "rationale",
        "confidence",
        "metadata",
        "created_at",
      ].join(", ")
    )
    .eq("work_item_id", options.workItemId)
    .eq("organization_id", options.organizationId)
    .order("created_at", {
      ascending: false,
    })
    .limit(options.limit);

  if (options.cursor) {
    query = query.lt("created_at", options.cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as AgentDecisionRow[];
}

async function listHumanReviewRows(options: TimelineQueryOptions) {
  let query = options.supabase
    .from("human_reviews")
    .select(
      [
        "id",
        "agent_execution_id",
        "agent_decision_id",
        "requested_by",
        "reviewer_user_id",
        "source_agent_id",
        "source_agent_name",
        "status",
        "review_type",
        "review_reason",
        "review_title",
        "review_summary",
        "review_context",
        "recommended_action",
        "priority",
        "decision",
        "requested_at",
        "reviewed_at",
        "reviewed_by",
        "review_outcome",
        "review_notes",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .eq("work_item_id", options.workItemId)
    .eq("organization_id", options.organizationId)
    .order("created_at", {
      ascending: false,
    })
    .limit(options.limit);

  if (options.cursor) {
    query = query.lt("created_at", options.cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as HumanReviewRow[];
}

async function listExecutionQueueRows(options: TimelineQueryOptions) {
  let query = options.supabase
    .from("execution_queue")
    .select(
      [
        "id",
        "review_id",
        "source_decision_id",
        "assigned_agent_id",
        "assigned_agent_name",
        "status",
        "priority",
        "queue_reason",
        "next_action",
        "created_at",
        "updated_at",
        "started_at",
        "completed_at",
      ].join(", ")
    )
    .eq("work_item_id", options.workItemId)
    .eq("organization_id", options.organizationId)
    .order("created_at", {
      ascending: false,
    })
    .limit(options.limit);

  if (options.cursor) {
    query = query.lt("created_at", options.cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as ExecutionQueueRow[];
}

async function listMemoryEntryRows(options: TimelineQueryOptions) {
  let query = options.supabase
    .from("memory_entries")
    .select(
      [
        "id",
        "agent_id",
        "lead_id",
        "source_agent_execution_id",
        "scope",
        "key",
        "content",
        "expires_at",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .eq("work_item_id", options.workItemId)
    .eq("organization_id", options.organizationId)
    .order("created_at", {
      ascending: false,
    })
    .limit(options.limit);

  if (options.cursor) {
    query = query.lt("created_at", options.cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as MemoryEntryRow[];
}

function normalizeAiEvent(row: AiEventRow): WorkItemTimelineItem {
  return {
    id: `ai_events:${row.id}`,
    type: "ai_event",
    source: "ai_events",
    title: row.type ? `AI event: ${row.type}` : "AI event",
    message: row.message,
    status: null,
    agent_id: null,
    confidence: null,
    created_at: row.created_at,
    metadata: {
      record_id: row.id,
      event_type: row.type,
      lead_id: row.lead_id ?? null,
      work_item_id: row.work_item_id,
    },
  };
}

function normalizeAgentExecution(
  row: AgentExecutionRow
): WorkItemTimelineItem {
  return {
    id: `agent_executions:${row.id}`,
    type: "agent_execution",
    source: "agent_executions",
    title: row.status
      ? `${formatAgentLabel(row)} execution ${row.status}`
      : "Agent execution",
    message: summarizeExecution(row),
    status: row.status,
    agent_id: row.agent_id,
    confidence: null,
    created_at: row.created_at,
    metadata: {
      record_id: row.id,
      workflow_run_id: row.workflow_run_id,
      workflow_step_id: row.workflow_step_id,
      agent_name: row.agent_name,
      agent_role: row.agent_role,
      agent_identity: getAgentIdentityMetadata(row.metadata),
      started_at: row.started_at,
      completed_at: row.completed_at,
      updated_at: row.updated_at,
      error_message: getErrorMessage(row.error),
    },
  };
}

export function normalizeAgentExecutionForVerification(
  row: AgentExecutionRow
) {
  return normalizeAgentExecution(row);
}

function normalizeAgentDecision(
  row: AgentDecisionRow
): WorkItemTimelineItem {
  if (row.decision_type === "ownership_change") {
    return normalizeOwnershipChangeDecision(row);
  }

  if (row.decision_type === "handoff") {
    return normalizeHandoffDecision(row);
  }

  if (row.decision_type === "human_review_requested") {
    return normalizeHumanReviewRequestedDecision(row);
  }

  if (row.decision_type === "human_review_decision") {
    return normalizeHumanReviewDecision(row);
  }

  if (row.decision_type === "execution_resume_ready") {
    return normalizeExecutionResumeReadyDecision(row);
  }

  if (row.decision_type === "queue_execution_processed") {
    return normalizeQueueExecutionProcessedDecision(row);
  }

  return {
    id: `agent_decisions:${row.id}`,
    type: "agent_decision",
    source: "agent_decisions",
    title: `${formatAgentLabel(row)} decision: ${row.decision_type}`,
    message: row.rationale,
    status: null,
    agent_id: row.agent_id,
    confidence:
      row.confidence === null ? null : Number(row.confidence),
    created_at: row.created_at,
    metadata: {
      record_id: row.id,
      agent_execution_id: row.agent_execution_id,
      decision_type: row.decision_type,
      agent_identity: getAgentIdentityMetadata(row.metadata),
    },
  };
}

function normalizeExecutionResumeReadyDecision(
  row: AgentDecisionRow
): WorkItemTimelineItem {
  const outcome = getDecisionOutcome(row.decision);
  const resumeAgentName =
    getReviewString(row.metadata, "resume_agent_name") ??
    getReviewString(outcome, "resume_agent_name") ??
    "Operations Agent";
  const resumeReason =
    getReviewString(row.metadata, "resume_reason") ??
    getReviewString(outcome, "resume_reason") ??
    row.rationale;

  return {
    id: `agent_decisions:${row.id}`,
    type: "agent_decision",
    source: "agent_decisions",
    title: "Execution Resume Ready",
    message: `${resumeAgentName} can continue after human approval.`,
    status: "ready_to_resume",
    agent_id: row.agent_id,
    confidence:
      row.confidence === null ? null : Number(row.confidence),
    created_at: row.created_at,
    metadata: {
      record_id: row.id,
      agent_execution_id: row.agent_execution_id,
      decision_type: row.decision_type,
      review_id:
        getReviewString(row.metadata, "review_id") ??
        getReviewString(outcome, "review_id"),
      work_item_id:
        getReviewString(row.metadata, "work_item_id") ??
        getReviewString(outcome, "work_item_id"),
      source_review_status:
        getReviewString(row.metadata, "source_review_status") ??
        getReviewString(outcome, "source_review_status"),
      approved_by:
        getReviewString(row.metadata, "approved_by") ??
        getReviewString(outcome, "approved_by"),
      resume_agent_id:
        getReviewString(row.metadata, "resume_agent_id") ??
        getReviewString(outcome, "resume_agent_id"),
      resume_agent_name: resumeAgentName,
      resume_reason: resumeReason,
      recommended_next_action:
        getReviewString(row.metadata, "recommended_next_action") ??
        getReviewString(outcome, "recommended_next_action"),
      agent_identity: getAgentIdentityMetadata(row.metadata),
    },
  };
}

function normalizeQueueExecutionProcessedDecision(
  row: AgentDecisionRow
): WorkItemTimelineItem {
  const outcome = getDecisionOutcome(row.decision);
  const assignedAgentName =
    getReviewString(row.metadata, "assigned_agent_name") ??
    getReviewString(outcome, "assigned_agent_name") ??
    "Operations Agent";
  const nextAction =
    getReviewString(row.metadata, "next_action") ??
    getReviewString(outcome, "next_action");

  return {
    id: `agent_decisions:${row.id}`,
    type: "agent_decision",
    source: "agent_decisions",
    title: "Queue Item Processed",
    message: `${assignedAgentName} processed the resumed execution queue item.`,
    status: "processed",
    agent_id: row.agent_id,
    confidence:
      row.confidence === null ? null : Number(row.confidence),
    created_at: row.created_at,
    metadata: {
      record_id: row.id,
      agent_execution_id: row.agent_execution_id,
      decision_type: row.decision_type,
      queue_item_id:
        getReviewString(row.metadata, "queue_item_id") ??
        getReviewString(outcome, "queue_item_id"),
      work_item_id:
        getReviewString(row.metadata, "work_item_id") ??
        getReviewString(outcome, "work_item_id"),
      assigned_agent_name: assignedAgentName,
      next_action: nextAction,
      result:
        getReviewString(row.metadata, "result") ??
        getReviewString(outcome, "result"),
      agent_identity: getAgentIdentityMetadata(row.metadata),
    },
  };
}

function normalizeHandoffDecision(
  row: AgentDecisionRow
): WorkItemTimelineItem {
  const sourceAgent = getHandoffString(row, "source_agent");
  const targetAgent = getHandoffString(row, "target_agent");
  const shouldHandoff =
    getHandoffBoolean(row, "should_handoff") ?? Boolean(targetAgent);
  const reason = getHandoffString(row, "reason") ?? row.rationale;

  return {
    id: `agent_decisions:${row.id}`,
    type: "agent_decision",
    source: "agent_decisions",
    title: buildHandoffTitle({
      sourceAgent: sourceAgent ?? formatAgentLabel(row),
      targetAgent,
      shouldHandoff,
    }),
    message: reason,
    status: shouldHandoff ? "handoff" : "continued",
    agent_id: row.agent_id,
    confidence:
      row.confidence === null ? null : Number(row.confidence),
    created_at: row.created_at,
    metadata: {
      record_id: row.id,
      agent_execution_id: row.agent_execution_id,
      decision_type: row.decision_type,
      should_handoff: shouldHandoff,
      source_agent: sourceAgent,
      target_agent: targetAgent,
      reason,
      agent_identity: getAgentIdentityMetadata(row.metadata),
    },
  };
}

function normalizeHumanReviewRequestedDecision(
  row: AgentDecisionRow
): WorkItemTimelineItem {
  const outcome = getDecisionOutcome(row.decision);
  const reviewId =
    getReviewString(row.metadata, "review_id") ??
    getReviewString(outcome, "review_id");
  const reviewType =
    getReviewString(row.metadata, "review_type") ??
    getReviewString(outcome, "review_type");
  const reason =
    getReviewString(row.metadata, "reason") ??
    getReviewString(outcome, "reason") ??
    row.rationale;
  const priority =
    getReviewString(row.metadata, "priority") ??
    getReviewString(outcome, "priority");
  const reviewTitle =
    getReviewString(row.metadata, "review_title") ??
    getReviewString(outcome, "review_title");
  const reviewSummary =
    getReviewString(row.metadata, "review_summary") ??
    getReviewString(outcome, "review_summary");
  const recommendedAction =
    getReviewString(row.metadata, "recommended_action") ??
    getReviewString(outcome, "recommended_action");

  return {
    id: `agent_decisions:${row.id}`,
    type: "agent_decision",
    source: "agent_decisions",
    title: "Human Review Requested",
    message: reviewTitle ?? reason,
    status: "pending",
    agent_id: row.agent_id,
    confidence:
      row.confidence === null ? null : Number(row.confidence),
    created_at: row.created_at,
    metadata: {
      record_id: row.id,
      agent_execution_id: row.agent_execution_id,
      decision_type: row.decision_type,
      review_id: reviewId,
      review_type: reviewType,
      review_title: reviewTitle,
      review_summary: reviewSummary,
      recommended_action: recommendedAction,
      reason,
      priority,
      agent_identity: getAgentIdentityMetadata(row.metadata),
    },
  };
}

function normalizeHumanReviewDecision(
  row: AgentDecisionRow
): WorkItemTimelineItem {
  const outcome = getDecisionOutcome(row.decision);
  const reviewStatus =
    getReviewString(row.metadata, "review_status") ??
    getReviewString(outcome, "review_status");
  const reviewOutcome =
    getReviewString(row.metadata, "review_outcome") ??
    getReviewString(outcome, "review_outcome");
  const reviewNotes =
    getReviewString(row.metadata, "review_notes") ??
    getReviewString(outcome, "review_notes");
  const nextOwner =
    getFeedbackOwner(row.metadata, "next_owner") ??
    getFeedbackOwner(outcome, "next_owner");
  const recommendedNextAgent =
    getFeedbackOwner(row.metadata, "recommended_next_agent") ??
    getFeedbackOwner(outcome, "recommended_next_agent");
  const nextAgentName =
    getOwnershipString(recommendedNextAgent, "name") ??
    getOwnershipString(nextOwner, "owner_agent_name") ??
    "Operations Agent";

  return {
    id: `agent_decisions:${row.id}`,
    type: "agent_decision",
    source: "agent_decisions",
    title: buildHumanReviewDecisionTitle({
      reviewStatus,
      nextAgentName,
    }),
    message: reviewNotes ?? reviewOutcome ?? row.rationale,
    status: reviewStatus,
    agent_id: row.agent_id,
    confidence:
      row.confidence === null ? null : Number(row.confidence),
    created_at: row.created_at,
    metadata: {
      record_id: row.id,
      agent_execution_id: row.agent_execution_id,
      decision_type: row.decision_type,
      review_id:
        getReviewString(row.metadata, "review_id") ??
        getReviewString(outcome, "review_id"),
      review_status: reviewStatus,
      review_outcome: reviewOutcome,
      review_notes: reviewNotes,
      decided_by:
        getReviewString(row.metadata, "decided_by") ??
        getReviewString(outcome, "decided_by"),
      previous_owner:
        getFeedbackOwner(row.metadata, "previous_owner") ??
        getFeedbackOwner(outcome, "previous_owner"),
      next_owner: nextOwner,
      recommended_next_agent: recommendedNextAgent,
      agent_identity: getAgentIdentityMetadata(row.metadata),
    },
  };
}

function normalizeOwnershipChangeDecision(
  row: AgentDecisionRow
): WorkItemTimelineItem {
  const outcome = getDecisionOutcome(row.decision);
  const previousOwner = getOwnershipOwner(outcome, "previous_owner");
  const newOwner = getOwnershipOwner(outcome, "new_owner");
  const sourceAgent = getOwnershipAgentName(outcome, "source_agent");
  const targetAgent = getOwnershipAgentName(outcome, "target_agent");
  const reason = getOwnershipString(outcome, "reason") ?? row.rationale;
  const ownershipStatus =
    getOwnershipString(newOwner, "ownership_status") ??
    getOwnershipString(row.metadata, "ownership_status");

  return {
    id: `agent_decisions:${row.id}`,
    type: "agent_decision",
    source: "agent_decisions",
    title: buildOwnershipChangeTitle({
      previousOwnerName: formatOwnershipOwner(previousOwner),
      newOwnerName: formatOwnershipOwner(newOwner),
      newOwnerType: getOwnershipString(newOwner, "owner_type"),
      sourceAgent,
      targetAgent,
      ownershipStatus,
    }),
    message: reason,
    status: ownershipStatus,
    agent_id: row.agent_id,
    confidence:
      row.confidence === null ? null : Number(row.confidence),
    created_at: row.created_at,
    metadata: {
      record_id: row.id,
      agent_execution_id: row.agent_execution_id,
      decision_type: row.decision_type,
      previous_owner: previousOwner,
      new_owner: newOwner,
      source_agent: sourceAgent,
      target_agent: targetAgent,
      reason,
      changed_at: getOwnershipString(outcome, "changed_at"),
      agent_identity: getAgentIdentityMetadata(row.metadata),
    },
  };
}

export function normalizeAgentDecisionForVerification(
  row: AgentDecisionRow
) {
  return normalizeAgentDecision(row);
}

function normalizeHumanReview(
  row: HumanReviewRow
): WorkItemTimelineItem {
  return {
    id: `human_reviews:${row.id}`,
    type: "human_review",
    source: "human_reviews",
    title: buildHumanReviewTitle(row.status),
    message: buildHumanReviewMessage(row),
    status: row.status,
    agent_id: null,
    confidence: null,
    created_at: row.created_at,
    metadata: {
      record_id: row.id,
      agent_execution_id: row.agent_execution_id,
      agent_decision_id: row.agent_decision_id,
      requested_by: row.requested_by,
      reviewer_user_id: row.reviewer_user_id,
      source_agent_id: row.source_agent_id,
      source_agent_name: row.source_agent_name,
      review_type: row.review_type,
      review_reason: row.review_reason,
      review_title: row.review_title,
      review_summary: row.review_summary,
      review_context: row.review_context,
      recommended_action: row.recommended_action,
      priority: row.priority,
      requested_at: row.requested_at,
      reviewed_at: row.reviewed_at,
      reviewed_by: row.reviewed_by,
      review_outcome: row.review_outcome,
      review_notes: row.review_notes,
      updated_at: row.updated_at,
    },
  };
}

export function normalizeHumanReviewForVerification(
  row: HumanReviewRow
) {
  return normalizeHumanReview(row);
}

function normalizeExecutionQueue(
  row: ExecutionQueueRow
): WorkItemTimelineItem {
  const agentName = row.assigned_agent_name ?? "Operations Agent";

  return {
    id: `execution_queue:${row.id}`,
    type: "execution_queue",
    source: "execution_queue",
    title: "Execution Queued",
    message: `${agentName} is ready to continue work.`,
    status: row.status,
    agent_id: row.assigned_agent_id,
    confidence: null,
    created_at: row.created_at,
    metadata: {
      record_id: row.id,
      review_id: row.review_id,
      source_decision_id: row.source_decision_id,
      assigned_agent_id: row.assigned_agent_id,
      assigned_agent_name: row.assigned_agent_name,
      priority: row.priority,
      queue_reason: row.queue_reason,
      next_action: row.next_action,
      updated_at: row.updated_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
    },
  };
}

function buildHumanReviewTitle(status: string | null) {
  if (status === "approved") {
    return "Human Review Approved";
  }

  if (status === "rejected") {
    return "Human Review Rejected";
  }

  if (status === "completed") {
    return "Human Review Completed";
  }

  if (status === "in_review") {
    return "Human Review In Review";
  }

  return "Human Review Requested";
}

function buildHumanReviewMessage(row: HumanReviewRow) {
  if (row.review_notes) {
    return row.review_notes;
  }

  if (row.review_outcome) {
    return row.review_outcome;
  }

  if (row.review_title) {
    return row.review_title;
  }

  if (row.review_summary) {
    return row.review_summary;
  }

  if (row.recommended_action) {
    return row.recommended_action;
  }

  if (row.review_reason) {
    return row.review_reason;
  }

  if (row.decision) {
    return `Decision: ${row.decision}`;
  }

  return row.review_type
    ? `Review type: ${row.review_type}`
    : "Human review requested";
}

function normalizeMemoryEntry(
  row: MemoryEntryRow
): WorkItemTimelineItem {
  return {
    id: `memory_entries:${row.id}`,
    type: "memory_entry",
    source: "memory_entries",
    title: row.key ? `Memory: ${row.key}` : "Memory entry",
    message: row.content,
    status: getMemoryStatus(row),
    agent_id: row.agent_id,
    confidence: null,
    created_at: row.created_at,
    metadata: {
      record_id: row.id,
      source_agent_execution_id:
        row.source_agent_execution_id,
      lead_id: row.lead_id,
      scope: row.scope,
      key: row.key,
      expires_at: row.expires_at,
      updated_at: row.updated_at,
    },
  };
}

function summarizeExecution(row: AgentExecutionRow) {
  const errorMessage = getErrorMessage(row.error);

  if (errorMessage) {
    return errorMessage;
  }

  if (row.completed_at) {
    return `Completed at ${row.completed_at}`;
  }

  if (row.started_at) {
    return `Started at ${row.started_at}`;
  }

  return null;
}

function formatAgentLabel(
  row:
    | Pick<AgentExecutionRow, "agent_name" | "metadata">
    | Pick<AgentDecisionRow, "metadata">
) {
  if ("agent_name" in row && row.agent_name) {
    return row.agent_name;
  }

  const identity = getAgentIdentityMetadata(row.metadata);

  if (
    identity &&
    "agent_name" in identity &&
    typeof identity.agent_name === "string"
  ) {
    return identity.agent_name;
  }

  return "Agent";
}

function buildHandoffTitle({
  sourceAgent,
  targetAgent,
  shouldHandoff,
}: {
  sourceAgent: string;
  targetAgent: string | null;
  shouldHandoff: boolean;
}) {
  if (!shouldHandoff || !targetAgent) {
    return `${sourceAgent} continued current execution`;
  }

  if (targetAgent === "Human Review") {
    return `${sourceAgent} requested Human Review`;
  }

  return `${sourceAgent} handed work to ${targetAgent}`;
}

function buildOwnershipChangeTitle({
  previousOwnerName,
  newOwnerName,
  newOwnerType,
  sourceAgent,
  targetAgent,
  ownershipStatus,
}: {
  previousOwnerName: string | null;
  newOwnerName: string | null;
  newOwnerType: string | null;
  sourceAgent: string | null;
  targetAgent: string | null;
  ownershipStatus: string | null;
}) {
  if (ownershipStatus === "blocked") {
    return "Work blocked by human decision";
  }

  if (ownershipStatus === "completed") {
    return "Human review completed";
  }

  if (ownershipStatus === "ready_to_resume" && newOwnerName) {
    return `Work ready to resume with ${newOwnerName}`;
  }

  if (newOwnerType === "human" || newOwnerType === "shared") {
    return "Work ownership moved to Human Review";
  }

  if (
    ownershipStatus === "transferred" &&
    sourceAgent &&
    targetAgent
  ) {
    return `Work ownership transferred from ${sourceAgent} to ${targetAgent}`;
  }

  if (
    ownershipStatus === "transferred" &&
    previousOwnerName &&
    newOwnerName
  ) {
    return `Work ownership transferred from ${previousOwnerName} to ${newOwnerName}`;
  }

  if (newOwnerName) {
    return `Work ownership assigned to ${newOwnerName}`;
  }

  return "Work ownership changed";
}

function buildHumanReviewDecisionTitle({
  reviewStatus,
  nextAgentName,
}: {
  reviewStatus: string | null;
  nextAgentName: string;
}) {
  if (reviewStatus === "approved") {
    return `Work returned to ${nextAgentName}`;
  }

  if (reviewStatus === "rejected") {
    return "Work blocked by human decision";
  }

  if (reviewStatus === "completed") {
    return "Human Review Completed";
  }

  return "Human review decision recorded";
}

function getOwnershipOwner(
  value: Record<string, unknown> | null,
  key: string
) {
  const owner = value?.[key];

  return owner && typeof owner === "object"
    ? (owner as Record<string, unknown>)
    : null;
}

function getOwnershipAgentName(
  value: Record<string, unknown> | null,
  key: string
) {
  const agent = value?.[key];

  if (typeof agent === "string") {
    return agent;
  }

  if (agent && typeof agent === "object") {
    const name = (agent as Record<string, unknown>).name;

    return typeof name === "string" ? name : null;
  }

  return null;
}

function formatOwnershipOwner(
  owner: Record<string, unknown> | null
) {
  const ownerType = getOwnershipString(owner, "owner_type");
  const agentName = getOwnershipString(owner, "owner_agent_name");

  if (ownerType === "ai" && agentName) {
    return agentName;
  }

  if (ownerType === "human") {
    return "Human Review";
  }

  if (ownerType === "shared") {
    return "Shared Human Review";
  }

  return null;
}

function getOwnershipString(
  value: Record<string, unknown> | null,
  key: string
) {
  const rawValue = value?.[key];

  return typeof rawValue === "string" ? rawValue : null;
}

function getHandoffString(row: AgentDecisionRow, key: string) {
  const metadataValue = row.metadata?.[key];

  if (typeof metadataValue === "string") {
    return metadataValue;
  }

  const decisionOutcome = getDecisionOutcome(row.decision);
  const outcomeValue = decisionOutcome?.[key];

  return typeof outcomeValue === "string" ? outcomeValue : null;
}

function getHandoffBoolean(row: AgentDecisionRow, key: string) {
  const metadataValue = row.metadata?.[key];

  if (typeof metadataValue === "boolean") {
    return metadataValue;
  }

  const decisionOutcome = getDecisionOutcome(row.decision);
  const outcomeValue = decisionOutcome?.[key];

  return typeof outcomeValue === "boolean" ? outcomeValue : null;
}

function getReviewString(
  value: Record<string, unknown> | null,
  key: string
) {
  const rawValue = value?.[key];

  return typeof rawValue === "string" ? rawValue : null;
}

function getFeedbackOwner(
  value: Record<string, unknown> | null,
  key: string
) {
  const rawValue = value?.[key];

  return rawValue && typeof rawValue === "object"
    ? (rawValue as Record<string, unknown>)
    : null;
}

function getDecisionOutcome(
  decision: Record<string, unknown> | null
) {
  const outcome = decision?.outcome;

  return outcome && typeof outcome === "object"
    ? (outcome as Record<string, unknown>)
    : null;
}

function getAgentIdentityMetadata(
  metadata: Record<string, unknown> | null
) {
  const identity = metadata?.agent_identity;

  return identity && typeof identity === "object"
    ? identity
    : null;
}

function getErrorMessage(error: Record<string, unknown> | null) {
  if (!error || !("message" in error)) {
    return null;
  }

  return typeof error.message === "string"
    ? error.message
    : null;
}

function getMemoryStatus(row: MemoryEntryRow) {
  if (!row.expires_at) {
    return "active";
  }

  return new Date(row.expires_at).getTime() <= Date.now()
    ? "expired"
    : "active";
}

function compareTimelineItems(
  left: WorkItemTimelineItem,
  right: WorkItemTimelineItem
) {
  const createdAtDelta =
    new Date(right.created_at).getTime() -
    new Date(left.created_at).getTime();

  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  return right.id.localeCompare(left.id);
}

function normalizeLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(
    1,
    Math.min(MAX_LIMIT, Math.floor(limit))
  );
}

function normalizeOffset(offset?: number) {
  if (!offset || !Number.isFinite(offset)) {
    return 0;
  }

  return Math.max(0, Math.floor(offset));
}
