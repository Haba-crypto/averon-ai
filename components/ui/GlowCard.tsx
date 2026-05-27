type GlowCardProps = {
    children: React.ReactNode
    className?: string
    glow?: string
  }
  
  export default function GlowCard({
    children,
    className = "",
    glow = "rgba(0,255,200,0.15)",
  }: GlowCardProps) {
    return (
      <div
        className={`
          relative
          rounded-[32px]
          border
          border-white/10
          bg-black/40
          backdrop-blur-2xl
          overflow-hidden
          transition-all
          duration-300
          hover:scale-[1.01]
          ${className}
        `}
        style={{
          boxShadow: `
            inset 0 0 0 1px rgba(255,255,255,0.03),
            0 0 60px ${glow}
          `,
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_60%)]" />
  
        <div className="relative z-10">
          {children}
        </div>
      </div>
    )
  }