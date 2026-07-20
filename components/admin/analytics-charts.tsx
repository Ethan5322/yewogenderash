"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";
import { formatETB } from "@/lib/format";
import type { DonationDay, StatusCount } from "@/lib/analytics";

// Theme-aware: these CSS vars flip with light/dark automatically.
const INK = "var(--muted-foreground)";
const GRID = "var(--border)";
const PRIMARY = "var(--primary)";

const axisTick = { fill: INK, fontSize: 12 } as const;

const compactETB = (n: number) =>
  n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n);

function TooltipCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export function DonationsTrendChart({ data }: { data: DonationDay[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="donationFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.28} />
            <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} strokeOpacity={0.6} />
        <XAxis
          dataKey="label"
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
        />
        <YAxis
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={compactETB}
        />
        <Tooltip
          cursor={{ stroke: GRID }}
          content={({ active, payload }: any) =>
            active && payload?.length ? (
              <TooltipCard
                title={payload[0].payload.label}
                value={formatETB(payload[0].value ?? 0)}
              />
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke={PRIMARY}
          strokeWidth={2}
          fill="url(#donationFill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CampaignsByStatusChart({ data }: { data: StatusCount[] }) {
  const height = Math.max(180, data.length * 34);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 28, bottom: 4, left: 8 }}
      >
        <CartesianGrid horizontal={false} stroke={GRID} strokeOpacity={0.6} />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={104}
        />
        <Tooltip
          cursor={{ fill: GRID, fillOpacity: 0.35 }}
          content={({ active, payload }: any) =>
            active && payload?.length ? (
              <TooltipCard
                title={payload[0].payload.label}
                value={`${payload[0].value} campaign${payload[0].value === 1 ? "" : "s"}`}
              />
            ) : null
          }
        />
        <Bar dataKey="count" fill={PRIMARY} radius={[0, 4, 4, 0]} barSize={16}>
          <LabelList
            dataKey="count"
            position="right"
            className="fill-muted-foreground"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
