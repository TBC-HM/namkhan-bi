'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type SourceRow = { source: string; sessions: number };

export default function SourcesChart({ data }: { data: SourceRow[] }) {
  if (!data.length) return <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'#8A8A8A', fontSize:12 }}>No source data</div>;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} layout="vertical" margin={{ top:0, right:20, left:0, bottom:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E6DFCC" horizontal={false} />
        <XAxis type="number" tick={{ fontSize:10, fill:'#8A8A8A' }} />
        <YAxis type="category" dataKey="source" tick={{ fontSize:10, fill:'#5A5A5A' }} width={120} />
        <Tooltip contentStyle={{ fontSize:11, border:'1px solid #E6DFCC', background:'#FFFFFF' }} />
        <Bar dataKey="sessions" fill="#084838" radius={[0,3,3,0]} name="Sessions" maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
