"use client";

import { useEffect, useState } from "react";

const DEMO_LEAD_ID =
  "8741d6e7-d508-461a-a147-f32f7aef6b0d";

export default function ConversationsPage() {

  const [message, setMessage] =
    useState("");

  const [messages, setMessages] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(false);

  async function loadMessages() {

    try {

      const res = await fetch(
        `/api/messages?leadId=${DEMO_LEAD_ID}`
      );

      const data =
        await res.json();

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

    loadMessages();

  }, []);

  async function sendMessage() {

    if (!message.trim()) {
      return;
    }

    const userMessage =
      message;

    setMessage("");

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
              userMessage,

            leadId:
              DEMO_LEAD_ID,
          }),
        }
      );

      await loadMessages();

    } catch (error) {

      console.error(error);

    }

    setLoading(false);

  }

  return (

    <div className="flex h-screen bg-black text-white">

      <div className="flex flex-1 flex-col">

        {/* HEADER */}

        <div className="border-b border-zinc-900 px-10 py-6">

          <h1 className="text-4xl font-bold">
            Conversations
          </h1>

          <p className="mt-2 text-zinc-500">
            AI-native revenue conversations
          </p>

        </div>

        {/* MESSAGES */}

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

              <div className="flex justify-start">

                <div className="rounded-3xl border border-zinc-800 bg-zinc-950 px-6 py-5 text-zinc-400">

                  AVERON AI is thinking...

                </div>

              </div>

            )}

          </div>

        </div>

        {/* INPUT */}

        <div className="border-t border-zinc-900 px-10 py-6">

          <div className="mx-auto flex max-w-4xl gap-4">

            <input
              value={message}
              onChange={(e) =>
                setMessage(
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
              className="h-[64px] rounded-3xl bg-white px-8 text-lg font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            >

              Send

            </button>

          </div>

        </div>

      </div>

    </div>

  );

}