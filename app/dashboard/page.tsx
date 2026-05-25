"use client";

import {
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase/client";

const agents = [

  {
    name: "SDR Agent",
    status: "active",
    tasks: 148,
  },

  {
    name: "Closer Agent",
    status: "active",
    tasks: 64,
  },

  {
    name: "Research Agent",
    status: "active",
    tasks: 203,
  },

  {
    name: "Ops Agent",
    status: "active",
    tasks: 91,
  },

];

const activities = [

  "SDR Agent qualified Tesla lead",

  "Closer Agent scheduled enterprise demo",

  "Research Agent enriched 24 leads",

  "Ops Agent optimized pipeline routing",

  "AI generated outbound sequence",

];

export default function DashboardPage() {

  const [stats, setStats] =
    useState<any[]>([]);

  useEffect(() => {

    loadDashboard();

  }, []);

  async function loadDashboard() {

    const { count: leadsCount } =
      await supabase
        .from("leads")
        .select("*", {
          count: "exact",
          head: true,
        });

    const { count: tasksCount } =
      await supabase
        .from("tasks")
        .select("*", {
          count: "exact",
          head: true,
        });

    const {
      count: conversationsCount,
    } =
      await supabase
        .from("conversations")
        .select("*", {
          count: "exact",
          head: true,
        });

    setStats([

      {
        title:
          "Pipeline Value",

        value:
          "$847K",

        growth:
          "+18%",
      },

      {
        title:
          "Active Leads",

        value:
          String(
            leadsCount || 0
          ),

        growth:
          "+12%",
      },

      {
        title:
          "AI Actions Today",

        value:
          String(
            tasksCount || 0
          ),

        growth:
          "+41%",
      },

      {
        title:
          "Conversations",

        value:
          String(
            conversationsCount || 0
          ),

        growth:
          "+9%",
      },

    ]);

  }

  return (

    <div className="min-h-screen bg-black p-10 text-white">

      {/* HEADER */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-7xl font-bold">

            AI Command Center

          </h1>

          <p className="mt-4 text-2xl text-zinc-500">

            Autonomous revenue infrastructure

          </p>

        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 px-8 py-6">

          <div className="text-zinc-500">

            System Status

          </div>

          <div className="mt-3 flex items-center gap-3 text-2xl font-bold text-green-400">

            <div className="h-4 w-4 rounded-full bg-green-400" />

            OPERATIONAL

          </div>

        </div>

      </div>

      {/* STATS */}

      <div className="mt-12 grid grid-cols-4 gap-6">

        {stats.map((stat) => (

          <div
            key={stat.title}
            className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8"
          >

            <div className="text-lg text-zinc-500">

              {stat.title}

            </div>

            <div className="mt-4 text-5xl font-bold">

              {stat.value}

            </div>

            <div className="mt-4 text-lg font-semibold text-green-400">

              {stat.growth}

            </div>

          </div>

        ))}

      </div>

      {/* MAIN GRID */}

      <div className="mt-10 grid grid-cols-[1.2fr_0.8fr] gap-6">

        {/* LEFT */}

        <div className="space-y-6">

          {/* LIVE ACTIVITY */}

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">

            <div className="flex items-center justify-between">

              <h2 className="text-4xl font-bold">

                Live AI Activity

              </h2>

              <div className="flex items-center gap-3 rounded-2xl bg-green-500/20 px-4 py-2 text-sm font-semibold uppercase text-green-400">

                <div className="h-3 w-3 rounded-full bg-green-400" />

                Live

              </div>

            </div>

            <div className="mt-8 space-y-4">

              {activities.map(
                (
                  activity,
                  index
                ) => (

                  <div
                    key={index}
                    className="rounded-2xl border border-zinc-800 bg-black px-6 py-5"
                  >

                    {activity}

                  </div>

                )
              )}

            </div>

          </div>

          {/* REVENUE GRAPH */}

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">

            <div className="flex items-center justify-between">

              <h2 className="text-4xl font-bold">

                Revenue Intelligence

              </h2>

              <div className="text-green-400">

                +28%

              </div>

            </div>

            <div className="mt-10 flex h-[300px] items-end gap-4">

              {[40, 65, 30, 80, 55, 92, 74, 100].map(
                (
                  height,
                  index
                ) => (

                  <div
                    key={index}
                    className="flex-1 rounded-t-3xl bg-white"
                    style={{
                      height: `${height}%`,
                    }}
                  />

                )
              )}

            </div>

          </div>

        </div>

        {/* RIGHT */}

        <div className="space-y-6">

          {/* AGENTS */}

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">

            <h2 className="text-4xl font-bold">

              AI Agents

            </h2>

            <div className="mt-8 space-y-4">

              {agents.map((agent) => (

                <div
                  key={agent.name}
                  className="rounded-2xl border border-zinc-800 bg-black p-5"
                >

                  <div className="flex items-center justify-between">

                    <div>

                      <div className="text-2xl font-bold">

                        {agent.name}

                      </div>

                      <div className="mt-2 text-zinc-500">

                        {agent.tasks} active tasks

                      </div>

                    </div>

                    <div className="flex items-center gap-2 rounded-2xl bg-green-500/20 px-3 py-2 text-sm font-semibold text-green-400">

                      <div className="h-2 w-2 rounded-full bg-green-400" />

                      {agent.status}

                    </div>

                  </div>

                </div>

              ))}

            </div>

          </div>

          {/* SYSTEM METRICS */}

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">

            <h2 className="text-4xl font-bold">

              System Metrics

            </h2>

            <div className="mt-8 space-y-6">

              <div>

                <div className="flex items-center justify-between">

                  <span>
                    AI Throughput
                  </span>

                  <span>
                    94%
                  </span>

                </div>

                <div className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-800">

                  <div
                    className="h-full bg-white"
                    style={{
                      width: "94%",
                    }}
                  />

                </div>

              </div>

              <div>

                <div className="flex items-center justify-between">

                  <span>
                    Workflow Automation
                  </span>

                  <span>
                    87%
                  </span>

                </div>

                <div className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-800">

                  <div
                    className="h-full bg-white"
                    style={{
                      width: "87%",
                    }}
                  />

                </div>

              </div>

              <div>

                <div className="flex items-center justify-between">

                  <span>
                    CRM Intelligence
                  </span>

                  <span>
                    91%
                  </span>

                </div>

                <div className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-800">

                  <div
                    className="h-full bg-white"
                    style={{
                      width: "91%",
                    }}
                  />

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>

  );

}