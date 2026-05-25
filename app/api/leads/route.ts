export const dynamic =
  "force-dynamic";

import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {

  try {

    const { data, error } =
      await supabaseServer
        .from("leads")
        .select("*")
        .order(
          "intent_score",
          {
            ascending: false,
          }
        );

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

      leads:
        data || [],

    });

  } catch (error: any) {

    console.error(
      "LEADS API ERROR:",
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