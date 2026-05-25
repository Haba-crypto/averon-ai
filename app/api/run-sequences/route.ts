import { NextResponse } from "next/server";

import OpenAI from "openai";

import { Resend } from "resend";

import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const resend = new Resend(
  process.env.RESEND_API_KEY
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {

  try {

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

  } catch (error: any) {

    return NextResponse.json({

      success: false,

      error:
        error.message,

    });

  }

}