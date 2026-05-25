"use client";

import { useEffect, useState } from "react";

export default function LeadsPage() {

  const [leads, setLeads] =
    useState<any[]>([]);

  async function loadLeads() {

    try {

      const res = await fetch(
        "/api/leads"
      );

      const data =
        await res.json();

      setLeads(
        data.leads || []
      );

    } catch (error) {

      console.error(error);

    }

  }

  useEffect(() => {

    loadLeads();

  }, []);

  function getStatusColor(
    status: string
  ) {

    if (
      status === "closing"
    ) {
      return "bg-green-500";
    }

    if (
      status === "proposal"
    ) {
      return "bg-yellow-500";
    }

    if (
      status ===
      "demo_scheduled"
    ) {
      return "bg-blue-500";
    }

    if (
      status ===
      "qualified"
    ) {
      return "bg-purple-500";
    }

    return "bg-zinc-500";

  }

  return (

    <div className="min-h-screen bg-black p-10 text-white">

      <div className="mb-10">

        <h1 className="text-5xl font-bold">
          AI Pipeline
        </h1>

        <p className="mt-3 text-zinc-500">

          Autonomous revenue
          orchestration

        </p>

      </div>

      <div className="grid grid-cols-4 gap-6">

        {leads.map((lead) => (

          <div
            key={lead.id}
            className="rounded-3xl border border-zinc-900 bg-zinc-950 p-6"
          >

            <div className="flex items-center justify-between">

              <h2 className="text-2xl font-semibold">

                {lead.name}

              </h2>

              <div
                className={`h-3 w-3 rounded-full ${getStatusColor(
                  lead.status
                )}`}
              />

            </div>

            <p className="mt-3 text-zinc-500">

              {lead.email}

            </p>

            <div className="mt-6">

              <div className="mb-2 flex items-center justify-between">

                <span className="text-zinc-400">
                  Intent Score
                </span>

                <span className="font-semibold">

                  {lead.intent_score || 0}

                </span>

              </div>

              <div className="h-3 overflow-hidden rounded-full bg-zinc-800">

                <div
                  className="h-full bg-white"
                  style={{
                    width: `${lead.intent_score || 0}%`,
                  }}
                />

              </div>

            </div>

            <div className="mt-6 rounded-2xl border border-zinc-800 bg-black p-4">

              <div className="text-sm text-zinc-500">

                Pipeline Status

              </div>

              <div className="mt-2 text-lg font-semibold capitalize">

                {lead.status || "new"}

              </div>

            </div>

          </div>

        ))}

      </div>

    </div>

  );

}