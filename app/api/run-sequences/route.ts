import { NextResponse } from "next/server";

import { Resend } from "resend";

import { requireApiUser } from "@/lib/auth/api";
import { jsonError, methodNotAllowed } from "@/lib/api/errors";
import { getOpenAIClient } from "@/lib/ai/openai";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

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

    // GET PENDING SEQUENCES

    const { data: sequences } =
      await supabase
        .from("lead_sequences")
        .select(`
          *,
          leads (*)
        `)
        .eq("status", "pending");

    if (!sequences?.length) {

      return NextResponse.json({
        success: true,
        message: "No pending sequences",
      });

    }

    const results = [];

    for (const seq of sequences) {

      const lead = seq.leads;

      // AI GENERATES FOLLOW-UP

      const completion =
        await openai.chat.completions.create({

          model: "gpt-4o-mini",

          messages: [

            {
              role: "system",
              content: `
You are an elite AI SDR follow-up system.

You write short high-converting follow-up emails.

Human.
Natural.
Persuasive.
`,
            },

            {
              role: "user",
              content: `
Write follow-up email #${seq.step}

Lead:
${lead.name}

Company:
${lead.company}

Goal:
Book a call for AVERON AI automation services.
`,
            },

          ],

        });

      const aiEmail =
        completion.choices[0]
          .message.content;

      // SEND EMAIL

      const response =
        await resend.emails.send({

          from:
            "AVERON <onboarding@resend.dev>",

          to:
            lead.email,

          subject:
            `Following up — ${lead.company}`,

          html: `
            <div style="background:black;padding:40px;color:white;font-family:sans-serif;">
              <h1>AVERON</h1>

              <div style="margin-top:30px;line-height:1.8;">
                ${aiEmail}
              </div>
            </div>
          `,
        });

      // COMPLETE SEQUENCE

      await supabase
        .from("lead_sequences")
        .update({

          status: "completed",

          completed_at:
            new Date(),

        })
        .eq("id", seq.id);

      results.push({

        lead: lead.name,

        success: true,

        response,

      });

    }

    return NextResponse.json({

      success: true,

      processed:
        results.length,

      results,

    });

  } catch (error: unknown) {

    return jsonError(error);

  }

}
