export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/errors";
import { listRecentTaskEvents } from "@/lib/application/events/list-recent-task-events";
import { requireApiOrganizationContext } from "@/lib/auth/organization";

export async function GET() {
  try {
    const { supabase, response, organizationId } =
      await requireApiOrganizationContext();

    if (response) {
      return response;
    }

    const events = await listRecentTaskEvents({
      supabase,
      organizationId,
    });

    return NextResponse.json({
      events,
    });
  } catch (error: unknown) {
    console.error("EVENTS API ERROR:", error);

    return jsonError(error);
  }
}
