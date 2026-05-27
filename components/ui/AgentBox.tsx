export default function AgentBox({
  className,
  title,
  desc,
  sub,
  color,
}: {
  className?: string
  title: string
  desc: string
  sub: string
  color: string
}) {
  return (
    <div
      className={`z-30 w-[200px] rounded-[28px] border bg-black/45 p-6 backdrop-blur-xl ${className || ""}`}
      style={{
        borderColor: `${color}40`,
        boxShadow: `0 0 40px ${color}15`,
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full text-2xl"
          style={{
            background: `${color}15`,
            color,
            boxShadow: `0 0 30px ${color}20`,
          }}
        >
          ◎
        </div>

        <div
          className="rounded-full px-4 py-2 text-xs"
          style={{
            background: `${color}20`,
            color,
          }}
        >
          ACTIVE
        </div>
      </div>

      <div className="mt-5 text-[30px] font-semibold leading-[0.95] tracking-[-0.06em]">
        {title}
      </div>

      <div className="mt-4 text-lg text-white/60">
        {desc}
      </div>

      <div className="mt-2 text-lg text-white/35">
        {sub}
      </div>
    </div>
  )
}