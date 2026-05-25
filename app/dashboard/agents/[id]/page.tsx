"use client";

import { useEffect, useState } from "react";

export default function AgentPage() {
  const [logs, setLogs] = useState<
    string[]
  >([]);

  const terminalLogs = [
    "[AVERON] Agent initialized...",
    "Analyzing lead behavior patterns...",
    "Extracting buying intent signals...",
    "Intent score increased → 85%",
    "Generating follow-up sequence...",
    "Updating CRM memory...",
    "Synchronizing sales pipeline...",
    "AI reasoning completed",
    "Demo recommendation: HIGH PRIORITY",
    "Outbound workflow triggered",
    "Researching enterprise account...",
    "Lead enrichment completed",
    "Follow-up email generated",
    "Calendar synchronization active",
    "Monitoring CRM activity...",
    "New buying signal detected",
    "Pipeline updated successfully",
    "Lead status changed → Qualified",
    "AI confidence score increased",
    "Waiting for next task...",
  ];

  useEffect(() => {
    let index = 0;

    const interval =
      setInterval(() => {
        setLogs((prev) => [
          ...prev,
          terminalLogs[index],
        ]);

        index++;

        if (
          index >= terminalLogs.length
        ) {
          index = 0;

          setLogs([]);
        }
      }, 1200);

    return () =>
      clearInterval(interval);
  }, []);

  return (
    <div className="p-10 bg-black min-h-screen text-white overflow-hidden">
      {/* HEADER */}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-7xl font-bold">
            SDR Agent
          </h1>

          <p className="text-zinc-500 text-2xl mt-4">
            Autonomous lead
            qualification and sales
            execution
          </p>
        </div>

        <div className="bg-green-500/20 text-green-400 px-6 py-3 rounded-2xl text-xl border border-green-500/20">
          ● Online
        </div>
      </div>

      {/* STATS */}

      <div className="grid grid-cols-3 gap-6 mt-12">
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8">
          <p className="text-zinc-500">
            Active Tasks
          </p>

          <h2 className="text-6xl font-bold mt-4">
            24
          </h2>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8">
          <p className="text-zinc-500">
            Conversion
          </p>

          <h2 className="text-6xl font-bold mt-4 text-green-400">
            38%
          </h2>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8">
          <p className="text-zinc-500">
            AI State
          </p>

          <h2 className="text-4xl font-bold mt-5">
            Autonomous
          </h2>
        </div>
      </div>

      {/* LIVE TERMINAL */}

      <div className="mt-12 bg-black border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500" />

            <div className="w-3 h-3 rounded-full bg-yellow-500" />

            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>

          <div className="text-zinc-500 text-sm font-mono">
            LIVE AI TERMINAL
          </div>
        </div>

        <div className="p-6 font-mono text-sm space-y-4 min-h-[520px] bg-gradient-to-b from-black to-zinc-950">
          {logs.map((log, index) => (
            <div
              key={index}
              className={`animate-pulse ${
                log.includes("HIGH") ||
                log.includes("85%") ||
                log.includes("Qualified")
                  ? "text-yellow-400"
                  : log.includes(
                        "completed"
                    ) ||
                    log.includes(
                        "successfully"
                    )
                  ? "text-green-400"
                  : log.includes(
                        "workflow"
                    ) ||
                    log.includes(
                        "synchronization"
                    )
                  ? "text-blue-400"
                  : "text-zinc-400"
              }`}
            >
              {">"} {log}
            </div>
          ))}

          <div className="text-green-400 animate-pulse">
            █
          </div>
        </div>
      </div>

      {/* LIVE EXECUTION */}

      <div className="grid grid-cols-2 gap-6 mt-12">
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8">
          <h2 className="text-3xl font-bold">
            Current Objective
          </h2>

          <p className="text-zinc-400 text-xl mt-6 leading-relaxed">
            Increase enterprise lead
            conversion through AI-driven
            qualification, automated
            follow-up orchestration,
            and intelligent CRM memory
            synchronization.
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8">
          <h2 className="text-3xl font-bold">
            AI Recommendations
          </h2>

          <div className="space-y-4 mt-6">
            <div className="bg-black border border-zinc-800 rounded-2xl p-5">
              Contact Tesla within 24h
            </div>

            <div className="bg-black border border-zinc-800 rounded-2xl p-5">
              Schedule enterprise demo
            </div>

            <div className="bg-black border border-zinc-800 rounded-2xl p-5">
              Increase outbound volume
            </div>

            <div className="bg-black border border-zinc-800 rounded-2xl p-5">
              Trigger automated
              follow-up workflow
            </div>
          </div>
        </div>
      </div>

      {/* LIVE AI STATUS */}

      <div className="mt-12 grid grid-cols-4 gap-6">
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
          <p className="text-zinc-500">
            AI Decisions
          </p>

          <h2 className="text-5xl font-bold mt-4">
            184
          </h2>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
          <p className="text-zinc-500">
            Leads Processed
          </p>

          <h2 className="text-5xl font-bold mt-4">
            42
          </h2>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
          <p className="text-zinc-500">
            AI Accuracy
          </p>

          <h2 className="text-5xl font-bold mt-4 text-green-400">
            96%
          </h2>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
          <p className="text-zinc-500">
            Active Workflows
          </p>

          <h2 className="text-5xl font-bold mt-4">
            18
          </h2>
        </div>
      </div>
    </div>
  );
}