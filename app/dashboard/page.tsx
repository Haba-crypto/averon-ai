"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  MessageSquare,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  type Language,
  translate,
  useLanguage,
} from "@/lib/i18n/language";

type DashboardSummary = {
  leadsCount?: number;
  tasksCount?: number;
  conversationsCount?: number;
};

type Lead = {
  id: string;
  name?: string | null;
  company?: string | null;
  email?: string | null;
  urgency?: string | null;
  intent_score?: number | null;
  recommendation?: string | null;
  updated_at?: string | null;
};

type Task = {
  id: string;
  lead_id?: string | null;
  task?: string | null;
  title?: string | null;
  priority?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AIEvent = {
  id: string;
  lead_id?: string | null;
  type?: string | null;
  message?: string | null;
  created_at?: string | null;
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

type RevenueIntelligence = {
  pipelineHealth: "Healthy" | "At Risk" | "Delayed" | "Escalated";
  executionPressure: "Low" | "Moderate" | "High" | "Critical";
  escalationLoad: number;
  stalledCount: number;
  activeAIExecutionCount: number;
  humanInterventionLoad: number;
  approvalBacklog: number;
  highIntentAgingCount: number;
  aiWorkload: number;
  humanWorkload: number;
  queueSaturation: number;
  throughput: number;
  warnings: string[];
  recommendations: string[];
  priorityWorkflows: Array<{
    id: string;
    leadName: string;
    task: string;
    reason: string;
    href: string;
    tone: "danger" | "attention" | "active";
  }>;
  timelineSignals: Array<{
    title: string;
    detail: string;
    cause: string;
    impact: string;
    response: string;
    tone: "danger" | "attention" | "active" | "stable";
  }>;
  executivePosture:
    | "Intervene"
    | "Rebalance"
    | "Accelerate"
    | "Monitor";
  executiveNarrative: {
    title: string;
    detail: string;
    tone: "danger" | "attention" | "active" | "stable";
  };
  systemicThreats: Array<{
    title: string;
    detail: string;
    tone: "danger" | "attention";
  }>;
  interventions: Array<{
    title: string;
    directive: string;
    href: string;
    tone: "danger" | "attention" | "active";
  }>;
  operationSignals: Array<{
    label: string;
    value: string;
    tone: "danger" | "attention" | "active" | "stable";
  }>;
  primarySignal: {
    label: string;
    title: string;
    detail: string;
    tone: "danger" | "attention" | "active" | "stable";
  };
  causalReasons: string[];
  executiveActionPath: {
    title: string;
    directive: string;
    href: string;
    tone: "danger" | "attention" | "active";
  };
  coordinationPlan: {
    title: string;
    directive: string;
    tone: "danger" | "attention" | "active" | "stable";
  };
  ownershipDirectives: Array<{
    owner: "AI" | "Human";
    title: string;
    detail: string;
    tone: "danger" | "attention" | "active" | "stable";
  }>;
  executionPriorityPath: Array<{
    label: string;
    detail: string;
    tone: "danger" | "attention" | "active";
  }>;
  priorityObjects: Array<{
    id: string;
    leadName: string;
    state: string;
    urgency: string;
    intent: string;
    waiting: string;
    risk: string;
    recommendation: string;
    href: string;
    tone: "danger" | "attention" | "active";
  }>;
  coordinationEvidence: {
    approvalsWaiting: number;
    lowRiskApprovals: number;
    escalations: number;
    stalledWorkflows: number;
    highestImpactWorkflow: string;
    expectedImpact: string[];
  };
};

const closedStatuses = new Set([
  "completed",
  "superseded",
  "archived",
]);

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

function getTaskStatus(task: Task) {
  return task.status || "pending";
}

function isClosedTask(task: Task) {
  return closedStatuses.has(getTaskStatus(task));
}

function isStalledTask(task: Task) {
  const status = getTaskStatus(task);
  const ageHours = getHoursSince(
    task.updated_at || task.created_at
  );

  return (
    status === "blocked" ||
    (status === "pending" && ageHours > 24) ||
    (status === "approved" && ageHours > 12)
  );
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

function formatWaitingTime(
  timestamp?: string | null,
  language: Language = "en"
) {
  const hours = getHoursSince(timestamp);

  if (hours < 1) {
    return translate(language, "under 1h", "меньше 1 ч");
  }

  if (hours < 24) {
    return translate(
      language,
      `${Math.floor(hours)}h`,
      `${Math.floor(hours)} ч`
    );
  }

  return translate(
    language,
    `${Math.floor(hours / 24)}d`,
    `${Math.floor(hours / 24)} д`
  );
}

function buildRevenueIntelligence(
  leads: Lead[],
  tasks: Task[],
  aiEvents: AIEvent[],
  language: Language
): RevenueIntelligence {
  const l = (en: string, ru: string) =>
    translate(language, en, ru);
  const leadMap = new Map(
    leads.map((lead) => [lead.id, lead])
  );
  const activeTasks = tasks.filter(
    (task) => !isClosedTask(task)
  );
  const stalledTasks = activeTasks.filter(isStalledTask);
  const escalatedTasks = activeTasks.filter(
    (task) => getTaskStatus(task) === "escalated"
  );
  const pendingTasks = activeTasks.filter(
    (task) => getTaskStatus(task) === "pending"
  );
  const approvedTasks = activeTasks.filter(
    (task) => getTaskStatus(task) === "approved"
  );
  const blockedTasks = activeTasks.filter(
    (task) => getTaskStatus(task) === "blocked"
  );
  const stalledLastSixHours = stalledTasks.filter(
    (task) =>
      getHoursSince(task.updated_at || task.created_at) <= 6
  );
  const staleApprovalTasks = pendingTasks.filter(
    (task) =>
      getHoursSince(task.updated_at || task.created_at) > 12
  );
  const completedRecently = tasks.filter(
    (task) =>
      getTaskStatus(task) === "completed" &&
      getHoursSince(task.updated_at || task.created_at) <= 24
  );
  const recentEvents = aiEvents.filter(
    (event) => getHoursSince(event.created_at) <= 24
  );
  const recentExecutionEvents = recentEvents.filter((event) => {
    const type = event.type?.toLowerCase() || "";

    return (
      type === "task_executed" ||
      type === "workflow_state_propagated" ||
      type === "workflow_run_requested"
    );
  });
  const recentEscalationEvents = recentEvents.filter((event) => {
    const type = event.type?.toLowerCase() || "";

    return (
      type === "task_escalated" ||
      event.message?.toLowerCase().includes("escalat")
    );
  });
  const highIntentAgingLeads = leads.filter(
    (lead) =>
      ((lead.intent_score ?? 0) >= 70 ||
        lead.urgency === "high") &&
      getHoursSince(lead.updated_at) > 24
  );
  const humanInterventionLoad =
    pendingTasks.length +
    escalatedTasks.length +
    blockedTasks.length;
  const queueSaturation = activeTasks.length;
  const escalationLeadCount = new Set(
    escalatedTasks
      .map((task) => task.lead_id)
      .filter(Boolean)
  ).size;
  const approvalCongestion =
    pendingTasks.length >= 4 ||
    pendingTasks.filter(
      (task) =>
        getHoursSince(task.updated_at || task.created_at) >
        12
    ).length >= 2;
  const workflowSaturation =
    activeTasks.length >= 6 ||
    activeTasks.length > Math.max(3, leads.length * 0.45);
  const executionDecay =
    approvedTasks.length > completedRecently.length &&
    stalledTasks.some(
      (task) => getTaskStatus(task) === "approved"
    );
  const operationalImbalance =
    humanInterventionLoad >
    Math.max(2, approvedTasks.length * 2);
  const executionPressure =
    stalledTasks.length >= 4 ||
    humanInterventionLoad >= 8
      ? "Critical"
      : stalledTasks.length >= 2 ||
        humanInterventionLoad >= 5
      ? "High"
      : activeTasks.length >= 4
      ? "Moderate"
      : "Low";
  const pipelineHealth =
    escalatedTasks.length >= 3
      ? "Escalated"
      : stalledTasks.length >= 3 ||
        highIntentAgingLeads.length >= 3
      ? "Delayed"
      : stalledTasks.length > 0 ||
        highIntentAgingLeads.length > 0
      ? "At Risk"
      : "Healthy";
  const warnings = [
    escalatedTasks.length >= 2
      ? "More deals now need human help"
      : "",
    highIntentAgingLeads.length > 0
      ? "Important leads have waited too long"
      : "",
    humanInterventionLoad >= 5
      ? "Too much work is waiting on people"
      : "",
    approvedTasks.length > 0 &&
    stalledTasks.some(
      (task) => getTaskStatus(task) === "approved"
    )
      ? "AI work is moving slower than expected"
      : "",
    pendingTasks.length >= 4
      ? "Too many approvals are waiting"
      : "",
  ].filter(Boolean);
  const recommendations = [
    stalledTasks.length > 0
      ? "Move stalled important deals ahead of new approvals."
      : "",
    escalatedTasks.length > 0
      ? "Clear the human blockers and send work back to AVERON."
      : "",
    pendingTasks.length >= 3
      ? "Approve routine work in batches so people can focus on hard cases."
      : "",
    highIntentAgingLeads.length > 0
      ? "Follow up with important buyers before the deal cools."
      : "",
    blockedTasks.length > 0
      ? "Unblock stuck work before adding more human review."
      : "",
  ].filter(Boolean);
  const priorityWorkflows = activeTasks
    .map((task) => {
      const lead = task.lead_id
        ? leadMap.get(task.lead_id)
        : undefined;
      const status = getTaskStatus(task);
      const highIntent =
        (lead?.intent_score ?? 0) >= 70 ||
        lead?.urgency === "high" ||
        task.priority === "high";
      const stalled = isStalledTask(task);
      const score =
        (stalled ? 100 : 0) +
        (status === "escalated" ? 90 : 0) +
        (status === "blocked" ? 80 : 0) +
        (highIntent ? 45 : 0) +
        Math.min(
          getHoursSince(task.updated_at || task.created_at),
          36
        );
      const tone: "danger" | "attention" | "active" =
        status === "escalated" || status === "blocked"
          ? "danger"
          : stalled || highIntent
          ? "attention"
          : "active";

      return {
        id: task.id,
        leadName: getLeadName(lead),
        task: getTaskTitle(task),
        reason: stalled
          ? "Workflow stalled"
          : status === "escalated"
          ? "Needs human help"
          : highIntent
          ? "Important deal"
          : "Active work",
        href: task.lead_id
          ? `/dashboard/leads/${task.lead_id}`
          : "/dashboard/tasks",
        tone,
        score,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((workflow) => ({
      id: workflow.id,
      leadName: workflow.leadName,
      task: workflow.task,
      reason: workflow.reason,
      href: workflow.href,
      tone: workflow.tone,
    }));
  const timelineSignals = [
    {
      title:
        executionPressure === "Critical" ||
        executionPressure === "High"
          ? "Execution pressure increased"
          : "Execution pressure stable",
      detail: `${activeTasks.length} active workflows with ${stalledTasks.length} stalled.`,
      cause: `${stalledTasks.length} stalled workflows are competing with ${activeTasks.length} active execution paths.`,
      impact:
        stalledTasks.length > 0
          ? "Operator focus is being pulled toward recovery work."
          : "Execution capacity is not currently constrained by stalled work.",
      response:
        stalledTasks.length > 0
          ? "Recover stalled paths before expanding new approvals."
          : "Keep current pace.",
      tone:
        executionPressure === "Critical"
          ? "danger"
          : executionPressure === "High"
          ? "attention"
          : "stable",
    },
    {
      title:
        escalatedTasks.length > 1
          ? "Escalation load elevated"
          : "Escalation queue stable",
      detail: `${escalatedTasks.length} workflows require human intervention.`,
      cause: `${escalatedTasks.length} escalated workflows are owned by human review.`,
      impact:
        escalatedTasks.length > 1
          ? "Too many hard cases can slow the team down."
          : "Human help is not overloaded.",
      response:
        escalatedTasks.length > 1
          ? "Clear the human-help cases before approving new work."
          : "Keep watching new human-help requests.",
      tone:
        escalatedTasks.length > 1
          ? "attention"
          : "stable",
    },
    {
      title:
        completedRecently.length > stalledTasks.length
          ? "Deals are recovering"
          : "Deal recovery needs attention",
      detail: `${completedRecently.length} executions completed in the last 24 hours.`,
      cause: `${completedRecently.length} workflows completed recently versus ${stalledTasks.length} currently stalled.`,
      impact:
        completedRecently.length > stalledTasks.length
          ? "AVERON is clearing more work than is getting stuck."
          : "Stuck work is still building faster than recovery.",
      response:
        completedRecently.length > stalledTasks.length
          ? "Push important active deals while work is moving."
          : "Focus on stuck work until completions catch up.",
      tone:
        completedRecently.length > stalledTasks.length
          ? "active"
          : stalledTasks.length > 0
          ? "attention"
          : "stable",
    },
    {
      title:
        humanInterventionLoad >= 5
          ? "Too much work is waiting on people"
          : "Human review is manageable",
      detail: `${humanInterventionLoad} operator-owned decisions are open.`,
      cause: `${pendingTasks.length} approvals, ${escalatedTasks.length} escalations, and ${blockedTasks.length} blocked paths require human input.`,
      impact:
        humanInterventionLoad >= 5
          ? "People are becoming the slowest part of the process."
          : "People can handle the current review load.",
      response:
        humanInterventionLoad >= 5
          ? "Let AVERON take routine approvals back."
          : "Keep people focused on exceptions.",
      tone:
        humanInterventionLoad >= 5
          ? "danger"
          : humanInterventionLoad >= 3
          ? "attention"
          : "stable",
    },
  ]
    .sort((left, right) => {
      const priority: Record<string, number> = {
        danger: 4,
        attention: 3,
        active: 2,
        stable: 1,
      };

      return priority[right.tone] - priority[left.tone];
    }) as RevenueIntelligence["timelineSignals"];
  const systemicThreats = [
    escalationLeadCount >= 2
      ? {
          title: "More deals now need human help",
          detail: `${escalationLeadCount} deals are waiting for human help.`,
          tone: "danger" as const,
        }
      : null,
    workflowSaturation
      ? {
          title: "Too much work is active at once",
          detail: `${activeTasks.length} active items are competing for attention.`,
          tone: "attention" as const,
        }
      : null,
    executionDecay
      ? {
          title: "Work is slowing down",
          detail: "Approved work is waiting longer than completed work.",
          tone: "danger" as const,
        }
      : null,
    approvalCongestion
      ? {
          title: "Too many approvals are waiting",
          detail: `${pendingTasks.length} items need a decision before they can move.`,
          tone: "attention" as const,
        }
      : null,
    highIntentAgingLeads.length > 0
      ? {
          title: "Important buyers are waiting too long",
          detail: `${highIntentAgingLeads.length} important buyer path needs attention.`,
          tone: "danger" as const,
        }
      : null,
    operationalImbalance
      ? {
          title: "People are becoming overloaded",
          detail: "More work is waiting on people than AVERON is carrying.",
          tone: "attention" as const,
        }
      : null,
  ].filter(Boolean) as RevenueIntelligence["systemicThreats"];
  const executivePosture =
    systemicThreats.some((threat) => threat.tone === "danger")
      ? "Intervene"
      : operationalImbalance || workflowSaturation
      ? "Rebalance"
      : completedRecently.length > stalledTasks.length &&
        recentExecutionEvents.length > recentEscalationEvents.length
      ? "Accelerate"
      : "Monitor";
  const executiveNarrative =
    executivePosture === "Intervene"
      ? {
          title: "Human attention is required",
          detail:
            "Important or stuck deals need attention before routine work continues.",
          tone: "danger" as const,
        }
      : executivePosture === "Rebalance"
      ? {
          title: "Work should be rebalanced",
          detail:
            "Too much work is waiting on people, and AVERON can take routine work back.",
          tone: "attention" as const,
        }
      : executivePosture === "Accelerate"
      ? {
          title: "Work is starting to move again",
          detail:
            "More work is getting completed than stuck. AVERON can carry more routine tasks.",
          tone: "active" as const,
        }
      : {
          title: "Work is stable",
          detail:
            "No major issue is currently slowing the operation.",
          tone: "stable" as const,
        };
  const interventions = [
    highIntentAgingLeads.length > 0 || stalledTasks.length > 0
      ? {
          title: "Move important stuck deals to the top",
          directive:
            "Handle delayed important deals before routine approvals.",
          href: "/dashboard/tasks",
          tone: "danger" as const,
        }
      : null,
    pendingTasks.length >= 3
      ? {
          title: "Let AVERON take routine approvals back",
          directive:
            "Approve routine work in batches so people can focus on harder deals.",
          href: "/dashboard/tasks",
          tone: "attention" as const,
        }
      : null,
    escalatedTasks.length > 0
      ? {
          title: "Clear the deals waiting on people",
          directive:
            "Fix human blockers and send eligible work back to AVERON.",
          href: "/dashboard/tasks",
          tone: "danger" as const,
        }
      : null,
    highIntentAgingLeads.length > 0
      ? {
          title: "Recover delayed enterprise conversations",
          directive:
            "Follow up with important buyers before the deal cools.",
          href: "/dashboard/conversations",
          tone: "attention" as const,
        }
      : null,
    approvedTasks.length > 0 && stalledTasks.length === 0
      ? {
          title: "Move important active deals faster",
          directive:
            "Keep AVERON moving active deals while workload is under control.",
          href: "/dashboard/tasks",
          tone: "active" as const,
        }
      : null,
  ]
    .filter(Boolean)
    .slice(0, 4) as RevenueIntelligence["interventions"];
  const operationSignals = [
    {
      label:
        executionDecay
          ? "Work slowing"
          : completedRecently.length > stalledTasks.length
          ? "Work recovering"
          : "Work steady",
      value: `${completedRecently.length}/${stalledTasks.length}`,
      tone:
        executionDecay
          ? "danger"
          : completedRecently.length > stalledTasks.length
          ? "active"
          : "stable",
    },
    {
      label:
        recentEscalationEvents.length >= 2
          ? "More deals need people"
          : "Human help stable",
      value: String(recentEscalationEvents.length),
      tone:
        recentEscalationEvents.length >= 2
          ? "danger"
          : "stable",
    },
    {
      label:
        approvalCongestion
          ? "Approvals slowing work"
          : "Approvals controlled",
      value: String(pendingTasks.length),
      tone: approvalCongestion ? "attention" : "stable",
    },
    {
      label:
        pipelineHealth === "Healthy"
          ? "Pipeline stable"
          : "Pipeline weakening",
      value: pipelineHealth,
      tone:
        pipelineHealth === "Healthy"
          ? "stable"
          : pipelineHealth === "Escalated" ||
            pipelineHealth === "Delayed"
          ? "danger"
          : "attention",
    },
  ] as RevenueIntelligence["operationSignals"];
  const primarySignal =
    systemicThreats.some(
      (threat) =>
        threat.title === "Important buyers are waiting too long"
    )
      ? {
          label: "Primary Executive Signal",
          title: l("Important deals need attention", "Важные сделки требуют внимания"),
          detail:
            l("High-potential deals have waited too long while other work is building up.", "Сделки с высоким потенциалом ждут слишком долго, пока другая работа копится."),
          tone: "danger" as const,
        }
      : escalationLeadCount >= 2
      ? {
          label: "Primary Executive Signal",
          title: l("More deals now require human involvement", "Нужна помощь человека"),
          detail:
            l("Several deals now need a person before they can move forward.", "Часть сделок не двигается без ручного решения."),
          tone: "danger" as const,
        }
      : executionDecay
      ? {
          label: "Primary Executive Signal",
          title: l("Work is moving slower than expected", "Работа движется медленнее ожидаемого"),
          detail:
            l("Approved work is waiting longer than completed work.", "Одобренная работа ждет дольше, чем завершается выполненная."),
          tone: "danger" as const,
        }
      : approvalCongestion || operationalImbalance
      ? {
          label: "Primary Executive Signal",
          title: l("Too many approvals are waiting", "Слишком много одобрений ждут"),
          detail:
            l("People are approving work slower than AVERON can execute it.", "Люди одобряют работу медленнее, чем AVERON может ее выполнять."),
          tone: "attention" as const,
        }
      : completedRecently.length > stalledTasks.length
      ? {
          label: "Primary Executive Signal",
          title: l("Work is starting to move again", "Работа снова начинает двигаться"),
          detail:
            l("More work is getting completed than stuck.", "Завершается больше работы, чем застревает."),
          tone: "active" as const,
        }
      : {
          label: "Primary Executive Signal",
          title: l("Execution Stabilizing", "Выполнение стабилизируется"),
          detail:
            l("No major issue is currently slowing the operation.", "Сейчас нет крупной проблемы, которая замедляет работу."),
          tone: "stable" as const,
        };
  const causalReasons = [
    stalledTasks.length > 0
      ? l(`${stalledTasks.length} stalled workflow${stalledTasks.length === 1 ? "" : "s"} detected${stalledLastSixHours.length > 0 ? `, ${stalledLastSixHours.length} updated in the last 6h` : ""}.`, `${stalledTasks.length} застрявших процессов обнаружено${stalledLastSixHours.length > 0 ? `, ${stalledLastSixHours.length} обновлены за последние 6 ч` : ""}.`)
      : "",
    highIntentAgingLeads.length > 0
      ? l(`${highIntentAgingLeads.length} important lead${highIntentAgingLeads.length === 1 ? "" : "s"} aged beyond 24h.`, `${highIntentAgingLeads.length} важных лидов ждут больше 24 ч.`)
      : "",
    escalationLeadCount > 0
      ? l(`${escalationLeadCount} lead path${escalationLeadCount === 1 ? "" : "s"} concentrated in escalation.`, `${escalationLeadCount} путей лидов сосредоточены в эскалации.`)
      : "",
    staleApprovalTasks.length > 0
      ? l(`${staleApprovalTasks.length} approval${staleApprovalTasks.length === 1 ? "" : "s"} waiting longer than 12h.`, `${staleApprovalTasks.length} одобрений ждут больше 12 ч.`)
      : "",
    completedRecently.length > stalledTasks.length
      ? l(`Work is recovering: ${completedRecently.length} completed vs ${stalledTasks.length} stalled.`, `Работа восстанавливается: ${completedRecently.length} завершено против ${stalledTasks.length} застрявших.`)
      : "",
  ].filter(Boolean);
  const executiveActionPath =
    systemicThreats.some(
      (threat) =>
        threat.title === "Important buyers are waiting too long"
    )
      ? {
          title: l("Move important stuck deals to the top", "Поднять важные застрявшие сделки наверх"),
          directive:
            l("Handle high-potential delayed deals before routine approvals.", "Сначала разберите задержанные сделки с высоким потенциалом, потом рутинные одобрения."),
          href: "/dashboard/tasks",
          tone: "danger" as const,
        }
      : escalationLeadCount >= 2
      ? {
          title: l("Handle the deals waiting on people first", "Сначала разобрать сделки, которые ждут людей"),
          directive:
            l("Clear human blockers, then send eligible work back to AVERON.", "Снимите человеческие блокеры, затем верните подходящую работу AVERON."),
          href: "/dashboard/tasks",
          tone: "danger" as const,
        }
      : approvalCongestion || operationalImbalance
      ? {
          title: l("Let AVERON take routine approvals back", "Вернуть рутинные одобрения AVERON"),
          directive:
            l("Reduce human workload by approving routine tasks in batches.", "Снизьте нагрузку на людей, одобряя рутинные задачи пакетами."),
          href: "/dashboard/tasks",
          tone: "attention" as const,
        }
      : completedRecently.length > stalledTasks.length
      ? {
          title: l("Move important active deals faster", "Ускорить важные активные сделки"),
          directive:
            l("Use the current momentum to push active deals forward.", "Используйте текущий темп, чтобы продвинуть активные сделки."),
          href: "/dashboard/tasks",
          tone: "active" as const,
        }
      : {
          title: l("Keep watching and keep work moving", "Продолжать наблюдение и движение работы"),
          directive:
            l("No major action is needed. Keep AVERON moving routine work.", "Крупных действий не нужно. Пусть AVERON продолжает рутинную работу."),
          href: "/dashboard/tasks",
          tone: "active" as const,
        };
  const lowRiskApprovalCount = pendingTasks.filter((task) => {
    const lead = task.lead_id
      ? leadMap.get(task.lead_id)
      : undefined;

    return (
      task.priority !== "high" &&
      lead?.urgency !== "high" &&
      (lead?.intent_score ?? 0) < 70
    );
  }).length;
  const enterpriseRecoveryCount = activeTasks.filter((task) => {
    const lead = task.lead_id
      ? leadMap.get(task.lead_id)
      : undefined;

    return (
      ((lead?.intent_score ?? 0) >= 70 ||
        lead?.urgency === "high" ||
        task.priority === "high") &&
      (isStalledTask(task) ||
        getTaskStatus(task) === "escalated" ||
        getTaskStatus(task) === "blocked")
    );
  }).length;
  const aiBandwidthAvailable =
    approvedTasks.length < Math.max(2, pendingTasks.length) &&
    escalatedTasks.length < humanInterventionLoad;
  const coordinationPlan =
    enterpriseRecoveryCount > 0
      ? {
          title: l("High-potential stalled deals moved to the top", "Застрявшие сделки с высоким потенциалом подняты наверх"),
          directive:
            l("People should focus on important stuck deals while AVERON handles routine work.", "Люди должны заняться важными застрявшими сделками, пока AVERON ведет рутину."),
          tone: "danger" as const,
        }
      : humanInterventionLoad >= 5 && lowRiskApprovalCount > 0
      ? {
          title: l("Too many approvals are waiting", "Слишком много одобрений ждут"),
          directive:
            l("AVERON can take some routine approvals back so people are less overloaded.", "AVERON может забрать часть рутинных одобрений, чтобы разгрузить людей."),
          tone: "attention" as const,
        }
      : aiBandwidthAvailable
      ? {
          title: l("AVERON can carry more routine work", "AVERON может взять больше рутинной работы"),
          directive:
            l("Routine work can stay with AVERON while people handle exceptions.", "Рутина может оставаться у AVERON, пока люди занимаются исключениями."),
          tone: "active" as const,
        }
      : {
          title: l("Workload is balanced", "Нагрузка сбалансирована"),
          directive:
            l("AVERON and people are carrying the right kinds of work.", "AVERON и люди ведут подходящие типы работы."),
          tone: "stable" as const,
        };
  const ownershipDirectives = [
    {
      owner: "AI" as const,
      title:
        lowRiskApprovalCount > 0
          ? "AVERON should take routine approvals back"
          : "AVERON owns active work",
      detail:
        lowRiskApprovalCount > 0
          ? `${lowRiskApprovalCount} routine approval path${
              lowRiskApprovalCount === 1 ? "" : "s"
            } can move away from people.`
          : `${approvedTasks.length} workflow${
              approvedTasks.length === 1 ? "" : "s"
            } already sit with AVERON.`,
      tone:
        lowRiskApprovalCount > 0
          ? ("active" as const)
          : ("stable" as const),
    },
    {
      owner: "Human" as const,
      title:
        escalatedTasks.length > 0 || blockedTasks.length > 0
          ? "People should handle only the hard cases"
          : "People are not overloaded",
      detail:
        escalatedTasks.length > 0 || blockedTasks.length > 0
          ? `${escalatedTasks.length} escalated and ${blockedTasks.length} blocked workflow${
              escalatedTasks.length + blockedTasks.length === 1 ? "" : "s"
            } should stay with people.`
          : "No group of hard cases is forcing broad human review.",
      tone:
        escalatedTasks.length > 0 || blockedTasks.length > 0
          ? ("attention" as const)
          : ("stable" as const),
    },
  ];
  const executionPriorityPath = [
    enterpriseRecoveryCount > 0
      ? {
          label: l("1. Important stuck deals", "1. Важные застрявшие сделки"),
          detail: l(`${enterpriseRecoveryCount} high-potential delayed path${enterpriseRecoveryCount === 1 ? "" : "s"} should be handled first.`, `${enterpriseRecoveryCount} задержанных путей с высоким потенциалом нужно разобрать первыми.`),
          tone: "danger" as const,
        }
      : null,
    escalatedTasks.length > 0
      ? {
          label: l("2. Deals needing people", "2. Сделки, где нужны люди"),
          detail:
            l("People should handle hard cases before routine approvals.", "Сначала сложные случаи, потом рутинные одобрения."),
          tone: "attention" as const,
        }
      : null,
    lowRiskApprovalCount > 0
      ? {
          label: l("3. Routine approvals", "3. Рутинные одобрения"),
          detail:
            l("AVERON should take routine approvals back.", "AVERON должен забрать рутинные одобрения."),
          tone: "active" as const,
        }
      : null,
    approvedTasks.length > 0
      ? {
          label: l("4. Active AVERON work", "4. Активная работа AVERON"),
          detail:
            l("Keep delegated work moving and watch for slowdowns.", "Двигайте делегированную работу и следите за замедлениями."),
          tone: "active" as const,
        }
      : null,
  ].filter(Boolean) as RevenueIntelligence["executionPriorityPath"];
  const priorityObjects = activeTasks
    .map((task) => {
      const lead = task.lead_id
        ? leadMap.get(task.lead_id)
        : undefined;
      const status = getTaskStatus(task);
      const highIntent =
        (lead?.intent_score ?? 0) >= 70 ||
        lead?.urgency === "high" ||
        task.priority === "high";
      const stalled = isStalledTask(task);
      const escalated = status === "escalated";
      const blocked = status === "blocked";
      const waitingTimestamp =
        task.updated_at ||
        task.created_at ||
        lead?.updated_at;
      const score =
        (highIntent ? 80 : 0) +
        (stalled ? 70 : 0) +
        (escalated ? 65 : 0) +
        (blocked ? 60 : 0) +
        Math.min(getHoursSince(waitingTimestamp), 48);

      return {
        id: task.id,
        leadName: getLeadName(lead),
        state: escalated
          ? l("Escalated", "Передано человеку")
          : blocked
          ? l("Blocked", "Заблокировано")
          : stalled
          ? l("Stalled", "Застряло")
          : status === "approved"
          ? l("AI execution", "AI выполняет")
          : l("Awaiting approval", "Ждет одобрения"),
        urgency: lead?.urgency || task.priority || "normal",
        intent:
          typeof lead?.intent_score === "number"
            ? String(lead.intent_score)
            : "unknown",
        waiting: formatWaitingTime(waitingTimestamp, language),
        risk: highIntent
          ? l("High-intent decay risk", "Риск остывания высокого интента")
          : escalated || blocked
          ? l("Human blocker", "Человеческий блокер")
          : stalled
          ? l("Workflow aging", "Процесс стареет")
          : l("Execution queue", "Очередь выполнения"),
        recommendation:
          lead?.recommendation ||
          task.task ||
          l("Continue revenue execution.", "Продолжать выполнение revenue-задачи."),
        href: task.lead_id
          ? `/dashboard/leads/${task.lead_id}`
          : "/dashboard/tasks",
        tone:
          escalated || blocked || (highIntent && stalled)
            ? ("danger" as const)
            : stalled || highIntent
            ? ("attention" as const)
            : ("active" as const),
        score,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((object) => ({
      id: object.id,
      leadName: object.leadName,
      state: object.state,
      urgency: object.urgency,
      intent: object.intent,
      waiting: object.waiting,
      risk: object.risk,
      recommendation: object.recommendation,
      href: object.href,
      tone: object.tone,
    }));
  const highestImpactWorkflow =
    priorityObjects[0]?.leadName || l("No active priority object", "Нет активного приоритетного объекта");
  const coordinationEvidence = {
    approvalsWaiting: pendingTasks.length,
    lowRiskApprovals: lowRiskApprovalCount,
    escalations: escalatedTasks.length,
    stalledWorkflows: stalledTasks.length,
    highestImpactWorkflow,
    expectedImpact: [
      lowRiskApprovalCount > 0
        ? l(`${lowRiskApprovalCount} approval${lowRiskApprovalCount === 1 ? "" : "s"} recoverable by AI`, `${lowRiskApprovalCount} одобрений может забрать AI`)
        : "",
      escalatedTasks.length > 0
        ? l(`${escalatedTasks.length} escalation${escalatedTasks.length === 1 ? "" : "s"} isolated for human review`, `${escalatedTasks.length} эскалаций оставлены для человека`)
        : "",
      stalledTasks.length > 0
        ? l(`${stalledTasks.length} stalled workflow${stalledTasks.length === 1 ? "" : "s"} targeted for recovery`, `${stalledTasks.length} застрявших процессов взяты в восстановление`)
        : "",
      highIntentAgingLeads.length > 0
        ? l("high-intent response latency reduced", "задержка ответа по важным лидам снижена")
        : "",
    ].filter(Boolean),
  };

  return {
    pipelineHealth,
    executionPressure,
    escalationLoad: escalatedTasks.length,
    stalledCount: stalledTasks.length,
    activeAIExecutionCount: approvedTasks.length,
    humanInterventionLoad,
    approvalBacklog: pendingTasks.length,
    highIntentAgingCount: highIntentAgingLeads.length,
    aiWorkload: approvedTasks.length,
    humanWorkload: humanInterventionLoad,
    queueSaturation,
    throughput: completedRecently.length,
    warnings,
    recommendations:
      recommendations.length > 0
        ? recommendations
        : [
            "Maintain current execution rhythm and keep AI-owned workflows moving.",
          ],
    priorityWorkflows,
    timelineSignals,
    executivePosture,
    executiveNarrative,
    systemicThreats,
    interventions:
      interventions.length > 0
        ? interventions
        : [
            {
              title: "Maintain AI-managed execution rhythm",
              directive:
                "Keep current delegation model active and monitor for emerging pressure.",
              href: "/dashboard/tasks",
              tone: "active",
            },
          ],
    operationSignals,
    primarySignal,
    causalReasons:
      causalReasons.length > 0
        ? causalReasons
        : [
            l("No dominant systemic pressure detected from current task, lead, and event state.", "По текущим задачам, лидам и событиям нет главной системной проблемы."),
          ],
    executiveActionPath,
    coordinationPlan,
    ownershipDirectives,
    executionPriorityPath:
      executionPriorityPath.length > 0
        ? executionPriorityPath
        : [
            {
              label: l("1. Maintain balanced execution", "1. Сохранять сбалансированное выполнение"),
              detail:
                l("No redistribution is currently required; AI and human ownership remain stable.", "Перераспределение сейчас не нужно; зоны ответственности AI и людей стабильны."),
              tone: "active",
            },
          ],
    priorityObjects,
    coordinationEvidence,
  };
}

export default function DashboardPage() {
  const { language, t } = useLanguage();
  const [summary, setSummary] = useState<DashboardSummary>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [aiEvents, setAiEvents] = useState<AIEvent[]>([]);

  useEffect(() => {
    async function loadDashboard() {
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
      const nextLeads: Lead[] = leadsData.leads ?? [];
      const aiEventEntries = await Promise.all(
        nextLeads.slice(0, 25).map(async (lead) => {
          try {
            const response = await fetch(
              `/api/ai-events?leadId=${lead.id}`
            );
            const data = await response.json();

            return data.events ?? [];
          } catch (error) {
            console.error(
              "EXECUTIVE AI EVENT LOAD ERROR",
              error
            );

            return [];
          }
        })
      );

      setSummary(summaryData.summary ?? {});
      setLeads(nextLeads);
      setTasks(tasksData.tasks ?? []);
      setAiEvents(aiEventEntries.flat());
    }

    void loadDashboard();
  }, []);

  const intelligence =
    buildRevenueIntelligence(leads, tasks, aiEvents, language);

  const attentionBlocks: WorkflowBlock[] = [
    {
      title: t("executionQueue"),
      description: translate(language, "Open tasks that need approval, completion, or routing.", "Откройте задачи, которым нужно одобрение, завершение или новый маршрут."),
      href: "/dashboard/tasks",
      value: String(summary.tasksCount ?? 0),
      label: translate(language, "active tasks", "активных задач"),
      icon: CheckCircle2,
      tone: "attention",
    },
    {
      title: t("leads"),
      description: translate(language, "Inspect live leads before AI proceeds into next actions.", "Проверьте активных лидов перед следующим шагом AI."),
      href: "/dashboard/leads",
      value: String(summary.leadsCount ?? 0),
      label: translate(language, "tracked leads", "лидов"),
      icon: Users,
      tone: "attention",
    },
  ];

  const momentumBlocks: WorkflowBlock[] = [
    {
      title: translate(language, "Pipeline Movement", "Движение в pipeline"),
      description: translate(language, "Monitor where revenue work is progressing right now.", "Смотрите, где revenue-работа движется прямо сейчас."),
      href: "/dashboard/leads",
      value: "$847K",
      label: translate(language, "pipeline value", "pipeline"),
      icon: TrendingUp,
      tone: "momentum",
    },
    {
      title: t("conversations"),
      description: translate(language, "Review buyer replies and AI-assisted revenue context.", "Проверьте ответы покупателей и revenue-контекст от AI."),
      href: "/dashboard/conversations",
      value: String(summary.conversationsCount ?? 0),
      label: t("conversations").toLowerCase(),
      icon: MessageSquare,
      tone: "momentum",
    },
  ];

  const executionBlocks: WorkflowBlock[] = [
    {
      title: t("aiAgents"),
      description: translate(language, "View the autonomous roles coordinating revenue execution.", "Посмотрите автономные роли, которые координируют выполнение."),
      href: "/dashboard/agents",
      value: "4",
      label: translate(language, "active agents", "активных агентов"),
      icon: Bot,
      tone: "execution",
    },
    {
      title: translate(language, "Live AI Work", "Активная работа AI"),
      description: translate(language, "Jump into current workflow orchestration and outcomes.", "Перейдите к текущим процессам и результатам."),
      href: "/dashboard/tasks",
      value: String(summary.tasksCount ?? 0),
      label: translate(language, "AI actions", "действий AI"),
      icon: CheckCircle2,
      tone: "execution",
    },
  ];

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-8 text-white lg:px-10">
      <header className="flex flex-col gap-6 border-b border-zinc-900 pb-8 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
            {t("missionControl")}
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">
            {t("dashboardTitle")}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-500">
            {t("dashboardSubtitle")}
          </p>
        </div>

        <div className="operational-surface premium-card rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4">
          <div className="text-sm text-zinc-500">{t("systemStatus")}</div>
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold uppercase text-green-400">
            <span className="live-dot live-beacon h-2 w-2 rounded-full bg-green-400" />
            {t("operational")}
          </div>
        </div>
      </header>

      <div className="mt-8 space-y-8">
        <ExecutiveBriefing intelligence={intelligence} />

        <DashboardSection
          eyebrow={translate(language, "Requires Attention", "Требует внимания")}
          title={translate(language, "Human decisions that unblock revenue execution", "Решения человека, которые разблокируют revenue-работу")}
          blocks={attentionBlocks}
        />

        <DashboardSection
          eyebrow={translate(language, "Revenue Momentum", "Движение revenue")}
          title={translate(language, "Where pipeline work is moving", "Где сейчас движется pipeline")}
          blocks={momentumBlocks}
        />

        <DashboardSection
          eyebrow={translate(language, "Live AI Execution", "Живое выполнение AI")}
          title={translate(language, "Autonomous work currently carrying the system", "Автономная работа, которая сейчас держит систему")}
          blocks={executionBlocks}
        />
      </div>
    </main>
  );
}

function getToneTextClass(tone: string) {
  if (tone === "green" || tone === "stable") {
    return "text-green-300";
  }

  if (tone === "teal" || tone === "active") {
    return "text-[#00ffcc]";
  }

  if (tone === "yellow" || tone === "attention") {
    return "text-yellow-200";
  }

  if (tone === "red" || tone === "danger") {
    return "text-red-200";
  }

  return "text-zinc-300";
}

function getCommandPriorityClass(tone: string) {
  if (tone === "red" || tone === "danger") {
    return "command-priority-critical border-red-300/35";
  }

  if (tone === "yellow" || tone === "attention") {
    return "command-priority-danger border-yellow-300/30";
  }

  if (tone === "teal" || tone === "active") {
    return "command-priority-active border-[#00ffcc]/28";
  }

  if (tone === "green" || tone === "stable") {
    return "command-priority-stable border-zinc-800";
  }

  return "command-priority-passive border-zinc-900";
}

function SignalEvidence({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="text-xs uppercase tracking-[0.16em] text-zinc-600">
        {label}
      </div>
      <div className="mt-2 truncate text-lg font-semibold text-white">
        {value}
      </div>
      <div className="mt-1 text-xs text-zinc-500">
        {detail}
      </div>
    </div>
  );
}

function ExecutiveBriefing({
  intelligence,
}: {
  intelligence: RevenueIntelligence;
}) {
  const { language, t } = useLanguage();
  const visibleObjects =
    intelligence.priorityObjects.slice(0, 4);

  return (
    <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <div
        className={`operational-surface premium-card rounded-2xl border bg-zinc-950 p-7 ${getCommandPriorityClass(
          intelligence.primarySignal.tone
        )}`}
      >
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          1. {t("primaryProblem")}
        </div>
        <h2
          className={`mt-3 font-semibold tracking-tight ${
            language === "ru"
              ? "text-3xl leading-tight md:text-5xl md:leading-tight"
              : "text-4xl md:text-6xl"
          }`}
        >
          {intelligence.primarySignal.title}
        </h2>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-400">
          {intelligence.primarySignal.detail}
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <SignalEvidence
            label={t("stalled")}
            value={String(
              intelligence.coordinationEvidence.stalledWorkflows
            )}
            detail={t("workflows")}
          />
          <SignalEvidence
            label={t("approvals")}
            value={String(
              intelligence.coordinationEvidence.approvalsWaiting
            )}
            detail={t("waiting")}
          />
          <SignalEvidence
            label={t("escalated")}
            value={String(
              intelligence.coordinationEvidence.escalations
            )}
            detail={t("active").toLowerCase()}
          />
          <SignalEvidence
            label={t("topPath")}
            value={
              intelligence.coordinationEvidence
                .highestImpactWorkflow
            }
            detail={t("affected")}
          />
        </div>
      </div>

      <div
        className={`operational-surface premium-card rounded-2xl border bg-zinc-950 p-5 ${getCommandPriorityClass(
          intelligence.executiveActionPath.tone
        )}`}
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[#00ffcc]" />
          <div className="text-sm font-semibold text-white">
            3. {t("whatToDo")}
          </div>
        </div>

        <Link
          href={intelligence.executiveActionPath.href}
          className="command-action group mt-4 block rounded-xl border border-white/10 bg-black/30 p-4 transition hover:bg-white/[0.04]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xl font-semibold text-white">
                {intelligence.executiveActionPath.title}
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-400">
                {intelligence.executiveActionPath.directive}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:translate-x-1 group-hover:text-white" />
          </div>
        </Link>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
            5. {t("expectedImpact")}
          </div>
          <div className="mt-2 space-y-1.5 text-xs leading-5 text-zinc-400">
            {intelligence.coordinationEvidence.expectedImpact.length > 0 ? (
              intelligence.coordinationEvidence.expectedImpact.map(
                (impact) => (
                  <div key={impact}>{impact}</div>
                )
              )
            ) : (
              <div>
                {translate(
                  language,
                  "Maintain balanced execution pressure",
                  "Сохранять сбалансированную нагрузку"
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="operational-surface premium-card rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          2. {t("why")}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {intelligence.causalReasons.slice(0, 4).map((reason) => (
            <div
              key={reason}
              className="rounded-xl border border-zinc-800 bg-black/25 px-4 py-3 text-sm leading-6 text-zinc-300"
            >
              {reason}
            </div>
          ))}
        </div>
      </div>

      <div
        className={`rounded-2xl border bg-zinc-950/80 p-5 ${getCommandPriorityClass(
          intelligence.coordinationPlan.tone
        )}`}
      >
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          {t("coordinationPlan")}
        </div>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">
          {intelligence.coordinationPlan.title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          {intelligence.coordinationPlan.directive}
        </p>

        <div className="mt-4 space-y-2">
          {intelligence.executionPriorityPath.slice(0, 3).map((priority) => (
            <div
              key={priority.label}
              className="rounded-xl border border-white/10 bg-black/25 p-3"
            >
              <div
                className={`text-xs font-semibold uppercase tracking-[0.16em] ${getToneTextClass(
                  priority.tone
                )}`}
              >
                {priority.label}
              </div>
              <div className="mt-1 text-xs leading-5 text-zinc-500">
                {priority.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      {visibleObjects.length > 0 && (
        <div className="xl:col-span-2">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">
            4. {t("whatIsAffected")}
          </div>
          <div className="grid gap-3 xl:grid-cols-4">
            {visibleObjects.map((object) => (
              <Link
                key={object.id}
                href={object.href}
                className={`command-action rounded-2xl border bg-zinc-950/70 p-4 transition hover:bg-white/[0.04] ${getCommandPriorityClass(
                  object.tone
                )}`}
              >
                <div className="truncate text-sm font-semibold text-white">
                  {object.leadName}
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-600">
                  {object.state}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-400">
                  <div>
                    <span className="text-zinc-600">{t("urgency")}</span>
                    <div>{object.urgency}</div>
                  </div>
                  <div>
                    <span className="text-zinc-600">{t("intent")}</span>
                    <div>{object.intent}</div>
                  </div>
                  <div>
                    <span className="text-zinc-600">{t("wait")}</span>
                    <div>{object.waiting}</div>
                  </div>
                </div>
                <div className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-500">
                  {object.recommendation}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
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
      className={`operational-surface premium-card command-action group flex min-h-44 flex-col justify-between rounded-2xl border bg-zinc-950 p-6 hover:bg-[#101010] ${
        block.tone === "attention"
          ? "border-yellow-300/18 hover:border-yellow-300/30"
          : block.tone === "execution"
          ? "border-[#00ffcc]/18 hover:border-[#00ffcc]/30"
          : "border-zinc-800"
      }`}
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
