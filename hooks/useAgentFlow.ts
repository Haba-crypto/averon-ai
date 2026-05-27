"use client"

import { useState } from "react"

export type Agent = "research" | "sdr" | "closer" | "pipeline"

type EventLog = {
  agent: Agent
  timestamp: number
}

export function useAgentFlow() {
  const [active, setActive] = useState<Agent>("research")
  const [signal, setSignal] = useState<Agent | null>(null)
  const [events, setEvents] = useState<EventLog[]>([])

  async function runFlow(start: Agent) {
    const flowMap: Record<Agent, Agent[]> = {
      research: ["research", "sdr", "closer", "pipeline"],
      sdr: ["sdr", "closer", "pipeline"],
      closer: ["closer", "pipeline"],
      pipeline: ["pipeline"],
    }

    const flow = flowMap[start]

    for (const step of flow) {
      setActive(step)
      setSignal(step)

      setEvents((prev) => [
        ...prev,
        { agent: step, timestamp: Date.now() },
      ])

      await new Promise((r) => setTimeout(r, 650))
    }

    setTimeout(() => {
      setSignal(null)
    }, 800)
  }

  return {
    active,
    signal,
    runFlow,
    events,
  }
}