"use client";

import { useEffect, useState } from "react";

export default function LeadWorkspacePage() {

  const [lead, setLead] =
    useState<any>(null);

  const [messages, setMessages] =
    useState<any[]>([]);

  const [input, setInput] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function loadLead() {

    try {

      const res = await fetch(
        "/api/leads"
      );

      const data =
        await res.json();

      console.log(data);

      if (
        data.leads &&
        data.leads.length > 0
      ) {

        setLead(
          data.leads[0]
        );

      }

    } catch (error) {

      console.error(error);

    }

  }

  async function loadMessages() {

    try {

      const res = await fetch(
        "/api/messages?leadId=8741d6e7-d508-461a-a147-f32f7aef6b0d"
      );

      const data =
        await res.json();

      console.log(data);

      if (data.messages) {

        setMessages(
          data.messages
        );

      }

    } catch (error) {

      console.error(error);

    }

  }

  useEffect(() => {

    async function init() {

      await loadLead();

      await loadMessages();

    }

    init();

  }, []);

  async function sendMessage() {

    if (!input.trim()) {
      return;
    }

    const currentInput =
      input;

    setInput("");

    setLoading(true);

    try {

      await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({

            message:
              currentInput,

            leadId:
              "8741d6e7-d508-461a-a147-f32f7aef6b0d",

          }),
        }
      );

      await loadMessages();

    } catch (error) {

      console.error(error);

    }

    setLoading(false);

  }

  if (!lead) {

    return (

      <div className="flex h-screen items-center justify-center bg-black text-5xl text-white">

        Loading...

      </div>

    );

  }

  return (

    <div className="flex h-screen bg-black text-white">

      {/* SIDEBAR */}

      <div className="w-[420px] border-r border-zinc-900 bg-zinc-950 p-8">

        <h1 className="text-4xl font-bold">

          Lead Intelligence

        </h1>

        <div className="mt-10 space-y-6">

          <div className="rounded-3xl border border-zinc-800 bg-black p-6">

            <div className="text-zinc-500">
              Lead
            </div>

            <div className="mt-2 text-2xl font-bold">

              {lead.name}

            </div>

            <div className="mt-2 text-zinc-400">

              {lead.email}

            </div>

          </div>

          <div className="rounded-3xl border border-zinc-800 bg-black p-6">

            <div className="text-zinc-500">
              Pipeline Status
            </div>

            <div className="mt-2 text-2xl font-semibold capitalize">

              {lead.status || "new"}

            </div>

          </div>

          <div className="rounded-3xl border border-zinc-800 bg-black p-6">

            <div className="text-zinc-500">
              Intent Score
            </div>

            <div className="mt-2 text-5xl font-bold">

              {lead.intent_score || 0}

            </div>

          </div>

          <div className="rounded-3xl border border-zinc-800 bg-black p-6">

            <div className="text-zinc-500">
              AI Notes
            </div>

            <div className="mt-4 whitespace-pre-wrap text-zinc-300">

              {lead.ai_notes ||
                "No AI notes yet"}

            </div>

          </div>

        </div>

      </div>

      {/* CHAT */}

      <div className="flex flex-1 flex-col">

        <div className="border-b border-zinc-900 px-10 py-6">

          <h1 className="text-4xl font-bold">

            AI Revenue Workspace

          </h1>

          <p className="mt-2 text-zinc-500">

            Autonomous sales intelligence

          </p>

        </div>

        <div className="flex-1 overflow-y-auto px-10 py-8">

          <div className="mx-auto max-w-4xl space-y-6">

            {messages.map(
              (msg, index) => (

                <div
                  key={index}
                  className={`flex ${
                    msg.role ===
                    "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >

                  <div
                    className={`max-w-[70%] rounded-3xl px-6 py-5 text-lg ${
                      msg.role ===
                      "user"
                        ? "bg-white text-black"
                        : "border border-zinc-800 bg-zinc-950"
                    }`}
                  >

                    {msg.message}

                  </div>

                </div>

              )
            )}

            {loading && (

              <div className="text-zinc-500">

                AVERON AI thinking...

              </div>

            )}

          </div>

        </div>

        {/* INPUT */}

        <div className="border-t border-zinc-900 px-10 py-6">

          <div className="mx-auto flex max-w-4xl gap-4">

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
              className="h-[64px] flex-1 rounded-3xl border border-zinc-800 bg-zinc-950 px-6 text-lg outline-none"
            />

            <button
              onClick={
                sendMessage
              }
              disabled={loading}
              className="h-[64px] rounded-3xl bg-white px-8 text-lg font-semibold text-black"
            >

              Send

            </button>

          </div>

        </div>

      </div>

    </div>

  );

}