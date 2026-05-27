import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/errors";
import { respondToLeadMessage } from "@/lib/application/conversations/respond-to-lead-message";
import { requireApiOrganizationContext } from "@/lib/auth/organization";

export async function POST(req: Request) {
  try {
    const { supabase, response, organizationId } =
      await requireApiOrganizationContext();

    if (response) {
      return response;
    }

    const body = await req.json();
    const { message, leadId } = body;

    if (
      typeof message !== "string" ||
      typeof leadId !== "string"
    ) {
      return NextResponse.json(
        {
          error: "message and leadId are required",
        },
        {
          status: 400,
        }
      );
    }

    const result = await respondToLeadMessage({
      supabase,
      leadId,
      message,
      organizationId,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    console.error(error);

    return jsonError(error);
  }
}
