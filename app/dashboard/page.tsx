"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";

export default function DashboardPage() {

  const [events, setEvents] =
    useState<any[]>([]);

  async function loadEvents() {

    try {

      const res = await fetch(
        "/api/events"
      );

      const data =
        await res.json();

      setEvents(
        data.events || []
      );

    } catch (error) {

      console.error(error);

    }

  }

  useEffect(() => {

    loadEvents();

    const channel =
      supabase

        .channel(
          "realtime-ai-feed"
        )

        .on(
          "postgres_changes",
          {
            event: "INSERT",

            schema: "public",

            table: "tasks",
          },

          async () => {

            await loadEvents();

          }
        )

        .subscribe();

    return () => {

      supabase.removeChannel(
        channel
      );

    };

  }, []);

  return (

    <div className="min-h-screen bg-black p-10 text-white">

      <div className="mb-10">

        <h1 className="text-6xl font-bold">

          AVERON OS

        </h1>

        <p className="mt-4 text-xl text-zinc-500">

          Realtime autonomous
          AI orchestration

        </p>

      </div>

      {/* METRICS */}

      <div className="grid grid-cols-3 gap-6">

        <div className="rounded-3xl border border-zinc-900 bg-zinc-950 p-8">

          <div className="text-zinc-500">

            Active Leads

          </div>

          <div className="mt-4 text-5xl font-bold">

            124

          </div>

        </div>

        <div className="rounded-3xl border border-zinc-900 bg-zinc-950 p-8">

          <div className="text-zinc-500">

            AI Tasks Running

          </div>

          <div className="mt-4 text-5xl font-bold">

            {events.length}

          </div>

        </div>

        <div className="rounded-3xl border border-zinc-900 bg-zinc-950 p-8">

          <div className="text-zinc-500">

            Pipeline Value

          </div>

          <div className="mt-4 text-5xl font-bold">

            $2.4M

          </div>

        </div>

      </div>

      {/* LIVE AI FEED */}

      <div className="mt-10 rounded-3xl border border-zinc-900 bg-zinc-950 p-8">

        <div className="mb-8 flex items-center justify-between">

          <div>

            <h2 className="text-3xl font-bold">

              Live AI Activity

            </h2>

            <p className="mt-2 text-zinc-500">

              Multi-agent realtime
              orchestration

            </p>

          </div>

          <div className="flex items-center gap-3">

            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />

            <span className="text-zinc-400">

              LIVE

            </span>

          </div>

        </div>

        <div className="space-y-4">

          {events.map((event) => (

            <div
              key={event.id}
              className="flex items-start justify-between rounded-2xl border border-zinc-800 bg-black p-5 transition hover:border-white"
            >

              <div>

                <div className="text-lg font-semibold">

                  {event.agent_name}

                </div>

                <div className="mt-2 text-zinc-400">

                  {event.event}

                </div>

              </div>

              <div className="text-sm text-zinc-600">

                {new Date(
                  event.created_at
                ).toLocaleTimeString()}

              </div>

            </div>

          ))}

        </div>

      </div>

    </div>

  );

}