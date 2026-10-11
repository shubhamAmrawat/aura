"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Chart colours (validated for the dark surface #111111):
// single series = green (brand-adjacent), two series = blue + orange.
export const C = {
  series: "#57a83a",
  blue: "#3987e5",
  orange: "#d95926",
  grid: "rgba(255,255,255,0.06)",
  axis: "#727070",
  text: "#f5f0eb",
  textSecondary: "#888888",
  surface: "#111111",
};

const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
export const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

type TipPayload = { name?: string; value?: number; color?: string; dataKey?: string | number };

function ChartTooltip({ active, payload, label, labelFormat }: {
  active?: boolean;
  payload?: TipPayload[];
  label?: string | number;
  labelFormat?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
      <p className="mb-1" style={{ color: C.textSecondary }}>{labelFormat ? labelFormat(String(label)) : label}</p>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="inline-block w-3 h-[2px] rounded" style={{ background: p.color }} />
          <span className="font-semibold tabular-nums" style={{ color: C.text }}>{fmt(Number(p.value ?? 0))}</span>
          <span style={{ color: C.textSecondary }}>{p.name}</span>
        </div>
      ))}
    </div>
  );
}

/** Tiny trend line for a KPI tile (no axes). */
export function Sparkline({ values }: { values: number[] }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className="h-8 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={[0, (max: number) => Math.max(1, max)]} />
          <Line type="monotone" dataKey="v" stroke={C.series} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** One metric over time (area, single series → no legend; the title names it). */
export function TrendChart({ data, dataKey, name }: { data: Record<string, number | string>[]; dataKey: string; name: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.series} stopOpacity={0.28} />
            <stop offset="100%" stopColor={C.series} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} domain={[0, (max: number) => Math.max(4, max)]} tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
        <Tooltip content={<ChartTooltip labelFormat={shortDay} />} cursor={{ stroke: "rgba(255,255,255,0.25)", strokeWidth: 1 }} />
        <Area type="monotone" dataKey={dataKey} name={name} stroke={C.series} strokeWidth={2} fill="url(#trendFill)"
          activeDot={{ r: 4, stroke: C.surface, strokeWidth: 2 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Sign-ups vs uploads per day (grouped bars, legend + tooltip). */
export function GrowthChart({ data }: { data: Record<string, number | string>[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barGap={1} barCategoryGap="12%">
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} domain={[0, (max: number) => Math.max(4, max)]} tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
        <Tooltip content={<ChartTooltip labelFormat={shortDay} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Legend verticalAlign="top" align="right" height={24} iconType="rect" iconSize={10}
          formatter={(v: string) => <span style={{ color: C.textSecondary, fontSize: 12 }}>{v}</span>} />
        <Bar dataKey="signups" name="Sign-ups" fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        <Bar dataKey="uploads" name="Uploads" fill={C.orange} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars for categories (single series). */
export function CategoryChart({ data, dataKey, name }: { data: { name: string; value: number }[]; dataKey: "value"; name: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} barCategoryGap={4}>
        <XAxis type="number" hide domain={[0, (max: number) => Math.max(1, max)]} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fill: C.textSecondary, fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey={dataKey} name={name} fill={C.series} radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false}
          label={{ position: "right", fill: C.textSecondary, fontSize: 11, formatter: (v: unknown) => fmt(Number(v)) }} />
      </BarChart>
    </ResponsiveContainer>
  );
}
