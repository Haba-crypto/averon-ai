"use client";

import {
  useEffect,
  useState,
} from "react";

export default function LeadsPage() {

  const [liveEvents, setLiveEvents] =
    useState([
      "Research Agent enriching lead intelligence",
      "Pipeline AI recalculating close probability",
      "Closer Agent detected urgency spike",
      "Memory Layer synchronized context",
    ]);

  useEffect(() => {

    const interval =
      setInterval(() => {

        const events = [

          "Research Agent updated company signals",

          "Closer Agent generated follow-up strategy",

          "Pipeline AI recalculated revenue forecast",

          "Memory Layer synchronized orchestration state",

          "AI monitoring behavioral intent",

          "Autonomous workflow executed",

        ];

        const random =
          events[
            Math.floor(
              Math.random() *
              events.length
            )
          ];

        setLiveEvents((prev) => [

          random,

          ...prev.slice(0, 4),

        ]);

      }, 2500);

    return () =>
      clearInterval(
        interval
      );

  }, []);

  return (

    <div className="min-h-screen overflow-y-auto bg-[#050505] text-white">

      {/* SIDEBAR */}

      <div className="fixed left-0 top-0 z-50 flex h-screen w-[92px] flex-col items-center border-r border-white/10 bg-black/40 backdrop-blur-2xl py-6">

        <div className="mb-10 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] text-2xl font-bold">

          A

        </div>

        <div className="flex flex-col gap-5">

          {[
            "⌘",
            "◎",
            "✦",
            "◈",
            "▣",
          ].map(
            (icon) => (

              <button
                key={icon}
                className="group flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-xl text-zinc-400 transition duration-300 hover:border-[#00ffcc]/30 hover:bg-[#00ffcc]/[0.05] hover:text-[#00ffcc]"
              >

                {icon}

              </button>

            )
          )}

        </div>

      </div>

      {/* MAIN */}

      <div className="ml-[92px] px-10 py-10 pb-32">

        {/* HEADER */}

        <div className="mb-12 flex items-start justify-between">

          <div>

            <div className="mb-4 text-xs uppercase tracking-[0.4em] text-zinc-500">

              AVERON AI CRM

            </div>

            <h1 className="text-7xl font-semibold tracking-[-0.08em]">

              Leads

            </h1>

            <div className="mt-5 max-w-2xl text-lg leading-8 text-zinc-500">

              Autonomous AI-native revenue intelligence workspace powered by orchestration agents.

            </div>

          </div>

          <button className="rounded-2xl bg-white px-8 py-4 text-sm font-semibold text-black transition hover:scale-[1.02]">

            Create Lead

          </button>

        </div>

        {/* HERO */}

        <div className="relative mb-10 overflow-hidden rounded-[42px] border border-[#00ffcc]/10 bg-gradient-to-br from-[#0a0a0a] to-black p-10">

          <div className="absolute left-[10%] top-[10%] h-[240px] w-[240px] rounded-full bg-cyan-500/10 blur-[120px]" />

          <div className="absolute bottom-[0%] right-[5%] h-[260px] w-[260px] rounded-full bg-[#00ffcc]/10 blur-[120px]" />

          <div className="relative z-10 flex items-start justify-between gap-10">

            {/* LEFT */}

            <div>

              <div className="mb-5 flex items-center gap-3">

                <div className="h-3 w-3 rounded-full bg-[#00ffcc]" />

                <div className="text-xs uppercase tracking-[0.35em] text-[#00ffcc]">

                  Autonomous Revenue OS

                </div>

              </div>

              <h2 className="max-w-3xl text-7xl font-semibold leading-[0.95] tracking-[-0.09em]">

                AVERON Command Center

              </h2>

              <div className="mt-7 max-w-2xl text-lg leading-8 text-zinc-400">

                Real-time orchestration layer managing AI-driven pipeline intelligence, reasoning, and autonomous execution.

              </div>

              <div className="mt-10 flex gap-14">

                <div>

                  <div className="text-xs uppercase tracking-[0.25em] text-zinc-500">

                    Agents Active

                  </div>

                  <div className="mt-2 text-5xl font-bold text-[#00ffcc]">

                    5

                  </div>

                </div>

                <div>

                  <div className="text-xs uppercase tracking-[0.25em] text-zinc-500">

                    AI Tasks

                  </div>

                  <div className="mt-2 text-5xl font-bold">

                    24

                  </div>

                </div>

                <div>

                  <div className="text-xs uppercase tracking-[0.25em] text-zinc-500">

                    Visibility

                  </div>

                  <div className="mt-2 text-5xl font-bold">

                    98%

                  </div>

                </div>

              </div>

            </div>

            {/* LIVE FEED */}

            <div className="w-[360px] rounded-[36px] border border-white/10 bg-white/[0.02] p-7 backdrop-blur-xl">

              <div className="mb-6 flex items-center justify-between">

                <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">

                  Live AI Activity

                </div>

                <div className="rounded-full border border-[#00ffcc]/20 bg-[#00ffcc]/10 px-3 py-1 text-xs text-[#00ffcc]">

                  LIVE

                </div>

              </div>

              <div className="space-y-4">

                {liveEvents.map(
                  (
                    event,
                    index
                  ) => (

                    <div
                      key={index}
                      className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-[#00ffcc]/20"
                    >

                      <div className="flex items-start gap-4">

                        <div className="mt-2 h-2 w-2 rounded-full bg-[#00ffcc]" />

                        <div className="text-sm leading-7 text-zinc-300">

                          {event}

                        </div>

                      </div>

                    </div>

                  )
                )}

              </div>

            </div>

          </div>

        </div>

        {/* LIVE AGENT NETWORK */}

        <div className="relative overflow-hidden rounded-[42px] border border-white/10 bg-[#070707] p-10">

          {/* GLOW */}

          <div className="absolute left-[25%] top-[25%] h-[260px] w-[260px] rounded-full bg-cyan-500/10 blur-[120px]" />

          <div className="absolute right-[15%] top-[20%] h-[220px] w-[220px] rounded-full bg-[#00ffcc]/10 blur-[120px]" />

          {/* HEADER */}

          <div className="relative z-10 mb-10 flex items-start justify-between">

            <div>

              <div className="text-xs uppercase tracking-[0.35em] text-[#00ffcc]">

                Multi-Agent Orchestration

              </div>

              <h2 className="mt-4 text-6xl font-semibold tracking-[-0.06em]">

                Live Agent Network

              </h2>

              <div className="mt-4 text-lg text-zinc-500">

                Real-time visualization of AI agents, reasoning, and orchestration.

              </div>

            </div>

            <div className="text-right">

              <div className="rounded-full border border-[#00ffcc]/20 bg-[#00ffcc]/10 px-5 py-2 text-sm text-[#00ffcc]">

                ● SYNCHRONIZED

              </div>

              <div className="mt-5 text-sm text-zinc-500">

                System Health 98%
              </div>

            </div>

          </div>

          {/* MAIN GRID */}

          <div className="relative z-10 grid grid-cols-[280px_1fr_280px] gap-10">

            {/* LEFT PANEL */}

            <div className="rounded-[32px] border border-white/10 bg-white/[0.02] p-7 backdrop-blur-xl">

              <div className="mb-6 text-sm uppercase tracking-[0.3em] text-[#00ffcc]">

                Agent Status

              </div>

              <div className="space-y-7">

                {[
                  ["Research Agent", "Analyzing market & leads", "bg-cyan-400"],

                  ["Closer Agent", "Monitoring deal signals", "bg-[#00ffcc]"],

                  ["SDR Agent", "Engaging inbound leads", "bg-yellow-400"],

                  ["Pipeline AI", "Predicting outcomes", "bg-red-400"],

                  ["Memory Layer", "Syncing context", "bg-emerald-400"],

                ].map(
                  (
                    item,
                    index
                  ) => (

                    <button
                      key={index}
                      className="w-full text-left transition hover:translate-x-1"
                    >

                      <div className="flex items-start gap-4">

                        <div className={`mt-2 h-3 w-3 rounded-full ${item[2]}`} />

                        <div>

                          <div className="text-lg font-medium">

                            {item[0]}

                          </div>

                          <div className="mt-1 text-sm text-zinc-500">

                            {item[1]}

                          </div>

                          <div className="mt-3 text-xs uppercase tracking-[0.25em] text-[#00ffcc]">

                            ACTIVE

                          </div>

                        </div>

                      </div>

                    </button>

                  )
                )}

              </div>

            </div>

            {/* CENTER */}

            <div className="relative flex min-h-[700px] items-center justify-center">

              {/* CONNECTIONS */}

              <div className="absolute left-[24%] top-[26%] h-[2px] w-[180px] bg-gradient-to-r from-cyan-400 to-transparent" />

              <div className="absolute right-[24%] top-[26%] h-[2px] w-[180px] bg-gradient-to-l from-[#00ffcc] to-transparent" />

              <div className="absolute bottom-[28%] left-[28%] h-[2px] w-[150px] bg-gradient-to-r from-yellow-400 to-transparent" />

              <div className="absolute bottom-[28%] right-[28%] h-[2px] w-[150px] bg-gradient-to-l from-red-400 to-transparent" />

              {/* CORE */}

              <button className="absolute z-20 transition hover:scale-[1.02]">

                <div className="relative flex h-[240px] w-[240px] flex-col items-center justify-center rounded-full border border-[#00ffcc]/20 bg-[#00ffcc]/[0.04] backdrop-blur-xl">

                  <div className="absolute inset-0 rounded-full bg-[#00ffcc]/10 blur-[40px]" />

                  <div className="relative z-10 text-6xl">

                    ◎

                  </div>

                  <div className="relative z-10 mt-5 text-4xl font-semibold">

                    Memory Layer

                  </div>

                  <div className="relative z-10 mt-3 text-sm uppercase tracking-[0.3em] text-zinc-500">

                    Core Orchestration

                  </div>

                  <div className="relative z-10 mt-6 rounded-full border border-[#00ffcc]/20 bg-[#00ffcc]/10 px-4 py-2 text-sm text-[#00ffcc]">

                    REAL-TIME

                  </div>

                </div>

              </button>

              {/* TOP LEFT */}

              <button className="absolute left-[2%] top-[10%] transition hover:scale-[1.03]">

                <div className="rounded-[30px] border border-cyan-400/20 bg-cyan-400/[0.04] p-7">

                  <div className="text-2xl font-semibold">

                    Research Agent

                  </div>

                  <div className="mt-3 text-sm leading-7 text-zinc-500">

                    Market intelligence & lead research

                  </div>

                  <div className="mt-5 inline-flex rounded-full border border-cyan-400/20 px-4 py-2 text-sm text-cyan-400">

                    ACTIVE

                  </div>

                </div>

              </button>

              {/* TOP RIGHT */}

              <button className="absolute right-[2%] top-[10%] transition hover:scale-[1.03]">

                <div className="rounded-[30px] border border-[#00ffcc]/20 bg-[#00ffcc]/[0.04] p-7">

                  <div className="text-2xl font-semibold">

                    Closer Agent

                  </div>

                  <div className="mt-3 text-sm leading-7 text-zinc-500">

                    Deal intelligence & close probability

                  </div>

                  <div className="mt-5 inline-flex rounded-full border border-[#00ffcc]/20 px-4 py-2 text-sm text-[#00ffcc]">

                    ACTIVE

                  </div>

                </div>

              </button>

              {/* BOTTOM LEFT */}

              <button className="absolute bottom-[12%] left-[8%] transition hover:scale-[1.03]">

                <div className="rounded-[30px] border border-yellow-400/20 bg-yellow-400/[0.04] p-7">

                  <div className="text-2xl font-semibold">

                    SDR Agent

                  </div>

                  <div className="mt-3 text-sm leading-7 text-zinc-500">

                    Lead engagement & qualification

                  </div>

                  <div className="mt-5 inline-flex rounded-full border border-yellow-400/20 px-4 py-2 text-sm text-yellow-400">

                    ACTIVE

                  </div>

                </div>

              </button>

              {/* BOTTOM RIGHT */}

              <button className="absolute bottom-[12%] right-[8%] transition hover:scale-[1.03]">

                <div className="rounded-[30px] border border-red-400/20 bg-red-400/[0.04] p-7">

                  <div className="text-2xl font-semibold">

                    Pipeline AI

                  </div>

                  <div className="mt-3 text-sm leading-7 text-zinc-500">

                    Pipeline prediction & risk analysis

                  </div>

                  <div className="mt-5 inline-flex rounded-full border border-red-400/20 px-4 py-2 text-sm text-red-400">

                    ACTIVE

                  </div>

                </div>

              </button>

            </div>

            {/* RIGHT PANEL */}

            <div className="rounded-[32px] border border-white/10 bg-white/[0.02] p-7 backdrop-blur-xl">

              <div className="mb-6 text-sm uppercase tracking-[0.3em] text-[#00ffcc]">

                Data Flow

              </div>

              <div className="space-y-8">

                {[
                  ["Inbound Data", "Web, Email, CRM, 3rd Party"],

                  ["AI Processing", "Enrichment & Analysis"],

                  ["Agent Orchestration", "Multi-Agent Collaboration"],

                  ["Action Execution", "Outreach, Updates, Tasks"],

                  ["Learning Loop", "Feedback & Optimization"],

                ].map(
                  (
                    item,
                    index
                  ) => (

                    <div key={index}>

                      <div className="flex items-start gap-5">

                        <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#00ffcc]/10 bg-[#00ffcc]/[0.04] text-[#00ffcc]">

                          ✦

                        </div>

                        <div>

                          <div className="text-lg font-medium">

                            {item[0]}

                          </div>

                          <div className="mt-1 text-sm text-zinc-500">

                            {item[1]}

                          </div>

                        </div>

                      </div>

                      {index !== 4 && (

                        <div className="ml-5 mt-5 h-8 w-[1px] bg-gradient-to-b from-[#00ffcc] to-transparent" />

                      )}

                    </div>

                  )
                )}

              </div>

            </div>

          </div>

          {/* METRICS */}

          <div className="relative z-10 mt-10 grid grid-cols-5 gap-6">

            {[
              ["Agents Active", "5 / 5"],

              ["Tasks Running", "24"],

              ["Data Processed", "12.4K"],

              ["Success Rate", "98.7%"],

              ["Avg Response", "1.2s"],

            ].map(
              (
                item,
                index
              ) => (

                <button
                  key={index}
                  className="rounded-[28px] border border-white/10 bg-white/[0.02] p-6 text-left transition hover:border-[#00ffcc]/20 hover:bg-[#00ffcc]/[0.03]"
                >

                  <div className="text-sm text-zinc-500">

                    {item[0]}

                  </div>

                  <div className="mt-4 text-5xl font-semibold tracking-[-0.05em]">

                    {item[1]}

                  </div>

                </button>

              )
            )}

          </div>

        </div>

      </div>

    </div>

  );

}