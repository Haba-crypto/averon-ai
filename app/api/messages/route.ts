export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/errors";
import { listMessagesForLead } from "@/lib/application/conversations/list-messages";
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

    const messages = await listMessagesForLead({
      supabase,
      leadId,
      organizationId,
    });

    return NextResponse.json({
      messages,
    });
  } catch (error: unknown) {
    console.error("MESSAGES API ERROR:", error);

    return jsonError(error);
  }
}
