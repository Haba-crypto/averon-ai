"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getAgentById } from "@/lib/agents/agent-registry";

export default function AgentPage() {
  const params = useParams<{ id: string }>();
  const agentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const agent = getAgentById(agentId);
  const terminalLogs = useMemo(
    () => agent?.terminalLogs ?? [],
    [agent?.terminalLogs]
  );
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!agent || terminalLogs.length === 0) {
      return;
    }

    let index = 0;

    const interval = window.setInterval(() => {
      setLogs((previous) => [
        ...previous,
        terminalLogs[index],
      ]);

      index++;

      if (index >= terminalLogs.length) {
        index = 0;
        setLogs([]);
      }
    }, 1200);

    return () => {
      window.clearInterval(interval);
    };
  }, [agent, terminalLogs]);

  if (!agent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-10 text-white">
        <div className="max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-10">
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Agent Not Found
          </div>
          <h1 className="mt-4 text-5xl font-bold">
            Unknown AI agent
          </h1>
          <p className="mt-4 text-lg leading-8 text-zinc-500">
            This agent route does not match an active AVERON agent.
          </p>
          <Link
            href="/dashboard/agents"
            className="mt-8 inline-flex rounded-2xl bg-white px-6 py-3 font-semibold text-black"
          >
            Back to AI Agents
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-black p-10 text-white">
      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-7xl font-bold">
            {agent.name}
          </h1>

          <p className="mt-4 text-2xl text-zinc-500">
            {agent.description}
          </p>
        </div>

        <div className="rounded-2xl border border-green-500/20 bg-green-500/20 px-6 py-3 text-xl text-green-400">
          <span className="mr-2">●</span>
          {agent.status}
        </div>
      </div>

      {/* STATS */}
      <div className="mt-12 grid grid-cols-3 gap-6">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="text-zinc-500">
            Active Tasks
          </p>

          <h2 className="mt-4 text-6xl font-bold">
            {agent.detailMetrics.activeTasks}
          </h2>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="text-zinc-500">
            Conversion
          </p>

          <h2 className="mt-4 text-6xl font-bold text-green-400">
            {agent.detailMetrics.conversion}
          </h2>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="text-zinc-500">
            AI State
          </p>

          <h2 className="mt-5 text-4xl font-bold">
            {agent.detailMetrics.aiState}
          </h2>
        </div>
      </div>

      {/* LIVE TERMINAL */}
      <div className="mt-12 overflow-hidden rounded-3xl border border-zinc-800 bg-black shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <div className="h-3 w-3 rounded-full bg-green-500" />
          </div>

          <div className="font-mono text-sm text-zinc-500">
            LIVE AI TERMINAL
          </div>
        </div>

        <div className="min-h-[520px] space-y-4 bg-gradient-to-b from-black to-zinc-950 p-6 font-mono text-sm">
          {logs.map((log, index) => (
            <div
              key={`${log}-${index}`}
              className={`animate-pulse ${
                log.includes("HIGH") ||
                log.includes("85%") ||
                log.includes("Qualified")
                  ? "text-yellow-400"
                  : log.includes("completed") ||
                    log.includes("successfully")
                  ? "text-green-400"
                  : log.includes("workflow") ||
                    log.includes("synchronization")
                  ? "text-blue-400"
                  : "text-zinc-400"
              }`}
            >
              {">"} {log}
            </div>
          ))}

          <div className="animate-pulse text-green-400">
            █
          </div>
        </div>
      </div>

      {/* LIVE EXECUTION */}
      <div className="mt-12 grid grid-cols-2 gap-6">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <h2 className="text-3xl font-bold">
            Current Objective
          </h2>

          <p className="mt-6 text-xl leading-relaxed text-zinc-400">
            {agent.objective}
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <h2 className="text-3xl font-bold">
            AI Recommendations
          </h2>

          <div className="mt-6 space-y-4">
            {agent.recommendations.map((recommendation) => (
              <div
                key={recommendation}
                className="rounded-2xl border border-zinc-800 bg-black p-5"
              >
                {recommendation}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LIVE AI STATUS */}
      <div className="mt-12 grid grid-cols-4 gap-6">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-zinc-500">
            AI Decisions
          </p>

          <h2 className="mt-4 text-5xl font-bold">
            {agent.detailMetrics.decisions}
          </h2>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-zinc-500">
            Leads Processed
          </p>

          <h2 className="mt-4 text-5xl font-bold">
            {agent.detailMetrics.leadsProcessed}
          </h2>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-zinc-500">
            AI Accuracy
          </p>

          <h2 className="mt-4 text-5xl font-bold text-green-400">
            {agent.detailMetrics.accuracy}
          </h2>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-zinc-500">
            Active Workflows
          </p>

          <h2 className="mt-4 text-5xl font-bold">
            {agent.detailMetrics.activeWorkflows}
          </h2>
        </div>
      </div>
    </div>
  );
}
