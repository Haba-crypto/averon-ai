import type { SupabaseClient } from "@supabase/supabase-js";

import {
  countRelevantMemoryEntries,
  createEmptyRelevantMemory,
  retrieveRelevantMemory,
  type RelevantMemory,
} from "@/lib/application/memory/memory-retrieval";
import { listWorkItemTimeline } from "@/lib/application/work-items/list-work-item-timeline";

export const AGENT_RUNTIME_CONTEXT_VERSION = "v1";

export type AgentRuntimeSafetyFlag =
  | "missing_lead"
  | "missing_memory"
  | "missing_human_review"
  | "stale_review"
  | "no_recommended_next_action";

type BuildAgentRuntimeContextInput = {
  supabase: SupabaseClient;
  organizationId: string;
  queueItemId: string;
  workItemId: string;
  assignedAgentName: string;
};

type WorkItemContext = {
  id: string;
  type: string | null;
  status: string;
  owner_type: string | null;
  owner_agent_name: string | null;
  ownership_status: string | null;
  last_owner_change_reason: string | null;
};

type QueueItemContext = {
  id: string;
  status: string;
  assigned_agent_name: string | null;
  queue_reason: string | null;
  next_action: string | null;
  review_id: string | null;
  source_decision_id: string | null;
  metadata: Record<string, unknown> | null;
};

type LeadContext = {
  id: string;
  name: string | null;
  email: string | null;
  status: string | null;
  intent_score: number | null;
  urgency: string | null;
};

type AssignedAgentContext = {
  id: string | null;
  key: string | null;
  name: string;
  description: string | null;
  role: string | null;
};

type OwnershipContext = {
  owner_type: string | null;
  owner_agent_name: string | null;
  ownership_status: string | null;
  last_owner_change_reason: string | null;
};

type HumanReviewContext = {
  id: string;
  review_title: string | null;
  review_summary: string | null;
  recommended_action: string | null;
  status: string | null;
  review_outcome: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
} | null;

type TimelineContextItem = {
  id: string;
  type: string;
  source: string;
  title: string;
  message: string | null;
  status: string | null;
  agent_id: string | null;
  confidence: number | null;
  created_at: string;
};

export type AgentRuntimeContext = {
  organization_id: string;
  queue_item: QueueItemContext;
  work_item: WorkItemContext;
  lead: LeadContext | null;
  assigned_agent: AssignedAgentContext;
  ownership: OwnershipContext;
  memory_context: RelevantMemory;
  human_review_context: HumanReviewContext;
  recent_timeline: TimelineContextItem[];
  recommended_next_action: string | null;
  safety_flags: AgentRuntimeSafetyFlag[];
};

type WorkItemRow = WorkItemContext & {
  source_type: string | null;
  source_id: string | null;
  lead_id?: string | null;
};

type QueueItemRow = QueueItemContext & {
  assigned_agent_id: string | null;
};

type LeadRow = LeadContext;

type AgentRow = {
  id: string;
  key: string | null;
  name: string;
  description: string | null;
  config: Record<string, unknown> | null;
};

type HumanReviewRow = NonNullable<HumanReviewContext> & {
  requested_at: string | null;
};

const STALE_REVIEW_DAYS = 7;

export async function buildAgentRuntimeContext({
  supabase,
  organizationId,
  queueItemId,
  workItemId,
  assignedAgentName,
}: BuildAgentRuntimeContextInput): Promise<AgentRuntimeContext> {
  const [workItem, queueItem, assignedAgent] = await Promise.all([
    loadWorkItem({ supabase, organizationId, workItemId }),
    loadQueueItem({ supabase, organizationId, queueItemId }),
    loadAssignedAgent({ supabase, organizationId, assignedAgentName }),
  ]);

  const leadId = resolveLeadId(workItem);
  const [lead, humanReviewContext, recentTimeline] = await Promise.all([
    leadId
      ? loadLead({ supabase, organizationId, leadId })
      : Promise.resolve(null),
    queueItem.review_id
      ? loadHumanReview({
          supabase,
          organizationId,
          reviewId: queueItem.review_id,
        })
      : Promise.resolve(null),
    loadRecentTimeline({ supabase, organizationId, workItemId }),
  ]);

  const memoryContext = lead
    ? await retrieveRelevantMemory({
        supabase,
        organizationId,
        leadId: lead.id,
        workItemId,
        latestUserMessage: buildMemoryRetrievalQuery({
          queueItem,
          workItem,
          humanReviewContext,
        }),
      })
    : createEmptyRelevantMemory();

  const recommendedNextAction =
    queueItem.next_action ??
    humanReviewContext?.recommended_action ??
    null;

  return {
    organization_id: organizationId,
    queue_item: {
      id: queueItem.id,
      status: queueItem.status,
      assigned_agent_name: queueItem.assigned_agent_name,
      queue_reason: queueItem.queue_reason,
      next_action: queueItem.next_action,
      review_id: queueItem.review_id,
      source_decision_id: queueItem.source_decision_id,
      metadata: queueItem.metadata ?? null,
    },
    work_item: {
      id: workItem.id,
      type: workItem.type,
      status: workItem.status,
      owner_type: workItem.owner_type,
      owner_agent_name: workItem.owner_agent_name,
      ownership_status: workItem.ownership_status,
      last_owner_change_reason: workItem.last_owner_change_reason,
    },
    lead,
    assigned_agent: {
      id: assignedAgent?.id ?? null,
      key: assignedAgent?.key ?? null,
      name: assignedAgent?.name ?? assignedAgentName,
      description: assignedAgent?.description ?? null,
      role: getAgentRole(assignedAgent),
    },
    ownership: {
      owner_type: workItem.owner_type,
      owner_agent_name: workItem.owner_agent_name,
      ownership_status: workItem.ownership_status,
      last_owner_change_reason: workItem.last_owner_change_reason,
    },
    memory_context: memoryContext,
    human_review_context: humanReviewContext,
    recent_timeline: recentTimeline,
    recommended_next_action: recommendedNextAction,
    safety_flags: buildSafetyFlags({
      lead,
      memoryContext,
      humanReviewContext,
      hasReviewId: Boolean(queueItem.review_id),
      recommendedNextAction,
    }),
  };
}

export function summarizeAgentRuntimeContext(
  context: AgentRuntimeContext
) {
  return {
    runtime_context_version: AGENT_RUNTIME_CONTEXT_VERSION,
    memory_count: countRelevantMemoryEntries(context.memory_context),
    timeline_count: context.recent_timeline.length,
    human_review_status: context.human_review_context?.status ?? null,
    recommended_next_action: context.recommended_next_action,
    safety_flags: context.safety_flags,
  };
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
        "source_type",
        "source_id",
        "lead_id",
        "owner_type",
        "owner_agent_name",
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
    throw new Error("Work item not found for agent runtime context");
  }

  return data;
}

async function loadQueueItem({
  supabase,
  organizationId,
  queueItemId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItemId: string;
}) {
  const { data, error } = await supabase
    .from("execution_queue")
    .select(
      [
        "id",
        "status",
        "assigned_agent_id",
        "assigned_agent_name",
        "queue_reason",
        "next_action",
        "review_id",
        "source_decision_id",
        "metadata",
      ].join(", ")
    )
    .eq("id", queueItemId)
    .eq("organization_id", organizationId)
    .maybeSingle<QueueItemRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Queue item not found for agent runtime context");
  }

  return data;
}

async function loadAssignedAgent({
  supabase,
  organizationId,
  assignedAgentName,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  assignedAgentName: string;
}) {
  const { data, error } = await supabase
    .from("agents")
    .select("id, key, name, description, config")
    .eq("organization_id", organizationId)
    .eq("name", assignedAgentName)
    .maybeSingle<AgentRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function loadLead({
  supabase,
  organizationId,
  leadId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  leadId: string;
}) {
  const { data, error } = await supabase
    .from("leads")
    .select("id, name, email, status, intent_score, urgency")
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .maybeSingle<LeadRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function loadHumanReview({
  supabase,
  organizationId,
  reviewId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  reviewId: string;
}) {
  const { data, error } = await supabase
    .from("human_reviews")
    .select(
      [
        "id",
        "review_title",
        "review_summary",
        "recommended_action",
        "status",
        "review_outcome",
        "review_notes",
        "reviewed_at",
        "requested_at",
      ].join(", ")
    )
    .eq("id", reviewId)
    .eq("organization_id", organizationId)
    .maybeSingle<HumanReviewRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    review_title: data.review_title,
    review_summary: data.review_summary,
    recommended_action: data.recommended_action,
    status: data.status,
    review_outcome: data.review_outcome,
    review_notes: data.review_notes,
    reviewed_at: data.reviewed_at,
  };
}

async function loadRecentTimeline({
  supabase,
  organizationId,
  workItemId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
}) {
  const timeline = await listWorkItemTimeline({
    supabase,
    organizationId,
    workItemId,
    limit: 10,
  });

  return timeline.items.map((item) => ({
    id: item.id,
    type: item.type,
    source: item.source,
    title: item.title,
    message: item.message,
    status: item.status,
    agent_id: item.agent_id,
    confidence: item.confidence,
    created_at: item.created_at,
  }));
}

function buildMemoryRetrievalQuery({
  queueItem,
  workItem,
  humanReviewContext,
}: {
  queueItem: QueueItemRow;
  workItem: WorkItemRow;
  humanReviewContext: HumanReviewContext;
}) {
  return [
    queueItem.next_action,
    queueItem.queue_reason,
    workItem.last_owner_change_reason,
    humanReviewContext?.recommended_action,
    humanReviewContext?.review_summary,
    humanReviewContext?.review_notes,
  ]
    .filter(Boolean)
    .join("\n");
}

function resolveLeadId(workItem: WorkItemRow) {
  if (workItem.lead_id) {
    return workItem.lead_id;
  }

  if (workItem.source_type === "lead") {
    return workItem.source_id;
  }

  return null;
}

function buildSafetyFlags({
  lead,
  memoryContext,
  humanReviewContext,
  hasReviewId,
  recommendedNextAction,
}: {
  lead: LeadContext | null;
  memoryContext: RelevantMemory;
  humanReviewContext: HumanReviewContext;
  hasReviewId: boolean;
  recommendedNextAction: string | null;
}) {
  const flags: AgentRuntimeSafetyFlag[] = [];

  if (!lead) {
    flags.push("missing_lead");
  }

  if (countRelevantMemoryEntries(memoryContext) === 0) {
    flags.push("missing_memory");
  }

  if (!hasReviewId || !humanReviewContext) {
    flags.push("missing_human_review");
  }

  if (isStaleReview(humanReviewContext)) {
    flags.push("stale_review");
  }

  if (!recommendedNextAction) {
    flags.push("no_recommended_next_action");
  }

  return flags;
}

function isStaleReview(humanReviewContext: HumanReviewContext) {
  if (!humanReviewContext?.reviewed_at) {
    return false;
  }

  const reviewedAt = new Date(humanReviewContext.reviewed_at).getTime();
  const staleAfterMs =
    STALE_REVIEW_DAYS * 24 * 60 * 60 * 1000;

  return Number.isFinite(reviewedAt)
    ? Date.now() - reviewedAt > staleAfterMs
    : false;
}

function getAgentRole(agent: AgentRow | null) {
  const role = agent?.config?.role;

  return typeof role === "string" ? role : null;
}
