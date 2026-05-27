import type { SupabaseClient } from "@supabase/supabase-js";

export async function listMessagesForLead({
  supabase,
  leadId,
  organizationId,
}: {
  supabase: SupabaseClient;
  leadId: string;
  organizationId: string;
}) {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("lead_id", leadId)
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return data ?? [];
}
