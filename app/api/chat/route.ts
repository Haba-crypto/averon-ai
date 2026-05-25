import { NextResponse } from "next/server";

import OpenAI from "openai";

import { supabaseServer } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY,
});

export async function POST(
  req: Request
) {

  try {

    const body =
      await req.json();

    const {
      message,
      leadId,
      organizationId,
    } = body;

    if (!message) {

      return NextResponse.json(
        {
          error:
            "Message required",
        },
        {
          status: 400,
        }
      );

    }

    const lower =
      message.toLowerCase();

    /* MEMORY */

    let memorySummary = "";

    let recentMessages = "";

    if (leadId) {

      const { data: memory } =
        await supabaseServer
          .from("lead_memory")
          .select("*")
          .eq("lead_id", leadId)
          .single();

      if (memory) {

        memorySummary =
          memory.summary || "";

      }

      const {
        data: previousMessages,
      } = await supabaseServer
        .from("conversations")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", {
          ascending: false,
        })
        .limit(10);

      if (previousMessages) {

        recentMessages =
          previousMessages

            .reverse()

            .map(
              (msg) =>
                `${msg.role}: ${msg.message}`
            )

            .join("\n");

      }

    }

    /* SAVE USER MESSAGE */

    if (leadId) {

      await supabaseServer
        .from("conversations")
        .insert({

          lead_id:
            leadId,

          organization_id:
            organizationId,

          role:
            "user",

          message,

        });

    }

    /* MULTI AGENT SYSTEM */

    const activeAgents = [];

    if (
      lower.includes(
        "integration"
      ) ||
      lower.includes(
        "api"
      )
    ) {

      activeAgents.push(
        "Solutions Agent"
      );

    }

    if (
      lower.includes(
        "enterprise"
      ) ||
      lower.includes(
        "pricing"
      ) ||
      lower.includes(
        "proposal"
      )
    ) {

      activeAgents.push(
        "Closer Agent"
      );

    }

    if (
      lower.includes(
        "research"
      ) ||
      lower.includes(
        "company"
      ) ||
      lower.includes(
        "competitor"
      )
    ) {

      activeAgents.push(
        "Research Agent"
      );

    }

    if (
      activeAgents.length === 0
    ) {

      activeAgents.push(
        "SDR Agent"
      );

    }

    /* AI EVENTS */

    if (leadId) {

      for (
        const agent
        of activeAgents
      ) {

        await supabaseServer
          .from("agent_events")
          .insert({

            lead_id:
              leadId,

            organization_id:
              organizationId,

            agent_name:
              agent,

            event:
              `${agent} activated`,

          });

      }

    }

    /* OPENAI */

    const completion =
      await openai.chat.completions.create(
        {
          model:
            "gpt-4.1-mini",

          messages: [
            {
              role: "system",

              content: `
You are AVERON AI.

You are an autonomous AI-native revenue operating system.

ACTIVE AGENTS:
${activeAgents.join(", ")}

LEAD MEMORY:
${memorySummary}

RECENT CONVERSATION:
${recentMessages}

Responsibilities:
- qualify leads
- orchestrate sales workflows
- automate pipeline movement
- assist enterprise revenue teams
- coordinate multi-agent execution
- prioritize opportunities
- personalize responses
- remain concise
`,
            },

            {
              role: "user",

              content:
                message,
            },
          ],
        }
      );

    const aiReply =
      completion.choices[0]
        ?.message?.content ||
      "No response";

    /* SAVE AI RESPONSE */

    if (leadId) {

      await supabaseServer
        .from("conversations")
        .insert({

          lead_id:
            leadId,

          organization_id:
            organizationId,

          role:
            "assistant",

          message:
            aiReply,

        });

    }

    /* PIPELINE */

    let intentScore = 40;

    let leadStatus =
      "new";

    if (
      lower.includes(
        "enterprise"
      ) ||
      lower.includes(
        "pricing"
      ) ||
      lower.includes(
        "demo"
      )
    ) {

      intentScore = 85;

      leadStatus =
        "qualified";

    }

    if (
      lower.includes(
        "proposal"
      )
    ) {

      leadStatus =
        "proposal";

    }

    if (
      lower.includes(
        "contract"
      )
    ) {

      leadStatus =
        "closing";

    }

    /* TASK GENERATION */

    const generatedTasks = [];

    for (
      const agent
      of activeAgents
    ) {

      generatedTasks.push({

        lead_id:
          leadId,

        organization_id:
          organizationId,

        assigned_agent:
          agent,

        task:
          `${agent} workflow execution`,

        status:
          "pending",

        priority:
          intentScore >= 80
            ? "high"
            : "medium",

      });

    }

    if (
      generatedTasks.length > 0
    ) {

      await supabaseServer
        .from("tasks")
        .insert(
          generatedTasks
        );

    }

    /* MEMORY UPDATE */

    const aiNotes = `
Agents:
${activeAgents.join(", ")}

Intent:
${intentScore}

Pipeline:
${leadStatus}

Recent Message:
${message}
`;

    if (leadId) {

      await supabaseServer
        .from("lead_memory")
        .upsert({

          lead_id:
            leadId,

          organization_id:
            organizationId,

          summary:
            aiNotes,

          intent_score:
            intentScore,

          last_message:
            message,

          updated_at:
            new Date().toISOString(),

        });

      await supabaseServer
        .from("leads")
        .update({

          status:
            leadStatus,

          intent_score:
            intentScore,

          ai_notes:
            aiNotes,

        })
        .eq(
          "id",
          leadId
        );

    }

    return NextResponse.json({

      reply:
        aiReply,

      activeAgents,

      intentScore,

      leadStatus,

    });

  } catch (error: any) {

    console.error(
      "CHAT API ERROR:",
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