"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  CheckCircle2,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Target,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

type ShellSummary = {
  leadsCount?: number;
  tasksCount?: number;
  conversationsCount?: number;
};

type ExecutionEvent = {
  id: string;
  agent_name?: string | null;
  event?: string | null;
  created_at?: string | null;
};

const navigation = [
  {
    label: "Mission Control",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Leads",
    href: "/dashboard/leads",
    icon: Users,
  },
  {
    label: "Conversations",
    href: "/dashboard/conversations",
    icon: MessageSquare,
  },
  {
    label: "Tasks",
    href: "/dashboard/tasks",
    icon: CheckCircle2,
  },
  {
    label: "AI Agents",
    href: "/dashboard/agents",
    icon: Bot,
  },
];

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showExecutionRail = pathname === "/dashboard";
  const isDeepWorkspace = pathname.startsWith("/dashboard/leads/");
  const [summary, setSummary] = useState<ShellSummary>({});
  const [events, setEvents] = useState<ExecutionEvent[]>([]);

  useEffect(() => {
    if (!showExecutionRail) {
      return;
    }

    async function loadShellState() {
      try {
        const [summaryResponse, eventsResponse] = await Promise.all([
          fetch("/api/dashboard/summary"),
          fetch("/api/events"),
        ]);

        const summaryData = await summaryResponse.json();
        const eventsData = await eventsResponse.json();

        setSummary(summaryData.summary ?? {});
        setEvents(eventsData.events ?? []);
      } catch (error) {
        console.error(error);
      }
    }

    void loadShellState();
  }, [showExecutionRail]);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-zinc-900 bg-[#080808] py-6 lg:flex lg:flex-col ${
          isDeepWorkspace ? "w-20 px-3" : "w-72 px-5"
        }`}
      >
        <Link
          href="/dashboard"
          className={`block ${isDeepWorkspace ? "px-0 text-center" : "px-3"}`}
        >
          <div className="text-2xl font-semibold tracking-tight">
            {isDeepWorkspace ? "A" : "AVERON"}
          </div>
          <div
            className={`mt-2 text-xs font-medium uppercase tracking-[0.22em] text-zinc-500 ${
              isDeepWorkspace ? "hidden" : ""
            }`}
          >
            Revenue Execution
          </div>
        </Link>

        <nav className="mt-10 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isDeepWorkspace ? item.label : undefined}
                className={`nav-surface flex h-12 items-center rounded-xl text-sm font-medium ${
                  isActive
                    ? "border border-zinc-600 bg-white text-black shadow-[0_14px_40px_rgba(255,255,255,0.08)]"
                    : "border border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-white"
                } ${isDeepWorkspace ? "justify-center px-0" : "gap-3 px-3"}`}
              >
                <Icon className="h-4 w-4" />
                <span className={isDeepWorkspace ? "hidden" : ""}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div
          className={`operational-surface premium-card mt-auto rounded-2xl border border-zinc-800 bg-black ${
            isDeepWorkspace ? "p-3" : "p-4"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-green-400">
            <span className="live-dot live-beacon h-2 w-2 rounded-full bg-green-400" />
            <span className={isDeepWorkspace ? "hidden" : ""}>
              System Operational
            </span>
          </div>
          <p
            className={`mt-3 text-sm leading-6 text-zinc-500 ${
              isDeepWorkspace ? "hidden" : ""
            }`}
          >
            AI execution layer is active across revenue workflows.
          </p>
        </div>
      </aside>

      {showExecutionRail && (
        <aside className="fixed inset-y-0 right-0 z-20 hidden w-80 border-l border-zinc-900 bg-[#080808] px-5 py-6 xl:flex xl:flex-col">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">
                Execution Rail
              </div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
                Live System State
              </div>
            </div>
            <Radio className="h-4 w-4 text-green-400" />
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <Metric label="Leads" value={summary.leadsCount ?? 0} />
            <Metric label="Tasks" value={summary.tasksCount ?? 0} />
            <Metric label="Talks" value={summary.conversationsCount ?? 0} />
          </div>

          <div className="mt-8">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-zinc-400" />
              Current AI Work
            </div>

            <div className="mt-4 space-y-3">
              {events.length > 0 ? (
                events.slice(0, 7).map((event) => (
                  <div
                    key={event.id}
                  className="operational-surface premium-card execution-pulse rounded-xl border border-zinc-800 bg-black p-3"
                  >
                    <div className="text-xs font-medium text-zinc-500">
                      {event.agent_name ?? "AI Agent"}
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm leading-5 text-zinc-200">
                      {event.event ?? "Workflow event recorded"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-zinc-900 bg-black p-4 text-sm leading-6 text-zinc-500">
                  No recent execution events yet.
                </div>
              )}
            </div>
          </div>

          <Link
            href="/dashboard/tasks"
          className="operational-surface mt-auto flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black hover:opacity-95"
          >
            <Target className="h-4 w-4" />
            Review Execution Queue
          </Link>
        </aside>
      )}

      <div
        className={`${isDeepWorkspace ? "lg:pl-20" : "lg:pl-72"} ${
          showExecutionRail ? "xl:pr-80" : ""
        }`}
      >
        <div className="border-b border-zinc-900 bg-[#080808] px-5 py-4 lg:hidden">
          <Link href="/dashboard" className="text-xl font-semibold">
            AVERON
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="operational-surface premium-card rounded-xl border border-zinc-800 bg-black p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}
