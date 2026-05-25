"use client";

import {
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase/client";

export default function TasksPage() {

  const [tasks, setTasks] =
    useState<any[]>([]);

  useEffect(() => {

    fetchTasks();

    const channel =
      supabase
        .channel(
          "tasks-realtime"
        )

        .on(
          "postgres_changes",

          {
            event: "*",

            schema: "public",

            table: "tasks",
          },

          () => {
            console.log(
              "Realtime update"
            );

            fetchTasks();
          }
        )

        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };

  }, []);

  async function fetchTasks() {

    const { data } =
      await supabase
        .from("tasks")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (data) {
      setTasks(data);

      data.forEach((task) => {

        if (
          task.task ===
            "Research company profile" &&
          task.status ===
            "pending"
        ) {
          autoCompleteTask(
            task
          );
        }

      });
    }

  }

  async function completeTask(
    taskId: string
  ) {

    await supabase
      .from("tasks")
      .update({
        status:
          "completed",
      })
      .eq("id", taskId);

  }

  async function autoCompleteTask(
    task: any
  ) {

    setTimeout(async () => {

      await supabase
        .from("tasks")
        .update({
          status:
            "completed",
        })
        .eq("id", task.id);

      if (
        task.task ===
        "Research company profile"
      ) {

        await supabase
          .from("tasks")
          .insert({
            lead_id:
              task.lead_id,

            assigned_agent:
              "Research Agent",

            task:
              "Generate company insights",

            status:
              "pending",

            priority:
              "medium",
          });

      }

    }, 5000);

  }

  return (

    <div className="min-h-screen bg-black p-10 text-white">

      {/* HEADER */}

      <div className="flex items-start justify-between">

        <div>

          <h1 className="text-7xl font-bold">
            AI Task Engine
          </h1>

          <p className="mt-4 text-2xl text-zinc-500">
            Autonomous workflow orchestration
          </p>

        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950 px-8 py-6">

          <p className="text-zinc-500 text-xl">
            Active Tasks
          </p>

          <h2 className="mt-2 text-6xl font-bold">
            {tasks.length}
          </h2>

        </div>

      </div>

      {/* TASKS */}

      <div className="mt-12 space-y-6">

        {tasks.map((task) => (

          <div
            key={task.id}
            className="rounded-3xl border border-white/10 bg-zinc-950 p-6"
          >

            <div className="flex items-start justify-between">

              {/* LEFT */}

              <div>

                <h2 className="text-3xl font-bold">
                  {task.task}
                </h2>

                <p className="mt-3 text-xl text-zinc-500">
                  Assigned Agent:
                  {" "}
                  {
                    task.assigned_agent
                  }
                </p>

              </div>

              {/* RIGHT */}

              <div className="text-right">

                <div
                  className={`rounded-2xl px-4 py-2 text-sm uppercase tracking-wider border ${
                    task.status ===
                    "completed"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "border-yellow-500/20 bg-yellow-500/10 text-yellow-400"
                  }`}
                >

                  {task.status}

                </div>

                <div className="mt-4 text-sm text-zinc-500 uppercase tracking-wider">
                  Priority:
                  {" "}
                  {task.priority}
                </div>

              </div>

            </div>

            {/* ACTIONS */}

            <div className="mt-8 flex gap-4">

              {task.status !==
                "completed" && (

                <button
                  onClick={() =>
                    completeTask(
                      task.id
                    )
                  }
                  className="rounded-2xl bg-white px-6 py-3 text-lg font-bold text-black"
                >

                  Complete Task

                </button>

              )}

            </div>

          </div>

        ))}

      </div>

    </div>

  );
}