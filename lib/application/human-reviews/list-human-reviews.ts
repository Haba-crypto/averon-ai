import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  HumanReviewPriority,
  HumanReviewStatus,
} from "@/lib/application/human-reviews/create-human-review";

export type HumanReviewLeadInfo = {
  id: string;
  name: string | null;
  company: string | null;
  email: string | null;
};

export type HumanReviewInboxItem = {
  id: string;
  work_item_id: string | null;
  lead: HumanReviewLeadInfo | null;
  source_agent_name: string | null;
  review_type: string;
  review_reason: string | null;
  review_title: string | null;
  review_summary: string | null;
  review_context: Record<string, unknown> | null;
  recommended_action: string | null;
  priority: HumanReviewPriority;
  status: HumanReviewStatus;
  requested_at: string;
  reviewed_at: string | null;
  review_outcome: string | null;
  review_notes: string | null;
};

type HumanReviewRow = Omit<HumanReviewInboxItem, "lead">;

type WorkItemLeadRow = {
  id: string;
  source_type: string | null;
  source_id: string | null;
};

export const HUMAN_REVIEW_STATUSES: HumanReviewStatus[] = [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "completed",
];

export async function listHumanReviews({
  supabase,
  organizationId,
  status,
  page = 1,
  limit = 25,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  status?: HumanReviewStatus;
  page?: number;
  limit?: number;
}) {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;

  let query = supabase
    .from("human_reviews")
    .select(
      [
        "id",
        "work_item_id",
        "source_agent_name",
        "review_type",
        "review_reason",
        "review_title",
        "review_summary",
        "review_context",
        "recommended_action",
        "priority",
        "status",
        "requested_at",
        "reviewed_at",
        "review_outcome",
        "review_notes",
      ].join(", "),
      {
        count: "exact",
      }
    )
    .eq("organization_id", organizationId)
    .order("requested_at", {
      ascending: false,
    })
    .range(from, to);

  if (status) {
    query = query.eq("status", status);
  } else {
    query = query.in("status", HUMAN_REVIEW_STATUSES);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const reviews = (data ?? []) as unknown as HumanReviewRow[];
  const workItemIds = Array.from(
    new Set(
      reviews
        .map((review) => review.work_item_id)
        .filter(Boolean)
    )
  ) as string[];
  const leadByWorkItemId = await getLeadInfoByWorkItemId({
    supabase,
    organizationId,
    workItemIds,
  });

  return {
    reviews: reviews.map((review) => ({
      ...review,
      lead: review.work_item_id
        ? leadByWorkItemId.get(review.work_item_id) ?? null
        : null,
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: count ?? 0,
      totalPages: Math.max(
        1,
        Math.ceil((count ?? 0) / safeLimit)
      ),
    },
  };
}

async function getLeadInfoByWorkItemId({
  supabase,
  organizationId,
  workItemIds,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemIds: string[];
}) {
  const leadByWorkItemId = new Map<string, HumanReviewLeadInfo>();

  if (workItemIds.length === 0) {
    return leadByWorkItemId;
  }

  const { data: workItems, error: workItemsError } = await supabase
    .from("work_items")
    .select("id, source_type, source_id")
    .eq("organization_id", organizationId)
    .in("id", workItemIds);

  if (workItemsError) {
    console.error("HUMAN REVIEW LEAD ENRICHMENT WORK ITEM LOOKUP FAILED", {
      organizationId,
      workItemIds,
      error: workItemsError,
    });

    return leadByWorkItemId;
  }

  const typedWorkItems = (workItems ?? []) as WorkItemLeadRow[];
  const leadIds = Array.from(
    new Set(
      typedWorkItems
        .filter((workItem) => workItem.source_type === "lead")
        .map((workItem) => workItem.source_id)
        .filter(Boolean)
    )
  ) as string[];

  if (leadIds.length === 0) {
    return leadByWorkItemId;
  }

  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("id, name, company, email")
    .eq("organization_id", organizationId)
    .in("id", leadIds);

  if (leadsError) {
    console.error("HUMAN REVIEW LEAD ENRICHMENT LEAD LOOKUP FAILED", {
      organizationId,
      leadIds,
      error: leadsError,
    });

    return leadByWorkItemId;
  }

  const leadById = new Map(
    ((leads ?? []) as HumanReviewLeadInfo[]).map((lead) => [
      lead.id,
      lead,
    ])
  );

  for (const workItem of typedWorkItems) {
    const lead = workItem.source_id
      ? leadById.get(workItem.source_id)
      : null;

    if (lead) {
      leadByWorkItemId.set(workItem.id, lead);
    }
  }

  return leadByWorkItemId;
}
