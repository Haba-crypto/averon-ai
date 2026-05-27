import type { SupabaseClient } from "@supabase/supabase-js";

export async function listAiEventsForLead({
  supabase,
  leadId,
  organizationId,
}: {
  supabase: SupabaseClient;
  leadId: string;
  organizationId: string;
}) {
  const { data, error } = await supabase
    .from("ai_events")
    .select("*")
    .eq("lead_id", leadId)
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: false,
    })
    .limit(50);

  if (error) {
    throw error;
  }

  return data ?? [];
}
