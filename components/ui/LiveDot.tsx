type LiveDotProps = {
    color?: "cyan" | "green" | "yellow" | "red"
    size?: "sm" | "md" | "lg"
  }
  
  const colors = {
    cyan: "bg-cyan-400",
    green: "bg-emerald-400",
    yellow: "bg-yellow-400",
    red: "bg-red-400",
  }
  
  const sizes = {
    sm: "h-2 w-2",
    md: "h-3 w-3",
    lg: "h-4 w-4",
  }
  
  export default function LiveDot({
    color = "cyan",
    size = "md",
  }: LiveDotProps) {
    return (
      <div
        className={`
          rounded-full
          animate-pulse
          ${colors[color]}
          ${sizes[size]}
        `}
        style={{
          boxShadow: "0 0 20px currentColor",
        }}
      />
    )
  }