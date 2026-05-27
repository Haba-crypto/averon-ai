"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  AlertTriangle,
  CalendarClock,
  Check,
  Pencil,
  Play,
} from "lucide-react";

type Lead = {
  id: string;
  name: string;
  email: string;
  company?: string;
  status: string;
  intent_score: number;
  ai_notes?: string;
  urgency?: string;
  deal_risk?: string;
  recommendation?: string;
  close_probability?: number;
};

type Message = {
  role: string;
  message: string;
};

type AIAction = {
  type: string;
  message: string;
};

type AIEvent = {
  id: string;
  type: string;
  message: string;
  created_at: string;
};

type WorkflowAction = "approve" | "run";

type WorkflowActionStatus = {
  type: "success" | "error";
  message: string;
  detail?: string;
  action?: WorkflowAction;
};

const eventSequence = [
  "signal",
  "classification",
  "objection",
  "qualification",
  "recommendation",
  "next_action",
];

function getOperationalEventLabel(type: string) {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes("signal")) {
    return "Signal Detected";
  }

  if (normalizedType.includes("classification")) {
    return "Classification";
  }

  if (normalizedType.includes("objection")) {
    return "Objection Identified";
  }

  if (normalizedType.includes("qualification")) {
    return "Qualification Updated";
  }

  if (normalizedType.includes("recommendation")) {
    return "Recommendation Generated";
  }

  if (
    normalizedType.includes("action") ||
    normalizedType.includes("task")
  ) {
    return "Next Action Created";
  }

  return type.replaceAll("_", " ");
}

function getOperationalEventOrder(type: string) {
  const normalizedType = type.toLowerCase();
  const index = eventSequence.findIndex((item) =>
    normalizedType.includes(item)
  );

  return index === -1 ? eventSequence.length : index;
}

function getEventTime(createdAt: string) {
  if (!createdAt) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function buildReasoningItems(lead: Lead) {
  const items = [];

  if (typeof lead.intent_score === "number") {
    items.push({
      title: "Why AI sees intent",
      detail: `Intent score is ${lead.intent_score}.`,
    });
  }

  if (lead.urgency) {
    items.push({
      title: "Why urgency changed",
      detail: `Current urgency is ${lead.urgency}.`,
    });
  }

  if (lead.deal_risk) {
    items.push({
      title: "Why risk exists",
      detail: lead.deal_risk,
    });
  }

  if (lead.ai_notes) {
    items.push({
      title: "Why AI thinks this",
      detail: lead.ai_notes,
    });
  }

  if (lead.recommendation) {
    items.push({
      title: "Why this recommendation exists",
      detail: lead.recommendation,
    });
  }

  return items;
}

export default function LeadPage() {

  const params =
    useParams();

  const leadId =
    params.id as string;

  const [lead, setLead] =
    useState<Lead | null>(
      null
    );

  const [messages, setMessages] =
    useState<Message[]>(
      []
    );

  const [actions, setActions] =
    useState<AIAction[]>(
      []
    );

  const [events, setEvents] =
    useState<AIEvent[]>(
      []
    );

  const [activeAgent, setActiveAgent] =
    useState("SDR Agent");

  const [thinkingStage, setThinkingStage] =
    useState("");

  const [input, setInput] =
    useState("");

  const [sending, setSending] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [workflowActionLoading, setWorkflowActionLoading] =
    useState<WorkflowAction | null>(null);

  const [workflowActionStatus, setWorkflowActionStatus] =
    useState<WorkflowActionStatus | null>(null);

  const [highlightedEventId, setHighlightedEventId] =
    useState<string | null>(null);

  const [leadStateUpdated, setLeadStateUpdated] =
    useState(false);

  const [workflowTaskCount, setWorkflowTaskCount] =
    useState(0);

  const knownEventIdsRef =
    useRef<Set<string>>(new Set());

  const lastLeadStateRef =
    useRef<string>("");

  const applyEvents = useCallback((
    nextEvents: AIEvent[],
    highlightNewEvents: boolean
  ) => {
    const previousEventIds =
      knownEventIdsRef.current;
    const nextEventIds =
      new Set(
        nextEvents.map((event) => event.id)
      );
    const newEvents =
      nextEvents.filter(
        (event) =>
          !previousEventIds.has(event.id)
      );

    setEvents(nextEvents);
    knownEventIdsRef.current =
      nextEventIds;

    if (
      highlightNewEvents &&
      previousEventIds.size > 0 &&
      newEvents.length > 0
    ) {
      setHighlightedEventId(
        newEvents[0].id
      );
    }
  }, []);

  const applyLeadState = useCallback((
    nextLead: Lead | null
  ) => {
    if (!nextLead) {
      setLead(null);
      return;
    }

    const nextSignature =
      [
        nextLead.status,
        nextLead.intent_score,
        nextLead.urgency,
        nextLead.recommendation,
        nextLead.close_probability,
      ].join("|");

    if (
      lastLeadStateRef.current &&
      lastLeadStateRef.current !==
        nextSignature
    ) {
      setLeadStateUpdated(true);
      window.setTimeout(() => {
        setLeadStateUpdated(false);
      }, 3600);
    }

    lastLeadStateRef.current =
      nextSignature;
    setLead(nextLead);
  }, []);

  useEffect(() => {

    async function loadData() {

      try {

        /* LOAD LEADS */

        const leadRes =
          await fetch(
            "/api/leads"
          );

        const leadData =
          await leadRes.json();

        const foundLead =
          leadData.leads?.find(
            (item: Lead) =>
              item.id ===
              leadId
          );

        applyLeadState(
          foundLead || null
        );

        /* LOAD MESSAGES */

        const msgRes =
          await fetch(
            `/api/messages?leadId=${leadId}`
          );

        const msgData =
          await msgRes.json();

        setMessages(
          msgData.messages ||
            []
        );

        /* LOAD EVENTS */

        const eventRes =
          await fetch(
            `/api/ai-events?leadId=${leadId}`
          );

        const eventData =
          await eventRes.json();

        applyEvents(
          eventData.events ||
            [],
          false
        );

        const tasksRes =
          await fetch("/api/tasks");

        const tasksData =
          await tasksRes.json();

        setWorkflowTaskCount(
          (
            tasksData.tasks || []
          ).filter(
            (task: {
              lead_id?: string | null;
              status?: string | null;
            }) =>
              task.lead_id === leadId &&
              task.status !== "completed"
          ).length
        );

      } catch (error) {

        console.error(error);

      }

      setLoading(false);

    }

    if (leadId) {

      void loadData();

    }

  }, [
    applyEvents,
    applyLeadState,
    leadId,
  ]);

  const refreshEvents = useCallback(async function refreshEvents() {

    try {

      const eventRes =
        await fetch(
          `/api/ai-events?leadId=${leadId}`
        );

      const eventData =
        await eventRes.json();

      applyEvents(
        eventData.events ||
          [],
        true
      );

    } catch (error) {

      console.error(error);

    }

  }, [
    applyEvents,
    leadId,
  ]);

  async function sendMessage() {

    if (!input.trim()) {
      return;
    }

    const userMessage = {

      role: "user",

      message: input,

    };

    setMessages((prev) => [
      ...prev,
      userMessage,
    ]);

    const currentInput =
      input;

    setInput("");

    setSending(true);

    /* THINKING STAGES */

    setThinkingStage(
      "Research Agent analyzing company..."
    );

    setTimeout(() => {

      setThinkingStage(
        "Closer Agent evaluating urgency..."
      );

    }, 1200);

    setTimeout(() => {

      setThinkingStage(
        "AVERON generating strategy..."
      );

    }, 2400);

    try {

      const response =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              leadId,
              message:
                currentInput,
            }),
          }
        );

      const data =
        await response.json();

      if (data.reply) {

        setMessages((prev) => [

          ...prev,

          {
            role:
              "assistant",

            message:
              data.reply,
          },

        ]);

      }

      if (data.actions) {

        setActions((prev) => [

          ...data.actions,

          ...prev,

        ]);

      }

      if (data.lead) {

        setLead(
          data.lead
        );

      }

      if (data.activeAgent) {

        setActiveAgent(
          data.activeAgent
        );

      }

      /* REFRESH EVENTS */

      await refreshEvents();

    } catch (error) {

      console.error(error);

    }

    setThinkingStage("");

    setSending(false);

  }

  const refreshOperationalState = useCallback(async function refreshOperationalState() {
    try {
      const [
        leadsRes,
        eventRes,
        tasksRes,
      ] = await Promise.all([
        fetch("/api/leads"),
        fetch(
          `/api/ai-events?leadId=${leadId}`
        ),
        fetch("/api/tasks"),
      ]);

      const leadsData =
        await leadsRes.json();
      const eventData =
        await eventRes.json();
      const tasksData =
        await tasksRes.json();
      const foundLead =
        leadsData.leads?.find(
          (item: Lead) =>
            item.id === leadId
        ) || null;

      applyLeadState(foundLead);
      applyEvents(
        eventData.events || [],
        true
      );
      setWorkflowTaskCount(
        (
          tasksData.tasks || []
        ).filter(
          (task: {
            lead_id?: string | null;
            status?: string | null;
          }) =>
            task.lead_id === leadId &&
            task.status !== "completed"
        ).length
      );
    } catch (error) {
      console.error(
        "LIVE OPERATIONAL REFRESH ERROR",
        error
      );
    }
  }, [
    applyEvents,
    applyLeadState,
    leadId,
  ]);

  useEffect(() => {
    if (!highlightedEventId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setHighlightedEventId(null);
    }, 5200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [highlightedEventId]);

  useEffect(() => {
    if (!leadId || loading) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshOperationalState();
    }, 10000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    leadId,
    loading,
    refreshOperationalState,
  ]);

  if (loading) {

    return (

      <div className="flex h-screen items-center justify-center bg-[#050505] text-zinc-500">

        Loading workspace...

      </div>

    );

  }

  if (!lead) {

    return (

      <div className="flex h-screen items-center justify-center bg-[#050505] text-red-500">

        Lead not found

      </div>

    );

  }

  async function executeAction(
    action: WorkflowAction,
    recommendation: string
  ) {

    const safeRecommendation =
      recommendation.trim() ||
      lead?.recommendation?.trim() ||
      "Continue qualification.";

    if (
      workflowActionLoading
    ) {
      return;
    }

    setWorkflowActionLoading(action);
    setWorkflowActionStatus(null);

    try {

      const response =
        await fetch(
          "/api/workflow-actions",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              leadId,
              action,
              recommendation:
                safeRecommendation,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Workflow action failed"
        );
      }

      setWorkflowActionStatus({
        type:
          data.warning &&
          !data.task
            ? "error"
            : "success",
        action,
        message: data.warning
          ? action === "approve"
            ? "Recommendation approved"
            : "Execution initiated"
          : action === "approve"
          ? "Recommendation approved"
          : "Execution initiated",
        detail: data.warning
          ? "Action recorded. Review task queue if follow-up is missing."
          : action === "approve"
          ? "This recommendation has entered the revenue execution queue."
          : "AVERON AI created an execution task and activated the workflow trail.",
      });

      if (data.event?.id) {
        setHighlightedEventId(
          data.event.id
        );
      }

      try {
        await refreshOperationalState();
      } catch (refreshError) {
        console.error(
          "WORKFLOW ACTION TIMELINE REFRESH ERROR",
          refreshError
        );
      }

    } catch (error) {

      setWorkflowActionStatus({
        type: "error",
        action,
        message:
          error instanceof Error
            ? error.message
            : "Workflow action failed",
        detail:
          "The action was not committed. Review the issue and try again.",
      });

    }

    setWorkflowActionLoading(null);

  }

  const operationalEvents = [...events].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime();
    const rightTime = new Date(right.created_at).getTime();

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return (
      getOperationalEventOrder(left.type) -
      getOperationalEventOrder(right.type)
    );
  });

  const reasoningItems =
    buildReasoningItems(lead);

  return (

    <div className="flex h-screen overflow-hidden bg-[#050505] text-white">

      {/* LEFT SIDEBAR */}

      <div className="w-[240px] shrink-0 overflow-y-auto border-r border-white/10 bg-black/20 backdrop-blur-xl 2xl:w-[280px]">

        <div className="p-5 2xl:p-6">

          <div className="mb-3 text-xs uppercase tracking-[0.3em] text-zinc-500">

            Lead Intelligence

          </div>

          <h1 className="text-2xl font-semibold tracking-tight 2xl:text-4xl">

            {lead.name}

          </h1>

          <div className="mt-3 truncate text-sm text-zinc-500">

            {lead.email}

          </div>

        </div>

        <div className="space-y-3 px-4 pb-5 2xl:px-5">

          <div
            className={`operational-surface premium-card grid grid-cols-2 gap-3 rounded-2xl border bg-white/[0.025] p-4 transition ${
              leadStateUpdated
                ? "execution-pulse border-[#00ffcc]/25 shadow-[0_0_30px_rgba(0,255,204,0.08)]"
                : "border-white/10"
            }`}
          >

            <div>

              <div className="text-xs text-zinc-500">

                Intent Score

              </div>

              <div className="mt-2 text-3xl font-semibold">

                {lead.intent_score}

              </div>

            </div>

            <div>

              <div className="text-xs text-zinc-500">

                Status

              </div>

              <div className="mt-2 truncate text-sm font-medium text-[#00ffcc] transition-opacity duration-500">

                {lead.status}

              </div>

            </div>

          </div>

          <div className="operational-surface premium-card rounded-2xl border border-white/10 bg-white/[0.025] p-4">

            <div className="mb-4 text-xs uppercase tracking-[0.2em] text-zinc-500">

              AI Memory

            </div>

            <div className="space-y-4 text-sm leading-6 text-zinc-400">

              <div>

                <div className="mb-1 text-zinc-500">

                  Company

                </div>

                <div className="text-white">

                  {lead.company ||
                    "Unknown"}

                </div>

              </div>

              <div>

                <div className="mb-1 text-zinc-500">

                  AI Notes

                </div>

                <div>

                  {lead.ai_notes ||
                    "No AI notes yet."}

                </div>

              </div>

            </div>

          </div>

          {/* LIVE ACTIONS */}

          <div className="operational-surface premium-card rounded-2xl border border-white/10 bg-white/[0.02] p-4">

            <div className="mb-4 text-xs uppercase tracking-[0.2em] text-zinc-500">

              Live AI Actions

            </div>

            <div className="space-y-3">

              {actions.length ===
              0 ? (

                <div className="text-sm text-zinc-500">

                  No AI actions yet.

                </div>

              ) : (

                actions.map(
                  (
                    action,
                    index
                  ) => (

                    <div
                      key={index}
                      className="message-surface execution-pulse rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300"
                    >

                      <div className="text-xs uppercase tracking-[0.18em] text-[#00ffcc]">

                        {action.type}

                      </div>

                      <div className="mt-2 leading-6">

                        {action.message}

                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">

                        {[
                          "Approve",
                          "Run",
                          "Edit",
                        ].map(
                          (
                            label
                          ) => (

                            <button
                              key={label}
                              type="button"
                              onClick={() => {
                                if (
                                  label ===
                                  "Approve"
                                ) {
                                  void executeAction(
                                    "approve",
                                    action.message
                                  );
                                }

                                if (
                                  label ===
                                  "Run"
                                ) {
                                  void executeAction(
                                    "run",
                                    action.message
                                  );
                                }
                              }}
                              disabled={
                                label === "Edit" ||
                                Boolean(
                                  workflowActionLoading
                                )
                              }
                              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-[#00ffcc]/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                            >

                              {workflowActionLoading &&
                              label.toLowerCase() ===
                                workflowActionLoading
                                ? "Working..."
                                : label}

                            </button>

                          )
                        )}

                      </div>

                    </div>

                  )
                )

              )}

            </div>

          </div>

        </div>

      </div>

      {/* CENTER */}

      <div className="flex min-w-0 flex-1 flex-col">

        {/* HEADER */}

        <div className="flex items-center justify-between gap-6 border-b border-white/10 px-8 py-6 2xl:px-12">

          <div>

            <div className="mb-2 text-xs uppercase tracking-[0.3em] text-zinc-500">

              AVERON AI Workspace

            </div>

            <h1 className="text-3xl font-semibold tracking-tight 2xl:text-4xl">

              Conversation Intelligence

            </h1>

          </div>

          <div className="execution-pulse shrink-0 rounded-full border border-[#00ffcc]/35 bg-[#00ffcc]/15 px-4 py-2 text-sm font-medium text-[#00ffcc] shadow-[0_0_28px_rgba(0,255,204,0.12)]">

            {activeAgent}

          </div>

        </div>

        {/* CHAT */}

        <div className="flex-1 overflow-y-auto px-8 py-10 2xl:px-12">

          <div className="mx-auto flex max-w-5xl flex-col gap-7">

            {messages.map(
              (
                message,
                index
              ) => (

                <div
                  key={index}
                  className={`flex ${
                    message.role ===
                    "assistant"
                      ? "justify-start"
                      : "justify-end"
                  }`}
                >

                  <div
                    className={`message-surface max-w-[780px] rounded-[30px] px-7 py-5 text-[15px] leading-8 ${
                      message.role ===
                      "assistant"
                        ? "premium-card border border-white/10 bg-white/[0.04] shadow-[0_18px_48px_rgba(0,0,0,0.24)]"
                        : "bg-white text-black shadow-[0_18px_48px_rgba(255,255,255,0.08)]"
                    }`}
                  >

                    {message.message}

                  </div>

                </div>

              )
            )}

            {sending && (

              <div className="flex justify-start">

                <div className="message-surface execution-pulse premium-card rounded-[30px] border border-[#00ffcc]/20 bg-white/[0.04] px-7 py-5 text-zinc-300">

                  <div className="flex items-center gap-4">

                    <span>
                      {thinkingStage}
                    </span>

                    <span className="flex items-center gap-1">
                      <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[#00ffcc]" />
                      <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[#00ffcc]" />
                      <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[#00ffcc]" />
                    </span>

                  </div>

                </div>

              </div>

            )}

          </div>

        </div>

        {/* INPUT */}

        <div className="command-surface border-t border-white/10 px-8 py-5 2xl:px-12">

          <div className="mx-auto flex max-w-5xl gap-4">

            <input
              value={input}
              onChange={(e) =>
                setInput(
                  e.target.value
                )
              }
              onKeyDown={(e) => {

                if (
                  e.key ===
                  "Enter"
                ) {

                  sendMessage();

                }

              }}
              placeholder="Ask AVERON AI..."
              className="focus-field h-[64px] flex-1 rounded-3xl border border-white/10 bg-white/[0.04] px-6 text-sm outline-none placeholder:text-zinc-600"
            />

            <button
              onClick={
                sendMessage
              }
              disabled={sending}
              className="operational-surface rounded-3xl bg-white px-8 text-sm font-semibold text-black shadow-[0_16px_45px_rgba(255,255,255,0.08)] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >

              Send

            </button>

          </div>

        </div>

      </div>

      {/* RIGHT PANEL */}

      <div className="w-[260px] shrink-0 overflow-y-auto border-l border-white/10 bg-black/10 backdrop-blur-xl 2xl:w-[300px]">

        <div className="p-4 2xl:p-5">

          <div className="mb-4 text-xs uppercase tracking-[0.24em] text-zinc-500">

            AI Strategic Analysis

          </div>

          <div className="operational-surface premium-card mb-4 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">

            <div>

              <div className="text-xs text-zinc-500">

                Deal Health

              </div>

              <div className="mt-2 text-2xl font-semibold text-[#00ffcc]">

                {lead.urgency ===
                "high"
                  ? "Hot"
                  : lead.urgency ===
                    "medium"
                  ? "Warm"
                  : "Cold"}

              </div>

            </div>

            <div>

              <div className="text-xs text-zinc-500">

                Close

              </div>

              <div className="mt-2 text-2xl font-semibold">

                {lead.close_probability ||
                  0}
                %

              </div>

            </div>

          </div>

          {/* RECOMMENDATION */}

          <div
            className={`operational-surface premium-card mb-4 rounded-2xl border bg-white/[0.025] p-4 ${
              workflowActionLoading
                ? "execution-pulse border-[#00ffcc]/25 shadow-[0_0_34px_rgba(0,255,204,0.08)]"
                : "border-white/10"
            }`}
          >

            <div className="mb-3 flex items-center justify-between gap-3">

              <div className="text-sm text-zinc-500">

                Recommended Action

              </div>

              <div className="rounded-full border border-[#00ffcc]/20 bg-[#00ffcc]/10 px-2.5 py-1 text-[11px] font-medium text-[#00ffcc]">

                {workflowActionLoading
                  ? "AI evaluating"
                  : "Actionable"}

              </div>

            </div>

            <div className="text-sm leading-6 text-zinc-400">

              {lead.recommendation ||
                "Continue qualification."}

            </div>

            {workflowTaskCount > 0 && (

              <div className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-600">

                {workflowTaskCount} active workflow task
                {workflowTaskCount === 1
                  ? ""
                  : "s"}

              </div>

            )}

            <div className="mt-4 grid grid-cols-2 gap-2">

              {[
                {
                  label: "Approve",
                  icon: Check,
                  action:
                    "approve" as WorkflowAction,
                },
                {
                  label: "Run",
                  icon: Play,
                  action:
                    "run" as WorkflowAction,
                },
                {
                  label: "Edit",
                  icon: Pencil,
                  action: null,
                },
                {
                  label: "Schedule",
                  icon: CalendarClock,
                  action: null,
                },
                {
                  label: "Escalate",
                  icon: AlertTriangle,
                  action: null,
                },
              ].map((item) => {
                const Icon = item.icon;
                const isActionLoading =
                  item.action &&
                  workflowActionLoading ===
                    item.action;

                return (

                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (item.action) {
                        void executeAction(
                          item.action,
                          lead.recommendation ||
                            "Continue qualification."
                        );
                      }
                    }}
                    disabled={
                      !item.action ||
                      Boolean(
                        workflowActionLoading
                      )
                    }
                    className="flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 text-xs font-medium text-zinc-300 transition hover:border-[#00ffcc]/30 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >

                    <Icon className="h-3.5 w-3.5" />

                    {isActionLoading
                      ? item.action === "approve"
                        ? "Approving"
                        : "Initiating"
                      : item.label}

                  </button>

                );
              })}

            </div>

            {workflowActionStatus && (

              <div
                className={`message-surface mt-3 rounded-xl px-3 py-2 ${
                  workflowActionStatus.type ===
                  "success"
                    ? "execution-pulse bg-[#00ffcc]/[0.055] shadow-[0_0_22px_rgba(0,255,204,0.07)]"
                    : "bg-yellow-400/10"
                }`}
                title={
                  workflowActionStatus.detail ||
                  workflowActionStatus.message
                }
              >

                <div className="flex min-w-0 items-center gap-2">

                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      workflowActionStatus.type ===
                      "success"
                        ? "live-dot live-beacon bg-[#00ffcc]"
                        : "bg-yellow-300"
                    }`}
                  />

                  <span
                    className={`truncate text-xs font-semibold ${
                      workflowActionStatus.type ===
                      "success"
                        ? "text-[#00ffcc]"
                        : "text-yellow-300"
                    }`}
                  >

                    {workflowActionStatus.type ===
                    "success"
                      ? workflowActionStatus.message
                      : "Action needs review"}

                  </span>

                </div>

                <div className="mt-1.5 flex flex-wrap gap-1.5">

                  {workflowActionStatus.type ===
                  "success" ? (

                    <>

                      <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-medium text-zinc-400">

                        Task queued

                      </span>

                      <span className="rounded-full bg-[#00ffcc]/10 px-2 py-0.5 text-[10px] font-medium text-[#00ffcc]/90">

                        Timeline updated

                      </span>

                    </>

                  ) : (

                    <span className="line-clamp-2 text-[11px] leading-4 text-yellow-200/80">

                      {workflowActionStatus.message}

                    </span>

                  )}

                </div>

              </div>

            )}

          </div>

          {/* AI REASONING */}

          <div className="operational-surface premium-card mb-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">

            <div className="mb-4 text-sm text-zinc-500">

              Why AI Thinks This

            </div>

            <div className="space-y-3">

              {reasoningItems.length ===
              0 ? (

                <div className="text-sm text-zinc-500">

                  No reasoning fields recorded yet.

                </div>

              ) : (

                reasoningItems.map(
                  (
                    item
                  ) => (

                    <div
                      key={item.title}
                      className="rounded-xl border border-white/10 bg-black/25 p-3"
                    >

                      <div className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">

                        {item.title}

                      </div>

                      <div className="mt-2 text-sm leading-6 text-zinc-300">

                        {item.detail}

                      </div>

                    </div>

                  )
                )

              )}

            </div>

          </div>

          {/* ACTIVE AGENT */}

          <div
            className={`operational-surface execution-pulse premium-card mb-4 rounded-2xl border p-4 ${
              sending ||
              workflowActionLoading ||
              highlightedEventId
                ? "border-[#00ffcc]/40 bg-[#00ffcc]/[0.12] shadow-[0_0_42px_rgba(0,255,204,0.12)]"
                : "border-[#00ffcc]/30 bg-[#00ffcc]/[0.09] shadow-[0_0_34px_rgba(0,255,204,0.08)]"
            }`}
          >

            <div className="text-sm text-[#00ffcc]">

              Active Agent

            </div>

            <div className="mt-2 text-xl font-semibold">

              {activeAgent}

            </div>

          </div>

          {/* AI EVENT TIMELINE */}

          <div
            className={`operational-surface premium-card rounded-2xl border bg-white/[0.02] p-4 ${
              highlightedEventId
                ? "execution-pulse border-[#00ffcc]/25 shadow-[0_0_42px_rgba(0,255,204,0.08)]"
                : "border-white/10"
            }`}
          >

            <div className="mb-4 flex items-center justify-between gap-3">

              <div className="text-sm text-zinc-500">

                AI Execution Timeline

              </div>

              {highlightedEventId && (

                <div className="rounded-full border border-[#00ffcc]/20 bg-[#00ffcc]/10 px-2.5 py-1 text-[11px] font-medium text-[#00ffcc]">

                  New workflow event

                </div>

              )}

            </div>

            <div className="space-y-3">

              {operationalEvents.length ===
              0 ? (

                <div className="text-sm text-zinc-500">

                  No AI events yet.

                </div>

              ) : (

                operationalEvents.map(
                  (
                    event,
                    index
                  ) => (

                    <div
                      key={
                        event.id
                      }
                      className={`message-surface relative rounded-xl border p-3 pl-10 text-zinc-300 ${
                        highlightedEventId ===
                        event.id
                          ? "execution-pulse border-[#00ffcc]/30 bg-[#00ffcc]/[0.08] shadow-[0_0_34px_rgba(0,255,204,0.1)]"
                          : "execution-pulse border-white/10 bg-black/30"
                      }`}
                    >

                      <div
                        className={`absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
                          highlightedEventId ===
                          event.id
                            ? "live-beacon border-[#00ffcc]/40 bg-[#00ffcc]/20 text-[#00ffcc]"
                            : "border-[#00ffcc]/30 bg-[#00ffcc]/10 text-[#00ffcc]"
                        }`}
                      >

                        {index + 1}

                      </div>

                      <div className="mb-2 flex items-center justify-between gap-3">

                        <div className="text-xs uppercase tracking-[0.18em] text-[#00ffcc]">

                          {getOperationalEventLabel(
                            event.type
                          )}

                        </div>

                        <div className="shrink-0 text-[11px] text-zinc-600">

                          {getEventTime(
                            event.created_at
                          )}

                        </div>

                      </div>

                      <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-zinc-600">

                        Source: {event.type}

                      </div>

                      <div className="text-sm leading-6 text-zinc-400">

                        {event.message}

                      </div>

                    </div>

                  )
                )

              )}

            </div>

          </div>

        </div>

      </div>

    </div>

  );

}
