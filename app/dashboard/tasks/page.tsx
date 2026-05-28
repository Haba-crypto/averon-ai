"use client";

import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Play,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  type Language,
  translate,
  useLanguage,
} from "@/lib/i18n/language";

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
  updated_at?: string | null;
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
  updated_at?: string | null;
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

type ExecutionIntelligence = {
  state:
    | "Awaiting Human Decision"
    | "AI Executing Workflow"
    | "Waiting On Buyer"
    | "Escalated To Human"
    | "Workflow Stalled"
    | "Recently Completed";
  owner:
    | "Owned by AI"
    | "Owned by Human"
    | "Awaiting Buyer"
    | "Escalated";
  health: "Healthy" | "At Risk" | "Delayed" | "Escalated";
  signal: string;
  tone: "active" | "attention" | "danger" | "complete" | "passive";
};

const queueGroups = [
  {
    key: "active",
    titleKey: "active",
    signalKey: "latestRecommendation",
    icon: UserCheck,
  },
  {
    key: "awaiting",
    titleKey: "awaitingApproval",
    signalKey: "awaitingApproval",
    icon: UserCheck,
  },
  {
    key: "ready",
    titleKey: "readyToExecute",
    signalKey: "readyToExecute",
    icon: Play,
  },
  {
    key: "escalated",
    titleKey: "escalated",
    signalKey: "escalated",
    icon: AlertTriangle,
  },
  {
    key: "blocked",
    titleKey: "blocked",
    signalKey: "blocked",
    icon: ShieldAlert,
  },
  {
    key: "completed",
    titleKey: "completedRecently",
    signalKey: "completedRecently",
    icon: CheckCircle2,
  },
  {
    key: "superseded",
    titleKey: "superseded",
    signalKey: "replacedRecommendation",
    icon: ShieldAlert,
  },
  {
    key: "archived",
    titleKey: "archived",
    signalKey: "archived",
    icon: CheckCircle2,
  },
] as const;

function localizeStatus(language: Language, status: string) {
  const labels: Record<string, string> = {
    approved: translate(language, "approved", "одобрено"),
    completed: translate(language, "completed", "завершено"),
    escalated: translate(language, "escalated", "передано человеку"),
    blocked: translate(language, "blocked", "заблокировано"),
    superseded: translate(language, "superseded", "заменено"),
    archived: translate(language, "archived", "в архиве"),
    pending: translate(language, "pending", "ожидает"),
  };

  return labels[status] || status;
}

function localizeOperationalText(language: Language, text: string) {
  const labels: Record<string, string> = {
    "Awaiting Human Decision": "Ждет решения человека",
    "AI Executing Workflow": "AI выполняет процесс",
    "Waiting On Buyer": "Ждет покупателя",
    "Escalated To Human": "Передано человеку",
    "Workflow Stalled": "Процесс застрял",
    "Recently Completed": "Недавно завершено",
    "Owned by AI": "Ведет AI",
    "Owned by Human": "Ведет человек",
    "Awaiting Buyer": "Ждет покупателя",
    Escalated: "Передано человеку",
    Healthy: "Стабильно",
    "At Risk": "Есть риск",
    Delayed: "Задержка",
    "Execution completed moments ago": "Выполнение только что завершено",
    "Completed execution path": "Путь выполнения завершен",
    "Human intervention required too long": "Помощь человека требуется слишком долго",
    "Human intervention required": "Нужна помощь человека",
    "Attention required before execution can continue": "Нужно внимание, прежде чем работа продолжится",
    "Approved but no execution trace yet": "Одобрено, но выполнения еще не видно",
    "Waiting too long for operator decision": "Слишком долго ждет решения оператора",
    "No buyer activity after AI follow-up": "Нет активности покупателя после follow-up от AI",
    "Awaiting buyer response": "Ожидается ответ покупателя",
    "Currently active and recently updated": "Активно и недавно обновлено",
    "AI executing next step": "AI выполняет следующий шаг",
    "High urgency decision waiting": "Срочное решение ждет",
    "AI awaiting operator decision": "AI ждет решения оператора",
    "Assigned to AI": "Назначено AI",
    "Assigned to Human": "Назначено человеку",
    "Awaiting Decision": "Ждет решения",
    normal: "обычно",
    high: "высокая",
    medium: "средняя",
    low: "низкая",
  };

  return language === "ru" ? labels[text] || text : text;
}

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

function getHoursSince(timestamp?: string | null) {
  if (!timestamp) {
    return 0;
  }

  return (
    (Date.now() - new Date(timestamp).getTime()) /
    1000 /
    60 /
    60
  );
}

function isRecentlyUpdated(task: QueueTask) {
  return (
    getHoursSince(
      task.latestEvent?.created_at ||
        task.updated_at ||
        task.created_at
    ) <= 2
  );
}

function hasExecutionEvent(task: QueueTask) {
  const eventType =
    task.latestEvent?.type || "";

  return (
    eventType === "task_executed" ||
    eventType === "workflow_state_propagated"
  );
}

function getExecutionIntelligence(task: QueueTask): ExecutionIntelligence {
  const status = getTaskStatus(task);
  const ageHours =
    getHoursSince(task.updated_at || task.created_at);
  const routingText = getRoutingText(task);
  const latestType =
    task.latestEvent?.type?.toLowerCase() || "";
  const highUrgency =
    task.lead?.urgency === "high" ||
    task.priority === "high";

  if (status === "completed") {
    return {
      state: "Recently Completed",
      owner: "Owned by AI",
      health: "Healthy",
      signal: isRecentlyUpdated(task)
        ? "Execution completed moments ago"
        : "Completed execution path",
      tone: "complete",
    };
  }

  if (
    status === "escalated" ||
    latestType === "task_escalated" ||
    routingText.includes("human intervention")
  ) {
    return {
      state: "Escalated To Human",
      owner: "Escalated",
      health: "Escalated",
      signal:
        ageHours > 8
          ? "Human intervention required too long"
          : "Human intervention required",
      tone: "danger",
    };
  }

  if (status === "blocked") {
    return {
      state: "Workflow Stalled",
      owner: "Owned by Human",
      health: "Delayed",
      signal: "Attention required before execution can continue",
      tone: "attention",
    };
  }

  if (
    status === "approved" &&
    !hasExecutionEvent(task) &&
    ageHours > 12
  ) {
    return {
      state: "Workflow Stalled",
      owner: "Owned by AI",
      health: "Delayed",
      signal: "Approved but no execution trace yet",
      tone: "attention",
    };
  }

  if (status === "pending" && ageHours > 24) {
    return {
      state: "Workflow Stalled",
      owner: "Owned by Human",
      health: "Delayed",
      signal: "Waiting too long for operator decision",
      tone: "attention",
    };
  }

  if (
    routingText.includes("buyer") ||
    routingText.includes("follow-up") ||
    routingText.includes("follow up")
  ) {
    return {
      state: "Waiting On Buyer",
      owner: "Awaiting Buyer",
      health: ageHours > 24 ? "Delayed" : "Healthy",
      signal:
        ageHours > 24
          ? "No buyer activity after AI follow-up"
          : "Awaiting buyer response",
      tone: ageHours > 24 ? "attention" : "active",
    };
  }

  if (
    status === "approved" ||
    getQueueKey(task) === "active"
  ) {
    return {
      state: "AI Executing Workflow",
      owner: "Owned by AI",
      health: highUrgency ? "At Risk" : "Healthy",
      signal: isRecentlyUpdated(task)
        ? "Currently active and recently updated"
        : "AI executing next step",
      tone: "active",
    };
  }

  return {
    state: "Awaiting Human Decision",
    owner: "Owned by Human",
    health: highUrgency ? "At Risk" : "Healthy",
    signal: highUrgency
      ? "High urgency decision waiting"
      : "AI awaiting operator decision",
    tone: highUrgency ? "attention" : "passive",
  };
}

function getExecutionPriority(task: QueueTask) {
  const intelligence =
    getExecutionIntelligence(task);
  const urgencyScore =
    task.lead?.urgency === "high" || task.priority === "high"
      ? 40
      : 0;
  const passivePenalty =
    getTaskStatus(task) === "completed" ||
    getTaskStatus(task) === "superseded" ||
    getTaskStatus(task) === "archived"
      ? -200
      : 0;

  return (
    (intelligence.state === "Workflow Stalled" ? 140 : 0) +
    (intelligence.state === "Escalated To Human" ? 125 : 0) +
    (intelligence.state === "AI Executing Workflow" ? 90 : 0) +
    (intelligence.health === "At Risk" ? 60 : 0) +
    (isRecentlyUpdated(task) ? 35 : 0) +
    urgencyScore +
    passivePenalty +
    Math.min(
      getHoursSince(task.updated_at || task.created_at),
      48
    )
  );
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
  const { t } = useLanguage();
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
        ).sort(
          (left, right) =>
            getExecutionPriority(right) -
            getExecutionPriority(left)
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
            {t("executionQueue")}
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            {t("humanCommandTitle")}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-500">
            {t("humanCommandSubtitle")}
          </p>
        </div>

        <div className="premium-card rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            {t("selected")}
          </div>
          <div className="mt-2 text-3xl font-semibold">
            {selectedTaskIds.size}
          </div>
        </div>
      </header>

      <section className="mt-6 flex flex-wrap gap-2">
        <CommandButton
          label={t("approveSelected")}
          loading={loadingAction === "approved"}
          workingLabel={t("working")}
          icon={Check}
          onClick={() => void moveSelected("approved")}
        />
        <CommandButton
          label={t("executeSelected")}
          loading={loadingAction === "completed"}
          workingLabel={t("working")}
          icon={Play}
          onClick={() => void moveSelected("completed")}
        />
        <CommandButton
          label={t("escalateSelected")}
          loading={loadingAction === "escalated"}
          workingLabel={t("working")}
          icon={AlertTriangle}
          onClick={() => void moveSelected("escalated")}
        />
        <CommandButton
          label={t("archiveSelected")}
          loading={loadingAction === "archived"}
          workingLabel={t("working")}
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
                      {t(group.titleKey)}
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {t(group.signalKey)}
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
                    {t("emptyQueue")}
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
  workingLabel,
  icon: Icon,
  onClick,
}: {
  label: string;
  loading: boolean;
  workingLabel: string;
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
      {loading ? workingLabel : label}
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
  const { language, t } = useLanguage();
  const status = getTaskStatus(task);
  const assignment = getAssignmentState(task);
  const intelligence =
    getExecutionIntelligence(task);
  const recentlyUpdated =
    isRecentlyUpdated(task);
  const intelligenceBorder = {
    active:
      "command-priority-active border-[#00ffcc]/30 shadow-[0_0_30px_rgba(0,255,204,0.06)]",
    attention:
      "command-priority-danger border-yellow-300/30 shadow-[0_0_30px_rgba(250,204,21,0.05)]",
    danger:
      "command-priority-critical border-red-300/35 shadow-[0_0_36px_rgba(248,113,113,0.08)]",
    complete: "command-priority-stable border-green-300/16",
    passive: "command-priority-passive border-zinc-900",
  }[intelligence.tone];

  return (
    <article
      className={`operational-surface premium-card rounded-2xl border bg-zinc-950 p-5 ${
        selected
          ? "border-[#00ffcc]/35 shadow-[0_0_34px_rgba(0,255,204,0.08)]"
          : intelligenceBorder
      } ${
        recentlyMoved || recentlyUpdated
          ? "message-surface execution-pulse"
          : ""
      } ${
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

        <Badge
          tone={
            intelligence.health === "Escalated"
              ? "red"
              : intelligence.health === "Delayed" ||
                intelligence.health === "At Risk"
              ? "yellow"
              : status === "completed"
              ? "green"
              : "zinc"
          }
        >
          {localizeStatus(language, status)}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge
          tone={
            intelligence.tone === "danger"
              ? "red"
              : intelligence.tone === "attention"
              ? "yellow"
              : intelligence.tone === "complete"
              ? "green"
              : "teal"
          }
        >
          {localizeOperationalText(language, intelligence.state)}
        </Badge>
        <Badge
          tone={
            intelligence.health === "Escalated"
              ? "red"
              : intelligence.health === "Delayed" ||
                intelligence.health === "At Risk"
              ? "yellow"
              : "green"
          }
        >
          {localizeOperationalText(language, intelligence.health)}
        </Badge>
        {recentlyUpdated && (
          <span className="flex items-center gap-1 rounded-full border border-[#00ffcc]/20 bg-[#00ffcc]/10 px-2.5 py-1 text-xs font-medium text-[#00ffcc]">
            <Clock3 className="h-3 w-3" />
            {t("recentlyUpdated")}
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Detail label={t("aiAgentOwner")} value={task.assigned_agent || "AVERON AI"} />
        <Detail label={t("ownership")} value={localizeOperationalText(language, intelligence.owner)} />
        <Detail label={t("urgency")} value={localizeOperationalText(language, task.lead?.urgency || task.priority || "normal")} />
        <Detail label={t("assignment")} value={localizeOperationalText(language, assignment)} />
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
        <div className="text-xs uppercase tracking-[0.16em] text-zinc-600">
          {status === "superseded"
            ? t("replacedRecommendation")
            : t("latestRecommendation")}
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-300">
          {task.description ||
            task.lead?.recommendation ||
            getTaskTitle(task)}
        </p>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Detail
          label={t("whyEscalated")}
          value={getWhyEscalated(task)}
        />
        <Detail
          label={t("latestEvent")}
          value={
            task.latestEvent?.message ||
            t("noAiEvent")
          }
        />
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-600">
        <Bot className="h-4 w-4" />
        {localizeOperationalText(language, intelligence.signal)}
      </div>

      {(task.latestEvent?.type === "operational_routing" ||
        task.latestEvent?.type === "queue_routing") && (

        <div className="mt-3 rounded-xl border border-[#00ffcc]/20 bg-[#00ffcc]/[0.065] px-3 py-2 text-xs leading-5 text-[#00ffcc]/90 shadow-[0_12px_36px_rgba(0,255,204,0.04)]">

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
  tone: "green" | "zinc" | "teal" | "yellow" | "red";
}) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
        tone === "green"
          ? "border-green-400/20 bg-green-400/10 text-green-300"
          : tone === "teal"
          ? "border-[#00ffcc]/20 bg-[#00ffcc]/10 text-[#00ffcc]"
          : tone === "yellow"
          ? "border-yellow-300/20 bg-yellow-300/10 text-yellow-200"
          : tone === "red"
          ? "border-red-300/20 bg-red-300/10 text-red-200"
          : "border-zinc-700 bg-zinc-900 text-zinc-300"
      }`}
    >
      {children}
    </span>
  );
}
