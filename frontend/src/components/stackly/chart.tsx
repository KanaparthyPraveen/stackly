import * as React from "react";
import { cn } from "@/lib/utils";

type ChartProps = {
  data: { date: string; value: number }[];
  /** Optional second series — used for views + clicks overlay. */
  secondary?: { date: string; value: number }[];
  height?: number;
  className?: string;
};

/**
 * Tiny SVG line chart. No external charting library — just two
 * polyline paths, a fill, and tick labels. Subtle grid, signal = primary.
 *
 * Server component (no state). Renders an accessible table fallback
 * via a visually-hidden <table>.
 */
export function Chart({
  data,
  secondary,
  height = 180,
  className,
}: ChartProps) {
  if (data.length === 0) return null;

  const width = 800; // viewBox width
  const pad = { top: 12, right: 12, bottom: 24, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const allValues = [
    ...data.map((p) => p.value),
    ...(secondary?.map((p) => p.value) ?? []),
  ];
  const max = Math.max(...allValues, 1);
  const min = 0;

  const x = (i: number) =>
    pad.left + (i / Math.max(1, data.length - 1)) * innerW;
  const y = (v: number) =>
    pad.top + innerH - ((v - min) / Math.max(1, max - min)) * innerH;

  const primaryPath = data
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`)
    .join(" ");
  const primaryArea =
    `M ${x(0)} ${y(0)} ` +
    data
      .map((p, i) => `${i === 0 ? "L" : "L"} ${x(i)} ${y(p.value)}`)
      .join(" ") +
    ` L ${x(data.length - 1)} ${pad.top + innerH} L ${x(0)} ${pad.top + innerH} Z`;

  const secondaryPath = secondary
    ?.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`)
    .join(" ");

  // Y-axis ticks (3 horizontal lines + labels)
  const ticks = [0, 0.5, 1].map((t) => Math.round(min + (max - min) * t));

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label={`Chart with ${data.length} data points`}
      >
        {/* Grid */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(t)}
              y2={y(t)}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeDasharray="2 4"
            />
            <text
              x={pad.left - 8}
              y={y(t) + 3}
              fontSize="9"
              textAnchor="end"
              fill="currentColor"
              opacity="0.5"
              className="font-mono"
            >
              {t.toLocaleString()}
            </text>
          </g>
        ))}

        {/* Primary area + line */}
        <path
          d={primaryArea}
          fill="currentColor"
          opacity="0.08"
          className="text-signal"
        />
        <path
          d={primaryPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-signal"
        />

        {/* Secondary line (no fill, muted) */}
        {secondaryPath && (
          <path
            d={secondaryPath}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.4"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="3 3"
            className="text-muted-foreground"
          />
        )}
      </svg>
      {/* Accessible data table — visually hidden, available to screen readers */}
      <table className="sr-only">
        <caption>Time-series data</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Primary</th>
            {secondary && <th scope="col">Secondary</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((p, i) => (
            <tr key={p.date}>
              <th scope="row">{p.date}</th>
              <td>{p.value}</td>
              {secondary && <td>{secondary[i]?.value ?? ""}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
