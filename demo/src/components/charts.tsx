"use client";

/**
 * 图表组件 —— 整合自 civora-dashboard 的 Recharts 3 渐变图表模式：
 * 渐变面积图 / 对比柱图，配色改为本平台的 indigo/emerald 体系。
 */

import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const fmtWan = (v: number) => (v >= 10000 ? `${Math.round(v / 1000) / 10}万` : `${v}`);

function TipBox({ label, rows }: { label: string; rows: { name: string; value: number; color: string }[] }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur">
      <div className="mb-1.5 text-[11px] font-semibold text-zinc-700">{label}</div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2 py-0.5 text-[11px]">
          <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
          <span className="text-zinc-500">{r.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-zinc-800">¥{fmtWan(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export type DailyPoint = { day: string; received: number; cumulative: number };
export type SiteBarPoint = { name: string; receivable: number; received: number };

/** 累计回款面积图（civora RevenueChart 式渐变） */
export function ReceiveAreaChart({ data }: { data: DailyPoint[] }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={42} tickFormatter={(v) => (v >= 10000 ? `${Math.round(v / 10000)}万` : `${v}`)} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TipBox label={String(label)} rows={[{ name: "累计回款", value: payload[0].payload.cumulative, color: "#4f46e5" }]} />
              ) : null
            }
          />
          <Area type="monotone" dataKey="cumulative" stroke="#4f46e5" strokeWidth={2.5} fill="url(#cumGrad)" dot={false} activeDot={{ r: 4, stroke: "#4f46e5", strokeWidth: 2, fill: "#fff" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 各工地应收 vs 已收对比柱图 */
export function SiteBarChart({ data }: { data: SiteBarPoint[] }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barGap={4}>
          <defs>
            <linearGradient id="recvBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#a5b4fc" stopOpacity={0.55} />
            </linearGradient>
            <linearGradient id="gotBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#6ee7b7" stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={42} tickFormatter={(v) => (v >= 10000 ? `${Math.round(v / 10000)}万` : `${v}`)} />
          <Tooltip
            cursor={{ fill: "rgba(99,102,241,0.06)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TipBox
                  label={String(label)}
                  rows={[
                    { name: "应收合计", value: payload.find((p) => p.dataKey === "receivable")?.payload.receivable ?? 0, color: "#6366f1" },
                    { name: "已收款", value: payload.find((p) => p.dataKey === "received")?.payload.received ?? 0, color: "#10b981" },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="receivable" fill="url(#recvBar)" radius={[6, 6, 0, 0]} maxBarSize={38} isAnimationActive={false} />
          <Bar dataKey="received" fill="url(#gotBar)" radius={[6, 6, 0, 0]} maxBarSize={38} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
