"use client";

import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Play,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TaskStatus =
  | "approved"
  | "completed"
  | "escalated"
  | "blocked"
  | "superseded"
  | "archived"
  | "pending";

type Task = {
  id: string;
  lead_id?: string | null;
  title?: string | null;
  task?: string | null;
  description?: string | null;
  priority?: string | null;
  status?: string | null;
  assigned_agent?: string | null;
  created_at?: string | null;
};

type Lead = {
  id: string;
  name?: string | null;
  company?: string | null;
  email?: string | null;
  urgency?: string | null;
  deal_risk?: string | null;
  recommendation?: string | null;
  ai_notes?: string | null;
};

type AIEvent = {
  id: string;
  type?: string | null;
  message?: string | null;
  created_at?: string | null;
};

type QueueTask = Task & {
  lead?: Lead;
  latestEvent?: AIEvent;
};

const queueGroups = [
  {
    key: "active",
    title: "Active",
    signal: "Latest operational recommendation",
    icon: UserCheck,
  },
  {
    key: "awaiting",
    title: "Awaiting Approval",
    signal: "AI awaiting operator decision",
    icon: UserCheck,
  },
  {
    key: "ready",
    title: "Ready To Execute",
    signal: "Execution authorized",
    icon: Play,
  },
  {
    key: "escalated",
    title: "Escalated",
    signal: "Human intervention required",
    icon: AlertTriangle,
  },
  {
    key: "blocked",
    title: "Blocked",
    signal: "Decision required before execution",
    icon: ShieldAlert,
  },
  {
    key: "completed",
    title: "Completed Recently",
    signal: "Workflow delegated",
    icon: CheckCircle2,
  },
  {
    key: "superseded",
    title: "Superseded",
    signal: "Replaced by newer recommendation",
    icon: ShieldAlert,
  },
  {
    key: "archived",
    title: "Archived",
    signal: "Lower-priority operational context",
    icon: CheckCircle2,
  },
];

function getLeadName(lead?: Lead) {
  return (
    lead?.company ||
    lead?.name ||
    lead?.email ||
    "Unlinked lead"
  );
}

function getTaskTitle(task: Task) {
  return (
    task.title ||
    task.task ||
    "Revenue execution task"
  );
}

function getTaskStatus(task: Task): TaskStatus {
  const status = task.status || "pending";

  if (
    status === "approved" ||
    status === "completed" ||
    status === "escalated" ||
    status === "blocked" ||
    status === "superseded" ||
    status === "archived"
  ) {
    return status;
  }

  return "pending";
}

function getRoutingText(task: QueueTask) {
  return `${task.task || ""} ${task.latestEvent?.message || ""}`.toLowerCase();
}

function getQueueKey(task: QueueTask) {
  const status = getTaskStatus(task);
  const routingText = getRoutingText(task);

  if (status === "completed") {
    return "completed";
  }

  if (status === "superseded") {
    return "superseded";
  }

  if (status === "archived") {
    return "archived";
  }

  if (
    routingText.includes("routed to approved") ||
    routingText.includes("high buying intent")
  ) {
    return "active";
  }

  if (
    routingText.includes("routed to escalated") ||
    routingText.includes("human intervention")
  ) {
    return "escalated";
  }

  if (status === "approved") {
    return "active";
  }

  if (status === "escalated") {
    return "escalated";
  }

  if (status === "blocked") {
    return "blocked";
  }

  return "awaiting";
}

function getAssignmentState(task: QueueTask) {
  const status = getTaskStatus(task);
  const queueKey = getQueueKey(task);

  if (status === "pending") {
    if (queueKey === "active") {
      return "Assigned to AI";
    }

    if (queueKey === "escalated") {
      return "Assigned to Human";
    }

    return "Awaiting Decision";
  }

  if (
    status === "escalated" ||
    status === "blocked"
  ) {
    return "Assigned to Human";
  }

  return "Assigned to AI";
}

function getWhyEscalated(task: QueueTask) {
  if (
    task.latestEvent?.type === "operational_routing" ||
    task.latestEvent?.type === "queue_routing"
  ) {
    return (
      task.latestEvent.message ||
      "AI routed this from conversation activity."
    );
  }

  return (
    task.lead?.deal_risk ||
    task.lead?.ai_notes ||
    task.task ||
    "AI surfaced this for operator review."
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<QueueTask[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    new Set()
  );
  const [recentlyMovedTaskIds, setRecentlyMovedTaskIds] = useState<Set<string>>(
    new Set()
  );
  const [loadingAction, setLoadingAction] =
    useState<TaskStatus | null>(null);

  async function loadQueue() {
    const [tasksResponse, leadsResponse] =
      await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/leads"),
      ]);
    const tasksData = await tasksResponse.json();
    const leadsData = await leadsResponse.json();
    const leadMap = new Map<string, Lead>(
      (leadsData.leads || []).map((lead: Lead) => [
        lead.id,
        lead,
      ])
    );
    const leadIds = Array.from(
      new Set(
        (tasksData.tasks || [])
          .map((task: Task) => task.lead_id)
          .filter(Boolean)
      )
    ) as string[];
    const eventEntries = await Promise.all(
      leadIds.map(async (leadId) => {
        const response = await fetch(
          `/api/ai-events?leadId=${leadId}`
        );
        const data = await response.json();

        return [
          leadId,
          data.events?.[0] || null,
        ] as const;
      })
    );
    const eventMap = new Map<string, AIEvent | null>(
      eventEntries
    );

    setTasks(
      (tasksData.tasks || []).map((task: Task) => ({
        ...task,
        lead: task.lead_id
          ? leadMap.get(task.lead_id)
          : undefined,
        latestEvent: task.lead_id
          ? eventMap.get(task.lead_id) || undefined
          : undefined,
      }))
    );
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadQueue();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  const groupedTasks = useMemo(() => {
    return queueGroups.reduce<Record<string, QueueTask[]>>(
      (groups, group) => {
        groups[group.key] = tasks.filter(
          (task) => getQueueKey(task) === group.key
        );
        return groups;
      },
      {}
    );
  }, [tasks]);

  function toggleTask(taskId: string) {
    setSelectedTaskIds((previous) => {
      const next = new Set(previous);

      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }

      return next;
    });
  }

  async function moveSelected(status: TaskStatus) {
    const taskIds = Array.from(selectedTaskIds);

    if (taskIds.length === 0) {
      return;
    }

    setLoadingAction(status);
    setTasks((previous) =>
      previous.map((task) =>
        selectedTaskIds.has(task.id)
          ? {
              ...task,
              status,
            }
          : task
      )
    );
    setRecentlyMovedTaskIds(new Set(taskIds));

    try {
      await Promise.all(
        taskIds.map((taskId) =>
          fetch("/api/tasks", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              taskId,
              status,
            }),
          })
        )
      );

      setSelectedTaskIds(new Set());
      await loadQueue();
    } catch (error) {
      console.error(error);
      await loadQueue();
    }

    window.setTimeout(() => {
      setRecentlyMovedTaskIds(new Set());
    }, 5200);
    setLoadingAction(null);
  }

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-8 text-white lg:px-10">
      <header className="flex flex-col gap-6 border-b border-zinc-900 pb-8 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Execution Queue
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            Human-In-The-Loop Command
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-500">
            Direct AI revenue work from approval to delegated execution.
          </p>
        </div>

        <div className="premium-card rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Selected
          </div>
          <div className="mt-2 text-3xl font-semibold">
            {selectedTaskIds.size}
          </div>
        </div>
      </header>

      <section className="mt-6 flex flex-wrap gap-2">
        <CommandButton
          label="Approve Selected"
          loading={loadingAction === "approved"}
          icon={Check}
          onClick={() => void moveSelected("approved")}
        />
        <CommandButton
          label="Execute Selected"
          loading={loadingAction === "completed"}
          icon={Play}
          onClick={() => void moveSelected("completed")}
        />
        <CommandButton
          label="Escalate Selected"
          loading={loadingAction === "escalated"}
          icon={AlertTriangle}
          onClick={() => void moveSelected("escalated")}
        />
        <CommandButton
          label="Archive Selected"
          loading={loadingAction === "archived"}
          icon={CheckCircle2}
          onClick={() => void moveSelected("archived")}
        />
      </section>

      <div className="mt-8 space-y-8">
        {queueGroups.map((group) => {
          const Icon = group.icon;
          const groupTasks = groupedTasks[group.key] || [];

          return (
            <section key={group.key}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-zinc-500" />
                    <h2 className="text-2xl font-semibold">
                      {group.title}
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {group.signal}
                  </p>
                </div>
                <div className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-zinc-400">
                  {groupTasks.length}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {groupTasks.length > 0 ? (
                  groupTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      selected={selectedTaskIds.has(task.id)}
                      recentlyMoved={recentlyMovedTaskIds.has(task.id)}
                      onToggle={() => toggleTask(task.id)}
                      lowSignal={
                        group.key === "superseded" ||
                        group.key === "archived" ||
                        group.key === "completed"
                      }
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5 text-sm text-zinc-500">
                    No work currently in this queue.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function CommandButton({
  label,
  loading,
  icon: Icon,
  onClick,
}: {
  label: string;
  loading: boolean;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="operational-surface flex h-11 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-200 hover:border-[#00ffcc]/30 hover:text-white"
    >
      <Icon className="h-4 w-4" />
      {loading ? "Working" : label}
    </button>
  );
}

function TaskCard({
  task,
  selected,
  recentlyMoved,
  onToggle,
  lowSignal,
}: {
  task: QueueTask;
  selected: boolean;
  recentlyMoved: boolean;
  onToggle: () => void;
  lowSignal: boolean;
}) {
  const status = getTaskStatus(task);
  const assignment = getAssignmentState(task);

  return (
    <article
      className={`operational-surface premium-card rounded-2xl border bg-zinc-950 p-5 ${
        selected
          ? "border-[#00ffcc]/35 shadow-[0_0_34px_rgba(0,255,204,0.08)]"
          : "border-zinc-800"
      } ${recentlyMoved ? "message-surface execution-pulse" : ""} ${
        lowSignal ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <label className="flex min-w-0 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="mt-1 h-4 w-4 accent-white"
          />
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold">
              {getTaskTitle(task)}
            </h3>
            <p className="mt-1 truncate text-sm text-zinc-500">
              {getLeadName(task.lead)}
            </p>
          </div>
        </label>

        <Badge tone={status === "completed" ? "green" : "zinc"}>
          {status}
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Detail label="AI agent owner" value={task.assigned_agent || "AVERON AI"} />
        <Detail label="Assignment" value={assignment} />
        <Detail label="Urgency" value={task.lead?.urgency || task.priority || "normal"} />
        <Detail label="Execution status" value={status} />
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
        <div className="text-xs uppercase tracking-[0.16em] text-zinc-600">
          {status === "superseded"
            ? "Replaced by newer recommendation"
            : "Latest operational recommendation"}
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-300">
          {task.description ||
            task.lead?.recommendation ||
            getTaskTitle(task)}
        </p>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Detail
          label="Why AI escalated it"
          value={getWhyEscalated(task)}
        />
        <Detail
          label="Latest event"
          value={
            task.latestEvent?.message ||
            "No AI event recorded yet."
          }
        />
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-600">
        <Bot className="h-4 w-4" />
        {status === "pending" && "AI awaiting operator decision"}
        {status === "approved" && "Execution authorized"}
        {status === "completed" && "Workflow delegated"}
        {status === "escalated" && "Human intervention required"}
        {status === "blocked" && "Execution blocked"}
        {status === "superseded" && "Replaced by newer recommendation"}
        {status === "archived" && "Archived operational context"}
      </div>

      {(task.latestEvent?.type === "operational_routing" ||
        task.latestEvent?.type === "queue_routing") && (

        <div className="mt-3 rounded-xl border border-[#00ffcc]/15 bg-[#00ffcc]/[0.05] px-3 py-2 text-xs leading-5 text-[#00ffcc]/90">

          {task.latestEvent.message}

        </div>

      )}
    </article>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-[0.16em] text-zinc-600">
        {label}
      </div>
      <div className="mt-1 line-clamp-2 text-sm leading-5 text-zinc-300">
        {value}
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "zinc";
}) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
        tone === "green"
          ? "border-green-400/20 bg-green-400/10 text-green-300"
          : "border-zinc-700 bg-zinc-900 text-zinc-300"
      }`}
    >
      {children}
    </span>
  );
}
