"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Target,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ShellSummary = {
  leadsCount?: number;
  tasksCount?: number;
  conversationsCount?: number;
};

type Task = {
  id: string;
  lead_id?: string | null;
  task?: string | null;
  title?: string | null;
  status?: string | null;
  priority?: string | null;
  assigned_agent?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Lead = {
  id: string;
  name?: string | null;
  company?: string | null;
  email?: string | null;
  urgency?: string | null;
  intent_score?: number | null;
};

type AIEvent = {
  id: string;
  lead_id?: string | null;
  type?: string | null;
  message?: string | null;
  created_at?: string | null;
};

type StreamTone = "critical" | "active" | "passive";

type OperationalStreamItem = {
  id: string;
  title: string;
  detail: string;
  interpretation: string;
  time: string;
  group: "Now" | "Today" | "Earlier";
  createdAt: string;
  tone: StreamTone;
  persistence: "high" | "normal" | "low";
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

function getHoursSince(timestamp?: string | null) {
  if (!timestamp) {
    return 999;
  }

  return (
    (Date.now() - new Date(timestamp).getTime()) /
    1000 /
    60 /
    60
  );
}

function getRelativeTime(timestamp?: string | null) {
  if (!timestamp) {
    return "recently";
  }

  const minutes = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(timestamp).getTime()) /
        1000 /
        60
    )
  );

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (minutes < 24 * 60) {
    return `${Math.floor(minutes / 60)}h ago`;
  }

  if (minutes < 72 * 60) {
    return "recently";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function getTimeGroup(timestamp?: string | null) {
  const hours = getHoursSince(timestamp);

  if (hours < 0.2) {
    return "Now";
  }

  if (hours < 24) {
    return "Today";
  }

  return "Earlier";
}

function getLeadName(lead?: Lead) {
  return (
    lead?.company ||
    lead?.name ||
    lead?.email ||
    "Revenue path"
  );
}

function getTaskTitle(task: Task) {
  return task.title || task.task || "Work item";
}

function normalizeAIEvent(
  event: AIEvent,
  lead?: Lead
): OperationalStreamItem {
  const type = event.type?.toLowerCase() || "";
  const leadName = getLeadName(lead);
  const createdAt =
    event.created_at || new Date().toISOString();

  if (type === "task_escalated") {
    return {
      id: `ai:${event.id}`,
      title: "This deal now needs human help",
      detail: `${leadName}: a person must unblock the next step.`,
      interpretation:
        "AVERON can keep the deal organized, but a person is now the blocker.",
      time: getRelativeTime(createdAt),
      group: getTimeGroup(createdAt),
      createdAt,
      tone: "critical",
      persistence: "high",
    };
  }

  if (type === "task_blocked") {
    return {
      id: `ai:${event.id}`,
      title: "Work is stuck",
      detail: `${leadName}: the next step is blocked.`,
      interpretation:
        "This deal will not move until the blocker is cleared.",
      time: getRelativeTime(createdAt),
      group: getTimeGroup(createdAt),
      createdAt,
      tone: "critical",
      persistence: "high",
    };
  }

  if (type === "task_approved") {
    return {
      id: `ai:${event.id}`,
      title: "A person approved the next step",
      detail: `${leadName}: AVERON can move the work forward again.`,
      interpretation:
        "The decision gate is cleared, so execution can resume.",
      time: getRelativeTime(createdAt),
      group: getTimeGroup(createdAt),
      createdAt,
      tone: "active",
      persistence: "normal",
    };
  }

  if (
    type === "workflow_run_requested" ||
    type === "workflow_state_propagated"
  ) {
    return {
      id: `ai:${event.id}`,
      title: "AVERON resumed the work",
      detail: `${leadName}: the approved step is moving again.`,
      interpretation:
        "An approved decision is now turning into action.",
      time: getRelativeTime(createdAt),
      group: getTimeGroup(createdAt),
      createdAt,
      tone: "active",
      persistence: "normal",
    };
  }

  if (type === "operational_routing") {
    return {
      id: `ai:${event.id}`,
      title: "AVERON changed the work route",
      detail: event.message || `${leadName}: operational routing updated.`,
      interpretation:
        "Ownership changed because this deal needs a different next step.",
      time: getRelativeTime(createdAt),
      group: getTimeGroup(createdAt),
      createdAt,
      tone: "active",
      persistence: "normal",
    };
  }

  if (type === "task_executed") {
    return {
      id: `ai:${event.id}`,
      title: "Work completed",
      detail: `${leadName}: the execution step is done.`,
      interpretation:
        "This lowers the backlog and reduces pressure.",
      time: getRelativeTime(createdAt),
      group: getTimeGroup(createdAt),
      createdAt,
      tone: "passive",
      persistence: "low",
    };
  }

  if (
    type === "task_archived" ||
    type === "workflow_superseded"
  ) {
    return {
      id: `ai:${event.id}`,
      title: "Old work was moved out of focus",
      detail: `${leadName}: outdated context was reduced.`,
      interpretation:
        "AVERON is keeping attention on current work.",
      time: getRelativeTime(createdAt),
      group: getTimeGroup(createdAt),
      createdAt,
      tone: "passive",
      persistence: "low",
    };
  }

  return {
    id: `ai:${event.id}`,
    title: "Work state changed",
    detail: event.message || `${leadName}: workflow state changed.`,
    interpretation:
      "AVERON detected a change that may affect what should happen next.",
    time: getRelativeTime(createdAt),
    group: getTimeGroup(createdAt),
    createdAt,
    tone: "active",
    persistence: "normal",
  };
}

function normalizeTaskEvent(
  task: Task,
  lead?: Lead
): OperationalStreamItem {
  const status = task.status || "pending";
  const createdAt =
    task.updated_at ||
    task.created_at ||
    new Date().toISOString();
  const leadName = getLeadName(lead);
  const taskTitle = getTaskTitle(task);
  const stalled =
    status === "blocked" ||
    (status === "pending" && getHoursSince(createdAt) > 24) ||
    (status === "approved" && getHoursSince(createdAt) > 12);

  if (status === "escalated") {
    return {
      id: `task:${task.id}:escalated`,
      title: "People may become overloaded",
      detail: `${leadName}: ${taskTitle}`,
      interpretation:
        "This item now depends on human capacity to move forward.",
      time: getRelativeTime(createdAt),
      group: getTimeGroup(createdAt),
      createdAt,
      tone: "critical",
      persistence: "high",
    };
  }

  if (stalled) {
    return {
      id: `task:${task.id}:stalled`,
      title: "This deal is waiting too long",
      detail: `${leadName}: ${taskTitle}`,
      interpretation:
        "The work has aged without enough progress.",
      time: getRelativeTime(createdAt),
      group: getTimeGroup(createdAt),
      createdAt,
      tone: "critical",
      persistence: "high",
    };
  }

  if (status === "approved") {
    return {
      id: `task:${task.id}:approved`,
      title: "AVERON is now carrying this work",
      detail: `${leadName}: ${taskTitle}`,
      interpretation:
        "The item moved from waiting for approval into active work.",
      time: getRelativeTime(createdAt),
      group: getTimeGroup(createdAt),
      createdAt,
      tone: "active",
      persistence: "normal",
    };
  }

  if (status === "pending") {
    return {
      id: `task:${task.id}:pending`,
      title: "This item is waiting for approval",
      detail: `${leadName}: ${taskTitle}`,
      interpretation:
        "AVERON is ready, but a person must approve the next step.",
      time: getRelativeTime(createdAt),
      group: getTimeGroup(createdAt),
      createdAt,
      tone: "active",
      persistence: "normal",
    };
  }

  if (status === "completed") {
    return {
      id: `task:${task.id}:completed`,
      title: "Pressure reduced",
      detail: `${leadName}: ${taskTitle}`,
      interpretation:
        "Finished work lowers the backlog.",
      time: getRelativeTime(createdAt),
      group: getTimeGroup(createdAt),
      createdAt,
      tone: "passive",
      persistence: "low",
    };
  }

  return {
    id: `task:${task.id}:${status}`,
    title: "Old work moved out of focus",
    detail: `${leadName}: ${taskTitle}`,
    interpretation:
      "This item no longer needs immediate attention.",
    time: getRelativeTime(createdAt),
    group: getTimeGroup(createdAt),
    createdAt,
    tone: "passive",
    persistence: "low",
  };
}

function buildOperationalStream({
  aiEvents,
  leads,
  tasks,
}: {
  aiEvents: AIEvent[];
  leads: Lead[];
  tasks: Task[];
}) {
  const leadMap = new Map(leads.map((lead) => [lead.id, lead]));
  const activeTasks = tasks.filter(
    (task) =>
      task.status !== "completed" &&
      task.status !== "archived" &&
      task.status !== "superseded"
  );
  const stalledTasks = activeTasks.filter((task) => {
    const timestamp = task.updated_at || task.created_at;
    const status = task.status || "pending";

    return (
      status === "blocked" ||
      (status === "pending" && getHoursSince(timestamp) > 24) ||
      (status === "approved" && getHoursSince(timestamp) > 12)
    );
  });
  const escalatedTasks = activeTasks.filter(
    (task) => task.status === "escalated"
  );
  const pendingTasks = activeTasks.filter(
    (task) => (task.status || "pending") === "pending"
  );
  const approvedTasks = activeTasks.filter(
    (task) => task.status === "approved"
  );
  const completedRecently = tasks.filter(
    (task) =>
      task.status === "completed" &&
      getHoursSince(task.updated_at || task.created_at) <= 24
  );
  const highIntentAgingLeads = leads.filter(
    (lead) =>
      ((lead.intent_score ?? 0) >= 70 ||
        lead.urgency === "high") &&
      tasks.some(
        (task) =>
          task.lead_id === lead.id &&
          getHoursSince(task.updated_at || task.created_at) >
            12
      )
  );
  const lowRiskApprovalTasks = pendingTasks.filter((task) => {
    const lead = task.lead_id
      ? leadMap.get(task.lead_id)
      : undefined;

    return (
      task.priority !== "high" &&
      lead?.urgency !== "high" &&
      (lead?.intent_score ?? 0) < 70
    );
  });
  const enterpriseRecoveryTasks = activeTasks.filter((task) => {
    const lead = task.lead_id
      ? leadMap.get(task.lead_id)
      : undefined;

    return (
      ((lead?.intent_score ?? 0) >= 70 ||
        lead?.urgency === "high" ||
        task.priority === "high") &&
      (task.status === "escalated" ||
        task.status === "blocked" ||
        stalledTasks.some(
          (stalledTask) => stalledTask.id === task.id
        ))
    );
  });
  const recentEscalationEvents = aiEvents.filter((event) => {
    const type = event.type?.toLowerCase() || "";

    return (
      getHoursSince(event.created_at) <= 24 &&
      (type === "task_escalated" ||
        event.message?.toLowerCase().includes("escalat"))
    );
  });
  const now = new Date().toISOString();
  const cognitionItems: OperationalStreamItem[] = [
    lowRiskApprovalTasks.length >= 2 && escalatedTasks.length > 0
      ? {
          id: "coordination:reroute-low-risk",
          title: "AVERON can take routine work back",
          detail: `${lowRiskApprovalTasks.length} routine approvals can move away from people.`,
          interpretation:
            "People should stay focused on hard cases while AVERON handles routine work.",
          time: "now",
          group: "Now",
          createdAt: now,
          tone: "active",
          persistence: "high",
        }
      : null,
    enterpriseRecoveryTasks.length > 0
      ? {
          id: "coordination:enterprise-priority",
          title: "Important stuck deals moved to the top",
          detail: `${enterpriseRecoveryTasks.length} high-intent delayed workflow${
            enterpriseRecoveryTasks.length === 1 ? "" : "s"
          } moved above routine work.`,
          interpretation:
            "The highest-potential delayed deals should get attention first.",
          time: "now",
          group: "Now",
          createdAt: now,
          tone: "critical",
          persistence: "high",
        }
      : null,
    pendingTasks.length >= 4 && approvedTasks.length < pendingTasks.length
      ? {
          id: "coordination:approval-redistribution",
          title: "Too many approvals are waiting",
          detail: `${pendingTasks.length} approvals are waiting while ${approvedTasks.length} items are already with AVERON.`,
          interpretation:
            "AVERON should take routine approvals back so people are less overloaded.",
          time: "now",
          group: "Now",
          createdAt: now,
          tone: "critical",
          persistence: "high",
        }
      : null,
    approvedTasks.length > 0 && escalatedTasks.length === 0
      ? {
          id: "coordination:ai-ownership-expanding",
          title: "AVERON can carry more work",
          detail: `${approvedTasks.length} workflows are delegated to AI without escalation concentration.`,
          interpretation:
            "Routine work can stay with AVERON while people handle exceptions.",
          time: "now",
          group: "Now",
          createdAt: now,
          tone: "active",
          persistence: "normal",
        }
      : null,
    escalatedTasks.length > 0
      ? {
          id: "coordination:human-reserved",
          title: "People should handle only the hard cases",
          detail: `${escalatedTasks.length} escalated workflow${
            escalatedTasks.length === 1 ? "" : "s"
          } kept with people.`,
          interpretation:
            "AVERON is separating routine work from cases that need judgment.",
          time: "now",
          group: "Now",
          createdAt: now,
          tone: "active",
          persistence: "normal",
        }
      : null,
    escalatedTasks.length >= 2 || recentEscalationEvents.length >= 2
      ? {
          id: "cognition:escalation-backlog",
          title: "More deals may soon need people",
          detail: `${escalatedTasks.length} workflows are escalated and ${recentEscalationEvents.length} escalation signals appeared recently.`,
          interpretation:
            "If people do not clear these, more work may pile up behind them.",
          time: "now",
          group: "Now",
          createdAt: now,
          tone: "critical",
          persistence: "high",
        }
      : null,
    pendingTasks.length >= 4
      ? {
          id: "cognition:approval-saturation",
          title: "Approvals may slow everything down",
          detail: `${pendingTasks.length} ready items are waiting for approval.`,
          interpretation:
            "AVERON cannot move routine work until people approve it.",
          time: "now",
          group: "Now",
          createdAt: now,
          tone: "critical",
          persistence: "high",
        }
      : null,
    highIntentAgingLeads.length > 0
      ? {
          id: "cognition:enterprise-latency",
          title: "Important buyers are waiting too long",
          detail: `${highIntentAgingLeads.length} important buyer path is aging while work piles up.`,
          interpretation:
            "The deal may cool if this waits behind routine work.",
          time: "now",
          group: "Now",
          createdAt: now,
          tone: "critical",
          persistence: "high",
        }
      : null,
    completedRecently.length > stalledTasks.length &&
    completedRecently.length > 0
      ? {
          id: "cognition:recovery-improving",
          title: "Work is recovering",
          detail: `${completedRecently.length} completed items are outpacing ${stalledTasks.length} stuck items.`,
          interpretation:
            "AVERON is clearing the backlog and can keep moving routine work.",
          time: "now",
          group: "Now",
          createdAt: now,
          tone: "active",
          persistence: "normal",
        }
      : null,
    approvedTasks.length > 0 && stalledTasks.length === 0
      ? {
          id: "cognition:throughput-recovering",
          title: "AVERON work is moving again",
          detail: `${approvedTasks.length} approved items are with AVERON and not blocked.`,
          interpretation:
            "The system can keep moving while watching for new slowdowns.",
          time: "now",
          group: "Now",
          createdAt: now,
          tone: "active",
          persistence: "normal",
        }
      : null,
    escalatedTasks.length === 0 &&
    pendingTasks.length < 4 &&
    activeTasks.length > 0
      ? {
          id: "cognition:pressure-stabilizing",
          title: "Human workload looks stable",
          detail: `${activeTasks.length} active items remain without a pileup of hard cases.`,
          interpretation:
            "Current work is not showing signs of a broader slowdown.",
          time: "now",
          group: "Now",
          createdAt: now,
          tone: "passive",
          persistence: "low",
        }
      : null,
  ].filter(Boolean) as OperationalStreamItem[];
  const aiItems = aiEvents.map((event) =>
    normalizeAIEvent(
      event,
      event.lead_id ? leadMap.get(event.lead_id) : undefined
    )
  );
  const taskItems = tasks.map((task) =>
    normalizeTaskEvent(
      task,
      task.lead_id ? leadMap.get(task.lead_id) : undefined
    )
  );
  const uniqueItems = new Map<string, OperationalStreamItem>();

  [...cognitionItems, ...aiItems, ...taskItems]
    .sort(
      (left, right) =>
        getStreamPriority(right) - getStreamPriority(left)
    )
    .forEach((item) => {
      const compressionKey = `${item.title}:${item.detail}`
        .toLowerCase()
        .slice(0, 140);

      if (
        item.persistence === "high" ||
        !uniqueItems.has(compressionKey)
      ) {
        uniqueItems.set(compressionKey, item);
      }
    });

  return Array.from(uniqueItems.values())
    .sort(
      (left, right) =>
        getStreamPriority(right) - getStreamPriority(left)
    )
    .slice(0, 14);
}

function getStreamPriority(item: OperationalStreamItem) {
  const toneWeight = {
    critical: 10000,
    active: 5000,
    passive: 1000,
  }[item.tone];
  const persistenceWeight = {
    high: 2400,
    normal: 900,
    low: 0,
  }[item.persistence];
  const recencyWeight = Math.max(
    0,
    1200 - getHoursSince(item.createdAt) * 40
  );

  return toneWeight + persistenceWeight + recencyWeight;
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showExecutionRail = pathname === "/dashboard";
  const isDeepWorkspace = pathname.startsWith("/dashboard/leads/");
  const [summary, setSummary] = useState<ShellSummary>({});
  const [streamItems, setStreamItems] = useState<OperationalStreamItem[]>([]);
  const [updatedEventIds, setUpdatedEventIds] = useState<Set<string>>(
    new Set()
  );
  const knownEventIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!showExecutionRail) {
      return;
    }

    async function loadShellState() {
      try {
        const [
          summaryResponse,
          leadsResponse,
          tasksResponse,
        ] = await Promise.all([
          fetch("/api/dashboard/summary"),
          fetch("/api/leads"),
          fetch("/api/tasks"),
        ]);

        const summaryData = await summaryResponse.json();
        const leadsData = await leadsResponse.json();
        const tasksData = await tasksResponse.json();
        const leads: Lead[] = leadsData.leads ?? [];
        const tasks: Task[] = tasksData.tasks ?? [];
        const leadIds = Array.from(
          new Set(
            tasks
              .map((task) => task.lead_id)
              .filter(Boolean)
          )
        ).slice(0, 20) as string[];
        const aiEventEntries = await Promise.all(
          leadIds.map(async (leadId) => {
            try {
              const response = await fetch(
                `/api/ai-events?leadId=${leadId}`
              );
              const data = await response.json();

              return data.events ?? [];
            } catch (error) {
              console.error(
                "EXECUTION RAIL AI EVENT LOAD ERROR",
                error
              );

              return [];
            }
          })
        );
        const aiEvents = aiEventEntries.flat() as AIEvent[];
        const nextEvents = buildOperationalStream({
          aiEvents,
          leads,
          tasks,
        });
        const previousEventIds = knownEventIdsRef.current;
        const nextEventIds = new Set(
          nextEvents.map((event) => event.id)
        );
        const freshEventIds = nextEvents
          .filter((event) => !previousEventIds.has(event.id))
          .map((event) => event.id);

        setSummary(summaryData.summary ?? {});
        setStreamItems(nextEvents);
        knownEventIdsRef.current = nextEventIds;

        if (previousEventIds.size > 0 && freshEventIds.length > 0) {
          setUpdatedEventIds(new Set(freshEventIds));
          window.setTimeout(() => {
            setUpdatedEventIds(new Set());
          }, 5200);
        }
      } catch (error) {
        console.error(error);
      }
    }

    void loadShellState();
    const interval = window.setInterval(loadShellState, 9000);

    return () => {
      window.clearInterval(interval);
    };
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
            AVERON is moving revenue work and watching for blockers.
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

          <div className="mt-8 min-h-0 flex-1 overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-zinc-400" />
                AI Operations Stream
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-[#00ffcc]/15 bg-[#00ffcc]/[0.055] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#00ffcc]">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#00ffcc]" />
                Live
              </div>
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-600">
              What changed, why it matters
            </div>

            <div className="mt-4 h-[calc(100vh-270px)] space-y-2 overflow-y-auto pr-1">
              {streamItems.length > 0 ? (
                streamItems.map((event, index) => {
                  const previous =
                    index > 0
                      ? streamItems[index - 1]
                      : null;
                  const showGroup =
                    !previous || previous.group !== event.group;

                  return (
                    <div key={event.id}>
                      {showGroup && (
                        <div className="pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600 first:pt-0">
                          {event.group}
                        </div>
                      )}

                      <StreamEventCard
                        event={event}
                        highlighted={updatedEventIds.has(event.id)}
                      />
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-zinc-900 bg-black p-4 text-sm leading-6 text-zinc-500">
                  No operational stream activity yet.
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

function StreamEventCard({
  event,
  highlighted,
}: {
  event: OperationalStreamItem;
  highlighted: boolean;
}) {
  const Icon =
    event.tone === "critical"
      ? AlertTriangle
      : event.tone === "active"
      ? Radio
      : CheckCircle2;
  const toneClasses = {
    critical:
      "command-priority-critical border-red-300/30 text-red-100",
    active:
      "command-priority-active border-[#00ffcc]/22 text-zinc-100",
    passive:
      "command-priority-passive border-zinc-900 text-zinc-400",
  }[event.tone];
  const dotClasses = {
    critical: "bg-red-300 shadow-[0_0_18px_rgba(248,113,113,0.24)]",
    active: "bg-[#00ffcc] shadow-[0_0_18px_rgba(0,255,204,0.24)]",
    passive: "bg-zinc-600",
  }[event.tone];

  return (
    <div
      className={`relative rounded-xl border bg-black/45 transition ${
        toneClasses
      } ${
        event.persistence === "high"
          ? "p-4 pl-10"
          : "p-3 pl-9"
      } ${
        highlighted
          ? "message-surface execution-pulse shadow-[0_0_34px_rgba(0,255,204,0.1)]"
          : ""
      }`}
    >
      <div className="absolute left-3 top-3 flex h-4 w-4 items-center justify-center">
        <span
          className={`absolute h-1.5 w-1.5 rounded-full ${dotClasses}`}
        />
        <Icon className="h-4 w-4 opacity-30" />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold leading-5">
            {event.title}
          </div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
            {event.detail}
          </div>
          {event.persistence !== "low" && (
            <div className="mt-2 border-t border-white/10 pt-2 text-xs leading-5 text-zinc-400">
              {event.interpretation}
            </div>
          )}
        </div>

        <div className="shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-600">
          {event.time}
        </div>
      </div>
    </div>
  );
}
