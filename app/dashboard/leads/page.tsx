"use client";

import Link from "next/link";
import { ArrowRight, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { translate, useLanguage } from "@/lib/i18n/language";

type Lead = {
  id: string;
  name?: string | null;
  company?: string | null;
  email?: string | null;
  status?: string | null;
  intent_score?: number | null;
  close_probability?: number | null;
  urgency?: string | null;
  ai_notes?: string | null;
};

function getLeadName(lead: Lead) {
  return lead.company || lead.name || lead.email || "Unknown lead";
}

function getLeadSignal(lead: Lead) {
  return lead.ai_notes || "No AI notes recorded yet.";
}

export default function LeadsPage() {
  const { language, t } = useLanguage();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function loadLeads() {
      try {
        const response = await fetch("/api/leads");
        const data = await response.json();

        setLeads(data.leads || []);
      } catch (error) {
        console.error(error);
      }
    }

    void loadLeads();
  }, []);

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return leads;
    }

    return leads.filter((lead) => {
      const searchable = [
        lead.name,
        lead.company,
        lead.email,
        lead.status,
        lead.urgency,
        lead.ai_notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [leads, query]);

  const hotLeads = leads.filter((lead) => lead.urgency === "high").length;
  const avgIntent =
    leads.length > 0
      ? Math.round(
          leads.reduce((total, lead) => total + (lead.intent_score ?? 0), 0) /
            leads.length
        )
      : 0;

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-8 text-white lg:px-10">
      <header className="flex flex-col gap-6 border-b border-zinc-900 pb-8 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
            {t("leadWorkQueue")}
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            {t("revenueAccounts")}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-500">
            {translate(
              language,
              "Prioritized lead records for review, routing, and AI-assisted follow-up.",
              "Приоритетные лиды для проверки, маршрута и follow-up с AI."
            )}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Metric label={t("leads")} value={leads.length} />
          <Metric label={translate(language, "Hot", "Горячие")} value={hotLeads} />
          <Metric label={t("intent")} value={avgIntent} />
        </div>
      </header>

      <section className="premium-card mt-8 rounded-2xl border border-zinc-800 bg-zinc-950">
        <div className="flex flex-col gap-4 border-b border-zinc-900 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-black text-zinc-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t("openLeadQueue")}</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {translate(
                  language,
                  "Select a lead to enter the dedicated workspace.",
                  "Выберите лида, чтобы открыть рабочее место."
                )}
              </p>
            </div>
          </div>

          <label className="focus-within:border-[#00ffcc]/30 focus-within:bg-white/[0.04] flex h-11 min-w-0 items-center gap-3 rounded-xl border border-zinc-800 bg-black px-4 transition md:w-80">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchLeads")}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
            />
          </label>
        </div>

        <div className="divide-y divide-zinc-900">
          {filteredLeads.length > 0 ? (
            filteredLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/dashboard/leads/${lead.id}`}
                className="operational-surface click-cue group grid gap-4 p-5 hover:bg-white/[0.055] lg:grid-cols-[1.4fr_0.7fr_0.7fr_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold">
                    {getLeadName(lead)}
                  </div>
                  <div className="mt-1 truncate text-sm text-zinc-500">
                    {lead.email || getLeadSignal(lead)}
                  </div>
                </div>

                <QueueCell
                  label={t("status")}
                  value={lead.status || "new"}
                  accent={lead.urgency === "high" ? "text-red-300" : ""}
                />
                <QueueCell
                  label={t("intent")}
                  value={`${lead.intent_score ?? 0}`}
                />
                <div className="flex items-center justify-between gap-3 lg:justify-end">
                  <QueueCell
                    label={t("close")}
                    value={`${lead.close_probability ?? 0}%`}
                  />
                  <ArrowRight className="h-5 w-5 shrink-0 text-zinc-600 transition duration-300 group-hover:translate-x-1 group-hover:text-white" />
                </div>
              </Link>
            ))
          ) : (
            <div className="p-8 text-sm text-zinc-500">
              {translate(
                language,
                "No leads match this queue view.",
                "Под этот вид очереди лиды не подходят."
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="operational-surface premium-card min-w-24 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function QueueCell({
  label,
  value,
  accent = "",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-[0.16em] text-zinc-600">
        {label}
      </div>
      <div className={`mt-1 truncate text-sm font-medium ${accent || "text-zinc-200"}`}>
        {value}
      </div>
    </div>
  );
}
