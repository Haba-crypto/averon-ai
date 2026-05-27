import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/errors";
import { listAiEventsForLead } from "@/lib/application/events/list-ai-events";
import { requireApiOrganizationContext } from "@/lib/auth/organization";

export async function GET(req: Request) {
  try {
    const { supabase, response, organizationId } =
      await requireApiOrganizationContext();

    if (response) {
      return response;
    }

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId");

    if (!leadId) {
      return NextResponse.json(
        {
          error: "Lead ID required",
        },
        {
          status: 400,
        }
      );
    }

    const events = await listAiEventsForLead({
      supabase,
      leadId,
      organizationId,
    });

    return NextResponse.json({
      events,
    });
  } catch (error: unknown) {
    return jsonError(error);
  }
}
