import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type WorkItemTimelineItem = {
  id: string;
  type:
    | "ai_event"
    | "agent_execution"
    | "agent_decision"
    | "human_review"
    | "memory_entry";
  source:
    | "ai_events"
    | "agent_executions"
    | "agent_decisions"
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
  status: string | null;
  review_type: string | null;
  decision: string | null;
  requested_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string | null;
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
        "status",
        "review_type",
        "decision",
        "requested_at",
        "reviewed_at",
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
  if (row.decision_type === "handoff") {
    return normalizeHandoffDecision(row);
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
    title: row.review_type
      ? `Human review: ${row.review_type}`
      : "Human review",
    message: row.decision
      ? `Decision: ${row.decision}`
      : "Human review requested",
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
      requested_at: row.requested_at,
      reviewed_at: row.reviewed_at,
      updated_at: row.updated_at,
    },
  };
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
