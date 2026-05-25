import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const navItems = [

    {
      name: "Dashboard",
      href: "/dashboard",
    },

    {
      name: "Leads",
      href: "/dashboard/leads",
    },

    {
      name: "Conversations",
      href: "/dashboard/conversations",
    },

    {
      name: "Tasks",
      href: "/dashboard/tasks",
    },

    {
      name: "AI Agents",
      href: "/dashboard/agents",
    },

  ];

  return (

    <div className="flex min-h-screen bg-black text-white">

      {/* SIDEBAR */}

      <div className="w-[300px] border-r border-zinc-900 bg-zinc-950/40 backdrop-blur-xl p-6 flex flex-col">

        <div>

          <h1 className="text-6xl font-bold">
            AVERON
          </h1>

          <p className="mt-3 text-zinc-500 text-lg">
            AI Revenue Operating System
          </p>

        </div>

        <div className="mt-10 space-y-4 flex-1">

          {navItems.map((item) => (

            <Link
              key={item.name}
              href={item.href}
            >

              <div className="cursor-pointer rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-2xl transition hover:border-white hover:bg-zinc-900">

                {item.name}

              </div>

            </Link>

          ))}

        </div>

        {/* AI STATUS */}

        <div className="mt-10 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">

          <div className="text-emerald-400 font-semibold text-lg">

            AI SYSTEM ACTIVE

          </div>

          <div className="text-zinc-400 mt-3">

            Autonomous workflows operational

          </div>

        </div>

      </div>

      {/* PAGE CONTENT */}

      <div className="flex-1 overflow-auto">

        {children}

      </div>

    </div>

  );

}