'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';

type PosBucket = { bucket: string; count: number; color: string };

export default function PositionDistChart({ data }: { data: PosBucket[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) return <div style={{ height:140, display:'flex', alignItems:'center', justifyContent:'center', color:'#8A8A8A', fontSize:12 }}>No keyword data yet</div>;
  return (
    <div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top:5, right:16, left:0, bottom:20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E6DFCC" vertical={false} />
          <XAxis dataKey="bucket" tick={{ fontSize:9, fill:'#5A5A5A' }} interval={0} angle={-10} textAnchor="end" />
          <YAxis tick={{ fontSize:10, fill:'#8A8A8A' }} width={28} />
          <Tooltip contentStyle={{ fontSize:11, border:'1px solid #E6DFCC', background:'#FFFFFF' }} formatter={(v: number) => [v + ' keywords', 'Count']} />
          <Bar dataKey="count" radius={[3,3,0,0]} maxBarSize={52}>{data.map((e,i)=>(<Cell key={i} fill={e.color} />))}</Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap' as const, marginTop:2 }}>
        {data.map(d => (
          <div key={d.bucket} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'#5A5A5A' }}>
            <span style={{ display:'inline-block', width:8, height:8, borderRadius:2, background:d.color }} />
            <strong style={{ color:'#1B1B1B' }}>{d.count}</strong> {d.bucket}
          </div>
        ))}
      </div>
    </div>
  );
}
