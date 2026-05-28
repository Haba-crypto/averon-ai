"use client";

import Link from "next/link";

import { agentRegistry } from "@/lib/agents/agent-registry";
import { translate, useLanguage } from "@/lib/i18n/language";

export default function AgentsPage() {
  const { language, t } = useLanguage();

  return (

    <div className="min-h-screen bg-black p-10 text-white">

      {/* HEADER */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-6xl font-bold">

            {t("aiAgents")}

          </h1>

          <p className="mt-4 text-xl text-zinc-500">

            {translate(
              language,
              "Autonomous multi-agent revenue infrastructure",
              "Автономная AI-инфраструктура для revenue-работы"
            )}

          </p>

        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 px-8 py-6">

          <div className="text-zinc-500">

            {t("activeAgents")}

          </div>

          <div className="mt-2 text-5xl font-bold">

            {agentRegistry.length}

          </div>

        </div>

      </div>

      {/* GRID */}

      <div className="mt-12 grid grid-cols-2 gap-6">

        {agentRegistry.map((agent) => (

          <div
            key={agent.name}
            className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8"
          >

            {/* TOP */}

            <div className="flex items-start justify-between">

              <div>

                <h2 className="text-4xl font-bold">

                  {agent.name}

                </h2>

                <p className="mt-4 max-w-[500px] text-lg leading-relaxed text-zinc-500">

                {translate(
                  language,
                  agent.description,
                  agent.name === "SDR Agent"
                    ? "Автономный поиск и квалификация лидов."
                    : agent.name === "Closer Agent"
                    ? "Ведет демо, возражения и движение сделки."
                    : agent.name === "Research Agent"
                    ? "Обогащает лидов данными о компании и рынке."
                    : "Оптимизирует CRM-процессы и pipeline."
                )}

                </p>

              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-green-500/20 px-4 py-2 text-sm font-semibold uppercase text-green-400">

                <div className="h-3 w-3 rounded-full bg-green-400" />

                {translate(language, agent.status, "активен")}

              </div>

            </div>

            {/* STATS */}

            <div className="mt-10 grid grid-cols-3 gap-4">

              <div className="rounded-2xl border border-zinc-800 bg-black p-5">

                <div className="text-zinc-500">

                  {t("tasks")}

                </div>

                <div className="mt-2 text-4xl font-bold">

                  {agent.tasks}

                </div>

              </div>

              <div className="rounded-2xl border border-zinc-800 bg-black p-5">

                <div className="text-zinc-500">

                  {t("conversations")}

                </div>

                <div className="mt-2 text-4xl font-bold">

                  {agent.conversations}

                </div>

              </div>

              <div className="rounded-2xl border border-zinc-800 bg-black p-5">

                <div className="text-zinc-500">

                  Revenue

                </div>

                <div className="mt-2 text-4xl font-bold">

                  {agent.revenue}

                </div>

              </div>

            </div>

            {/* FOOTER */}

            <div className="mt-8 flex items-center justify-between">

              <div className="text-zinc-500">

                {t("runtimeMemoryActive")}

              </div>

              <Link
                href={`/dashboard/agents/${agent.id}`}
                className="rounded-2xl bg-white px-6 py-3 font-semibold text-black"
              >

                {t("openAgent")}

              </Link>

            </div>

          </div>

        ))}

      </div>

    </div>

  );

}
