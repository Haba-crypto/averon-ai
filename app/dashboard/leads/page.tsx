"use client"

import AgentsSection from "@/components/dashboard/AgentsSection"
import LeadsTable from "@/components/dashboard/LeadsTable"
import MemoryLayer from "@/components/dashboard/MemoryLayer"

const leads = [
  {
    company: "Tesla",
    intent: "High",
    score: 94,
    status: "Negotiation",
    agent: "Closer Agent",
    probability: "82%",
    signal: "Pricing page revisit",
  },
  {
    company: "Stripe",
    intent: "Medium",
    score: 81,
    status: "AI Outreach",
    agent: "SDR Agent",
    probability: "64%",
    signal: "Reply sentiment positive",
  },
  {
    company: "Notion",
    intent: "High",
    score: 91,
    status: "Research",
    agent: "Research Agent",
    probability: "73%",
    signal: "Intent spike detected",
  },
  {
    company: "OpenAI",
    intent: "Critical",
    score: 97,
    status: "Follow-up",
    agent: "Closer Agent",
    probability: "91%",
    signal: "Decision-maker active",
  },
]

export default function LeadsPage() {
  return (
    <main className="min-h-screen bg-[#050607] text-white relative overflow-hidden">

      {/* background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,200,0.08),transparent_60%)]" />

      {/* HEADER */}
      <div className="relative z-10 px-10 pt-10">
        <h1 className="text-5xl font-semibold tracking-tight">
          Live Agent Network
        </h1>
      </div>

      {/* AGENTS SECTION */}
      <div className="relative z-10 mt-10 px-10">
        <AgentsSection />
      </div>

      {/* LEADS TABLE */}
      <div className="relative z-10 mt-14 px-10">
        <LeadsTable leads={leads} />
      </div>

      {/* MEMORY LAYER */}
      <div className="relative z-10 mt-14 px-10 pb-20">
        <MemoryLayer />
      </div>

    </main>
  )
}