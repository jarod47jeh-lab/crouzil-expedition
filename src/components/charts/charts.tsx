"use client";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { motion } from "motion/react";
import { nf } from "@/lib/utils";

const axis = { fontSize: 11, fill: "var(--muted)" };
const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-pop)" },
  labelStyle: { color: "var(--ink)", fontWeight: 600 },
  itemStyle: { color: "var(--ink)" },
  cursor: { fill: "color-mix(in srgb, var(--muted) 10%, transparent)" },
};

export type Series = { key: string; label: string; color: string };

export function Bars({
  data,
  x,
  series,
  height = 240,
  stacked,
  refLine,
  horizontal,
}: {
  data: Record<string, string | number>[];
  x: string;
  series: Series[];
  height?: number;
  stacked?: boolean;
  refLine?: { y: number; label: string };
  horizontal?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, bottom: 0, left: horizontal ? 8 : -18 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={!!horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey={x} tick={axis} axisLine={false} tickLine={false} width={140} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
          </>
        )}
        <Tooltip {...tooltipStyle} formatter={(v: number) => nf(v, 1)} />
        {refLine && <ReferenceLine y={refLine.y} stroke="var(--bad)" strokeDasharray="5 4" label={{ value: refLine.label, fill: "var(--bad)", fontSize: 11, position: "insideTopRight" }} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            stackId={stacked ? "a" : undefined}
            radius={stacked ? (i === series.length - 1 ? (horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]) : 0) : horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            maxBarSize={42}
            animationDuration={900}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Trend({
  data,
  x,
  series,
  height = 240,
  domain,
  refLine,
  area,
  unit = "",
}: {
  data: Record<string, string | number | null>[];
  x: string;
  series: Series[];
  height?: number;
  domain?: [number | "auto", number | "auto"];
  refLine?: { y: number; label: string };
  area?: boolean;
  unit?: string;
}) {
  const Chart = area ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={axis} axisLine={false} tickLine={false} domain={domain} tickFormatter={(v) => nf(v, 0) + unit} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => nf(v, 2) + unit} />
        {refLine && <ReferenceLine y={refLine.y} stroke="var(--bad)" strokeDasharray="5 4" label={{ value: refLine.label, fill: "var(--bad)", fontSize: 11, position: "insideBottomRight" }} />}
        {series.map((s) =>
          area ? (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5} fill={`url(#g-${s.key})`} connectNulls animationDuration={1000} dot={false} activeDot={{ r: 4 }} />
          ) : (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5} connectNulls dot={{ r: 2.5 }} activeDot={{ r: 5 }} animationDuration={1000} />
          ),
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 220, center }: { data: { name: string; value: number; color: string }[]; height?: number; center?: React.ReactNode }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip {...tooltipStyle} formatter={(v: number) => `${nf(v)} (${nf((v / (total || 1)) * 100, 0)} %)`} />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none" animationDuration={900}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {center && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}

export function Legend({ items, inline }: { items: { label: string; color: string; value?: React.ReactNode }[]; inline?: boolean }) {
  return (
    <ul className={inline ? "flex flex-wrap gap-x-4 gap-y-1.5 text-sm" : "grid gap-1.5 text-sm"}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: i.color }} />
          <span className={inline ? "" : "min-w-0 flex-1 truncate"}>{i.label}</span>
          {i.value != null && <span className="tabular font-semibold">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Jauge circulaire (taux de conformité) */
export function Gauge({ value, target, size = 150 }: { value: number | null; target: number; size?: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  // échelle 90-100 % pour rendre visibles les écarts autour de l'objectif
  const t = Math.max(0, Math.min(1, (v - 90) / 10));
  const ok = value != null && value >= target;
  return (
    <svg viewBox="0 0 120 120" style={{ width: "100%", maxWidth: size, height: "auto" }} className="-rotate-90">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="10" />
      <motion.circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={ok ? "var(--ok)" : "var(--bad)"}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - t) }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

/** Classement en barres horizontales (top clients, types, véhicules…) */
export function RankBars({ data, color, unit = "" }: { data: { k: string; v: number; href?: string }[]; color: string; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <ul className="grid gap-2.5">
      {data.map((d, i) => (
        <li key={d.k} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{d.href ? <a href={d.href} className="hover:text-brand">{d.k}</a> : d.k}</span>
            <span className="tabular shrink-0 font-semibold">
              {nf(d.v)}
              {unit}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full"
              style={{ background: color }}
              initial={{ width: 0 }}
              animate={{ width: `${(d.v / max) * 100}%` }}
              transition={{ delay: 0.05 * i, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
