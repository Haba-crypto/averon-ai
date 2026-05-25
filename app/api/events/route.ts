export const dynamic =
  "force-dynamic";

import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {

  try {

    const { data, error } =
      await supabaseServer
        .from("tasks")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(20);

    if (error) {

      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 500,
        }
      );

    }

    const events =
      (data || []).map(
        (task) => ({

          id: task.id,

          agent_name:
            task.assigned_agent,

          event:
            task.task,

          created_at:
            task.created_at,

        })
      );

    return NextResponse.json({

      events,

    });

  } catch (error: any) {

    console.error(
      "EVENTS API ERROR:",
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