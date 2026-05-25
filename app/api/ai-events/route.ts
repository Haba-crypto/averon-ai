import { NextResponse }
from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

const supabase =
  createClient(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL!,
    process.env
      .SUPABASE_SERVICE_ROLE_KEY!
  );

export async function GET(
  req: Request
) {

  const {
    searchParams,
  } = new URL(req.url);

  const leadId =
    searchParams.get(
      "leadId"
    );

  const {
    data,
  } = await supabase
    .from("ai_events")
    .select("*")
    .eq(
      "lead_id",
      leadId
    )
    .order(
      "created_at",
      {
        ascending:
          false,
      }
    )
    .limit(50);

  return NextResponse.json({

    events:
      data || [],

  });

}