import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/api";
import { jsonError, methodNotAllowed } from "@/lib/api/errors";
import { getOpenAIClient } from "@/lib/ai/openai";

export async function GET() {
  return methodNotAllowed("GET");
}

export async function POST() {

  try {
    const openai = getOpenAIClient();

    const { supabase, response } =
      await requireApiUser();

    if (response) {
      return response;
    }

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

  } catch (error: unknown) {

    return jsonError(error);

  }

}
