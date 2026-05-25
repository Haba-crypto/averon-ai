"use client";

const agents = [

  {
    name: "SDR Agent",
    description:
      "Autonomous outbound prospecting and qualification.",
    status: "active",
    tasks: 148,
    conversations: 82,
    revenue: "$42K",
  },

  {
    name: "Closer Agent",
    description:
      "Handles demos, objections, and deal progression.",
    status: "active",
    tasks: 64,
    conversations: 31,
    revenue: "$118K",
  },

  {
    name: "Research Agent",
    description:
      "Enriches leads with company and market intelligence.",
    status: "active",
    tasks: 203,
    conversations: 0,
    revenue: "$0",
  },

  {
    name: "Ops Agent",
    description:
      "Optimizes CRM workflows and pipeline operations.",
    status: "active",
    tasks: 91,
    conversations: 12,
    revenue: "$18K",
  },

];

export default function AgentsPage() {

  return (

    <div className="min-h-screen bg-black p-10 text-white">

      {/* HEADER */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-6xl font-bold">

            AI Agents

          </h1>

          <p className="mt-4 text-xl text-zinc-500">

            Autonomous multi-agent revenue infrastructure

          </p>

        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 px-8 py-6">

          <div className="text-zinc-500">

            Active Agents

          </div>

          <div className="mt-2 text-5xl font-bold">

            {agents.length}

          </div>

        </div>

      </div>

      {/* GRID */}

      <div className="mt-12 grid grid-cols-2 gap-6">

        {agents.map((agent) => (

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

                  {agent.description}

                </p>

              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-green-500/20 px-4 py-2 text-sm font-semibold uppercase text-green-400">

                <div className="h-3 w-3 rounded-full bg-green-400" />

                {agent.status}

              </div>

            </div>

            {/* STATS */}

            <div className="mt-10 grid grid-cols-3 gap-4">

              <div className="rounded-2xl border border-zinc-800 bg-black p-5">

                <div className="text-zinc-500">

                  Tasks

                </div>

                <div className="mt-2 text-4xl font-bold">

                  {agent.tasks}

                </div>

              </div>

              <div className="rounded-2xl border border-zinc-800 bg-black p-5">

                <div className="text-zinc-500">

                  Conversations

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

                Runtime memory active

              </div>

              <button
                className="rounded-2xl bg-white px-6 py-3 font-semibold text-black"
              >

                Open Agent

              </button>

            </div>

          </div>

        ))}

      </div>

    </div>

  );

}