"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Clock3,
  Flame,
  MessageSquare,
  Radio,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Lead = {
  id: string;
  name?: string | null;
  company?: string | null;
  email?: string | null;
  status?: string | null;
  intent_score?: number | null;
  close_probability?: number | null;
  urgency?: string | null;
  deal_risk?: string | null;
  recommendation?: string | null;
  ai_notes?: string | null;
};

type ConversationMessage = {
  role?: string | null;
  message?: string | null;
  classification?: string | null;
  created_at?: string | null;
};

type ConversationThread = {
  lead: Lead;
  messages: ConversationMessage[];
  latestMessage?: ConversationMessage;
  latestClassification: string;
  urgency: string;
  intentScore: number;
  confidence: number;
  needsHuman: boolean;
  aiCanContinue: boolean;
  hasObjection: boolean;
  meetingRequested: boolean;
  stalled: boolean;
  highRisk: boolean;
  recentAiAction: string;
  nextAction: string;
};

type FilterKey =
  | "all"
  | "needsHuman"
  | "hot"
  | "objections"
  | "waiting"
  | "aiActive"
  | "highRisk";

const filters: Array<{
  key: FilterKey;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = [
  {
    key: "all",
    label: "All",
    icon: MessageSquare,
  },
  {
    key: "needsHuman",
    label: "Needs Human",
    icon: UserCheck,
  },
  {
    key: "hot",
    label: "Hot Leads",
    icon: Flame,
  },
  {
    key: "objections",
    label: "Objections",
    icon: ShieldAlert,
  },
  {
    key: "waiting",
    label: "Waiting",
    icon: Clock3,
  },
  {
    key: "aiActive",
    label: "AI Active",
    icon: Bot,
  },
  {
    key: "highRisk",
    label: "High Risk",
    icon: AlertTriangle,
  },
];

function getLeadName(lead: Lead) {
  return lead.company || lead.name || lead.email || "Unknown lead";
}

function getMessageText(message?: ConversationMessage) {
  return message?.message || "No conversation activity recorded yet.";
}

function getLatestClassification(messages: ConversationMessage[]) {
  const classifiedMessage = [...messages]
    .reverse()
    .find((message) => message.classification);

  return classifiedMessage?.classification || "unclassified";
}

function hasMeetingRequest(messages: ConversationMessage[]) {
  return messages.some((message) => {
    const text = `${message.classification || ""} ${message.message || ""}`
      .toLowerCase();

    return (
      text.includes("meeting") ||
      text.includes("demo") ||
      text.includes("meeting_request")
    );
  });
}

function hasObjectionSignal(
  lead: Lead,
  messages: ConversationMessage[],
  classification: string
) {
  const context = [
    classification,
    lead.deal_risk,
    lead.ai_notes,
    ...messages.map((message) => message.message),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return context.includes("objection");
}

function buildThread(
  lead: Lead,
  messages: ConversationMessage[]
): ConversationThread {
  const latestMessage = messages[messages.length - 1];
  const latestClassification = getLatestClassification(messages);
  const intentScore = lead.intent_score ?? 0;
  const confidence = lead.close_probability ?? intentScore;
  const hasObjection = hasObjectionSignal(
    lead,
    messages,
    latestClassification
  );
  const meetingRequested = hasMeetingRequest(messages);
  const highRisk = Boolean(lead.deal_risk) || lead.urgency === "high";
  const needsHuman =
    latestMessage?.role === "user" ||
    hasObjection ||
    meetingRequested ||
    highRisk;
  const aiCanContinue =
    !needsHuman &&
    messages.length > 0 &&
    latestMessage?.role !== "user";
  const stalled = messages.length === 0 || lead.status === "stalled";

  return {
    lead,
    messages,
    latestMessage,
    latestClassification,
    urgency: lead.urgency || "normal",
    intentScore,
    confidence,
    needsHuman,
    aiCanContinue,
    hasObjection,
    meetingRequested,
    stalled,
    highRisk,
    recentAiAction:
      latestMessage?.role === "assistant"
        ? getMessageText(latestMessage)
        : "No recent AI action recorded.",
    nextAction:
      lead.recommendation ||
      (meetingRequested
        ? "Review meeting request."
        : hasObjection
        ? "Review objection context."
        : needsHuman
        ? "Review latest buyer message."
        : "Continue AI-assisted follow-up."),
  };
}

function getPriority(thread: ConversationThread) {
  return [
    thread.needsHuman ? 100 : 0,
    thread.meetingRequested ? 90 : 0,
    thread.hasObjection ? 80 : 0,
    thread.highRisk ? 70 : 0,
    thread.intentScore,
    thread.confidence,
  ].reduce((total, value) => total + value, 0);
}

export default function ConversationsPage() {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInbox() {
      try {
        const leadsResponse = await fetch("/api/leads");
        const leadsData = await leadsResponse.json();
        const leads: Lead[] = leadsData.leads || [];

        const loadedThreads = await Promise.all(
          leads.map(async (lead) => {
            const messagesResponse = await fetch(
              `/api/messages?leadId=${lead.id}`
            );
            const messagesData = await messagesResponse.json();

            return buildThread(lead, messagesData.messages || []);
          })
        );

        setThreads(
          loadedThreads.sort(
            (left, right) => getPriority(right) - getPriority(left)
          )
        );
      } catch (error) {
        console.error(error);
      }

      setLoading(false);
    }

    void loadInbox();
  }, []);

  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      if (activeFilter === "needsHuman") {
        return thread.needsHuman;
      }

      if (activeFilter === "hot") {
        return thread.intentScore >= 70 || thread.urgency === "high";
      }

      if (activeFilter === "objections") {
        return thread.hasObjection;
      }

      if (activeFilter === "waiting") {
        return thread.stalled || thread.latestMessage?.role === "assistant";
      }

      if (activeFilter === "aiActive") {
        return thread.aiCanContinue;
      }

      if (activeFilter === "highRisk") {
        return thread.highRisk;
      }

      return true;
    });
  }, [activeFilter, threads]);

  const selectedThread = filteredThreads[0] || threads[0];

  return (
    <main className="min-w-0 overflow-hidden bg-[#050505] px-5 py-8 text-white md:px-6 lg:px-8 2xl:px-10">
      <header className="flex flex-col gap-6 border-b border-zinc-900 pb-8 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Revenue Conversation Inbox
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            AI Triage Command
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-500">
            Prioritized buyer conversations with AI state, urgency, and next
            operational action.
          </p>
        </div>

        <div className="grid w-full grid-cols-3 gap-2 sm:max-w-xl sm:gap-3 xl:w-auto">
          <Metric
            label="Needs Human"
            value={threads.filter((item) => item.needsHuman).length}
          />
          <Metric
            label="Hot"
            value={
              threads.filter(
                (item) => item.intentScore >= 70 || item.urgency === "high"
              ).length
            }
          />
          <Metric
            label="AI Active"
            value={threads.filter((item) => item.aiCanContinue).length}
          />
        </div>
      </header>

      <section className="mt-6 flex flex-wrap gap-2">
        {filters.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeFilter === filter.key;

          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={`nav-surface flex h-10 min-w-0 items-center gap-2 rounded-xl border px-3 text-sm font-medium ${
                isActive
                  ? "border-white/30 bg-white text-black"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{filter.label}</span>
            </button>
          );
        })}
      </section>

      <div className="mt-6 grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="premium-card min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="flex flex-col gap-3 border-b border-zinc-900 p-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold">Prioritized Threads</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Sorted by human need, buyer intent, risk, and AI state.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 text-sm text-green-400">
              <Radio className="h-4 w-4 shrink-0" />
              Live Triage
            </div>
          </div>

          <div className="divide-y divide-zinc-900">
            {loading ? (
              <div className="p-8 text-sm text-zinc-500">
                Loading conversation inbox...
              </div>
            ) : filteredThreads.length > 0 ? (
              filteredThreads.map((thread) => (
                <ConversationCard key={thread.lead.id} thread={thread} />
              ))
            ) : (
              <div className="p-8 text-sm text-zinc-500">
                No conversations match this triage filter.
              </div>
            )}
          </div>
        </section>

        <aside className="premium-card min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 2xl:h-fit">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Triage Brief
          </div>

          {selectedThread ? (
            <div className="mt-5 space-y-4">
              <div className="min-w-0">
                <div className="truncate text-2xl font-semibold">
                  {getLeadName(selectedThread.lead)}
                </div>
                <div className="mt-2 truncate text-sm text-zinc-500">
                  {selectedThread.lead.email || "No email recorded"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <Insight
                  label="Intent"
                  value={`${selectedThread.intentScore}`}
                />
                <Insight
                  label="Confidence"
                  value={`${selectedThread.confidence}%`}
                />
                <Insight label="Urgency" value={selectedThread.urgency} />
                <Insight
                  label="Status"
                  value={selectedThread.lead.status || "new"}
                />
              </div>

              <div className="min-w-0 rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="text-sm text-zinc-500">Latest AI Context</div>
                <p className="mt-2 line-clamp-5 text-sm leading-6 text-zinc-300">
                  {selectedThread.recentAiAction}
                </p>
              </div>

              <div className="min-w-0 rounded-xl border border-[#00ffcc]/20 bg-[#00ffcc]/[0.06] p-4">
                <div className="text-sm text-[#00ffcc]">
                  Next Recommended Action
                </div>
                <p className="mt-2 line-clamp-5 text-sm leading-6 text-zinc-200">
                  {selectedThread.nextAction}
                </p>
              </div>

              <Link
                href={`/dashboard/leads/${selectedThread.lead.id}`}
                className="operational-surface flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black"
              >
                Enter Workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="mt-5 text-sm text-zinc-500">
              No conversation threads available.
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function ConversationCard({
  thread,
}: {
  thread: ConversationThread;
}) {
  return (
    <Link
      href={`/dashboard/leads/${thread.lead.id}`}
      className="operational-surface click-cue group block min-w-0 p-5 hover:bg-white/[0.055]"
    >
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(180px,0.7fr)_minmax(220px,0.8fr)_88px] xl:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 max-w-full truncate text-lg font-semibold">
              {getLeadName(thread.lead)}
            </h3>
            {thread.needsHuman && (
              <Badge tone="amber">Needs Human</Badge>
            )}
            {thread.aiCanContinue && (
              <Badge tone="green">AI Can Continue</Badge>
            )}
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">
            {getMessageText(thread.latestMessage)}
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
          <Insight label="Intent" value={`${thread.intentScore}`} />
          <Insight label="Urgency" value={thread.urgency} />
        </div>

        <div className="min-w-0 space-y-2">
          <StatusLine
            label="Classification"
            value={thread.latestClassification}
          />
          <StatusLine
            label="Recent AI Action"
            value={thread.recentAiAction}
          />
          <StatusLine
            label="Next Action"
            value={thread.nextAction}
          />
        </div>

        <div className="flex min-w-0 items-center justify-between gap-4 xl:justify-end">
          <div className="min-w-0 text-left xl:text-right">
            <div className="text-xs uppercase tracking-[0.16em] text-zinc-600">
              Confidence
            </div>
            <div className="mt-1 text-lg font-semibold">
              {thread.confidence}%
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-zinc-600 transition duration-300 group-hover:translate-x-1 group-hover:text-white" />
        </div>
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        {thread.meetingRequested && (
          <Badge tone="green">Meeting Requested</Badge>
        )}
        {thread.hasObjection && <Badge tone="red">Objection</Badge>}
        {thread.stalled && <Badge tone="zinc">Stalled/Waiting</Badge>}
        {thread.highRisk && <Badge tone="red">High Risk</Badge>}
      </div>
    </Link>
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
    <div className="operational-surface premium-card min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:p-4">
      <div className="truncate text-xs text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Insight({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="truncate text-xs uppercase tracking-[0.16em] text-zinc-600">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-zinc-200">
        {value}
      </div>
    </div>
  );
}

function StatusLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs uppercase tracking-[0.16em] text-zinc-600">
        {label}
      </div>
      <div className="mt-1 truncate text-sm text-zinc-300">
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
  tone: "green" | "amber" | "red" | "zinc";
}) {
  const toneClass = {
    green: "border-green-400/20 bg-green-400/10 text-green-300",
    amber: "border-yellow-400/20 bg-yellow-400/10 text-yellow-300",
    red: "border-red-400/20 bg-red-400/10 text-red-300",
    zinc: "border-zinc-700 bg-zinc-900 text-zinc-300",
  }[tone];

  return (
    <span
      className={`max-w-full truncate rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}
