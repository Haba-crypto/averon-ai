"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

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

        setLead(
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

        setEvents(
          eventData.events ||
            []
        );

      } catch (error) {

        console.error(error);

      }

      setLoading(false);

    }

    if (leadId) {

      loadData();

    }

  }, [leadId]);

  async function refreshEvents() {

    try {

      const eventRes =
        await fetch(
          `/api/ai-events?leadId=${leadId}`
        );

      const eventData =
        await eventRes.json();

      setEvents(
        eventData.events ||
          []
      );

    } catch (error) {

      console.error(error);

    }

  }

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

  return (

    <div className="flex h-screen overflow-hidden bg-[#050505] text-white">

      {/* LEFT SIDEBAR */}

      <div className="w-[340px] overflow-y-auto border-r border-white/10 bg-black/30 backdrop-blur-xl">

        <div className="p-8">

          <div className="mb-3 text-xs uppercase tracking-[0.3em] text-zinc-500">

            Lead Intelligence

          </div>

          <h1 className="text-5xl font-semibold tracking-[-0.06em]">

            {lead.name}

          </h1>

          <div className="mt-4 text-zinc-500">

            {lead.email}

          </div>

        </div>

        <div className="space-y-5 px-6 pb-6">

          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">

            <div className="text-sm text-zinc-500">

              Intent Score

            </div>

            <div className="mt-3 text-5xl font-bold">

              {lead.intent_score}

            </div>

          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">

            <div className="text-sm text-zinc-500">

              Pipeline Status

            </div>

            <div className="mt-3 text-lg font-medium text-[#00ffcc]">

              {lead.status}

            </div>

          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">

            <div className="mb-5 text-xs uppercase tracking-[0.25em] text-zinc-500">

              AI Memory

            </div>

            <div className="space-y-5 text-sm leading-7 text-zinc-300">

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

          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">

            <div className="mb-5 text-xs uppercase tracking-[0.25em] text-zinc-500">

              Live AI Actions

            </div>

            <div className="space-y-4">

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
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-zinc-300"
                    >

                      {action.message}

                    </div>

                  )
                )

              )}

            </div>

          </div>

        </div>

      </div>

      {/* CENTER */}

      <div className="flex flex-1 flex-col">

        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-white/10 px-10 py-7">

          <div>

            <div className="mb-2 text-xs uppercase tracking-[0.3em] text-zinc-500">

              AVERON AI Workspace

            </div>

            <h1 className="text-4xl font-semibold tracking-[-0.05em]">

              Conversation Intelligence

            </h1>

          </div>

          <div className="rounded-full border border-[#00ffcc]/20 bg-[#00ffcc]/10 px-5 py-3 text-sm font-medium text-[#00ffcc]">

            {activeAgent}

          </div>

        </div>

        {/* CHAT */}

        <div className="flex-1 overflow-y-auto px-10 py-10">

          <div className="mx-auto flex max-w-5xl flex-col gap-6">

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
                    className={`max-w-[760px] rounded-[30px] px-7 py-5 text-[15px] leading-8 ${
                      message.role ===
                      "assistant"
                        ? "border border-white/10 bg-white/[0.03]"
                        : "bg-white text-black"
                    }`}
                  >

                    {message.message}

                  </div>

                </div>

              )
            )}

            {sending && (

              <div className="flex justify-start">

                <div className="rounded-[30px] border border-white/10 bg-white/[0.03] px-7 py-5 text-zinc-400">

                  {thinkingStage}

                </div>

              </div>

            )}

          </div>

        </div>

        {/* INPUT */}

        <div className="border-t border-white/10 px-10 py-6">

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
              className="h-[64px] flex-1 rounded-3xl border border-white/10 bg-white/[0.03] px-6 text-sm"
            />

            <button
              onClick={
                sendMessage
              }
              disabled={sending}
              className="rounded-3xl bg-white px-8 text-sm font-semibold text-black transition hover:scale-[1.02] disabled:opacity-50"
            >

              Send

            </button>

          </div>

        </div>

      </div>

      {/* RIGHT PANEL */}

      <div className="w-[360px] overflow-y-auto border-l border-white/10 bg-black/20 backdrop-blur-xl">

        <div className="p-6">

          <div className="mb-6 text-xs uppercase tracking-[0.3em] text-zinc-500">

            AI Strategic Analysis

          </div>

          {/* DEAL HEALTH */}

          <div className="mb-5 rounded-[28px] border border-white/10 bg-white/[0.03] p-6">

            <div className="text-sm text-zinc-500">

              Deal Health

            </div>

            <div className="mt-3 text-4xl font-bold text-[#00ffcc]">

              {lead.urgency ===
              "high"
                ? "Hot"
                : lead.urgency ===
                  "medium"
                ? "Warm"
                : "Cold"}

            </div>

          </div>

          {/* CLOSE PROBABILITY */}

          <div className="mb-5 rounded-[28px] border border-white/10 bg-white/[0.03] p-6">

            <div className="text-sm text-zinc-500">

              Close Probability

            </div>

            <div className="mt-3 text-5xl font-bold">

              {lead.close_probability ||
                0}
              %

            </div>

          </div>

          {/* RECOMMENDATION */}

          <div className="mb-5 rounded-[28px] border border-white/10 bg-white/[0.03] p-6">

            <div className="mb-3 text-sm text-zinc-500">

              Recommended Action

            </div>

            <div className="text-sm leading-7 text-zinc-300">

              {lead.recommendation ||
                "Continue qualification."}

            </div>

          </div>

          {/* ACTIVE AGENT */}

          <div className="mb-5 rounded-[28px] border border-[#00ffcc]/20 bg-[#00ffcc]/10 p-6">

            <div className="text-sm text-[#00ffcc]">

              Active Agent

            </div>

            <div className="mt-3 text-2xl font-bold">

              {activeAgent}

            </div>

          </div>

          {/* AI EVENT TIMELINE */}

          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">

            <div className="mb-5 text-sm text-zinc-500">

              AI Event Timeline

            </div>

            <div className="space-y-4">

              {events.length ===
              0 ? (

                <div className="text-sm text-zinc-500">

                  No AI events yet.

                </div>

              ) : (

                events.map(
                  (
                    event
                  ) => (

                    <div
                      key={
                        event.id
                      }
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >

                      <div className="mb-2 text-xs uppercase tracking-[0.2em] text-[#00ffcc]">

                        {event.type}

                      </div>

                      <div className="text-sm leading-6 text-zinc-300">

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