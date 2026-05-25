import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import OpenAI from "openai";

import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const resend = new Resend(
  process.env.RESEND_API_KEY
);

export async function GET() {

  try {

    // LOAD LEADS FROM SUPABASE

    const { data: leads, error } =
      await supabase
        .from("leads")
        .select("*");

    if (error) {
      throw error;
    }

    const results = [];

    // LOOP THROUGH LEADS

    for (const lead of leads || []) {

      // GPT GENERATES EMAIL

      const completion =
        await openai.chat.completions.create({

          model: "gpt-4o-mini",

          messages: [

            {
              role: "system",
              content: `
You are an elite AI SDR agent for AVERON.

You write short high-converting cold emails.
              `,
            },

            {
              role: "user",
              content: `
Write a personalized cold email.

Lead Name:
${lead.name}

Company:
${lead.company || "Unknown"}

Industry:
${lead.industry || "Technology"}

Goal:
Book a call for AI automation services.
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

          to: lead.email,

          subject:
            `Idea for ${lead.company || "your company"}`,

          html: `
            <div style="background:black;padding:40px;color:white;font-family:sans-serif;">
              <h1>AVERON AI SDR</h1>

              <div style="margin-top:20px;line-height:1.8;">
                ${aiEmail}
              </div>
            </div>
          `,
        });

      // UPDATE LEAD STATUS

      await supabase
        .from("leads")
        .update({
          status: "contacted",
        })
        .eq("id", lead.id);

      results.push({

        lead: lead.name,

        email: lead.email,

        success: true,

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