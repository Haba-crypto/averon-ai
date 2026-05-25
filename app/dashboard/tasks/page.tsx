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

    fetchTasks();

  }

  return (

    <div className="min-h-screen bg-black p-10 text-white">

      {/* HEADER */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-6xl font-bold">

            AI Task Engine

          </h1>

          <p className="mt-4 text-xl text-zinc-500">

            Autonomous workflow orchestration

          </p>

        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 px-8 py-6">

          <div className="text-zinc-500">

            Active Tasks

          </div>

          <div className="mt-2 text-5xl font-bold">

            {tasks.length}

          </div>

        </div>

      </div>

      {/* TASKS */}

      <div className="mt-12 grid gap-6">

        {tasks.map((task) => (

          <div
            key={task.id}
            className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"
          >

            <div className="flex items-start justify-between">

              <div>

                <h2 className="text-3xl font-bold">

                  {task.title || task.task}

                </h2>

                <p className="mt-3 text-zinc-500">

                  {task.description}

                </p>

              </div>

              <div
                className={`rounded-2xl px-4 py-2 text-sm font-semibold uppercase ${
                  task.priority === "high"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-yellow-500/20 text-yellow-400"
                }`}
              >

                {task.priority}

              </div>

            </div>

            <div className="mt-6 flex items-center justify-between">

              <div
                className={`rounded-2xl px-4 py-2 text-sm ${
                  task.status === "completed"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-zinc-800 text-zinc-300"
                }`}
              >

                {task.status}

              </div>

              {task.status !==
                "completed" && (

                <button
                  onClick={() =>
                    completeTask(
                      task.id
                    )
                  }
                  className="rounded-2xl bg-white px-6 py-3 font-semibold text-black"
                >

                  Complete

                </button>

              )}

            </div>

          </div>

        ))}

      </div>

    </div>

  );

}