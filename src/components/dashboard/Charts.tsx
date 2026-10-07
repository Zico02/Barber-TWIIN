"use client";
import { useState } from "react";
import clsx from "clsx";
import { formatDH } from "@/lib/domain/pricing";

type Fmt = "number" | "dh";
const fmtValue = (f: Fmt, v: number) => (f === "dh" ? formatDH(v) : String(v));

/**
 * Restrained single-series charts: one gold hue, thin marks with 4px rounded data-ends
 * anchored to the baseline, recessive axes, hover tooltip, and an accessible table.
 */
export function ColumnChart({
  data,
  format: f = "number",
  height = 160,
  label,
}: {
  data: { label: string; value: number }[];
  format?: Fmt;
  height?: number;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.findIndex((d) => d.value === max);
  return (
    <figure>
      <div className="relative flex items-end gap-[2px]" style={{ height }} role="img" aria-label={label}>
        {/* recessive gridline at the max */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-white/[0.06]" />
        {data.map((d, i) => (
          <div
            key={d.label}
            className="group relative flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            tabIndex={0}
          >
            <div
              className={clsx("mx-auto w-full max-w-[28px] rounded-t-[4px] transition-colors", hover === i ? "bg-gold-light" : "bg-gold/70")}
              style={{ height: `${Math.max(d.value ? 3 : 0, (d.value / max) * 100)}%` }}
            />
            {(hover === i || (hover === null && i === peak && d.value > 0)) && (
              <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-sm border border-hair bg-ink px-1.5 py-0.5 text-[10px] tabular-nums text-ivory">
                {fmtValue(f, d.value)}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[2px] border-t border-white/10 pt-1.5">
        {data.map((d) => (
          <span key={d.label} className="flex-1 truncate text-center text-[10px] text-ivory-dim">
            {d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th>{d.label}</th>
              <td>{fmtValue(f, d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function BarList({ data, format: f = "number" }: { data: { label: string; value: number; sub?: string }[]; format?: Fmt }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label} title={`${d.label} : ${fmtValue(f, d.value)}`}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-ivory">{d.label}</span>
            <span className="tabular-nums text-ivory-muted">
              {fmtValue(f, d.value)}
              {d.sub ? ` · ${d.sub}` : ""}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.04]">
            <div className="h-full rounded-full bg-gold/75" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
