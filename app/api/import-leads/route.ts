import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {

  try {

    // DEMO IMPORT DATA

    const leads = [

      {
        name: "Alex Morgan",
        company: "ScaleForge",
        email: "alex@scaleforge.ai",
        industry: "SaaS",
      },

      {
        name: "David Kim",
        company: "NeuroFlow",
        email: "david@neuroflow.io",
        industry: "AI",
      },

      {
        name: "Emma Stone",
        company: "GrowthStack",
        email: "emma@growthstack.com",
        industry: "Marketing",
      },

    ];

    const imported = [];

    for (const lead of leads) {

      // INSERT LEAD

      const { data } =
        await supabase
          .from("leads")
          .insert({

            name:
              lead.name,

            company:
              lead.company,

            email:
              lead.email,

            industry:
              lead.industry,

            status:
              "new",

            intent_score:
              Math.floor(
                Math.random() * 100
              ),

          })
          .select()
          .single();

      // CREATE SEQUENCE

      await supabase
        .from("lead_sequences")
        .insert({

          lead_id:
            data.id,

          step: 1,

          status:
            "pending",

          scheduled_for:
            new Date(),

        });

      imported.push({

        lead:
          lead.name,

        company:
          lead.company,

      });

    }

    return NextResponse.json({

      success: true,

      imported,

    });

  } catch (error: any) {

    return NextResponse.json({

      success: false,

      error:
        error.message,

    });

  }

}