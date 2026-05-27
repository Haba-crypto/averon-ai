"use client"

import AgentBox from "@/components/ui/AgentBox"
import { useAgentFlow } from "@/hooks/useAgentFlow"

export default function AgentsSection() {
  const { active, signal, runFlow } = useAgentFlow()

  const isActive = (a: string) => active === a

  return (
    <div className="w-full min-h-[900px] flex items-center justify-center gap-[120px] px-[6%] relative overflow-hidden">

      {/* BACKGROUND GLOW */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[900px] h-[900px] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      {/* NETWORK LINES + FLOW */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">

        {/* base lines */}
        <line x1="25%" y1="35%" x2="50%" y2="50%" stroke="rgba(0,255,200,0.15)" strokeWidth="2" />
        <line x1="25%" y1="65%" x2="50%" y2="50%" stroke="rgba(0,255,200,0.15)" strokeWidth="2" />
        <line x1="75%" y1="35%" x2="50%" y2="50%" stroke="rgba(0,255,200,0.15)" strokeWidth="2" />
        <line x1="75%" y1="65%" x2="50%" y2="50%" stroke="rgba(0,255,200,0.15)" strokeWidth="2" />

        {/* FLOW PARTICLES (smooth, not jumping) */}
        {signal && (
          <>
            <circle r="5" fill="#00ffd5" opacity="0.9">
              <animateMotion dur="1.4s" repeatCount="indefinite">
                <path d="M 25% 35% L 50% 50%" />
              </animateMotion>
            </circle>

            <circle r="5" fill="#00ffd5" opacity="0.7">
              <animateMotion dur="1.8s" repeatCount="indefinite">
                <path d="M 25% 65% L 50% 50%" />
              </animateMotion>
            </circle>

            <circle r="5" fill="#00ffd5" opacity="0.8">
              <animateMotion dur="1.6s" repeatCount="indefinite">
                <path d="M 75% 35% L 50% 50%" />
              </animateMotion>
            </circle>

            <circle r="5" fill="#00ffd5" opacity="0.6">
              <animateMotion dur="2.0s" repeatCount="indefinite">
                <path d="M 75% 65% L 50% 50%" />
              </animateMotion>
            </circle>
          </>
        )}

      </svg>

      {/* LEFT SIDE */}
      <div className="flex flex-col gap-14 z-10">

        <div
          onClick={() => runFlow("research")}
          className={`cursor-pointer transition ${
            isActive("research") ? "scale-[1.08]" : "opacity-40"
          }`}
        >
          <AgentBox
            title="Research"
            desc="Market Intelligence"
            sub={signal === "research" ? "flow active" : "data extraction"}
            color="#00A6FF"
          />
        </div>

        <div
          onClick={() => runFlow("sdr")}
          className={`cursor-pointer transition ${
            isActive("sdr") ? "scale-[1.08]" : "opacity-40"
          }`}
        >
          <AgentBox
            title="SDR"
            desc="Lead Qualification"
            sub={signal === "sdr" ? "flow active" : "engagement layer"}
            color="#FFD600"
          />
        </div>

      </div>

      {/* CENTER CORE */}
      <div className="flex items-center justify-center z-10">

        <div className={`
          w-[620px] h-[620px]
          rounded-full border border-white/10
          bg-black/85 backdrop-blur-3xl
          flex items-center justify-center
          text-center
          transition-all duration-500
          ${signal ? "scale-[1.06] shadow-[0_0_300px_rgba(0,255,200,0.25)]" : ""}
        `}>

          <div>
            <div className="text-xs tracking-[0.3em] text-white/50">
              LIVE AGENT NETWORK
            </div>

            <div className="text-2xl mt-3 tracking-[0.4em] text-cyan-300">
              {signal ? signal.toUpperCase() : "STABLE"}
            </div>

            <div className="mt-4 text-xs text-white/30">
              {signal ? "processing flow..." : "idle state"}
            </div>
          </div>

        </div>

      </div>

      {/* RIGHT SIDE */}
      <div className="flex flex-col gap-14 z-10">

        <div
          onClick={() => runFlow("closer")}
          className={`cursor-pointer transition ${
            isActive("closer") ? "scale-[1.08]" : "opacity-40"
          }`}
        >
          <AgentBox
            title="Closer"
            desc="Deal Intelligence"
            sub={signal === "closer" ? "flow active" : "conversion engine"}
            color="#00FF99"
          />
        </div>

        <div
          onClick={() => runFlow("pipeline")}
          className={`cursor-pointer transition ${
            isActive("pipeline") ? "scale-[1.08]" : "opacity-40"
          }`}
        >
          <AgentBox
            title="Pipeline"
            desc="Revenue Prediction"
            sub={signal === "pipeline" ? "flow active" : "risk engine"}
            color="#FF4D6D"
          />
        </div>

      </div>

    </div>
  )
}