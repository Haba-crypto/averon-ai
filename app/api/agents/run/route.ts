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

export async function GET() {

  /* LOAD LEADS */

  const {
    data: leads,
  } = await supabase
    .from("leads")
    .select("*")
    .limit(10);

  if (!leads) {

    return NextResponse.json({
      success: false,
    });

  }

  /* BACKGROUND AI LOOP */

  for (const lead of leads) {

    let eventMessage =
      "AI monitoring lead activity";

    if (
      lead.intent_score > 70
    ) {

      eventMessage =
        "Closer Agent escalated deal urgency";

    }

    if (
      lead.intent_score > 40 &&
      lead.intent_score <= 70
    ) {

      eventMessage =
        "SDR Agent analyzing qualification status";

    }

    if (
      lead.close_probability >
      80
    ) {

      eventMessage =
        "AI predicts high probability close opportunity";

    }

    await supabase
      .from("ai_events")
      .insert({

        lead_id:
          lead.id,

        type:
          "background",

        message:
          eventMessage,

      });

  }

  return NextResponse.json({

    success: true,

    processed:
      leads.length,

  });

}