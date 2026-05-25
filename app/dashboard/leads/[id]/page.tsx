"use client";

import {
  useEffect,
  useState,
} from "react";

import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabase/client";

type Lead = {
  id: string;
  name: string;
  email: string;
  company: string;
  status: string;
  intent_score: number;
  ai_notes: string;
};

type Conversation = {
  id: string;
  role: string;
  message: string;
  created_at: string;
};

type Task = {
  id: string;
  task: string;
  status: string;
  priority: string;
  assigned_agent: string;
};

export default function LeadDetailsPage() {

  const params = useParams();

  const id = params.id as string;

  const [lead, setLead] =
    useState<Lead | null>(null);

  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [tasks, setTasks] =
    useState<Task[]>([]);

  async function loadLead() {

    const { data: leadData } =
      await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .single();

    setLead(leadData);

    const {
      data: conversationData,
    } = await supabase
      .from("conversations")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", {
        ascending: true,
      });

    setConversations(
      conversationData || []
    );

    const { data: tasksData } =
      await supabase
        .from("tasks")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", {
          ascending: false,
        });

    setTasks(tasksData || []);

  }

  useEffect(() => {

    if (!id) return;

    loadLead();

    const channel =
      supabase
        .channel(
          `lead-${id}`
        )

        .on(
          "postgres_changes",

          {
            event: "*",
            schema: "public",
            table: "conversations",
          },

          () => {
            loadLead();
          }
        )

        .on(
          "postgres_changes",

          {
            event: "*",
            schema: "public",
            table: "tasks",
          },

          () => {
            loadLead();
          }
        )

        .subscribe();

    return () => {

      supabase.removeChannel(
        channel
      );

    };

  }, [id]);

  if (!lead) {

    return (

      <div className="min-h-screen bg-black text-white flex items-center justify-center text-4xl">

        Loading...

      </div>

    );

  }

  return (

    <div className="min-h-screen bg-black text-white p-10">

      <div className="max-w-7xl mx-auto">

        {/* HEADER */}

        <div className="flex items-start justify-between">

          <div>

            <h1 className="text-7xl font-bold">
              {lead.name}
            </h1>

            <p className="text-zinc-500 text-2xl mt-4">

              {lead.company || "No company"}

            </p>

            <p className="text-zinc-600 text-xl mt-2">

              {lead.email}

            </p>

          </div>

          <div className="rounded-3xl bg-emerald-500/10 border border-emerald-500/20 px-10 py-8">

            <div className="text-zinc-500">
              Intent Score
            </div>

            <div className="text-7xl font-bold text-emerald-400 mt-3">

              {lead.intent_score || 0}%

            </div>

          </div>

        </div>

        {/* STATS */}

        <div className="grid grid-cols-4 gap-6 mt-14">

          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-8">

            <div className="text-zinc-500">
              Status
            </div>

            <div className="text-4xl font-bold mt-4">

              {lead.status || "new"}

            </div>

          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-8">

            <div className="text-zinc-500">
              Conversations
            </div>

            <div className="text-4xl font-bold mt-4">

              {conversations.length}

            </div>

          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-8">

            <div className="text-zinc-500">
              Active Tasks
            </div>

            <div className="text-4xl font-bold mt-4">

              {tasks.length}

            </div>

          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-8">

            <div className="text-zinc-500">
              AI Confidence
            </div>

            <div className="text-4xl font-bold mt-4 text-emerald-400">

              98%

            </div>

          </div>

        </div>

        {/* MAIN GRID */}

        <div className="grid grid-cols-[1.4fr_0.6fr] gap-8 mt-14">

          {/* CONVERSATIONS */}

          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-8">

            <h2 className="text-5xl font-bold">
              Conversations
            </h2>

            <div className="mt-10 space-y-6">

              {conversations.length === 0 ? (

                <div className="text-zinc-500 text-xl">

                  No conversations yet

                </div>

              ) : (

                conversations.map((msg) => (

                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role ===
                      "assistant"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >

                    <div
                      className={`max-w-[700px] rounded-3xl px-6 py-5 text-lg ${
                        msg.role ===
                        "assistant"
                          ? "bg-white text-black rounded-br-md"
                          : "bg-black border border-white/10 rounded-bl-md"
                      }`}
                    >

                      {msg.message}

                    </div>

                  </div>

                ))

              )}

            </div>

          </div>

          {/* RIGHT PANEL */}

          <div className="space-y-8">

            {/* AI NOTES */}

            <div className="rounded-3xl border border-white/10 bg-zinc-950 p-8">

              <h2 className="text-4xl font-bold">
                AI Insights
              </h2>

              <div className="mt-8 whitespace-pre-wrap text-zinc-300 leading-relaxed">

                {lead.ai_notes ||
                  "No AI insights yet"}

              </div>

            </div>

            {/* TASKS */}

            <div className="rounded-3xl border border-white/10 bg-zinc-950 p-8">

              <h2 className="text-4xl font-bold">
                Tasks
              </h2>

              <div className="mt-8 space-y-5">

                {tasks.length === 0 ? (

                  <div className="text-zinc-500">

                    No active tasks

                  </div>

                ) : (

                  tasks.map((task) => (

                    <div
                      key={task.id}
                      className="rounded-2xl border border-white/10 bg-black p-5"
                    >

                      <div className="text-xl font-semibold">

                        {task.task}

                      </div>

                      <div className="text-zinc-500 mt-3">

                        {task.assigned_agent}

                      </div>

                      <div className="flex gap-3 mt-5">

                        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm">

                          {task.status}

                        </div>

                        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm text-red-400">

                          {task.priority}

                        </div>

                      </div>

                    </div>

                  ))

                )}

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>

  );

}