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

Can we schedule a product demo next week?
`;

    // AI TASK ENGINE

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4o-mini",

        messages: [

          {
            role: "system",
            content: `
You are an AI sales task engine.

Analyze the message.

Generate the next sales task.

Return ONLY valid JSON.

Example:

{
  "title": "Schedule product demo",
  "description": "Lead requested a demo next week.",
  "priority": "high",
  "status": "pending"
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

    const rawTask =
      completion.choices[0]
        .message.content || "{}";

    const task =
      JSON.parse(rawTask);

    // SAVE TASK

    await supabase
      .from("tasks")
      .insert({

        lead_id: leadId,

        title:
          task.title,

        description:
          task.description,

        priority:
          task.priority,

        status:
          task.status,

      });

    return NextResponse.json({

      success: true,

      message:
        latestMessage,

      taskCreated: true,

      task,

    });

  } catch (error: any) {

    return NextResponse.json({

      success: false,

      error:
        error.message,

    });

  }

}