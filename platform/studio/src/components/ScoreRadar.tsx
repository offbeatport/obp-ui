"use client";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { SCORE_CRITERIA } from "~/lib/types";

interface Props {
  scores: Record<string, number>;
}

export function ScoreRadar({ scores }: Props) {
  const data = SCORE_CRITERIA.map((c) => ({
    criterion: c.label,
    value: scores[c.key] ?? 0,
    fullMark: 10,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="rgba(255,255,255,0.07)" />
        <PolarAngleAxis
          dataKey="criterion"
          tick={{ fill: "rgba(250,250,250,0.75)", fontSize: 13, fontFamily: "Space Grotesk, sans-serif" }}
        />
        <Radar
          name="Score"
          dataKey="value"
          stroke="var(--accent)"
          fill="var(--accent)"
          fillOpacity={0.12}
          strokeWidth={1.5}
        />
        <Tooltip
          contentStyle={{
            background: "#111",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 0,
            fontSize: "1rem",
            fontFamily: "Space Grotesk, sans-serif",
            color: "#fafafa",
          }}
          formatter={(value: number) => [value + " / 10", "Score"]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
