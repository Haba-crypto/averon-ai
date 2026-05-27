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
}: {
  supabase: SupabaseClient;
  taskId: string;
}) {
  const { error } = await supabase
    .from("tasks")
    .update({
      status: "completed",
    })
    .eq("id", taskId);

  if (error) {
    throw error;
  }
}
