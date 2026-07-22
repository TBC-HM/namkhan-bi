'use client';
// app/marketing/social/google-business/_client/ReviewsVelocityChart.tsx
// PBS 2026-07-23: Weekly review velocity + response overlay chart for the
// Google Business Profile landing page. Uses Recharts + the Namkhan palette
// (no default library colours — design_system §7 colour law).

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const FOREST = '#1F3A2E';
const GOLD   = '#B8792E';
const HAIR   = '#E6DFCC';
const INK_M  = '#5A5A5A';
const WHITE  = '#FFFFFF';

interface Point { week: string; received: number; responded: number; avgHours: number | null }

function fmtLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function ReviewsVelocityChart({ data }: { data: Point[] }) {
  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="2 3" stroke={HAIR} vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: INK_M, fontSize: 10 }}
            tickFormatter={fmtLabel}
            axisLine={{ stroke: HAIR }}
            tickLine={{ stroke: HAIR }}
          />
          <YAxis
            tick={{ fill: INK_M, fontSize: 10 }}
            axisLine={{ stroke: HAIR }}
            tickLine={{ stroke: HAIR }}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(31,58,46,0.06)' }}
            contentStyle={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, fontSize: 11 }}
            labelFormatter={(v) => 'Week of ' + fmtLabel(String(v))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
          <Bar dataKey="received"  name="New reviews" fill={GOLD}   radius={[2, 2, 0, 0]} />
          <Bar dataKey="responded" name="Replied"     fill={FOREST} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
