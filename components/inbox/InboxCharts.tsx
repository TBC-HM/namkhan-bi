'use client';
// 3-column charts row for /inbox dashboard.
// Brand palette resolved from styles/globals.css :root.

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from 'recharts';

const C = {
  grid:     '#d8cca8',  // --line-soft
  axis:     '#7d7565',  // --ink-mute
  bg:       '#1c1815',  // --ink
  border:   '#4a443c',  // --ink-soft
  label:    '#c4a06b',  // --brass-soft
  brass:    '#a8854a',  // --brass
  moss:     '#6b9379',  // --moss-glow
  bad:      '#a02d2d',  // --st-bad
};

const tooltipStyle = {
  background: C.bg, border: `1px solid ${C.border}`,
  fontSize: '11px', fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  color: '#f4ecd8', borderRadius: 4, padding: '8px 12px',
};
const labelStyle = { color: C.label, marginBottom: 4, fontWeight: 600 };

// 1. Volume by day (last 30d) — stacked in/out bars
export function VolumeByDayChart({ data }: { data: Array<{ date: string; inbound: number; outbound: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" stroke={C.axis} fontSize={10} tickFormatter={(d: string) => d?.slice(5)} />
        <YAxis stroke={C.axis} fontSize={10} />
        <Tooltip
          cursor={{ fill: 'rgba(168,133,74,0.08)' }}
          contentStyle={tooltipStyle}
          labelStyle={labelStyle}
        />
        <Bar dataKey="inbound"  stackId="vol" fill={C.moss}  fillOpacity={0.85} name="↘ Received" />
        <Bar dataKey="outbound" stackId="vol" fill={C.brass} fillOpacity={0.85} name="↗ Sent" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// 2. Mailbox volume — horizontal bars, top N intended_mailbox addresses
export function MailboxVolumeChart({ data }: { data: Array<{ mailbox: string; inbound: number; outbound: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, left: 60, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" stroke={C.axis} fontSize={10} />
        <YAxis type="category" dataKey="mailbox" stroke={C.axis} fontSize={10} width={140} tick={{ fontSize: 10 }} />
        <Tooltip cursor={{ fill: 'rgba(168,133,74,0.08)' }} contentStyle={tooltipStyle} labelStyle={labelStyle} />
        <Bar dataKey="inbound"  stackId="vol" fill={C.moss}  fillOpacity={0.85} name="↘ Received" />
        <Bar dataKey="outbound" stackId="vol" fill={C.brass} fillOpacity={0.85} name="↗ Sent" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// 3. Response time histogram — bucketed into <1h, 1-4h, 4-12h, 12-24h, 1-3d, 3d+
export function ResponseTimeChart({ data }: { data: Array<{ bucket: string; threads: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="bucket" stroke={C.axis} fontSize={10} />
        <YAxis stroke={C.axis} fontSize={10} />
        <Tooltip cursor={{ fill: 'rgba(168,133,74,0.08)' }} contentStyle={tooltipStyle} labelStyle={labelStyle} />
        <Bar dataKey="threads" fill={C.brass} fillOpacity={0.85} name="Threads" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// 4. Median response time per day, last 30d — line
export function ResponseTrendChart({ data }: { data: Array<{ date: string; median_min: number | null }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" stroke={C.axis} fontSize={10} tickFormatter={(d: string) => d?.slice(5)} />
        <YAxis stroke={C.axis} fontSize={10} tickFormatter={(v: number) => v >= 60 ? `${Math.round(v/60)}h` : `${v}m`} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={labelStyle}
          formatter={(v: number) => [`${v} min`, 'Median']}
        />
        <Line type="monotone" dataKey="median_min" stroke={C.brass} strokeWidth={2} dot={{ fill: C.brass, r: 3 }} name="Median reply" connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
