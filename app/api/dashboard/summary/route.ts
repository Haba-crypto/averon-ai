export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/errors";
import { getDashboardSummary } from "@/lib/application/dashboard/get-dashboard-summary";
import { requireApiOrganizationContext } from "@/lib/auth/organization";

export async function GET() {
  try {
    const { supabase, response, organizationId } =
      await requireApiOrganizationContext();

    if (response) {
      return response;
    }

    const summary = await getDashboardSummary({
      supabase,
      organizationId,
    });

    return NextResponse.json({
      summary,
    });
  } catch (error: unknown) {
    return jsonError(error);
  }
}
