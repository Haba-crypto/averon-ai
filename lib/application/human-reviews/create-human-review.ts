import type { SupabaseClient } from "@supabase/supabase-js";

import { updateWorkItemOwnership } from "@/lib/application/work-items/update-work-item-ownership";

export type HumanReviewPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

export type HumanReviewStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "completed";

export type HumanReviewSourceAgent = {
  id?: string | null;
  name?: string | null;
  role?: string | null;
};

export type CreateHumanReviewInput = {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
  sourceAgent: HumanReviewSourceAgent | string | null;
  reviewType: string;
  reviewReason: string;
  priority?: HumanReviewPriority;
  agentExecutionId?: string | null;
};

export type ReviewBriefingContext = {
  lead_id: string | null;
  work_item_id: string;
  source_agent: string | null;
  owner_agent: string | null;
  memory_summary: string | null;
  review_reason: string | null;
  latest_execution?: {
    id: string;
    status: string | null;
  } | null;
};

export type ReviewBriefing = {
  review_title: string;
  review_summary: string;
  review_context: ReviewBriefingContext;
  recommended_action: string;
};

export type HumanReviewRecord = {
  id: string;
  organization_id: string;
  work_item_id: string;
  source_agent_id: string | null;
  source_agent_name: string | null;
  review_type: string;
  review_reason: string | null;
  status: HumanReviewStatus;
  priority: HumanReviewPriority;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_outcome: string | null;
  review_notes: string | null;
  review_title: string | null;
  review_summary: string | null;
  review_context: ReviewBriefingContext | null;
  recommended_action: string | null;
};

const HUMAN_REVIEW_SELECT_COLUMNS = [
  "id",
  "organization_id",
  "work_item_id",
  "source_agent_id",
  "source_agent_name",
  "review_type",
  "review_reason",
  "review_title",
  "review_summary",
  "review_context",
  "recommended_action",
  "status",
  "priority",
  "requested_at",
  "reviewed_at",
  "reviewed_by",
  "review_outcome",
  "review_notes",
];

export async function createHumanReview({
  supabase,
  organizationId,
  workItemId,
  sourceAgent,
  reviewType,
  reviewReason,
  priority = "normal",
  agentExecutionId = null,
}: CreateHumanReviewInput) {
  const normalizedSourceAgent = normalizeSourceAgent(sourceAgent);
  const briefingContext = await loadReviewBriefingContext({
    supabase,
    organizationId,
    workItemId,
    sourceAgent: normalizedSourceAgent,
    reviewReason,
    agentExecutionId,
  });
  const briefing = buildReviewBriefing({
    sourceAgent: normalizedSourceAgent,
    reviewType,
    reviewReason,
    context: briefingContext,
  });
  const existingReview = await findOpenHumanReview({
    supabase,
    organizationId,
    workItemId,
    reviewType,
  });

  if (existingReview) {
    const updatedReview = await updateOpenHumanReviewBriefingIfMissing({
      supabase,
      organizationId,
      review: existingReview,
      briefing,
    });

    return {
      review: updatedReview,
      created: false,
      ownership: null,
      decision: null,
    };
  }

  const requestedAt = new Date().toISOString();
  const { data: review, error: reviewError } = await supabase
    .from("human_reviews")
    .insert({
      organization_id: organizationId,
      work_item_id: workItemId,
      agent_execution_id: agentExecutionId,
      source_agent_id: normalizedSourceAgent?.id ?? null,
      source_agent_name: normalizedSourceAgent?.name ?? null,
      review_type: reviewType,
      review_reason: reviewReason,
      review_title: briefing.review_title,
      review_summary: briefing.review_summary,
      review_context: briefing.review_context,
      recommended_action: briefing.recommended_action,
      status: "pending",
      priority,
      requested_at: requestedAt,
      request_payload: {
        source: "human_review_queue",
        source_agent: normalizedSourceAgent,
        review_type: reviewType,
        review_reason: reviewReason,
        review_title: briefing.review_title,
        review_summary: briefing.review_summary,
        review_context: briefing.review_context,
        recommended_action: briefing.recommended_action,
        priority,
      },
    })
    .select(HUMAN_REVIEW_SELECT_COLUMNS.join(", "))
    .single<HumanReviewRecord>();

  if (reviewError) {
    throw reviewError;
  }

  const ownership = await updateWorkItemOwnership({
    supabase,
    workItemId,
    organizationId,
    ownerType: "human",
    reason: reviewReason,
    sourceAgent: normalizedSourceAgent,
    targetAgent: "Human Review",
  });

  const { data: decision, error: decisionError } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: agentExecutionId,
      agent_id: normalizedSourceAgent?.id ?? null,
      work_item_id: workItemId,
      decision_type: "human_review_requested",
      decision: {
        outcome: {
          review_id: review.id,
          review_type: reviewType,
          reason: reviewReason,
          review_title: review.review_title,
          review_summary: review.review_summary,
          recommended_action: review.recommended_action,
          priority,
        },
      },
      rationale: `Human review requested: ${review.review_title ?? reviewReason}`,
      confidence: 1,
      metadata: {
        source: "human_review_queue",
        review_id: review.id,
        review_type: reviewType,
        reason: reviewReason,
        review_title: review.review_title,
        review_summary: review.review_summary,
        recommended_action: review.recommended_action,
        priority,
        source_agent: normalizedSourceAgent?.name ?? null,
        requested_at: review.requested_at,
      },
    })
    .select("id")
    .single<{ id: string }>();

  if (decisionError) {
    throw decisionError;
  }

  return {
    review,
    created: true,
    ownership,
    decision,
  };
}

async function findOpenHumanReview({
  supabase,
  organizationId,
  workItemId,
  reviewType,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
  reviewType: string;
}) {
  const { data, error } = await supabase
    .from("human_reviews")
    .select(HUMAN_REVIEW_SELECT_COLUMNS.join(", "))
    .eq("organization_id", organizationId)
    .eq("work_item_id", workItemId)
    .eq("review_type", reviewType)
    .in("status", ["pending", "in_review"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle<HumanReviewRecord>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function updateOpenHumanReviewBriefingIfMissing({
  supabase,
  organizationId,
  review,
  briefing,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  review: HumanReviewRecord;
  briefing: ReviewBriefing;
}) {
  console.info("HUMAN_REVIEW_REUSE_BRIEFING_CHECK", {
    review_id: review.id,
    work_item_id: review.work_item_id,
    existing_review_title: review.review_title,
    generated_review_title: briefing.review_title,
  });

  const patch: Partial<
    Pick<
      HumanReviewRecord,
      | "review_title"
      | "review_summary"
      | "review_context"
      | "recommended_action"
    >
  > = {};

  if (review.review_title !== briefing.review_title) {
    patch.review_title = briefing.review_title;
  }

  if (review.review_summary !== briefing.review_summary) {
    patch.review_summary = briefing.review_summary;
  }

  if (!areJsonValuesEqual(review.review_context, briefing.review_context)) {
    patch.review_context = briefing.review_context;
  }

  if (review.recommended_action !== briefing.recommended_action) {
    patch.recommended_action = briefing.recommended_action;
  }

  if (Object.keys(patch).length === 0) {
    console.info("HUMAN_REVIEW_REUSE_BRIEFING_UNCHANGED", {
      review_id: review.id,
      existing_review_title: review.review_title,
      generated_review_title: briefing.review_title,
    });

    return review;
  }

  console.info("HUMAN_REVIEW_REUSE_BRIEFING_UPDATE", {
    review_id: review.id,
    existing_review_title: review.review_title,
    generated_review_title: briefing.review_title,
    updated_fields: Object.keys(patch),
  });

  const { data, error } = await supabase
    .from("human_reviews")
    .update(patch)
    .eq("id", review.id)
    .eq("organization_id", organizationId)
    .select(HUMAN_REVIEW_SELECT_COLUMNS.join(", "))
    .single<HumanReviewRecord>();

  if (error) {
    console.error("HUMAN_REVIEW_REUSE_BRIEFING_UPDATE_FAILED", {
      review_id: review.id,
      error,
    });

    throw error;
  }

  console.info("HUMAN_REVIEW_REUSE_BRIEFING_UPDATED", {
    review_id: data.id,
    review_title: data.review_title,
  });

  return data;
}

export function buildReviewBriefing({
  reviewType,
  reviewReason,
  context,
}: {
  sourceAgent?: HumanReviewSourceAgent | null;
  reviewType: string;
  reviewReason: string | null;
  context: ReviewBriefingContext;
}): ReviewBriefing {
  const category = classifyReviewBriefing(reviewType, reviewReason);

  if (category === "procurement") {
    return {
      review_title: "Procurement Approval Required",
      review_summary:
        "Procurement approval is required before execution can continue.",
      review_context: context,
      recommended_action:
        "Review and approve or reject the procurement request.",
    };
  }

  if (category === "exception") {
    return {
      review_title: "Exception Review Required",
      review_summary:
        "An execution exception requires human review.",
      review_context: context,
      recommended_action: "Inspect exception and determine next action.",
    };
  }

  return {
    review_title: "Contract Approval Required",
    review_summary:
      "Legal or contractual approval is required before execution can continue.",
    review_context: context,
    recommended_action:
      "Review and approve or reject the requested contract action.",
  };
}

async function loadReviewBriefingContext({
  supabase,
  organizationId,
  workItemId,
  sourceAgent,
  reviewReason,
  agentExecutionId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
  sourceAgent: HumanReviewSourceAgent | null;
  reviewReason: string | null;
  agentExecutionId: string | null;
}): Promise<ReviewBriefingContext> {
  const [workItem, latestExecution] = await Promise.all([
    loadReviewWorkItem({
      supabase,
      organizationId,
      workItemId,
    }),
    loadLatestExecution({
      supabase,
      organizationId,
      workItemId,
      agentExecutionId,
    }),
  ]);
  const leadId =
    workItem?.lead_id ??
    (workItem?.source_type === "lead"
      ? workItem.source_id ?? null
      : null);
  const memorySummary = await loadLatestMemorySummary({
    supabase,
    organizationId,
    workItemId,
    leadId,
  });

  return {
    lead_id: leadId,
    work_item_id: workItemId,
    source_agent: sourceAgent?.name ?? null,
    owner_agent: workItem?.owner_agent_name ?? null,
    memory_summary: memorySummary,
    review_reason: reviewReason,
    latest_execution: latestExecution,
  };
}

async function loadReviewWorkItem({
  supabase,
  organizationId,
  workItemId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
}) {
  const { data, error } = await supabase
    .from("work_items")
    .select(
      [
        "id",
        "lead_id",
        "source_type",
        "source_id",
        "owner_agent_name",
      ].join(", ")
    )
    .eq("id", workItemId)
    .eq("organization_id", organizationId)
    .maybeSingle<{
      id: string;
      lead_id?: string | null;
      source_type?: string | null;
      source_id?: string | null;
      owner_agent_name?: string | null;
    }>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function loadLatestMemorySummary({
  supabase,
  organizationId,
  workItemId,
  leadId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
  leadId: string | null;
}) {
  const workItemMemory = await loadSingleMemorySummary({
    supabase,
    organizationId,
    key: "work_item_id",
    value: workItemId,
  });

  if (workItemMemory) {
    return workItemMemory;
  }

  if (!leadId) {
    return null;
  }

  return loadSingleMemorySummary({
    supabase,
    organizationId,
    key: "lead_id",
    value: leadId,
  });
}

async function loadSingleMemorySummary({
  supabase,
  organizationId,
  key,
  value,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  key: "work_item_id" | "lead_id";
  value: string;
}) {
  const { data, error } = await supabase
    .from("memory_entries")
    .select("content, metadata, created_at")
    .eq("organization_id", organizationId)
    .eq(key, value)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle<{
      content: string;
      metadata?: Record<string, unknown> | null;
      created_at: string;
    }>();

  if (error) {
    throw error;
  }

  return data?.content ?? null;
}

async function loadLatestExecution({
  supabase,
  organizationId,
  workItemId,
  agentExecutionId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
  agentExecutionId: string | null;
}) {
  let query = supabase
    .from("agent_executions")
    .select("id, status, created_at")
    .eq("organization_id", organizationId)
    .eq("work_item_id", workItemId);

  if (agentExecutionId) {
    query = query.eq("id", agentExecutionId);
  } else {
    query = query.order("created_at", {
      ascending: false,
    });
  }

  const { data, error } = await query
    .limit(1)
    .maybeSingle<{
      id: string;
      status: string | null;
      created_at: string;
    }>();

  if (error) {
    throw error;
  }

  return data
    ? {
        id: data.id,
        status: data.status,
      }
    : null;
}

function classifyReviewBriefing(
  reviewType: string,
  reviewReason: string | null
) {
  const haystack = `${reviewType} ${reviewReason ?? ""}`.toLowerCase();

  if (
    haystack.includes("procurement") ||
    haystack.includes("vendor approval") ||
    haystack.includes("supplier approval") ||
    haystack.includes("purchase approval") ||
    haystack.includes("закупка") ||
    haystack.includes("снабжение") ||
    haystack.includes("тендер")
  ) {
    return "procurement";
  }

  if (
    haystack.includes("approval") ||
    haystack.includes("approved") ||
    haystack.includes("contract") ||
    haystack.includes("legal") ||
    haystack.includes("legal review") ||
    haystack.includes("compliance") ||
    haystack.includes("agreement") ||
    haystack.includes("согласование") ||
    haystack.includes("юридическая проверка") ||
    haystack.includes("юрист") ||
    haystack.includes("договор") ||
    haystack.includes("контракт") ||
    haystack.includes("комплаенс")
  ) {
    return "legal_approval";
  }

  return "exception";
}

function areJsonValuesEqual(
  left: Record<string, unknown> | null,
  right: Record<string, unknown> | null
) {
  return stableJsonStringify(left) === stableJsonStringify(right);
}

function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableJsonStringify(record[key])}`
    );

  return `{${entries.join(",")}}`;
}

function normalizeSourceAgent(
  sourceAgent: HumanReviewSourceAgent | string | null
): HumanReviewSourceAgent | null {
  if (!sourceAgent) {
    return null;
  }

  if (typeof sourceAgent === "string") {
    return {
      name: sourceAgent,
    };
  }

  if (!sourceAgent.id && !sourceAgent.name && !sourceAgent.role) {
    return null;
  }

  return {
    id: sourceAgent.id ?? null,
    name: sourceAgent.name ?? null,
    role: sourceAgent.role ?? null,
  };
}
