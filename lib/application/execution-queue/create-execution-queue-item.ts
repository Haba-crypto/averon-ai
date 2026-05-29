import type { SupabaseClient } from "@supabase/supabase-js";

import { evaluateAndPersistWorkPriority } from "@/lib/application/execution-queue/priority-scheduling";

export type ExecutionQueueStatus =
  | "pending"
  | "ready"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export type ExecutionQueuePriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

export type ExecutionQueueItem = {
  id: string;
  organization_id: string;
  work_item_id: string;
  review_id: string | null;
  source_decision_id: string | null;
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  status: ExecutionQueueStatus;
  priority: ExecutionQueuePriority;
  queue_reason: string | null;
  failure_reason: string | null;
  next_action: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type CreateExecutionQueueItemInput = {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
  reviewId?: string | null;
  sourceDecisionId?: string | null;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  priority?: ExecutionQueuePriority;
  queueReason?: string | null;
  nextAction?: string | null;
  metadata?: Record<string, unknown> | null;
};

const OPEN_QUEUE_STATUSES: ExecutionQueueStatus[] = [
  "pending",
  "ready",
  "in_progress",
];

const EXECUTION_QUEUE_SELECT_COLUMNS = [
  "id",
  "organization_id",
  "work_item_id",
  "review_id",
  "source_decision_id",
  "assigned_agent_id",
  "assigned_agent_name",
  "status",
  "priority",
  "queue_reason",
  "failure_reason",
  "next_action",
  "metadata",
  "created_at",
  "updated_at",
  "started_at",
  "completed_at",
];

export async function createExecutionQueueItem({
  supabase,
  organizationId,
  workItemId,
  reviewId = null,
  sourceDecisionId = null,
  assignedAgentId = null,
  assignedAgentName = null,
  priority = "normal",
  queueReason = null,
  nextAction = null,
  metadata = null,
}: CreateExecutionQueueItemInput) {
  const existing = await findOpenExecutionQueueItem({
    supabase,
    organizationId,
    workItemId,
  });

  if (existing) {
    const priorityResult = await evaluateAndPersistWorkPriority({
      supabase,
      organizationId,
      queueItem: existing,
    });

    return priorityResult.queue_item;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("execution_queue")
    .insert({
      organization_id: organizationId,
      work_item_id: workItemId,
      review_id: reviewId,
      source_decision_id: sourceDecisionId,
      assigned_agent_id: assignedAgentId,
      assigned_agent_name: assignedAgentName,
      status: "ready",
      priority,
      queue_reason: queueReason,
      next_action: nextAction,
      metadata,
      created_at: now,
      updated_at: now,
    })
    .select(EXECUTION_QUEUE_SELECT_COLUMNS.join(", "))
    .single<ExecutionQueueItem>();

  if (error) {
    throw error;
  }

  const priorityResult = await evaluateAndPersistWorkPriority({
    supabase,
    organizationId,
    queueItem: data,
  });

  return priorityResult.queue_item;
}

async function findOpenExecutionQueueItem({
  supabase,
  organizationId,
  workItemId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
}) {
  const { data, error } = await supabase
    .from("execution_queue")
    .select(EXECUTION_QUEUE_SELECT_COLUMNS.join(", "))
    .eq("organization_id", organizationId)
    .eq("work_item_id", workItemId)
    .in("status", OPEN_QUEUE_STATUSES)
    .maybeSingle<ExecutionQueueItem>();

  if (error) {
    throw error;
  }

  return data;
}
