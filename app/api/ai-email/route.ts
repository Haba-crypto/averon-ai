import { NextResponse } from "next/server";

import { jsonError, methodNotAllowed } from "@/lib/api/errors";
import { getOpenAIClient } from "@/lib/ai/openai";

export async function GET() {
  return methodNotAllowed("GET");
}

export async function POST() {

  try {
    const openai = getOpenAIClient();

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4o-mini",

        messages: [

          {
            role: "system",
            content:
              "You are an elite AI SDR agent for AVERON. Write short high-converting outbound emails.",
          },

          {
            role: "user",
            content:
              "Write a cold outbound email to a SaaS founder offering AI automation services.",
          },

        ],

      });

    return NextResponse.json({

      success: true,

      email:
        completion.choices[0]
          .message.content,

    });

  } catch (error: unknown) {

    return jsonError(error);

  }

}
