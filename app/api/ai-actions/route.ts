import { NextResponse } from "next/server";

import OpenAI from "openai";

import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {

  try {

    // DEMO LEAD

    const leadId =
      "d19d37db-2dd3-48f1-9985-b91ec37a2bda";

    // DEMO MESSAGE

    const latestMessage = `
Hey,

This looks interesting.

Can we schedule a demo next week?
`;

    // AI DECISION ENGINE

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4o-mini",

        messages: [

          {
            role: "system",
            content: `
You are an autonomous AI CRM engine.

Analyze the message.

Return ONLY valid JSON.

Example:

{
  "intent": "high",
  "action": "schedule_demo",
  "status": "demo_scheduled",
  "intent_score": 85,
  "notes": "Lead requested a demo."
}
`,
          },

          {
            role: "user",
            content:
              latestMessage,
          },

        ],

      });

    const rawDecision =
      completion.choices[0]
        .message.content || "{}";

    const decision =
      JSON.parse(rawDecision);

    // UPDATE LEAD

    await supabase
      .from("leads")
      .update({

        status:
          decision.status,

        intent_score:
          decision.intent_score,

        ai_notes:
          decision.notes,

      })
      .eq(
        "id",
        leadId
      );

    return NextResponse.json({

      success: true,

      message:
        latestMessage,

      decision,

      crmUpdated: true,

    });

  } catch (error: any) {

    return NextResponse.json({

      success: false,

      error:
        error.message,

    });

  }

}