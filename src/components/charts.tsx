"use client";
import { useEffect, useRef, useState } from "react";

type Point = { date: string; leads: number; admissions: number };

const SERIES = "#2a78d6"; // categorical slot 1 (validated reference palette)

/** Daily leads, area + 2px line, crosshair tooltip. Single series, so no legend box: the card title names it. */
export function TrendChart({
  data,
  height: maxH = 240,
}: {
  data: Point[];
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) =>
      setW(Math.max(240, Math.floor(e.contentRect.width))),
    );
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const height = w ? Math.round(Math.min(maxH, Math.max(200, w * 0.55))) : maxH;
  const pad = { l: 32, r: 12, t: 12, b: 26 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const max = Math.max(4, ...data.map((d) => d.leads));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const x = (i: number) =>
    pad.l + (data.length <= 1 ? 0 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const line = data
    .map(
      (d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.leads).toFixed(1)}`,
    )
    .join("");
  const area = `${line}L${x(data.length - 1)},${pad.t + ih}L${x(0)},${pad.t + ih}Z`;
  const fmt = (s: string) =>
    new Date(s + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(iw / 70)));

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round((px / r.width) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const h = hover != null ? data[hover] : null;

  return (
    <div
      ref={ref}
      className="relative w-full min-w-0 select-none overflow-hidden"
      style={{ height }}
    >
      {w > 0 && (
        <svg
          width={w}
          height={height}
          role="img"
          aria-label="Leads received per day"
        >
          <defs>
            <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={SERIES} stopOpacity="0.18" />
              <stop offset="100%" stopColor={SERIES} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((k) => (
            <g key={k}>
              <line
                x1={pad.l}
                x2={w - pad.r}
                y1={y(k * step)}
                y2={y(k * step)}
                stroke="#e8eaf0"
                strokeDasharray={k ? "3 4" : undefined}
              />
              <text
                x={pad.l - 8}
                y={y(k * step) + 4}
                textAnchor="end"
                className="fill-slate-400 text-[11px] tabular-nums"
              >
                {k * step}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            (i % labelEvery === 0 && x(data.length - 1) - x(i) > 84) ||
            i === data.length - 1 ? (
              <text
                key={d.date}
                x={x(i)}
                y={height - 6}
                textAnchor={
                  i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"
                }
                className="fill-slate-400 text-[11px]"
              >
                {fmt(d.date)}
              </text>
            ) : null,
          )}
          <path d={area} fill="url(#trendFill)" />
          <path
            d={line}
            fill="none"
            stroke={SERIES}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {hover != null && (
            <>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={pad.t}
                y2={pad.t + ih}
                stroke="#94a3b8"
                strokeDasharray="3 3"
              />
              <circle
                cx={x(hover)}
                cy={y(data[hover].leads)}
                r={5}
                fill={SERIES}
                stroke="#fff"
                strokeWidth={2}
              />
            </>
          )}
          <rect
            x={pad.l}
            y={pad.t}
            width={iw}
            height={ih}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {h && hover != null && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(Math.max(x(hover) - 70, 0), w - 150),
            top: Math.max(y(h.leads) - 78, 0),
            width: 140,
          }}
        >
          <div className="font-semibold text-slate-800">{fmt(h.date)}</div>
          <div className="mt-1 flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: SERIES }}
              />
              Leads
            </span>
            <b className="tabular-nums text-slate-900">{h.leads}</b>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span className="pl-3.5">Admissions</span>
            <b className="tabular-nums text-slate-900">{h.admissions}</b>
          </div>
        </div>
      )}
    </div>
  );
}

/** Horizontal magnitude bars with hover tooltip; label + value always visible (text in ink, not series color). */
export function HBars({
  rows,
  color = SERIES,
}: {
  rows: { label: string; value: number; sub?: string; href?: string }[];
  color?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <a
          key={r.label}
          href={r.href}
          className="group block"
          title={`${r.label}: ${r.value}${r.sub ? ` · ${r.sub}` : ""}`}
        >
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
            <span className="truncate text-slate-700 group-hover:text-slate-900">
              {r.label}
            </span>
            <span className="shrink-0 tabular-nums">
              <b className="font-semibold text-slate-900">{r.value}</b>
              {r.sub && (
                <span className="ml-1.5 text-xs text-slate-400">{r.sub}</span>
              )}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full transition-[filter] group-hover:brightness-110"
              style={{
                width: `${Math.max(2, (r.value / max) * 100)}%`,
                background: color,
              }}
            />
          </div>
        </a>
      ))}
    </div>
  );
}
