export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/errors";
import { listLeads } from "@/lib/application/leads/list-leads";
import { requireApiOrganizationContext } from "@/lib/auth/organization";

export async function GET() {
  try {
    const { supabase, response, organizationId } =
      await requireApiOrganizationContext();

    if (response) {
      return response;
    }

    const leads = await listLeads({
      supabase,
      organizationId,
    });

    return NextResponse.json({
      leads,
    });
  } catch (error: unknown) {
    console.error("LEADS API ERROR:", error);

    return jsonError(error);
  }
}
