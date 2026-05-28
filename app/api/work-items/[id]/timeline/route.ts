export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/errors";
import {
  listWorkItemTimeline,
  WorkItemTimelineNotFoundError,
} from "@/lib/application/work-items/list-work-item-timeline";
import { requireApiOrganizationContext } from "@/lib/auth/organization";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const { supabase, response, organizationId } =
      await requireApiOrganizationContext();

    if (response) {
      return response;
    }

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const cursor = searchParams.get("cursor");

    if (!id) {
      return NextResponse.json(
        {
          error: "Work item ID required",
        },
        {
          status: 400,
        }
      );
    }

    const timeline = await listWorkItemTimeline({
      supabase,
      workItemId: id,
      organizationId,
      limit:
        limitParam === null ? undefined : Number(limitParam),
      offset:
        offsetParam === null ? undefined : Number(offsetParam),
      cursor,
    });

    return NextResponse.json({
      timeline,
    });
  } catch (error: unknown) {
    if (error instanceof WorkItemTimelineNotFoundError) {
      return jsonError(error, 404);
    }

    return jsonError(error);
  }
}
