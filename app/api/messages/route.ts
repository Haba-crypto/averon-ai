export const dynamic =
  "force-dynamic";

import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: Request
) {

  try {

    const { searchParams } =
      new URL(req.url);

    const leadId =
      searchParams.get(
        "leadId"
      );

    if (!leadId) {

      return NextResponse.json(
        {
          error:
            "Lead ID required",
        },
        {
          status: 400,
        }
      );

    }

    const { data, error } =
      await supabaseServer
        .from("conversations")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", {
          ascending: true,
        });

    if (error) {

      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 500,
        }
      );

    }

    return NextResponse.json({

      messages:
        data || [],

    });

  } catch (error: any) {

    console.error(
      "MESSAGES API ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong",
      },
      {
        status: 500,
      }
    );

  }

}