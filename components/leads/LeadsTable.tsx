import GlowCard from "../ui/GlowCard"
import SectionTitle from "../ui/SectionTitle"
import LiveDot from "../ui/LiveDot"

type Lead = {
  company: string
  intent: string
  score: number
  status: string
  agent: string
  probability: string
  signal: string
}

type LeadsTableProps = {
  leads: Lead[]
  selectedLead: string | null
  setSelectedLead: (lead: string) => void
}

export default function LeadsTable({
  leads,
  selectedLead,
  setSelectedLead,
}: LeadsTableProps) {
  return (
    <section className="mt-10">

      <GlowCard>

        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-white/5 px-8 py-6">

          <SectionTitle
            eyebrow="AI Leads Intelligence"
            title="Live Pipeline Activity"
          />

          <div className="flex items-center gap-3">

            <LiveDot color="green" />

            <div className="text-sm text-white/50">
              Real-time synchronization
            </div>

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="w-full">

            <thead>

              <tr className="border-b border-white/5">

                {[
                  "Company",
                  "Intent",
                  "AI Score",
                  "Status",
                  "Agent",
                  "Probability",
                  "Last Signal",
                ].map((item) => (
                  <th
                    key={item}
                    className="px-8 py-5 text-left text-[11px] font-medium uppercase tracking-[0.25em] text-white/35"
                  >
                    {item}
                  </th>
                ))}

              </tr>

            </thead>

            <tbody>

              {leads.map((lead) => (
                <tr
                  key={lead.company}
                  onClick={() => setSelectedLead(lead.company)}
                  className={`cursor-pointer border-b border-white/5 transition-all duration-300 hover:bg-white/[0.03] ${
                    selectedLead === lead.company
                      ? "bg-cyan-400/[0.06]"
                      : ""
                  }`}
                >

                  <td className="px-8 py-6">

                    <div className="flex items-center gap-4">

                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
                        <div className="h-2 w-2 rounded-full bg-cyan-400" />
                      </div>

                      <div>

                        <div className="font-medium text-white">
                          {lead.company}
                        </div>

                        <div className="mt-1 text-xs text-white/35">
                          Enterprise account
                        </div>

                      </div>

                    </div>

                  </td>

                  <td className="px-8 py-6">

                    <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                      {lead.intent}
                    </div>

                  </td>

                  <td className="px-8 py-6">

                    <div className="flex items-center gap-3">

                      <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">

                        <div
                          className="h-full rounded-full bg-cyan-400"
                          style={{
                            width: `${lead.score}%`,
                          }}
                        />

                      </div>

                      <span className="text-sm text-white">
                        {lead.score}
                      </span>

                    </div>

                  </td>

                  <td className="px-8 py-6 text-white/75">
                    {lead.status}
                  </td>

                  <td className="px-8 py-6 text-cyan-300">
                    {lead.agent}
                  </td>

                  <td className="px-8 py-6 font-medium text-white">
                    {lead.probability}
                  </td>

                  <td className="px-8 py-6">

                    <div className="flex items-center gap-3">

                      <LiveDot size="sm" />

                      <span className="text-sm text-white/45">
                        {lead.signal}
                      </span>

                    </div>

                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>

      </GlowCard>

    </section>
  )
}