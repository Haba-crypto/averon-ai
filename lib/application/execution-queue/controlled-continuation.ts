import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildAgentRuntimeContext,
} from "@/lib/application/agents/build-agent-runtime-context";
import {
  evaluateContinuationPolicy,
  MAX_CONTINUATION_STEPS,
  type ContinuationPolicyDecision,
} from "@/lib/application/agents/continuation-policy";
import {
  executeAgentCapability,
  selectAgentCapability,
} from "@/lib/application/agents/agent-capabilities";
import type { ExecutionQueueItem } from "@/lib/application/execution-queue/create-execution-queue-item";
import {
  ExecutionQueueEmptyError,
  processNextExecutionQueueItem,
} from "@/lib/application/execution-queue/process-next-execution-queue-item";
import {
  compareQueueItemsByPriority,
  evaluateAndPersistWorkPriority,
  isBlockedPriority,
} from "@/lib/application/execution-queue/priority-scheduling";

type ProcessControlledContinuationInput = {
  supabase: SupabaseClient;
  organizationId: string;
  queueItemId?: string | null;
};

type WorkItemPolicyRow = {
  id: string;
  priority: string | null;
  metadata: Record<string, unknown> | null;
};

type AgentDecisionRow = {
  id: string;
};

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

export async function processControlledContinuation({
  supabase,
  organizationId,
  queueItemId = null,
}: ProcessControlledContinuationInput) {
  const queueItem = await findEligibleQueueItem({
    supabase,
    organizationId,
    queueItemId,
  });

  if (!queueItem) {
    throw new ExecutionQueueEmptyError();
  }

  const evaluatedAt = new Date().toISOString();
  const policySnapshot = await reevaluatePolicy({
    supabase,
    organizationId,
    queueItem,
  });

  if (!policySnapshot.allowed) {
    await recordBlockedContinuation({
      supabase,
      organizationId,
      queueItem,
      policySnapshot,
      blockedAt: evaluatedAt,
    });

    return {
      success: false,
      result: "blocked" as const,
      queue_item_id: queueItem.id,
      work_item_id: queueItem.work_item_id,
      reason: policySnapshot.reason,
      continuation_depth: resolveContinuationDepth(queueItem),
      policy_snapshot: policySnapshot,
      processed_count: 0,
      openai_called: false,
    };
  }

  const processResult = await processNextExecutionQueueItem({
    supabase,
    organizationId,
    queueItemId: queueItem.id,
  });
  const processedAt = new Date().toISOString();
  const continuationDepth = resolveContinuationDepth(queueItem);
  const updatedQueueItem = await updateProcessedContinuationMetadata({
    supabase,
    organizationId,
    queueItem,
    policySnapshot,
    processedAt,
    continuationDepth,
  });
  const decision = await recordProcessedContinuation({
    supabase,
    organizationId,
    queueItem: updatedQueueItem,
    policySnapshot,
    processResult,
    processedAt,
    continuationDepth,
  });

  return {
    success: true,
    result: "processed" as const,
    queue_item: updatedQueueItem,
    agent_decision_id: decision.id,
    process_result: processResult,
    continuation_depth: continuationDepth,
    policy_snapshot: policySnapshot,
    processed_count: 1,
    openai_called: false,
  };
}

async function findEligibleQueueItem({
  supabase,
  organizationId,
  queueItemId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItemId: string | null;
}) {
  let query = supabase
    .from("execution_queue")
    .select(EXECUTION_QUEUE_SELECT_COLUMNS.join(", "))
    .eq("organization_id", organizationId)
    .eq("status", "ready");

  if (queueItemId) {
    query = query.eq("id", queueItemId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: true })
    .limit(queueItemId ? 1 : 25);

  if (error) {
    throw error;
  }

  const candidates = (data ?? []) as unknown as ExecutionQueueItem[];
  const prioritizedCandidates = await Promise.all(
    candidates.map(async (candidate) => {
      const priorityResult = await evaluateAndPersistWorkPriority({
        supabase,
        organizationId,
        queueItem: candidate,
      });

      return priorityResult.queue_item;
    })
  );

  return (
    prioritizedCandidates
      .filter(
        (candidate) =>
          !isBlockedPriority(candidate) &&
          isEligibleForContinuation(candidate)
      )
      .sort(compareQueueItemsByPriority)[0] ?? null
  );
}

function isEligibleForContinuation(queueItem: ExecutionQueueItem) {
  const metadata = queueItem.metadata ?? {};
  const mode = metadata.continuation_mode;

  return (
    metadata.continuation_allowed === true &&
    (mode === "manual" || mode === "guarded") &&
    resolveContinuationDepth(queueItem) <= MAX_CONTINUATION_STEPS
  );
}

async function reevaluatePolicy({
  supabase,
  organizationId,
  queueItem,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ExecutionQueueItem;
}) {
  const assignedAgentName =
    queueItem.assigned_agent_name ?? "Operations Agent";
  const runtimeContext = await buildAgentRuntimeContext({
    supabase,
    organizationId,
    queueItemId: queueItem.id,
    workItemId: queueItem.work_item_id,
    assignedAgentName,
  });
  const capability = selectAgentCapability(runtimeContext);
  const capabilityResult = executeAgentCapability({
    organizationId,
    agentExecutionId: `controlled-continuation-policy-${queueItem.id}`,
    runtimeContext,
    capability,
  });
  const workItem = await loadWorkItemForPolicy({
    supabase,
    organizationId,
    workItemId: queueItem.work_item_id,
  });

  return evaluateContinuationPolicy({
    organizationId,
    queueItem,
    workItem,
    runtimeContext,
    capabilityResult,
    generatedWork: {
      created_work_items: [queueItem.work_item_id],
      created_queue_items: [queueItem.id],
      skipped_duplicates: [],
    },
  });
}

async function loadWorkItemForPolicy({
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
    .select("id, priority, metadata")
    .eq("id", workItemId)
    .eq("organization_id", organizationId)
    .maybeSingle<WorkItemPolicyRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function updateProcessedContinuationMetadata({
  supabase,
  organizationId,
  queueItem,
  policySnapshot,
  processedAt,
  continuationDepth,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ExecutionQueueItem;
  policySnapshot: ContinuationPolicyDecision;
  processedAt: string;
  continuationDepth: number;
}) {
  const metadata = {
    ...(queueItem.metadata ?? {}),
    continuation_processed_at: processedAt,
    continuation_processed_by: "manual_api",
    continuation_policy_snapshot: policySnapshot,
    continuation_depth: continuationDepth,
    openai_called: false,
  };

  const { data, error } = await supabase
    .from("execution_queue")
    .update({
      metadata,
      updated_at: processedAt,
    })
    .eq("id", queueItem.id)
    .eq("organization_id", organizationId)
    .select(EXECUTION_QUEUE_SELECT_COLUMNS.join(", "))
    .single<ExecutionQueueItem>();

  if (error) {
    throw error;
  }

  return data;
}

async function recordProcessedContinuation({
  supabase,
  organizationId,
  queueItem,
  policySnapshot,
  processResult,
  processedAt,
  continuationDepth,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ExecutionQueueItem;
  policySnapshot: ContinuationPolicyDecision;
  processResult: unknown;
  processedAt: string;
  continuationDepth: number;
}) {
  const outcome = {
    queue_item_id: queueItem.id,
    work_item_id: queueItem.work_item_id,
    continuation_depth: continuationDepth,
    policy_snapshot: policySnapshot,
    process_result: processResult,
    processed_at: processedAt,
  };

  const { data, error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id:
        getRecordString(processResult, "agent_execution_id") ?? null,
      agent_id: queueItem.assigned_agent_id,
      work_item_id: queueItem.work_item_id,
      decision_type: "controlled_continuation_processed",
      decision: {
        outcome,
      },
      rationale:
        "Operations Agent continued one approved follow-up step.",
      confidence: 1,
      metadata: {
        source: "controlled_continuation",
        phase: 25,
        ...outcome,
        runtime_context_summary:
          getRuntimeContextSummary(processResult) ?? null,
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

async function recordBlockedContinuation({
  supabase,
  organizationId,
  queueItem,
  policySnapshot,
  blockedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ExecutionQueueItem;
  policySnapshot: ContinuationPolicyDecision;
  blockedAt: string;
}) {
  const outcome = {
    queue_item_id: queueItem.id,
    work_item_id: queueItem.work_item_id,
    reason: policySnapshot.reason,
    policy_snapshot: policySnapshot,
    blocked_at: blockedAt,
  };

  const { error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: null,
      agent_id: queueItem.assigned_agent_id,
      work_item_id: queueItem.work_item_id,
      decision_type: "continuation_blocked",
      decision: {
        outcome,
      },
      rationale: policySnapshot.reason,
      confidence: 1,
      metadata: {
        source: "controlled_continuation",
        phase: 25,
        ...outcome,
        openai_called: false,
      },
      created_at: blockedAt,
    });

  if (error) {
    throw error;
  }
}

function resolveContinuationDepth(queueItem: ExecutionQueueItem) {
  const depth = queueItem.metadata?.continuation_depth;

  return typeof depth === "number" && Number.isFinite(depth) ? depth : 1;
}

function getRecordString(value: unknown, key: string) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const rawValue = (value as Record<string, unknown>)[key];

  return typeof rawValue === "string" ? rawValue : null;
}

function getRuntimeContextSummary(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const processResult = value as Record<string, unknown>;
  const sideEffects = processResult.side_effects;
  const workGeneration = processResult.work_generation;

  if (sideEffects || workGeneration) {
    return {
      processed_count: processResult.processed_count ?? null,
      side_effects_applied: Boolean(sideEffects),
      work_generated: Boolean(workGeneration),
    };
  }

  return null;
}
