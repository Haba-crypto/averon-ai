import Link from "next/link"

export type Lead = {
  id: string
  name?: string | null
  company?: string | null
  email?: string | null
  status?: string | null
  intent?: string | null
  intent_score?: number | null
  score?: number | null
  agent?: string | null
  probability?: string | null
  close_probability?: number | null
  signal?: string | null
  ai_notes?: string | null
}

function getLeadDisplay(lead: Lead) {
  return {
    company: lead.company || lead.name || lead.email || "Unknown lead",
    signal: lead.signal || lead.ai_notes || "No recent signal",
    status: lead.status || "new",
    probability:
      lead.probability ||
      (typeof lead.close_probability === "number"
        ? `${lead.close_probability}%`
        : "0%"),
  }
}

export default function LeadsTable({ leads }: { leads: Lead[] }) {
  return (
    <div className="rounded-[32px] border border-white/10 bg-black/40 p-8">
      <h2 className="text-3xl font-semibold mb-6">
        Live Pipeline Activity
      </h2>

      <div className="space-y-4">
        {leads.map((lead) => {
          const display = getLeadDisplay(lead)

          return (
            <Link
              key={lead.id}
              href={`/dashboard/leads/${lead.id}`}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
            >
              <div>
                <div className="text-lg font-medium">{display.company}</div>
                <div className="text-sm text-white/50">{display.signal}</div>
              </div>
  
              <div className="text-right">
                <div className="text-sm text-white/70">
                  {display.status}
                </div>
                <div className="text-sm text-white/40">
                  {display.probability}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
