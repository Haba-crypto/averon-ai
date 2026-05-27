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

    const { supabase, response: authResponse } =
      await requireApiUser();

    if (authResponse) {
      return authResponse;
    }

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

  } catch (error: unknown) {

    return jsonError(error);

  }

}
