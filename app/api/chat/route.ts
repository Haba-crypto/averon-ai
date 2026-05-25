import OpenAI from "openai";

import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

const openai =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY,
  });

const supabase =
  createClient(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL!,
    process.env
      .SUPABASE_SERVICE_ROLE_KEY!
  );

export async function POST(
  req: Request
) {

  try {

    const body =
      await req.json();

    const {
      message,
      leadId,
    } = body;

    /* LOAD LEAD */

    const {
      data: lead,
    } = await supabase
      .from("leads")
      .select("*")
      .eq(
        "id",
        leadId
      )
      .single();

    /* SAVE USER MESSAGE */

    await supabase
      .from("conversations")
      .insert({

        lead_id:
          leadId,

        role:
          "user",

        message,

      });

    const lower =
      message.toLowerCase();

    /* MULTI AGENT */

    let activeAgent =
      "SDR Agent";

    if (
      lower.includes(
        "pricing"
      ) ||
      lower.includes(
        "contract"
      ) ||
      lower.includes(
        "close"
      )
    ) {

      activeAgent =
        "Closer Agent";

    }

    if (
      lower.includes(
        "research"
      ) ||
      lower.includes(
        "company"
      ) ||
      lower.includes(
        "market"
      )
    ) {

      activeAgent =
        "Research Agent";

    }

    if (
      lower.includes(
        "support"
      ) ||
      lower.includes(
        "onboarding"
      ) ||
      lower.includes(
        "retention"
      )
    ) {

      activeAgent =
        "Customer Success Agent";

    }

    /* AI RESPONSE */

    const completion =
      await openai.chat.completions.create({

        model:
          "gpt-4.1-mini",

        messages: [

          {
            role:
              "system",

            content: `

You are AVERON AI.

You are an elite autonomous AI revenue operating system.

Current active agent:
${activeAgent}

Your goals:
- qualify leads
- detect buying intent
- move deals forward
- identify urgency
- identify blockers
- recommend next actions
- act like elite revenue operators

Lead:

Name: ${lead?.name}

Company: ${lead?.company}

Status: ${lead?.status}

Intent score:
${lead?.intent_score}

Urgency:
${lead?.urgency}

Deal risk:
${lead?.deal_risk}

Recommendation:
${lead?.recommendation}

AI notes:
${lead?.ai_notes}

`,
          },

          {
            role:
              "user",

            content:
              message,
          },

        ],

      });

    const reply =
      completion
        .choices?.[0]
        ?.message?.content ||
      "No response";

    /* SAVE AI MESSAGE */

    await supabase
      .from("conversations")
      .insert({

        lead_id:
          leadId,

        role:
          "assistant",

        message:
          reply,

      });

    /* AI EVENT LOGGER */

    async function logEvent(
      type: string,
      message: string
    ) {

      await supabase
        .from("ai_events")
        .insert({

          lead_id:
            leadId,

          type,

          message,

        });

    }

    /* AI INTELLIGENCE */

    let intentScore =
      lead?.intent_score || 0;

    let status =
      lead?.status || "new";

    let aiNotes =
      lead?.ai_notes || "";

    let urgency =
      lead?.urgency || "low";

    let recommendation =
      lead?.recommendation ||
      "Continue qualification.";

    let dealRisk =
      lead?.deal_risk || "low";

    let closeProbability =
      lead?.close_probability || 10;

    const actions = [];

    /* BUYING INTENT */

    if (
      lower.includes(
        "demo"
      ) ||
      lower.includes(
        "pricing"
      ) ||
      lower.includes(
        "integration"
      )
    ) {

      intentScore += 15;

      closeProbability +=
        12;

      urgency =
        "high";

      status =
        "qualified";

      recommendation =
        "Schedule enterprise demo immediately.";

      aiNotes +=
        "\nDetected high buying intent.";

      actions.push({

        type:
          "intent",

        message:
          "Detected high buying intent",

      });

      await logEvent(
        "intent",
        "Detected high buying intent"
      );

      actions.push({

        type:
          "pipeline",

        message:
          "Pipeline moved to qualified",

      });

      await logEvent(
        "pipeline",
        "Pipeline moved to qualified"
      );

      await supabase
        .from("tasks")
        .insert({

          lead_id:
            leadId,

          title:
            "High-intent follow-up",

          description:
            "Lead requested demo/pricing/integration discussion.",

          priority:
            "high",

        });

      actions.push({

        type:
          "task",

        message:
          "Created high-intent follow-up task",

      });

      await logEvent(
        "task",
        "Created high-intent follow-up task"
      );

    }

    /* ENTERPRISE */

    if (
      lower.includes(
        "enterprise"
      ) ||
      lower.includes(
        "team"
      ) ||
      lower.includes(
        "scale"
      )
    ) {

      intentScore += 10;

      closeProbability +=
        8;

      urgency =
        "medium";

      recommendation =
        "Push enterprise expansion conversation.";

      aiNotes +=
        "\nEnterprise expansion potential detected.";

      actions.push({

        type:
          "enterprise",

        message:
          "Enterprise expansion potential detected",

      });

      await logEvent(
        "enterprise",
        "Enterprise expansion potential detected"
      );

    }

    /* RISK */

    if (
      lower.includes(
        "later"
      ) ||
      lower.includes(
        "not now"
      ) ||
      lower.includes(
        "budget"
      )
    ) {

      dealRisk =
        "medium";

      closeProbability -=
        10;

      recommendation =
        "Address timing and budget objections.";

      actions.push({

        type:
          "risk",

        message:
          "Potential deal risk detected",

      });

      await logEvent(
        "risk",
        "Potential deal risk detected"
      );

    }

    /* RESEARCH */

    if (
      activeAgent ===
      "Research Agent"
    ) {

      aiNotes +=
        "\nResearch agent activated.";

      actions.push({

        type:
          "research",

        message:
          "Research agent analyzing company intelligence",

      });

      await logEvent(
        "research",
        "Research agent analyzing company intelligence"
      );

    }

    /* CUSTOMER SUCCESS */

    if (
      activeAgent ===
      "Customer Success Agent"
    ) {

      recommendation =
        "Focus on onboarding and retention strategy.";

      actions.push({

        type:
          "cs",

        message:
          "Customer Success workflow activated",

      });

      await logEvent(
        "cs",
        "Customer Success workflow activated"
      );

    }

    /* NORMALIZE */

    closeProbability =
      Math.max(
        5,
        Math.min(
          closeProbability,
          95
        )
      );

    /* UPDATE LEAD */

    await supabase
      .from("leads")
      .update({

        intent_score:
          intentScore,

        status,

        ai_notes:
          aiNotes,

        urgency,

        recommendation,

        deal_risk:
          dealRisk,

        close_probability:
          closeProbability,

      })
      .eq(
        "id",
        leadId
      );

    /* UPDATED LEAD */

    const {
      data: updatedLead,
    } = await supabase
      .from("leads")
      .select("*")
      .eq(
        "id",
        leadId
      )
      .single();

    /* FINAL EVENTS */

    actions.push({

      type:
        "memory",

      message:
        "AI memory updated",

    });

    await logEvent(
      "memory",
      "AI memory updated"
    );

    actions.push({

      type:
        "agent",

      message:
        `${activeAgent} active`,

    });

    await logEvent(
      "agent",
      `${activeAgent} active`
    );

    actions.push({

      type:
        "urgency",

      message:
        `Urgency level: ${urgency}`,

    });

    await logEvent(
      "urgency",
      `Urgency level: ${urgency}`
    );

    actions.push({

      type:
        "probability",

      message:
        `Close probability: ${closeProbability}%`,

    });

    await logEvent(
      "probability",
      `Close probability: ${closeProbability}%`
    );

    actions.push({

      type:
        "recommendation",

      message:
        recommendation,

    });

    await logEvent(
      "recommendation",
      recommendation
    );

    return NextResponse.json({

      success: true,

      reply,

      activeAgent,

      lead:
        updatedLead,

      actions,

    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      {
        error:
          "AI failed",
      },
      {
        status: 500,
      }
    );

  }

}