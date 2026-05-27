import type { SupabaseClient } from "@supabase/supabase-js";

export async function listLeads({
  supabase,
  organizationId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
}) {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("organization_id", organizationId)
    .order("intent_score", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data ?? [];
}
