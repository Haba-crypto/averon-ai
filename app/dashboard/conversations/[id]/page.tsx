"use client";

import { useState } from "react";

type Message = {
  role: string;
  content: string;
};

export default function ConversationPage() {
  const [messages, setMessages] =
    useState<Message[]>([]);

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
      const response = await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            message: currentInput,

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
    <div className="h-screen bg-black text-white flex flex-col">
      {/* HEADER */}

      <div className="h-[80px] border-b border-zinc-900 flex items-center px-8">
        <h1 className="text-4xl font-bold">
          AVERON AI
        </h1>
      </div>

      {/* CHAT */}

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
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
                    : "bg-zinc-900"
                }`}
              >
                {message.content}
              </div>
            </div>
          )
        )}

        {loading && (
          <div className="text-zinc-500">
            AVERON AI is thinking...
          </div>
        )}
      </div>

      {/* INPUT */}

      <div className="border-t border-zinc-900 p-6 flex gap-4">
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
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 outline-none text-lg"
        />

        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-white text-black px-8 py-4 rounded-2xl font-semibold"
        >
          Send
        </button>
      </div>
    </div>
  );
}