"use client";

import Link from "next/link";

import { useState } from "react";

export default function HomePage() {

  const [messages, setMessages] =
    useState<
      {
        role: string;
        content: string;
      }[]
    >([]);

  const [input, setInput] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function sendMessage() {

    const currentInput =
      input.trim();

    if (!currentInput) return;

    const userMessage = {
      role: "user",
      content: currentInput,
    };

    setMessages((prev) => [
      ...prev,
      userMessage,
    ]);

    setInput("");

    setLoading(true);

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
              message:
                currentInput,

              leadId:
                "d19d37db-2dd3-48f1-9985-b91ec37a2bda",
            }),
          }
        );

      const data =
        await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data.reply ||
            "No response",
        },
      ]);

    } catch (error) {

      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "AVERON AI failed to respond.",
        },
      ]);

    }

    setLoading(false);

  }

  return (

    <main className="flex h-screen bg-black text-white">

      {/* SIDEBAR */}

      <div className="w-[300px] border-r border-zinc-900 p-6">

        <h1 className="text-6xl font-bold">
          AVERON
        </h1>

        <div className="mt-10 space-y-4">

          <Link href="/">
            <div className="cursor-pointer rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-2xl transition hover:border-white">
              Dashboard
            </div>
          </Link>

          <Link href="/dashboard/leads">
            <div className="cursor-pointer rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-2xl transition hover:border-white">
              Leads
            </div>
          </Link>

          <Link href="/dashboard/conversations">
            <div className="cursor-pointer rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-2xl transition hover:border-white">
              Conversations
            </div>
          </Link>

          <Link href="/dashboard/agents">
            <div className="cursor-pointer rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-2xl transition hover:border-white">
              AI Agents
            </div>
          </Link>

        </div>

      </div>

      {/* CHAT AREA */}

      <div className="flex flex-1 flex-col">

        {/* MESSAGES */}

        <div className="flex-1 overflow-y-auto p-10 space-y-6">

          {messages.map(
            (message, index) => (

              <div
                key={index}
                className={`flex ${
                  message.role ===
                  "assistant"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >

                <div
                  className={`max-w-[700px] rounded-3xl px-6 py-5 text-lg leading-relaxed ${
                    message.role ===
                    "assistant"
                      ? "bg-white text-black"
                      : "bg-zinc-900 text-white"
                  }`}
                >

                  {message.content}

                </div>

              </div>

            )
          )}

          {loading && (

            <div className="flex justify-end">

              <div className="rounded-3xl bg-white px-6 py-5 text-black">
                AVERON AI is thinking...
              </div>

            </div>

          )}

        </div>

        {/* INPUT */}

        <div className="flex gap-4 border-t border-zinc-900 p-6">

          <input
            value={input}
            onChange={(e) =>
              setInput(
                e.target.value
              )
            }
            onKeyDown={(e) => {

              if (
                e.key === "Enter"
              ) {
                sendMessage();
              }

            }}
            placeholder="Type message..."
            className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-950 px-6 py-4 text-lg outline-none"
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="rounded-2xl bg-white px-8 py-4 text-lg font-semibold text-black"
          >
            Send
          </button>

        </div>

      </div>

    </main>

  );
}