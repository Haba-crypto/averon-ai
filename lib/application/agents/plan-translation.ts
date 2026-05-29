import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgentRuntimeContext } from "@/lib/application/agents/build-agent-runtime-context";
import type {
  AgentExecutionPlan,
  AgentExecutionPlanStep,
} from "@/lib/application/agents/agent-planning";
import {
  createExecutionQueueItem,
  type ExecutionQueuePriority,
} from "@/lib/application/execution-queue/create-execution-queue-item";

export type PlanTranslationResult = {
  created_tasks: string[];
  created_work_items: string[];
  created_queue_items: string[];
  skipped_steps: Array<{
    step_id: string;
    title: string;
    reason: string;
  }>;
  skipped_duplicates: Array<{
    type: "task" | "work_item" | "queue_item";
    id: string;
    step_id: string;
    reason: string;
  }>;
};

type TranslateExecutionPlanToWorkInput = {
  supabase: SupabaseClient;
  organizationId: string;
  parentWorkItemId: string;
  agentExecutionId: string;
  executionPlan: AgentExecutionPlan;
  runtimeContext: AgentRuntimeContext;
  processedAt?: string;
};

type TaskRow = {
  id: string;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
};

type WorkItemRow = {
  id: string;
  metadata?: Record<string, unknown> | null;
};

type QueueItemRow = {
  id: string;
  metadata?: Record<string, unknown> | null;
};

const OPEN_TASK_STATUSES = new Set([
  "pending",
  "approved",
  "escalated",
  "blocked",
]);

export async function translateExecutionPlanToWork({
  supabase,
  organizationId,
  parentWorkItemId,
  agentExecutionId,
  executionPlan,
  runtimeContext,
  processedAt = new Date().toISOString(),
}: TranslateExecutionPlanToWorkInput): Promise<PlanTranslationResult> {
  const result: PlanTranslationResult = {
    created_tasks: [],
    created_work_items: [],
    created_queue_items: [],
    skipped_steps: [],
    skipped_duplicates: [],
  };

  for (const step of executionPlan.steps) {
    if (!isTranslatableStep(step)) {
      result.skipped_steps.push({
        step_id: step.id,
        title: step.title,
        reason: getSkipReason(step),
      });
      continue;
    }

    const existingTask = await findExistingTranslatedTask({
      supabase,
      organizationId,
      parentWorkItemId,
      planId: executionPlan.plan_id,
      stepId: step.id,
    });

    if (existingTask) {
      result.skipped_duplicates.push({
        type: "task",
        id: existingTask.id,
        step_id: step.id,
        reason: "task_exists_for_plan_step",
      });
    } else {
      const task = await createTranslatedTask({
        supabase,
        organizationId,
        parentWorkItemId,
        agentExecutionId,
        executionPlan,
        runtimeContext,
        step,
        processedAt,
      });

      result.created_tasks.push(task.id);
    }

    if (shouldCreateFollowUpWork(step)) {
      await translateStepToFollowUpWork({
        supabase,
        organizationId,
        parentWorkItemId,
        agentExecutionId,
        executionPlan,
        runtimeContext,
        step,
        result,
        processedAt,
      });
    }
  }

  return result;
}

function isTranslatableStep(step: AgentExecutionPlanStep) {
  return (
    step.status === "pending" &&
    (step.risk_level === "low" || step.risk_level === "medium") &&
    step.requires_human_review === false
  );
}

function getSkipReason(step: AgentExecutionPlanStep) {
  if (step.status !== "pending") {
    return "step_not_pending";
  }

  if (step.risk_level === "high") {
    return "high_risk_step";
  }

  if (step.requires_human_review) {
    return "human_review_required";
  }

  return "step_not_safe_for_translation";
}

async function findExistingTranslatedTask({
  supabase,
  organizationId,
  parentWorkItemId,
  planId,
  stepId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  parentWorkItemId: string;
  planId: string;
  stepId: string;
}) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, status, metadata")
    .eq("organization_id", organizationId)
    .eq("work_item_id", parentWorkItemId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as TaskRow[]).find((task) => {
    const status = task.status ?? "pending";

    return (
      OPEN_TASK_STATUSES.has(status) &&
      task.metadata?.source === "plan_translation" &&
      task.metadata?.parent_work_item_id === parentWorkItemId &&
      task.metadata?.plan_id === planId &&
      task.metadata?.step_id === stepId
    );
  });
}

async function createTranslatedTask({
  supabase,
  organizationId,
  parentWorkItemId,
  agentExecutionId,
  executionPlan,
  runtimeContext,
  step,
  processedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  parentWorkItemId: string;
  agentExecutionId: string;
  executionPlan: AgentExecutionPlan;
  runtimeContext: AgentRuntimeContext;
  step: AgentExecutionPlanStep;
  processedAt: string;
}) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      organization_id: organizationId,
      lead_id: runtimeContext.lead?.id ?? null,
      work_item_id: parentWorkItemId,
      title: step.title,
      task: step.title,
      description: step.description,
      priority: step.risk_level === "medium" ? "high" : "normal",
      status: "pending",
      assigned_agent: executionPlan.agent_name,
      metadata: {
        source: "plan_translation",
        parent_work_item_id: parentWorkItemId,
        agent_execution_id: agentExecutionId,
        plan_id: executionPlan.plan_id,
        step_id: step.id,
        agent_name: executionPlan.agent_name,
        agent_id: runtimeContext.assigned_agent.id,
        capability_id: executionPlan.capability_id,
        risk_level: step.risk_level,
        requires_human_review: step.requires_human_review,
        openai_called: false,
      },
      created_at: processedAt,
      updated_at: processedAt,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw error;
  }

  return data;
}

async function translateStepToFollowUpWork({
  supabase,
  organizationId,
  parentWorkItemId,
  agentExecutionId,
  executionPlan,
  runtimeContext,
  step,
  result,
  processedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  parentWorkItemId: string;
  agentExecutionId: string;
  executionPlan: AgentExecutionPlan;
  runtimeContext: AgentRuntimeContext;
  step: AgentExecutionPlanStep;
  result: PlanTranslationResult;
  processedAt: string;
}) {
  const existingWorkItem = await findExistingTranslatedWorkItem({
    supabase,
    organizationId,
    parentWorkItemId,
    planId: executionPlan.plan_id,
    stepId: step.id,
  });
  let workItemId = existingWorkItem?.id ?? null;

  if (existingWorkItem) {
    result.skipped_duplicates.push({
      type: "work_item",
      id: existingWorkItem.id,
      step_id: step.id,
      reason: "work_item_exists_for_plan_step",
    });
  } else {
    const workItem = await createTranslatedFollowUpWorkItem({
      supabase,
      organizationId,
      parentWorkItemId,
      agentExecutionId,
      executionPlan,
      runtimeContext,
      step,
      processedAt,
    });

    workItemId = workItem.id;
    result.created_work_items.push(workItem.id);
  }

  if (!workItemId) {
    return;
  }

  const existingQueueItem = await findExistingTranslatedQueueItem({
    supabase,
    organizationId,
    workItemId,
    planId: executionPlan.plan_id,
    stepId: step.id,
  });

  if (existingQueueItem) {
    result.skipped_duplicates.push({
      type: "queue_item",
      id: existingQueueItem.id,
      step_id: step.id,
      reason: "queue_item_exists_for_plan_step",
    });
    return;
  }

  const queueItem = await createExecutionQueueItem({
    supabase,
    organizationId,
    workItemId,
    assignedAgentId: runtimeContext.assigned_agent.id,
    assignedAgentName: executionPlan.agent_name,
    priority: resolveQueuePriority(step),
    queueReason: "follow-up work created by plan translation",
    nextAction: step.description,
    metadata: {
      source: "plan_translation",
      phase: 27,
      parent_work_item_id: parentWorkItemId,
      agent_execution_id: agentExecutionId,
      plan_id: executionPlan.plan_id,
      step_id: step.id,
      agent_name: executionPlan.agent_name,
      capability_id: executionPlan.capability_id,
      continuation_allowed: false,
      continuation_mode: "manual",
      openai_called: false,
    },
  });

  result.created_queue_items.push(queueItem.id);
}

async function findExistingTranslatedWorkItem({
  supabase,
  organizationId,
  parentWorkItemId,
  planId,
  stepId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  parentWorkItemId: string;
  planId: string;
  stepId: string;
}) {
  const { data, error } = await supabase
    .from("work_items")
    .select("id, metadata")
    .eq("organization_id", organizationId)
    .eq("parent_work_item_id", parentWorkItemId)
    .eq("source_type", "plan_translation");

  if (error) {
    throw error;
  }

  return ((data ?? []) as WorkItemRow[]).find(
    (workItem) =>
      workItem.metadata?.source === "plan_translation" &&
      workItem.metadata?.plan_id === planId &&
      workItem.metadata?.step_id === stepId
  );
}

async function createTranslatedFollowUpWorkItem({
  supabase,
  organizationId,
  parentWorkItemId,
  agentExecutionId,
  executionPlan,
  runtimeContext,
  step,
  processedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  parentWorkItemId: string;
  agentExecutionId: string;
  executionPlan: AgentExecutionPlan;
  runtimeContext: AgentRuntimeContext;
  step: AgentExecutionPlanStep;
  processedAt: string;
}) {
  const { data, error } = await supabase
    .from("work_items")
    .insert({
      organization_id: organizationId,
      title: step.title,
      description: step.description,
      type: "follow_up",
      status: "queued",
      priority: step.risk_level === "medium" ? "high" : "normal",
      source_type: "plan_translation",
      source_id: agentExecutionId,
      lead_id: runtimeContext.lead?.id ?? null,
      parent_work_item_id: parentWorkItemId,
      owner_type: "ai",
      owner_agent_id: runtimeContext.assigned_agent.id,
      owner_agent_name: executionPlan.agent_name,
      owner_agent_role: runtimeContext.assigned_agent.role,
      ownership_status: "assigned",
      last_owner_change_at: processedAt,
      last_owner_change_reason:
        "follow-up work created by plan translation",
      metadata: {
        source: "plan_translation",
        phase: 27,
        parent_work_item_id: parentWorkItemId,
        agent_execution_id: agentExecutionId,
        plan_id: executionPlan.plan_id,
        step_id: step.id,
        agent_name: executionPlan.agent_name,
        capability_id: executionPlan.capability_id,
        risk_level: step.risk_level,
        requires_human_review: step.requires_human_review,
        openai_called: false,
      },
      created_at: processedAt,
      updated_at: processedAt,
    })
    .select("id, metadata")
    .single<WorkItemRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function findExistingTranslatedQueueItem({
  supabase,
  organizationId,
  workItemId,
  planId,
  stepId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
  planId: string;
  stepId: string;
}) {
  const { data, error } = await supabase
    .from("execution_queue")
    .select("id, metadata")
    .eq("organization_id", organizationId)
    .eq("work_item_id", workItemId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as QueueItemRow[]).find(
    (queueItem) =>
      queueItem.metadata?.source === "plan_translation" &&
      queueItem.metadata?.plan_id === planId &&
      queueItem.metadata?.step_id === stepId
  );
}

function shouldCreateFollowUpWork(step: AgentExecutionPlanStep) {
  return /\b(queue|queued|follow-up|follow up)\b/i.test(
    `${step.title}\n${step.description}`
  );
}

function resolveQueuePriority(
  step: AgentExecutionPlanStep
): ExecutionQueuePriority {
  return step.risk_level === "medium" ? "high" : "normal";
}
