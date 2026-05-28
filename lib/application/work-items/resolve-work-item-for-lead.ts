import type { SupabaseClient } from "@supabase/supabase-js";

type ResolveWorkItemForLeadOptions = {
  supabase: SupabaseClient;
  organizationId?: string;
};

type LeadForWorkItem = {
  id: string;
  organization_id: string | null;
  name?: string | null;
  email?: string | null;
  status?: string | null;
  urgency?: string | null;
  intent_score?: number | null;
};

type WorkItemRecord = {
  id: string;
  organization_id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  source_type: string | null;
  source_id: string | null;
  lead_id?: string | null;
};

type DatabaseErrorLike = {
  code?: string;
};

function isUniqueViolation(error: unknown) {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    (error as DatabaseErrorLike).code === "23505"
  );
}

function mapLeadStatusToWorkItemStatus(status?: string | null) {
  const normalized = (status || "").toLowerCase();

  if (
    [
      "closed_won",
      "converted",
      "customer",
      "won",
    ].includes(normalized)
  ) {
    return "completed";
  }

  if (
    [
      "closed_lost",
      "disqualified",
      "lost",
      "unqualified",
    ].includes(normalized)
  ) {
    return "cancelled";
  }

  if (["blocked", "stalled"].includes(normalized)) {
    return "blocked";
  }

  if (
    [
      "approved",
      "contacted",
      "demo_scheduled",
      "execution_active",
      "proposal",
      "qualified",
    ].includes(normalized)
  ) {
    return "in_progress";
  }

  return "open";
}

function mapLeadPriority({
  urgency,
  intentScore,
}: {
  urgency?: string | null;
  intentScore?: number | null;
}) {
  const normalizedUrgency = (urgency || "").toLowerCase();
  const score = intentScore ?? 0;

  if (
    normalizedUrgency === "critical" ||
    normalizedUrgency === "urgent" ||
    score >= 85
  ) {
    return "urgent";
  }

  if (normalizedUrgency === "high" || score >= 70) {
    return "high";
  }

  if (normalizedUrgency === "low" && score < 25) {
    return "low";
  }

  return "normal";
}

function buildLeadWorkItemTitle(lead: LeadForWorkItem) {
  const titleParts = [lead.name, lead.email]
    .map((value) => value?.trim())
    .filter(Boolean);

  if (titleParts.length > 0) {
    return titleParts.join(" - ");
  }

  return `Lead ${lead.id.slice(0, 8)}`;
}

async function findExistingWorkItem({
  supabase,
  leadId,
  organizationId,
}: ResolveWorkItemForLeadOptions & {
  leadId: string;
}) {
  let query = supabase
    .from("work_items")
    .select("*")
    .eq("source_type", "lead")
    .eq("source_id", leadId);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } =
    await query.maybeSingle<WorkItemRecord>();

  if (error) {
    throw error;
  }

  return data;
}

export async function resolveWorkItemForLead(
  leadId: string,
  { supabase, organizationId }: ResolveWorkItemForLeadOptions
) {
  const existingWorkItem = await findExistingWorkItem({
    supabase,
    leadId,
    organizationId,
  });

  if (existingWorkItem) {
    return existingWorkItem;
  }

  let leadQuery = supabase
    .from("leads")
    .select(
      "id, organization_id, name, email, status, urgency, intent_score"
    )
    .eq("id", leadId);

  if (organizationId) {
    leadQuery = leadQuery.eq("organization_id", organizationId);
  }

  const { data: lead, error: leadError } =
    await leadQuery.single<LeadForWorkItem>();

  if (leadError) {
    throw leadError;
  }

  if (!lead.organization_id) {
    throw new Error(
      "Cannot resolve work item for a lead without an organization_id"
    );
  }

  const { data: createdWorkItem, error: createError } =
    await supabase
      .from("work_items")
      .insert({
        organization_id: lead.organization_id,
        title: buildLeadWorkItemTitle(lead),
        type: "lead_acquisition",
        status: mapLeadStatusToWorkItemStatus(lead.status),
        priority: mapLeadPriority({
          urgency: lead.urgency,
          intentScore: lead.intent_score,
        }),
        source_type: "lead",
        source_id: lead.id,
        lead_id: lead.id,
        metadata: {
          backfill: "resolve_work_item_for_lead",
          lead_status: lead.status,
          lead_urgency: lead.urgency,
          intent_score: lead.intent_score,
        },
      })
      .select("*")
      .single<WorkItemRecord>();

  if (!createError) {
    return createdWorkItem;
  }

  if (!isUniqueViolation(createError)) {
    throw createError;
  }

  const racedWorkItem = await findExistingWorkItem({
    supabase,
    leadId,
    organizationId: lead.organization_id,
  });

  if (!racedWorkItem) {
    throw createError;
  }

  return racedWorkItem;
}
