import type { SupabaseClient } from "@supabase/supabase-js";

export async function getDashboardSummary({
  supabase,
  organizationId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
}) {
  const [
    { count: leadsCount, error: leadsError },
    { count: tasksCount, error: tasksError },
    { count: conversationsCount, error: conversationsError },
    { count: executionQueueReadyCount, error: executionQueueError },
  ] = await Promise.all([
    supabase.from("leads").select("*", {
      count: "exact",
      head: true,
    }).eq("organization_id", organizationId),
    supabase.from("tasks").select("*", {
      count: "exact",
      head: true,
    }).eq("organization_id", organizationId),
    supabase.from("conversations").select("*", {
      count: "exact",
      head: true,
    }).eq("organization_id", organizationId),
    supabase.from("execution_queue").select("*", {
      count: "exact",
      head: true,
    }).eq("organization_id", organizationId).eq("status", "ready"),
  ]);

  const error =
    leadsError ||
    tasksError ||
    conversationsError ||
    executionQueueError;

  if (error) {
    throw error;
  }

  return {
    leadsCount: leadsCount ?? 0,
    tasksCount: tasksCount ?? 0,
    conversationsCount: conversationsCount ?? 0,
    executionQueueReadyCount: executionQueueReadyCount ?? 0,
  };
}
