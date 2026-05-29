import type { SupabaseClient } from "@supabase/supabase-js";

import { createExecutionQueueItem } from "@/lib/application/execution-queue/create-execution-queue-item";
import type { HumanReviewStatus } from "@/lib/application/human-reviews/create-human-review";
import {
  updateWorkItemOwnership,
  type WorkItemOwnershipAgent,
  type WorkItemOwnershipRecord,
} from "@/lib/application/work-items/update-work-item-ownership";

export type UpdateHumanReviewStatusInput = {
  supabase: SupabaseClient;
  organizationId: string;
  reviewId: string;
  status: HumanReviewStatus;
  reviewedBy?: string | null;
  reviewOutcome?: string | null;
  reviewNotes?: string | null;
};

type UpdatedHumanReviewRecord = {
  id: string;
  organization_id: string;
  work_item_id: string | null;
  agent_execution_id: string | null;
  source_agent_id: string | null;
  source_agent_name: string | null;
  review_type: string;
  review_reason: string | null;
  status: HumanReviewStatus;
  priority: string;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_outcome: string | null;
  review_notes: string | null;
  recommended_action: string | null;
};

const UPDATED_REVIEW_SELECT_COLUMNS = [
  "id",
  "organization_id",
  "work_item_id",
  "agent_execution_id",
  "source_agent_id",
  "source_agent_name",
  "review_type",
  "review_reason",
  "status",
  "priority",
  "requested_at",
  "reviewed_at",
  "reviewed_by",
  "review_outcome",
  "review_notes",
  "recommended_action",
];

export async function updateHumanReviewStatus({
  supabase,
  organizationId,
  reviewId,
  status,
  reviewedBy = null,
  reviewOutcome = null,
  reviewNotes = null,
}: UpdateHumanReviewStatusInput) {
  const now = new Date().toISOString();
  const reviewedAt =
    status === "approved" ||
    status === "rejected" ||
    status === "completed"
      ? now
      : null;

  const { data, error } = await supabase
    .from("human_reviews")
    .update({
      status,
      reviewed_at: reviewedAt,
      reviewed_by: reviewedBy,
      review_outcome: reviewOutcome,
      review_notes: reviewNotes,
      decision: mapReviewDecision(status),
      updated_at: now,
    })
    .eq("id", reviewId)
    .eq("organization_id", organizationId)
    .select(UPDATED_REVIEW_SELECT_COLUMNS.join(", "))
    .single<UpdatedHumanReviewRecord>();

  if (error) {
    throw error;
  }

  if (isTerminalHumanReviewStatus(status)) {
    try {
      await createHumanDecisionFeedback({
        supabase,
        organizationId,
        review: data,
        decidedBy: reviewedBy,
      });
    } catch (feedbackError) {
      console.error("HUMAN REVIEW DECISION FEEDBACK FAILED", {
        organizationId,
        reviewId,
        status,
        error: feedbackError,
      });
    }
  }

  return data;
}

async function createHumanDecisionFeedback({
  supabase,
  organizationId,
  review,
  decidedBy,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  review: UpdatedHumanReviewRecord;
  decidedBy: string | null;
}) {
  if (!review.work_item_id) {
    console.warn("HUMAN REVIEW DECISION FEEDBACK SKIPPED", {
      reviewId: review.id,
      reason: "missing_work_item_id",
    });

    return null;
  }

  const ownership = await applyHumanDecisionOwnership({
    supabase,
    organizationId,
    review,
  });
  const feedback = buildHumanDecisionFeedback({
    review,
    ownership,
    decidedBy,
  });

  const { data, error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: review.agent_execution_id,
      agent_id: feedback.recommended_next_agent?.id ?? null,
      work_item_id: review.work_item_id,
      decision_type: "human_review_decision",
      decision: {
        outcome: feedback,
      },
      rationale: buildHumanDecisionRationale(feedback),
      confidence: 1,
      metadata: {
        source: "human_review_feedback",
        review_id: review.id,
        review_status: review.status,
        review_outcome: review.review_outcome,
        review_notes: review.review_notes,
        decided_by: decidedBy,
        previous_owner: feedback.previous_owner,
        next_owner: feedback.next_owner,
        recommended_next_agent: feedback.recommended_next_agent,
      },
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw error;
  }

  if (review.status === "approved") {
    try {
      await createExecutionResumeReadyDecision({
        supabase,
        organizationId,
        review,
        decidedBy,
        resumeAgent: feedback.recommended_next_agent,
      });
    } catch (resumeError) {
      console.error("EXECUTION RESUME READY DECISION FAILED", {
        organizationId,
        reviewId: review.id,
        workItemId: review.work_item_id,
        error: resumeError,
      });
    }
  }

  return data;
}

async function createExecutionResumeReadyDecision({
  supabase,
  organizationId,
  review,
  decidedBy,
  resumeAgent,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  review: UpdatedHumanReviewRecord;
  decidedBy: string | null;
  resumeAgent: WorkItemOwnershipAgent | null;
}) {
  if (!review.work_item_id) {
    return null;
  }

  const createdAt = new Date().toISOString();
  const resumeAgentName = resumeAgent?.name ?? "Operations Agent";
  const resumeReason =
    review.review_notes ??
    review.review_outcome ??
    "Human review approved; execution may resume.";
  const recommendedNextAction =
    review.recommended_action ??
    `Resume work after approved human review.`;
  const resumeReady = {
    review_id: review.id,
    work_item_id: review.work_item_id,
    source_review_status: review.status,
    approved_by: decidedBy,
    resume_agent_id: resumeAgent?.id ?? null,
    resume_agent_name: resumeAgentName,
    resume_reason: resumeReason,
    recommended_next_action: recommendedNextAction,
    created_at: createdAt,
  };

  const { data, error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: review.agent_execution_id,
      agent_id: resumeAgent?.id ?? null,
      work_item_id: review.work_item_id,
      decision_type: "execution_resume_ready",
      decision: {
        outcome: resumeReady,
      },
      rationale: `${resumeAgentName} can continue after human approval.`,
      confidence: 1,
      metadata: {
        source: "execution_resume_layer",
        ...resumeReady,
      },
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw error;
  }

  try {
    await createExecutionQueueItem({
      supabase,
      organizationId,
      workItemId: review.work_item_id,
      reviewId: review.id,
      sourceDecisionId: data.id,
      assignedAgentId: resumeAgent?.id ?? null,
      assignedAgentName: resumeAgentName,
      priority: normalizeExecutionQueuePriority(review.priority),
      queueReason: resumeReason,
      nextAction: recommendedNextAction,
    });
  } catch (queueError) {
    console.error("EXECUTION QUEUE CREATION FAILED", {
      organizationId,
      reviewId: review.id,
      workItemId: review.work_item_id,
      sourceDecisionId: data.id,
      error: queueError,
    });
  }

  return data;
}

async function applyHumanDecisionOwnership({
  supabase,
  organizationId,
  review,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  review: UpdatedHumanReviewRecord;
}) {
  if (!review.work_item_id) {
    throw new Error("Cannot apply feedback without work item id");
  }

  if (review.status === "approved") {
    const nextAgent = resolveApprovedNextAgent(review);

    return updateWorkItemOwnership({
      supabase,
      organizationId,
      workItemId: review.work_item_id,
      ownerType: "ai",
      ownerAgentId: nextAgent.id,
      ownerAgentName: nextAgent.name,
      ownerAgentRole: nextAgent.role,
      ownershipStatus: "ready_to_resume",
      reason: "approved human review; ready to resume",
      sourceAgent: "Human Review",
      targetAgent: nextAgent,
    });
  }

  if (review.status === "rejected") {
    return updateWorkItemOwnership({
      supabase,
      organizationId,
      workItemId: review.work_item_id,
      ownerType: "human",
      ownershipStatus: "blocked",
      reason: "rejected by human review",
      sourceAgent: "Human Review",
      targetAgent: "Human Review",
    });
  }

  return updateWorkItemOwnership({
    supabase,
    organizationId,
    workItemId: review.work_item_id,
    ownerType: "human",
    ownershipStatus: "completed",
    reason: "completed by human review",
    sourceAgent: "Human Review",
    targetAgent: "Human Review",
  });
}

function buildHumanDecisionFeedback({
  review,
  ownership,
  decidedBy,
}: {
  review: UpdatedHumanReviewRecord;
  ownership: Awaited<ReturnType<typeof updateWorkItemOwnership>>;
  decidedBy: string | null;
}) {
  return {
    review_id: review.id,
    review_status: review.status,
    review_outcome: review.review_outcome,
    review_notes: review.review_notes,
    decided_by: decidedBy,
    previous_owner: formatFeedbackOwner(ownership.previous),
    next_owner: formatFeedbackOwner(ownership.workItem),
    recommended_next_agent: getRecommendedNextAgent({
      review,
      workItem: ownership.workItem,
    }),
  };
}

function getRecommendedNextAgent({
  review,
  workItem,
}: {
  review: UpdatedHumanReviewRecord;
  workItem: WorkItemOwnershipRecord;
}): WorkItemOwnershipAgent | null {
  if (review.status !== "approved") {
    return null;
  }

  return {
    id: workItem.owner_agent_id,
    name: workItem.owner_agent_name,
    role: workItem.owner_agent_role,
  };
}

function resolveApprovedNextAgent(
  review: UpdatedHumanReviewRecord
): Required<WorkItemOwnershipAgent> {
  return {
    id: review.source_agent_id ?? null,
    name: review.source_agent_name || "Operations Agent",
    role: review.source_agent_name ? null : "Revenue Operations",
  };
}

function formatFeedbackOwner(owner: WorkItemOwnershipRecord) {
  return {
    owner_type: owner.owner_type,
    owner_agent_id: owner.owner_agent_id,
    owner_agent_name: owner.owner_agent_name,
    owner_agent_role: owner.owner_agent_role,
    owner_user_id: owner.owner_user_id,
    ownership_status: owner.ownership_status,
  };
}

function buildHumanDecisionRationale(feedback: {
  review_status: HumanReviewStatus;
  next_owner: {
    owner_agent_name: string | null;
    ownership_status: string;
  };
}) {
  if (feedback.review_status === "approved") {
    return `Work returned to ${feedback.next_owner.owner_agent_name ?? "Operations Agent"}`;
  }

  if (feedback.review_status === "rejected") {
    return "Work blocked by human decision";
  }

  return "Human review completed";
}

function isTerminalHumanReviewStatus(status: HumanReviewStatus) {
  return (
    status === "approved" ||
    status === "rejected" ||
    status === "completed"
  );
}

function mapReviewDecision(status: HumanReviewStatus) {
  if (status === "approved") {
    return "approve";
  }

  if (status === "rejected") {
    return "reject";
  }

  if (status === "completed") {
    return "complete";
  }

  return null;
}

function normalizeExecutionQueuePriority(priority: string) {
  if (
    priority === "low" ||
    priority === "normal" ||
    priority === "high" ||
    priority === "urgent"
  ) {
    return priority;
  }

  return "normal";
}
