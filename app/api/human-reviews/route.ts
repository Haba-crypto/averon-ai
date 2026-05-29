export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/errors";
import {
  HUMAN_REVIEW_STATUSES,
  listHumanReviews,
} from "@/lib/application/human-reviews/list-human-reviews";
import type { HumanReviewStatus } from "@/lib/application/human-reviews/create-human-review";
import { requireApiOrganizationContext } from "@/lib/auth/organization";

export async function GET(req: Request) {
  try {
    const { supabase, response, organizationId } =
      await requireApiOrganizationContext();

    if (response) {
      return response;
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    if (
      statusParam &&
      !HUMAN_REVIEW_STATUSES.includes(statusParam as HumanReviewStatus)
    ) {
      return NextResponse.json(
        {
          error: "Unsupported human review status",
        },
        {
          status: 400,
        }
      );
    }

    const result = await listHumanReviews({
      supabase,
      organizationId,
      status: statusParam
        ? (statusParam as HumanReviewStatus)
        : undefined,
      page: pageParam === null ? undefined : Number(pageParam),
      limit: limitParam === null ? undefined : Number(limitParam),
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error);
  }
}
