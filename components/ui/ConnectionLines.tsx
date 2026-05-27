export default function ConnectionLines() {
    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-[5]"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* CENTER DOT */}
        <circle cx="50" cy="50" r="1.2" fill="#00ffcc" />
  
        {/* TOP LEFT */}
        <path
          d="M50 50 C 40 40, 25 25, 10 10"
          stroke="#00ffcc"
          strokeOpacity="0.5"
          strokeWidth="0.6"
        />
  
        {/* TOP RIGHT */}
        <path
          d="M50 50 C 60 40, 75 25, 90 10"
          stroke="#00ffcc"
          strokeOpacity="0.5"
          strokeWidth="0.6"
        />
  
        {/* BOTTOM LEFT */}
        <path
          d="M50 50 C 40 60, 25 75, 10 90"
          stroke="#ffd600"
          strokeOpacity="0.5"
          strokeWidth="0.6"
        />
  
        {/* BOTTOM RIGHT */}
        <path
          d="M50 50 C 60 60, 75 75, 90 90"
          stroke="#ff4d6d"
          strokeOpacity="0.5"
          strokeWidth="0.6"
        />
      </svg>
    )
  }