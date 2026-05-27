"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  MessageSquare,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

type DashboardSummary = {
  leadsCount?: number;
  tasksCount?: number;
  conversationsCount?: number;
};

type WorkflowBlock = {
  title: string;
  description: string;
  href: string;
  value: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  tone?: "attention" | "momentum" | "execution";
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary>({});

  useEffect(() => {
    async function loadDashboard() {
      const response = await fetch("/api/dashboard/summary");
      const data = await response.json();

      setSummary(data.summary ?? {});
    }

    void loadDashboard();
  }, []);

  const attentionBlocks: WorkflowBlock[] = [
    {
      title: "Execution Queue",
      description: "Open tasks that need approval, completion, or routing.",
      href: "/dashboard/tasks",
      value: String(summary.tasksCount ?? 0),
      label: "active tasks",
      icon: CheckCircle2,
      tone: "attention",
    },
    {
      title: "Lead Review",
      description: "Inspect live leads before AI proceeds into next actions.",
      href: "/dashboard/leads",
      value: String(summary.leadsCount ?? 0),
      label: "tracked leads",
      icon: Users,
      tone: "attention",
    },
  ];

  const momentumBlocks: WorkflowBlock[] = [
    {
      title: "Pipeline Movement",
      description: "Monitor where revenue work is progressing right now.",
      href: "/dashboard/leads",
      value: "$847K",
      label: "pipeline value",
      icon: TrendingUp,
      tone: "momentum",
    },
    {
      title: "Conversation Demand",
      description: "Review buyer replies and AI-assisted revenue context.",
      href: "/dashboard/conversations",
      value: String(summary.conversationsCount ?? 0),
      label: "conversations",
      icon: MessageSquare,
      tone: "momentum",
    },
  ];

  const executionBlocks: WorkflowBlock[] = [
    {
      title: "Agent Network",
      description: "View the autonomous roles coordinating revenue execution.",
      href: "/dashboard/agents",
      value: "4",
      label: "active agents",
      icon: Bot,
      tone: "execution",
    },
    {
      title: "Live AI Work",
      description: "Jump into current workflow orchestration and outcomes.",
      href: "/dashboard/tasks",
      value: String(summary.tasksCount ?? 0),
      label: "AI actions",
      icon: CheckCircle2,
      tone: "execution",
    },
  ];

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-8 text-white lg:px-10">
      <header className="flex flex-col gap-6 border-b border-zinc-900 pb-8 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Mission Control
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">
            AI Revenue Execution System
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-500">
            One operating surface for attention, pipeline movement, and live AI
            workflow execution.
          </p>
        </div>

        <div className="operational-surface premium-card rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4">
          <div className="text-sm text-zinc-500">System Status</div>
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold uppercase text-green-400">
            <span className="live-dot live-beacon h-2 w-2 rounded-full bg-green-400" />
            Operational
          </div>
        </div>
      </header>

      <div className="mt-8 space-y-8">
        <DashboardSection
          eyebrow="Requires Attention"
          title="Human decisions that unblock revenue execution"
          blocks={attentionBlocks}
        />

        <DashboardSection
          eyebrow="Revenue Momentum"
          title="Where pipeline work is moving"
          blocks={momentumBlocks}
        />

        <DashboardSection
          eyebrow="Live AI Execution"
          title="Autonomous work currently carrying the system"
          blocks={executionBlocks}
        />
      </div>
    </main>
  );
}

function DashboardSection({
  eyebrow,
  title,
  blocks,
}: {
  eyebrow: string;
  title: string;
  blocks: WorkflowBlock[];
}) {
  return (
    <section>
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {eyebrow}
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {title}
          </h2>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {blocks.map((block) => (
          <WorkflowCard key={block.title} block={block} />
        ))}
      </div>
    </section>
  );
}

function WorkflowCard({
  block,
}: {
  block: WorkflowBlock;
}) {
  const Icon = block.icon;

  return (
    <Link
      href={block.href}
      className="operational-surface premium-card group flex min-h-44 flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-6 hover:bg-[#101010]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-black text-zinc-300 transition duration-300 group-hover:border-[#00ffcc]/30 group-hover:text-white group-hover:shadow-[0_0_30px_rgba(0,255,204,0.08)]">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-5 w-5 text-zinc-600 transition duration-300 group-hover:translate-x-1 group-hover:text-white" />
      </div>

      <div className="mt-8">
        <div className="flex items-baseline gap-3">
          <div className="text-4xl font-semibold tracking-tight">
            {block.value}
          </div>
          <div className="text-sm text-zinc-500">{block.label}</div>
        </div>
        <h3 className="mt-5 text-xl font-semibold">{block.title}</h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
          {block.description}
        </p>
      </div>
    </Link>
  );
}
