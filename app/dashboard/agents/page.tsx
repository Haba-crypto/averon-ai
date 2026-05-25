export default function AgentsPage() {

  const agents = [

    {
      name: "SDR Agent",
      role: "Lead Qualification",
      status: "Active",
      tasks: 42,
      confidence: "98%",
    },

    {
      name: "Closer Agent",
      role: "Revenue Conversion",
      status: "Busy",
      tasks: 18,
      confidence: "94%",
    },

    {
      name: "Research Agent",
      role: "Company Intelligence",
      status: "Active",
      tasks: 27,
      confidence: "96%",
    },

    {
      name: "Retention Agent",
      role: "Customer Recovery",
      status: "Idle",
      tasks: 6,
      confidence: "91%",
    },

  ];

  return (

    <div className="min-h-screen bg-black text-white p-10">

      <div className="max-w-7xl mx-auto">

        <div className="flex items-center justify-between">

          <div>

            <h1 className="text-7xl font-bold">
              AI Agents
            </h1>

            <p className="text-zinc-500 text-2xl mt-4">
              Autonomous AI workforce
            </p>

          </div>

          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 text-emerald-400 text-xl">

            4 AGENTS ONLINE

          </div>

        </div>

        <div className="grid grid-cols-2 gap-8 mt-14">

          {agents.map((agent) => (

            <div
              key={agent.name}
              className="rounded-3xl border border-white/10 bg-zinc-950 p-8"
            >

              <div className="flex items-start justify-between">

                <div>

                  <h2 className="text-4xl font-bold">
                    {agent.name}
                  </h2>

                  <p className="text-zinc-500 text-xl mt-3">
                    {agent.role}
                  </p>

                </div>

                <div className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-emerald-400">

                  {agent.status}

                </div>

              </div>

              <div className="grid grid-cols-2 gap-6 mt-10">

                <div className="rounded-2xl bg-black border border-white/10 p-6">

                  <div className="text-zinc-500">
                    Active Tasks
                  </div>

                  <div className="text-5xl font-bold mt-4">
                    {agent.tasks}
                  </div>

                </div>

                <div className="rounded-2xl bg-black border border-white/10 p-6">

                  <div className="text-zinc-500">
                    AI Confidence
                  </div>

                  <div className="text-5xl font-bold mt-4 text-emerald-400">
                    {agent.confidence}
                  </div>

                </div>

              </div>

              <div className="mt-10 rounded-2xl border border-white/10 bg-black p-6">

                <div className="text-zinc-500">
                  Current Activity
                </div>

                <div className="text-2xl font-semibold mt-3">
                  Processing autonomous workflows
                </div>

              </div>

            </div>

          ))}

        </div>

      </div>

    </div>

  );

}