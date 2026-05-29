export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/errors";
import type { HumanReviewStatus } from "@/lib/application/human-reviews/create-human-review";
import { HUMAN_REVIEW_STATUSES } from "@/lib/application/human-reviews/list-human-reviews";
import { updateHumanReviewStatus } from "@/lib/application/human-reviews/update-human-review-status";
import { requireApiOrganizationContext } from "@/lib/auth/organization";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ExistingReview = {
  status: HumanReviewStatus;
  review_outcome: string | null;
  review_notes: string | null;
};

type PatchHumanReviewBody = {
  status?: unknown;
  review_outcome?: unknown;
  review_notes?: unknown;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { response, organizationId, user } =
      await requireApiOrganizationContext();

    if (response) {
      return response;
    }

    const { id } = await context.params;
    const body = await req.json();

    return patchHumanReviewAction({
      supabase: supabaseAdmin,
      organizationId,
      reviewId: id,
      userId: user?.id ?? null,
      body,
    });
  } catch (error: unknown) {
    console.error("HUMAN REVIEW PATCH FAILED", {
      error,
    });

    return jsonError(error);
  }
}

export async function patchHumanReviewAction({
  supabase,
  organizationId,
  reviewId,
  userId,
  body,
}: {
  supabase: SupabaseClient;
  organizationId: string | null;
  reviewId: string;
  userId: string | null;
  body: PatchHumanReviewBody;
}) {
  try {
    if (!organizationId) {
      return NextResponse.json(
        {
          error: "Organization context not found",
        },
        {
          status: 403,
        }
      );
    }

    const { status, review_outcome, review_notes } = body;

    console.info("HUMAN REVIEW PATCH RECEIVED", {
      review_id: reviewId,
      organization_id: organizationId,
      status,
      has_review_notes:
        typeof review_notes === "string" && review_notes.length > 0,
    });

    if (!reviewId) {
      return NextResponse.json(
        {
          error: "Human review ID required",
        },
        {
          status: 400,
        }
      );
    }

    if (
      status !== undefined &&
      (typeof status !== "string" ||
        !HUMAN_REVIEW_STATUSES.includes(status as HumanReviewStatus))
    ) {
      return NextResponse.json(
        {
          error: "Supported human review status is required",
        },
        {
          status: 400,
        }
      );
    }

    if (
      review_outcome !== undefined &&
      review_outcome !== null &&
      typeof review_outcome !== "string"
    ) {
      return NextResponse.json(
        {
          error: "review_outcome must be a string or null",
        },
        {
          status: 400,
        }
      );
    }

    if (
      review_notes !== undefined &&
      review_notes !== null &&
      typeof review_notes !== "string"
    ) {
      return NextResponse.json(
        {
          error: "review_notes must be a string or null",
        },
        {
          status: 400,
        }
      );
    }

    if (
      status === undefined &&
      review_outcome === undefined &&
      review_notes === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "At least one of status, review_outcome, or review_notes is required",
        },
        {
          status: 400,
        }
      );
    }

    const { data: existingReview, error: existingReviewError } =
      await supabase
        .from("human_reviews")
        .select("status, review_outcome, review_notes")
        .eq("id", reviewId)
        .eq("organization_id", organizationId)
        .maybeSingle<ExistingReview>();

    if (existingReviewError) {
      throw existingReviewError;
    }

    if (!existingReview) {
      return NextResponse.json(
        {
          error: "Human review not found",
        },
        {
          status: 404,
        }
      );
    }

    console.info("HUMAN REVIEW PATCH UPDATING", {
      review_id: reviewId,
      previous_status: existingReview.status,
      next_status:
        status === undefined
          ? existingReview.status
          : (status as HumanReviewStatus),
    });

    const review = await updateHumanReviewStatus({
      supabase,
      organizationId,
      reviewId,
      status:
        status === undefined
          ? existingReview.status
          : (status as HumanReviewStatus),
      reviewedBy: userId,
      reviewOutcome:
        review_outcome === undefined
          ? existingReview.review_outcome
          : (review_outcome as string | null),
      reviewNotes:
        review_notes === undefined
          ? existingReview.review_notes
          : (review_notes as string | null),
    });

    console.info("HUMAN REVIEW PATCH UPDATED", {
      review_id: review.id,
      status: review.status,
      review_outcome: review.review_outcome,
      reviewed_at: review.reviewed_at,
      reviewed_by: review.reviewed_by,
    });

    return NextResponse.json({
      success: true,
      review,
    });
  } catch (error: unknown) {
    console.error("HUMAN REVIEW PATCH ACTION FAILED", {
      reviewId,
      organizationId,
      error,
    });

    return jsonError(error);
  }
}
