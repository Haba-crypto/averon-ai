import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkflowAction = "approve" | "run";

type ExecuteWorkflowActionInput = {
  supabase: SupabaseClient;
  organizationId: string;
  leadId: string;
  action: WorkflowAction;
  recommendation: string;
};

type WorkflowWriteErrorContext = {
  step: string;
  leadId: string;
  organizationId: string;
  action: WorkflowAction;
  error: unknown;
};

function getDatabaseErrorMessage(
  error: unknown,
  fallback: string
) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

function logWorkflowWriteError({
  step,
  leadId,
  organizationId,
  action,
  error,
}: WorkflowWriteErrorContext) {
  console.error("WORKFLOW ACTION WRITE ERROR", {
    step,
    leadId,
    organizationId,
    action,
    error,
  });
}

export async function executeWorkflowAction({
  supabase,
  organizationId,
  leadId,
  action,
  recommendation,
}: ExecuteWorkflowActionInput) {
  const normalizedRecommendation =
    recommendation.trim();

  if (!normalizedRecommendation) {
    throw new Error("Recommendation is required");
  }

  const { data: lead, error: leadError } =
    await supabase
      .from("leads")
      .select(
        "id, status, intent_score, urgency, deal_risk, recommendation, close_probability"
      )
      .eq("id", leadId)
      .eq("organization_id", organizationId)
      .single();

  if (leadError) {
    logWorkflowWriteError({
      step: "verify_lead",
      leadId,
      organizationId,
      action,
      error: leadError,
    });

    throw new Error(
      getDatabaseErrorMessage(
        leadError,
        "Unable to verify lead ownership"
      )
    );
  }

  if (!lead) {
    throw new Error("Lead not found");
  }

  const eventMessage =
    action === "approve"
      ? `Recommendation approved: ${normalizedRecommendation}`
      : `Execution requested: ${normalizedRecommendation}`;

  const { data: event, error: eventError } =
    await supabase
      .from("ai_events")
      .insert({
        lead_id: leadId,
        organization_id: organizationId,
        type:
          action === "approve"
            ? "approval"
            : "workflow_run_requested",
        message: eventMessage,
      })
      .select("*")
      .single();

  if (eventError) {
    logWorkflowWriteError({
      step: "insert_ai_event",
      leadId,
      organizationId,
      action,
      error: eventError,
    });

    throw new Error(
      getDatabaseErrorMessage(
        eventError,
        "Unable to log workflow action"
      )
    );
  }

  const taskInsert = {
    lead_id: leadId,
    organization_id: organizationId,
    task:
      action === "approve"
        ? `Approved recommendation: ${normalizedRecommendation}`
        : `Run approved recommendation: ${normalizedRecommendation}`,
    priority:
      action === "run"
        ? "high"
        : "medium",
    status: "pending",
  };

  const { data: activeTasks, error: activeTasksError } =
    await supabase
      .from("tasks")
      .select("id, task, status")
      .eq("lead_id", leadId)
      .eq("organization_id", organizationId)
      .not("status", "in", "(completed,superseded,archived)")
      .order("created_at", {
        ascending: false,
      });

  if (activeTasksError) {
    logWorkflowWriteError({
      step: "load_active_tasks",
      leadId,
      organizationId,
      action,
      error: activeTasksError,
    });
  }

  const matchingTask =
    (activeTasks || []).find(
      (task) =>
        (task.task || "").includes(
          normalizedRecommendation
        )
    );

  if (matchingTask) {
    const { data: updatedTask, error: updateTaskError } =
      await supabase
        .from("tasks")
        .update({
          status:
            action === "run"
              ? "approved"
              : "pending",
          task: taskInsert.task,
          priority: taskInsert.priority,
        })
        .eq("id", matchingTask.id)
        .eq("organization_id", organizationId)
        .select("*")
        .single();

    if (!updateTaskError) {
      return {
        event,
        task: updatedTask,
      };
    }

    logWorkflowWriteError({
      step: "update_matching_task",
      leadId,
      organizationId,
      action,
      error: updateTaskError,
    });
  }

  const { data: task, error: taskError } =
    await supabase
      .from("tasks")
      .insert(taskInsert)
      .select("*")
      .single();

  if (taskError) {
    logWorkflowWriteError({
      step: "insert_task",
      leadId,
      organizationId,
      action,
      error: taskError,
    });

    const { data: fallbackTask, error: fallbackTaskError } =
      await supabase
        .from("tasks")
        .insert({
          lead_id: leadId,
          organization_id: organizationId,
          task: taskInsert.task,
          priority: taskInsert.priority,
          status: taskInsert.status,
        })
        .select("*")
        .single();

    if (fallbackTaskError) {
      logWorkflowWriteError({
        step: "insert_task_fallback",
        leadId,
        organizationId,
        action,
        error: fallbackTaskError,
      });

      return {
        event,
        task: null,
        warning:
          "Workflow event was logged, but task creation failed.",
        taskError: getDatabaseErrorMessage(
          fallbackTaskError,
          "Unable to create workflow task"
        ),
      };
    }

    return {
      event,
      task: fallbackTask,
      warning:
        "Workflow task was created with limited fields.",
    };
  }

  const nextLeadStatus =
    action === "run"
      ? "execution_active"
      : "approved";

  const { error: leadUpdateError } =
    await supabase
      .from("leads")
      .update({
        status: nextLeadStatus,
        recommendation: normalizedRecommendation,
      })
      .eq("id", leadId)
      .eq("organization_id", organizationId);

  if (leadUpdateError) {
    logWorkflowWriteError({
      step: "propagate_lead_state",
      leadId,
      organizationId,
      action,
      error: leadUpdateError,
    });
  }

  const { error: propagationEventError } =
    await supabase
      .from("ai_events")
      .insert({
        lead_id: leadId,
        organization_id: organizationId,
        type: "workflow_state_propagated",
        message:
          action === "run"
            ? "Execution state propagated to lead and queue."
            : "Approval state propagated to lead and queue.",
      });

  if (propagationEventError) {
    logWorkflowWriteError({
      step: "insert_propagation_event",
      leadId,
      organizationId,
      action,
      error: propagationEventError,
    });
  }

  return {
    event,
    task,
  };
}
