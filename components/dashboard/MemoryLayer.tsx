const signals = [
    {
      title: "High Buying Intent",
      value: "94%",
      color: "#00FF99",
    },
    {
      title: "Decision Maker Activity",
      value: "12 Signals",
      color: "#00A6FF",
    },
    {
      title: "Revenue Risk",
      value: "Low",
      color: "#FFD600",
    },
    {
      title: "AI Confidence",
      value: "98.2%",
      color: "#FF4D6D",
    },
  ]
  
  const timeline = [
    {
      title: "Research Agent enriched company profile",
      desc: "Detected hiring expansion and budget increase signals.",
      time: "2 sec ago",
      color: "#00A6FF",
    },
    {
      title: "Closer Agent recalculated close probability",
      desc: "Negotiation behavior indicates strong buying intent.",
      time: "11 sec ago",
      color: "#00FF99",
    },
    {
      title: "SDR Agent launched outreach sequence",
      desc: "AI generated personalized outbound messaging.",
      time: "24 sec ago",
      color: "#FFD600",
    },
  ]
  
  export default function MemoryLayer() {
    return (
      <div className="grid grid-cols-2 gap-6 mt-10">
  
        {/* SIGNALS */}
        <div className="rounded-[32px] border border-white/10 bg-black/40 p-6">
          <h2 className="text-2xl font-semibold mb-4">
            AI Signals
          </h2>
  
          <div className="space-y-3">
            {signals.map((s, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-white/70">{s.title}</span>
                <span style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
  
        {/* TIMELINE */}
        <div className="rounded-[32px] border border-white/10 bg-black/40 p-6">
          <h2 className="text-2xl font-semibold mb-4">
            Live Memory
          </h2>
  
          <div className="space-y-4">
            {timeline.map((t, i) => (
              <div key={i}>
                <div className="text-sm font-medium">{t.title}</div>
                <div className="text-xs text-white/50">{t.desc}</div>
                <div className="text-xs text-white/30">{t.time}</div>
              </div>
            ))}
          </div>
        </div>
  
      </div>
    )
  }