type StatusBadgeProps = {
    text: string
    color?: "cyan" | "green" | "yellow" | "red"
  }
  
  const colors = {
    cyan: {
      bg: "bg-cyan-500/10",
      text: "text-cyan-300",
      border: "border-cyan-500/20",
    },
  
    green: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-300",
      border: "border-emerald-500/20",
    },
  
    yellow: {
      bg: "bg-yellow-500/10",
      text: "text-yellow-300",
      border: "border-yellow-500/20",
    },
  
    red: {
      bg: "bg-red-500/10",
      text: "text-red-300",
      border: "border-red-500/20",
    },
  }
  
  export default function StatusBadge({
    text,
    color = "cyan",
  }: StatusBadgeProps) {
    return (
      <div
        className={`
          inline-flex
          items-center
          gap-2
          rounded-full
          border
          px-4
          py-1.5
          text-xs
          font-medium
          tracking-[0.2em]
          uppercase
          backdrop-blur-xl
          ${colors[color].bg}
          ${colors[color].text}
          ${colors[color].border}
        `}
      >
        <div className="h-2 w-2 rounded-full bg-current animate-pulse" />
  
        {text}
      </div>
    )
  }