import type { SupabaseClient } from "@supabase/supabase-js";

export async function listRecentTaskEvents({
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
    })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data ?? []).map((task) => ({
    id: task.id,
    agent_name: task.assigned_agent,
    event: task.task,
    created_at: task.created_at,
  }));
}
