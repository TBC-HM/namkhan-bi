'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type TrendPoint = { date: string; sessions: number; pageviews: number };

export default function TrendChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) return <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'#8A8A8A', fontSize:12 }}>No trend data — pull GA4 first</div>;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top:5, right:20, left:0, bottom:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E6DFCC" />
        <XAxis dataKey="date" tick={{ fontSize:10, fill:'#8A8A8A' }} />
        <YAxis tick={{ fontSize:10, fill:'#8A8A8A' }} width={35} />
        <Tooltip contentStyle={{ fontSize:11, border:'1px solid #E6DFCC', background:'#FFFFFF' }} />
        <Legend iconSize={10} wrapperStyle={{ fontSize:11 }} />
        <Line type="monotone" dataKey="sessions" stroke="#084838" strokeWidth={2} dot={false} name="Sessions" />
        <Line type="monotone" dataKey="pageviews" stroke="#C28F2C" strokeWidth={1.5} dot={false} name="Pageviews" strokeDasharray="5 3" />
      </LineChart>
    </ResponsiveContainer>
  );
}
