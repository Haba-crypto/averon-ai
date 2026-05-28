import type { SupabaseClient } from "@supabase/supabase-js";

export async function listTasks({
  supabase,
  organizationId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
}) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function completeTask({
  supabase,
  taskId,
  organizationId,
}: {
  supabase: SupabaseClient;
  taskId: string;
  organizationId: string;
}) {
  const { error } = await supabase
    .from("tasks")
    .update({
      status: "completed",
    })
    .eq("id", taskId)
    .eq("organization_id", organizationId);

  if (error) {
    throw error;
  }
}

export type TaskExecutionStatus =
  | "approved"
  | "completed"
  | "escalated"
  | "blocked"
  | "superseded"
  | "archived";

export async function updateTaskStatus({
  supabase,
  taskId,
  status,
  organizationId,
}: {
  supabase: SupabaseClient;
  taskId: string;
  status: TaskExecutionStatus;
  organizationId: string;
}) {
  const { data: task, error } = await supabase
    .from("tasks")
    .update({
      status,
    })
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (task?.lead_id) {
    const eventConfig = {
      approved: {
        type: "task_approved",
        message:
          "Execution authorized by operator",
      },
      completed: {
        type: "task_executed",
        message:
          "Workflow executed by operator",
      },
      escalated: {
        type: "task_escalated",
        message:
          "Escalated to human operator",
      },
      blocked: {
        type: "task_blocked",
        message:
          "Execution blocked pending operator review",
      },
      superseded: {
        type: "workflow_superseded",
        message:
          "Workflow superseded by newer recommendation",
      },
      archived: {
        type: "task_archived",
        message:
          "Archived operational task",
      },
    }[status];

    const { error: eventError } = await supabase
      .from("ai_events")
      .insert({
        lead_id: task.lead_id,
        organization_id: organizationId,
        type: eventConfig.type,
        message: `${eventConfig.message}. Task: ${
          task.task || task.title || task.id
        }`,
      });

    if (eventError) {
      console.error("TASK STATUS EVENT ERROR", {
        taskId,
        status,
        eventError,
      });
    }
  }

  return task;
}
