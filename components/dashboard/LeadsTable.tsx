type Lead = {
    company: string
    intent: string
    score: number
    status: string
    agent: string
    probability: string
    signal: string
  }
  
  export default function LeadsTable({ leads }: { leads: Lead[] }) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-black/40 p-8">
        <h2 className="text-3xl font-semibold mb-6">
          Live Pipeline Activity
        </h2>
  
        <div className="space-y-4">
          {leads.map((lead, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div>
                <div className="text-lg font-medium">{lead.company}</div>
                <div className="text-sm text-white/50">{lead.signal}</div>
              </div>
  
              <div className="text-right">
                <div className="text-sm text-white/70">
                  {lead.status}
                </div>
                <div className="text-sm text-white/40">
                  {lead.probability}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }