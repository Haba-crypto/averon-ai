import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/api";
import { jsonError, methodNotAllowed } from "@/lib/api/errors";
import { parseJsonObject } from "@/lib/ai/json";
import { getOpenAIClient } from "@/lib/ai/openai";

type AiTask = {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
};

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
      parseJsonObject<AiTask>(
        rawTask,
        {}
      );

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

  } catch (error: unknown) {

    return jsonError(error);

  }

}
