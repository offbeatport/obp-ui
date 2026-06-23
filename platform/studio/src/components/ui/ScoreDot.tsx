export function ScoreDot({ score }: { score: number }) {
  const color = score >= 7 ? "var(--accent)" : score >= 5 ? "#f59e0b" : "#ef4444";
  return (
    <span className="flex items-center gap-[7px]">
      <span
        className="w-[6px] h-[6px] rounded-full inline-block flex-shrink-0"
        style={{ background: color }}
      />
      <span className="font-semibold [font-variant-numeric:tabular-nums]" style={{ color }}>
        {score.toFixed(1)}
      </span>
    </span>
  );
}
