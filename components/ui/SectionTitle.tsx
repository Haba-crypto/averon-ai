type SectionTitleProps = {
    eyebrow: string
    title: string
    description?: string
    align?: "left" | "center"
  }
  
  export default function SectionTitle({
    eyebrow,
    title,
    description,
    align = "left",
  }: SectionTitleProps) {
    return (
      <div
        className={
          align === "center"
            ? "text-center"
            : "text-left"
        }
      >
  
        <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-400">
          {eyebrow}
        </div>
  
        <h2 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-white">
          {title}
        </h2>
  
        {description && (
          <p className="mt-4 max-w-[720px] text-lg leading-relaxed text-white/45">
            {description}
          </p>
        )}
  
      </div>
    )
  }