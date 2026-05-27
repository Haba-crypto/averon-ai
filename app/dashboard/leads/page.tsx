"use client"

import { useEffect, useState } from "react"

import AgentsSection from "@/components/dashboard/AgentsSection"
import LeadsTable, { type Lead } from "@/components/dashboard/LeadsTable"
import MemoryLayer from "@/components/dashboard/MemoryLayer"

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])

  useEffect(() => {
    async function loadLeads() {
      try {
        const response = await fetch("/api/leads")
        const data = await response.json()

        setLeads(data.leads || [])
      } catch (error) {
        console.error(error)
      }
    }

    void loadLeads()
  }, [])

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
