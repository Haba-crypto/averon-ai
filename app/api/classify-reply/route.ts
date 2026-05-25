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

    // DEMO INBOUND REPLY

    const inboundReply = `
Hey,

This sounds interesting.

Can you send pricing and maybe schedule a demo next week?

Thanks
`;

    // AI CLASSIFICATION

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4o-mini",

        messages: [

          {
            role: "system",
            content: `
You are an AI sales qualification engine.

Classify replies into ONE of:

- interested
- meeting_request
- pricing_request
- objection
- not_interested
- spam

Only return the classification.
            `,
          },

          {
            role: "user",
            content: inboundReply,
          },

        ],

      });

    const classification =
      completion.choices[0]
        .message.content
        ?.trim();

    // UPDATE LEAD STATUS

    let status = "new";

    if (
      classification ===
      "interested"
    ) {

      status = "qualified";

    }

    if (
      classification ===
      "meeting_request"
    ) {

      status = "demo_scheduled";

    }

    if (
      classification ===
      "pricing_request"
    ) {

      status = "proposal";

    }

    // SAVE CONVERSATION

    await supabase
      .from("conversations")
      .insert({

        role: "user",

        message:
          inboundReply,

        classification,

      });

    return NextResponse.json({

      success: true,

      inboundReply,

      classification,

      status,

    });

  } catch (error: any) {

    return NextResponse.json({

      success: false,

      error:
        error.message,

    });

  }

}