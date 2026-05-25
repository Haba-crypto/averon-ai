import { NextResponse } from "next/server";

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {

  try {

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

  } catch (error: any) {

    return NextResponse.json({

      success: false,

      error:
        error.message,

    });

  }

}