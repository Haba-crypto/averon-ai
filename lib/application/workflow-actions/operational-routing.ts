import type { SupabaseClient } from "@supabase/supabase-js";

type OperationalLeadState = {
  intent_score?: number | null;
  urgency?: string | null;
  deal_risk?: string | null;
  recommendation?: string | null;
  close_probability?: number | null;
};

type RouteOperationalWorkInput = {
  supabase: SupabaseClient;
  organizationId: string;
  leadId: string;
  leadState: OperationalLeadState;
  latestMessage?: string;
};

type ExistingTask = {
  id: string;
  task?: string | null;
  status?: string | null;
  priority?: string | null;
  created_at?: string | null;
};

function getRoutingDecision(leadState: OperationalLeadState) {
  const confidence =
    leadState.close_probability ??
    leadState.intent_score ??
    0;
  const risk =
    (leadState.deal_risk || "").toLowerCase();
  const urgency =
    (leadState.urgency || "").toLowerCase();

  if (
    risk.includes("high") ||
    risk.includes("procurement") ||
    risk.includes("legal") ||
    risk.includes("security")
  ) {
    return {
      status: "escalated",
      priority: "high",
      reason:
        "Escalated because deal risk requires human intervention.",
    };
  }

  if (confidence >= 75 || urgency === "high") {
    return {
      status: "approved",
      priority: "high",
      reason:
        "AI routed this due to high buying intent.",
    };
  }

  if (confidence >= 45 || urgency === "medium") {
    return {
      status: "pending",
      priority: "medium",
      reason:
        "Awaiting approval because confidence is moderate.",
    };
  }

  return {
    status: "pending",
    priority: "low",
    reason:
      "AI created a follow-up suggestion from conversation activity.",
  };
}

export async function routeOperationalWork({
  supabase,
  organizationId,
  leadId,
  leadState,
  latestMessage,
}: RouteOperationalWorkInput) {
  const recommendation =
    leadState.recommendation?.trim() ||
    "Continue qualification.";
  const decision =
    getRoutingDecision(leadState);
  const taskText =
    `${recommendation}\n\nReason: ${decision.reason}`;
  const eventMessage =
    latestMessage?.trim()
      ? `${decision.reason} Routed to ${decision.status}. Latest signal: ${latestMessage.trim()}`
      : `${decision.reason} Routed to ${decision.status}.`;

  const { data: activeTasks, error: activeTasksError } =
    await supabase
      .from("tasks")
      .select("id, task, status, priority, created_at")
      .eq("lead_id", leadId)
      .eq("organization_id", organizationId)
      .not("status", "in", "(completed,superseded,archived)")
      .order("created_at", {
        ascending: false,
      });

  if (activeTasksError) {
    throw activeTasksError;
  }

  const existingTask =
    (activeTasks || []).find(
      (task: ExistingTask) =>
        (task.task || "").trim() === taskText
    );

  if (existingTask) {
    const { error: updateError } =
      await supabase
        .from("tasks")
        .update({
          priority: decision.priority,
          status: decision.status,
        })
        .eq("id", existingTask.id)
        .eq("organization_id", organizationId);

    if (updateError) {
      console.error("OPERATIONAL ROUTING DEDUPE UPDATE ERROR", {
        leadId,
        organizationId,
        taskId: existingTask.id,
        error: updateError,
      });
    }

    return {
      task: existingTask,
      routed: false,
      reason: decision.reason,
      status: decision.status,
    };
  }

  const tasksToSupersede =
    (activeTasks || []).filter(
      (task: ExistingTask) =>
        task.status !== "escalated"
    );

  if (tasksToSupersede.length > 0) {
    const supersededTaskIds =
      tasksToSupersede.map(
        (task: ExistingTask) => task.id
      );

    const { error: supersedeError } =
      await supabase
        .from("tasks")
        .update({
          status: "superseded",
        })
        .in("id", supersededTaskIds)
        .eq("organization_id", organizationId);

    if (supersedeError) {
      console.error("OPERATIONAL ROUTING SUPERSEDE ERROR", {
        leadId,
        organizationId,
        supersededTaskIds,
        error: supersedeError,
      });
    } else {
      await supabase.from("ai_events").insert({
        lead_id: leadId,
        organization_id: organizationId,
        type: "workflow_superseded",
        message:
          "Older operational recommendations were replaced by a newer recommendation.",
      });
    }
  }

  const { data: task, error: taskError } =
    await supabase
      .from("tasks")
      .insert({
        lead_id: leadId,
        organization_id: organizationId,
        task: taskText,
        priority: decision.priority,
        status: decision.status,
      })
      .select("*")
      .single();

  let createdTask = task;
  let createdWithFallback = false;

  if (taskError) {
    console.error("OPERATIONAL ROUTING TASK INSERT ERROR", {
      leadId,
      organizationId,
      desiredStatus: decision.status,
      error: taskError,
    });

    const { data: fallbackTask, error: fallbackTaskError } =
      await supabase
        .from("tasks")
        .insert({
          lead_id: leadId,
          organization_id: organizationId,
          task: taskText,
          priority: decision.priority,
          status: "pending",
        })
        .select("*")
        .single();

    if (fallbackTaskError) {
      throw fallbackTaskError;
    }

    createdTask = fallbackTask;
    createdWithFallback = true;
  }

  const { error: eventError } =
    await supabase
      .from("ai_events")
      .insert({
        lead_id: leadId,
        organization_id: organizationId,
        type: "operational_routing",
        message: eventMessage,
      });

  if (eventError) {
    throw eventError;
  }

  const { error: primaryEventError } =
    await supabase
      .from("ai_events")
      .insert({
        lead_id: leadId,
        organization_id: organizationId,
        type: "primary_recommendation_selected",
        message:
          "Latest operational recommendation selected as the primary next best action.",
      });

  if (primaryEventError) {
    console.error("PRIMARY RECOMMENDATION EVENT ERROR", {
      leadId,
      organizationId,
      error: primaryEventError,
    });
  }

  return {
    task: createdTask,
    routed: true,
    reason: decision.reason,
    status: decision.status,
    createdWithFallback,
  };
}
