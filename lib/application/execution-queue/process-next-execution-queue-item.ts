import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AGENT_RUNTIME_CONTEXT_VERSION,
  buildAgentRuntimeContext,
  summarizeAgentRuntimeContext,
  type AgentRuntimeContext,
} from "@/lib/application/agents/build-agent-runtime-context";
import type { ExecutionQueueItem } from "@/lib/application/execution-queue/create-execution-queue-item";

type ProcessNextExecutionQueueItemInput = {
  supabase: SupabaseClient;
  organizationId: string;
  queueItemId?: string | null;
};

type WorkItemRow = {
  id: string;
  type?: string | null;
  status: string;
  owner_type: string | null;
  owner_agent_id: string | null;
  owner_agent_name: string | null;
  owner_agent_role: string | null;
  ownership_status: string | null;
  last_owner_change_reason?: string | null;
};

type AgentRow = {
  id: string;
  key: string | null;
  name: string;
  description: string | null;
  config: Record<string, unknown> | null;
};

type AgentExecutionRow = {
  id: string;
  status: string;
};

type AgentDecisionRow = {
  id: string;
};

type ProcessedQueueItem = ExecutionQueueItem & {
  failure_reason?: string | null;
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
  "created_at",
  "updated_at",
  "started_at",
  "completed_at",
];

export class ExecutionQueueEmptyError extends Error {
  constructor() {
    super("No ready execution queue item found");
    this.name = "ExecutionQueueEmptyError";
  }
}

export async function processNextExecutionQueueItem({
  supabase,
  organizationId,
  queueItemId = null,
}: ProcessNextExecutionQueueItemInput) {
  let claimedQueueItem: ProcessedQueueItem | null = null;
  let agentExecutionId: string | null = null;

  try {
    claimedQueueItem = await claimNextQueueItem({
      supabase,
      organizationId,
      queueItemId,
    });

    const [workItem, assignedAgent] =
      await Promise.all([
        loadWorkItem({
          supabase,
          organizationId,
          workItemId: claimedQueueItem.work_item_id,
        }),
        loadAssignedAgent({
          supabase,
          organizationId,
          agentId: claimedQueueItem.assigned_agent_id,
          agentName: claimedQueueItem.assigned_agent_name,
        }),
      ]);

    const agentName =
      assignedAgent?.name ??
      claimedQueueItem.assigned_agent_name ??
      "Operations Agent";
    const agentRole = getAgentRole(assignedAgent);
    const nextAction =
      claimedQueueItem.next_action ??
      "Record controlled queue processing and wait for the next manual action.";
    const processedAt = new Date().toISOString();
    const runtimeContext = await buildAgentRuntimeContext({
      supabase,
      organizationId,
      queueItemId: claimedQueueItem.id,
      workItemId: claimedQueueItem.work_item_id,
      assignedAgentName: agentName,
    });
    const runtimeContextSummary =
      summarizeAgentRuntimeContext(runtimeContext);

    const agentExecution = await createAgentExecution({
      supabase,
      organizationId,
      queueItem: claimedQueueItem,
      workItem,
      assignedAgent,
      agentName,
      agentRole,
      runtimeContext,
      runtimeContextSummary,
      nextAction,
      processedAt,
    });
    agentExecutionId = agentExecution.id;

    const agentDecision = await createProcessedDecision({
      supabase,
      organizationId,
      queueItem: claimedQueueItem,
      assignedAgent,
      agentExecutionId,
      agentName,
      nextAction,
      runtimeContextSummary,
      processedAt,
    });

    await completeAgentExecution({
      supabase,
      organizationId,
      agentExecutionId,
      queueItem: claimedQueueItem,
      decisionId: agentDecision.id,
      agentName,
      nextAction,
      processedAt,
    });

    const completedQueueItem = await markQueueItemCompleted({
      supabase,
      organizationId,
      queueItemId: claimedQueueItem.id,
      completedAt: processedAt,
    });

    const updatedWorkItem = await updateProcessedWorkItem({
      supabase,
      organizationId,
      workItem,
      assignedAgent,
      agentName,
      agentRole,
      processedAt,
    });

    return {
      success: true,
      result: "processed" as const,
      queue_item: completedQueueItem,
      agent_execution_id: agentExecutionId,
      agent_decision_id: agentDecision.id,
      work_item: updatedWorkItem,
      next_action: nextAction,
      openai_called: false,
      processed_count: 1,
    };
  } catch (error: unknown) {
    const failureReason = getErrorMessage(error);

    if (claimedQueueItem) {
      await markQueueItemFailed({
        supabase,
        organizationId,
        queueItemId: claimedQueueItem.id,
        failureReason,
      });
    }

    if (agentExecutionId) {
      await markAgentExecutionFailed({
        supabase,
        organizationId,
        agentExecutionId,
        failureReason,
      });
    }

    throw error;
  }
}

async function claimNextQueueItem({
  supabase,
  organizationId,
  queueItemId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItemId: string | null;
}) {
  const candidate = await findReadyQueueItem({
    supabase,
    organizationId,
    queueItemId,
  });

  if (!candidate) {
    throw new ExecutionQueueEmptyError();
  }

  const startedAt = new Date().toISOString();
  const query = supabase
    .from("execution_queue")
    .update({
      status: "in_progress",
      started_at: startedAt,
      updated_at: startedAt,
      failure_reason: null,
    })
    .eq("id", candidate.id)
    .eq("organization_id", organizationId)
    .eq("status", "ready");

  const { data, error } = await query
    .select(EXECUTION_QUEUE_SELECT_COLUMNS.join(", "))
    .maybeSingle<ProcessedQueueItem>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ExecutionQueueEmptyError();
  }

  return data;
}

async function findReadyQueueItem({
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
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<ProcessedQueueItem>();

  if (error) {
    throw error;
  }

  return data;
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
        "owner_type",
        "owner_agent_id",
        "owner_agent_name",
        "owner_agent_role",
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
    throw new Error("Work item not found for execution queue item");
  }

  return data;
}

async function loadAssignedAgent({
  supabase,
  organizationId,
  agentId,
  agentName,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  agentId: string | null;
  agentName: string | null;
}) {
  if (agentId) {
    const { data, error } = await supabase
      .from("agents")
      .select("id, key, name, description, config")
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .maybeSingle<AgentRow>();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }
  }

  if (!agentName) {
    return null;
  }

  const { data, error } = await supabase
    .from("agents")
    .select("id, key, name, description, config")
    .eq("name", agentName)
    .eq("organization_id", organizationId)
    .maybeSingle<AgentRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function createAgentExecution({
  supabase,
  organizationId,
  queueItem,
  workItem,
  assignedAgent,
  agentName,
  agentRole,
  runtimeContext,
  runtimeContextSummary,
  nextAction,
  processedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ProcessedQueueItem;
  workItem: WorkItemRow;
  assignedAgent: AgentRow | null;
  agentName: string;
  agentRole: string | null;
  runtimeContext: AgentRuntimeContext;
  runtimeContextSummary: ReturnType<typeof summarizeAgentRuntimeContext>;
  nextAction: string;
  processedAt: string;
}) {
  const { data, error } = await supabase
    .from("agent_executions")
    .insert({
      organization_id: organizationId,
      agent_id: assignedAgent?.id ?? queueItem.assigned_agent_id,
      agent_name: agentName,
      agent_role: agentRole,
      work_item_id: queueItem.work_item_id,
      status: "running",
      input: {
        source: "execution_queue",
        queue_item_id: queueItem.id,
        work_item_id: queueItem.work_item_id,
        review_id: queueItem.review_id,
        source_decision_id: queueItem.source_decision_id,
        next_action: nextAction,
        runtime_context_version: AGENT_RUNTIME_CONTEXT_VERSION,
        runtime_context: runtimeContext,
        runtime_context_summary: runtimeContextSummary,
      },
      metadata: {
        source: "queue_orchestrator",
        phase: 20,
        queue_item_id: queueItem.id,
        work_item_id: queueItem.work_item_id,
        assigned_agent_name: agentName,
        agent_identity: buildAgentIdentityMetadata(assignedAgent, agentName),
        previous_work_item_status: workItem.status,
        previous_ownership_status: workItem.ownership_status,
        runtime_context_version: AGENT_RUNTIME_CONTEXT_VERSION,
        openai_called: false,
      },
      started_at: processedAt,
      created_at: processedAt,
      updated_at: processedAt,
    })
    .select("id, status")
    .single<AgentExecutionRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function createProcessedDecision({
  supabase,
  organizationId,
  queueItem,
  assignedAgent,
  agentExecutionId,
  agentName,
  nextAction,
  runtimeContextSummary,
  processedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ProcessedQueueItem;
  assignedAgent: AgentRow | null;
  agentExecutionId: string;
  agentName: string;
  nextAction: string;
  runtimeContextSummary: ReturnType<typeof summarizeAgentRuntimeContext>;
  processedAt: string;
}) {
  const decision = {
    queue_item_id: queueItem.id,
    work_item_id: queueItem.work_item_id,
    assigned_agent_name: agentName,
    next_action: nextAction,
    runtime_context_summary: runtimeContextSummary,
    result: "processed",
    processed_at: processedAt,
  };

  const { data, error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: agentExecutionId,
      agent_id: assignedAgent?.id ?? queueItem.assigned_agent_id,
      work_item_id: queueItem.work_item_id,
      decision_type: "queue_execution_processed",
      decision: {
        outcome: decision,
      },
      rationale: `${agentName} processed the resumed execution queue item.`,
      confidence: 1,
      metadata: {
        source: "queue_orchestrator",
        phase: 20,
        ...decision,
        agent_identity: buildAgentIdentityMetadata(assignedAgent, agentName),
        runtime_context_version: AGENT_RUNTIME_CONTEXT_VERSION,
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

async function completeAgentExecution({
  supabase,
  organizationId,
  agentExecutionId,
  queueItem,
  decisionId,
  agentName,
  nextAction,
  processedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  agentExecutionId: string;
  queueItem: ProcessedQueueItem;
  decisionId: string;
  agentName: string;
  nextAction: string;
  processedAt: string;
}) {
  const { error } = await supabase
    .from("agent_executions")
    .update({
      status: "succeeded",
      output: {
        result: "processed",
        queue_item_id: queueItem.id,
        work_item_id: queueItem.work_item_id,
        agent_decision_id: decisionId,
        assigned_agent_name: agentName,
        next_action: nextAction,
      },
      completed_at: processedAt,
      updated_at: processedAt,
    })
    .eq("id", agentExecutionId)
    .eq("organization_id", organizationId);

  if (error) {
    throw error;
  }
}

async function markQueueItemCompleted({
  supabase,
  organizationId,
  queueItemId,
  completedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItemId: string;
  completedAt: string;
}) {
  const { data, error } = await supabase
    .from("execution_queue")
    .update({
      status: "completed",
      completed_at: completedAt,
      updated_at: completedAt,
      failure_reason: null,
    })
    .eq("id", queueItemId)
    .eq("organization_id", organizationId)
    .select(EXECUTION_QUEUE_SELECT_COLUMNS.join(", "))
    .single<ProcessedQueueItem>();

  if (error) {
    throw error;
  }

  return data;
}

async function updateProcessedWorkItem({
  supabase,
  organizationId,
  workItem,
  assignedAgent,
  agentName,
  agentRole,
  processedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItem: WorkItemRow;
  assignedAgent: AgentRow | null;
  agentName: string;
  agentRole: string | null;
  processedAt: string;
}) {
  const completed = workItem.status === "completed";
  const { data, error } = await supabase
    .from("work_items")
    .update({
      status: completed ? "completed" : "in_progress",
      owner_type: "ai",
      owner_agent_id: assignedAgent?.id ?? workItem.owner_agent_id,
      owner_agent_name: agentName,
      owner_agent_role: agentRole ?? workItem.owner_agent_role,
      ownership_status: completed ? "completed" : "active",
      last_owner_change_at: processedAt,
      last_owner_change_reason:
        "execution queue item processed by queue orchestrator",
      updated_at: processedAt,
    })
    .eq("id", workItem.id)
    .eq("organization_id", organizationId)
    .select(
      [
        "id",
        "status",
        "owner_type",
        "owner_agent_id",
        "owner_agent_name",
        "owner_agent_role",
        "ownership_status",
      ].join(", ")
    )
    .single<WorkItemRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function markQueueItemFailed({
  supabase,
  organizationId,
  queueItemId,
  failureReason,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItemId: string;
  failureReason: string;
}) {
  const failedAt = new Date().toISOString();
  const { error } = await supabase
    .from("execution_queue")
    .update({
      status: "failed",
      failure_reason: failureReason,
      completed_at: failedAt,
      updated_at: failedAt,
    })
    .eq("id", queueItemId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("QUEUE ORCHESTRATOR FAILED TO MARK QUEUE ITEM FAILED", {
      queueItemId,
      organizationId,
      error,
    });
  }
}

async function markAgentExecutionFailed({
  supabase,
  organizationId,
  agentExecutionId,
  failureReason,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  agentExecutionId: string;
  failureReason: string;
}) {
  const failedAt = new Date().toISOString();
  const { error } = await supabase
    .from("agent_executions")
    .update({
      status: "failed",
      error: {
        message: failureReason,
      },
      completed_at: failedAt,
      updated_at: failedAt,
    })
    .eq("id", agentExecutionId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("QUEUE ORCHESTRATOR FAILED TO MARK EXECUTION FAILED", {
      agentExecutionId,
      organizationId,
      error,
    });
  }
}

function buildAgentIdentityMetadata(
  assignedAgent: AgentRow | null,
  agentName: string
) {
  return {
    agent_id: assignedAgent?.id ?? null,
    agent_key: assignedAgent?.key ?? null,
    agent_name: agentName,
    agent_role: getAgentRole(assignedAgent),
    description: assignedAgent?.description ?? null,
  };
}

function getAgentRole(agent: AgentRow | null) {
  const role = agent?.config?.role;

  return typeof role === "string" ? role : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Queue orchestrator processing failed";
}
