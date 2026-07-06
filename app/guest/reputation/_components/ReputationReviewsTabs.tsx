'use client';
// app/guest/reputation/_components/ReputationReviewsTabs.tsx
// PBS 2026-07-06: tabs for the "Latest reviews (local sample)" list — always shows
// tripadvisor / booking / expedia / ctrip even when 0 reviews yet.
import { useState } from 'react';
import SourceBadge from '@/components/marketing/SourceBadge';

type Review = {
  id: number;
  source: string;
  reviewer_name: string | null;
  reviewer_country?: string | null;
  rating_norm: number | string | null;
  title: string | null;
  body: string | null;
  reviewed_at: string | null;
  response_status: string | null;
};

const TABS = ['tripadvisor', 'booking', 'expedia', 'ctrip'] as const;
const LABEL: Record<string, string> = {
  tripadvisor: 'TripAdvisor', booking: 'Booking.com', expedia: 'Expedia', ctrip: 'Trip.com',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return '—'; }
}

const HAIR = '#E6DFCC';
const WHITE = '#FFFFFF';
const INK = '#1B1B1B';
const INK_S = '#3A3A3A';
const INK_M = '#5A5A5A';
const RED = '#B04A2F';

export default function ReputationReviewsTabs({ reviews }: { reviews: Review[] }) {
  const [active, setActive] = useState<string>('tripadvisor');
  const counts = new Map<string, number>();
  for (const t of TABS) counts.set(t, 0);
  for (const r of reviews) counts.set(r.source, (counts.get(r.source) ?? 0) + 1);

  const filtered = reviews.filter(r => r.source === active);

  return (
    <div>
      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, margin:'8px 2px 8px' }}>
        Latest reviews (local sample)
      </div>

      {/* Tab strip */}
      <div style={{ display:'flex', gap:6, borderBottom:'1px solid ' + HAIR, marginBottom:12 }}>
        {TABS.map(t => {
          const c = counts.get(t) ?? 0;
          const isActive = t === active;
          return (
            <button key={t} onClick={() => setActive(t)}
              style={{
                display:'inline-flex', alignItems:'center', gap:6,
                padding:'8px 14px', fontSize:12, fontWeight: isActive ? 600 : 500,
                background:'transparent', border:'none',
                color: isActive ? INK : INK_M,
                borderBottom: isActive ? '2px solid ' + INK : '2px solid transparent',
                cursor:'pointer', fontFamily:'inherit',
              }}>
              <SourceBadge source={t} />
              {LABEL[t]}
              <span style={{
                fontSize:10, fontWeight:500, color: isActive ? INK_M : '#8A8A8A',
                background:'#F5EEDF', padding:'1px 6px', borderRadius:99,
              }}>{c}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding:'32px 24px', background:WHITE, border:'1px dashed ' + HAIR, borderRadius:6, textAlign:'center', color:INK_M, fontSize:12 }}>
          No {LABEL[active]} reviews scraped yet. Click "Pull latest" once the {LABEL[active]} scrape is wired.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(r => (
            <div key={r.id} style={{ padding:'12px 14px', background:WHITE, border:'1px solid ' + HAIR, borderRadius:6 }}>
              <div style={{ display:'flex', gap:10, alignItems:'baseline', flexWrap:'wrap', marginBottom:4 }}>
                <SourceBadge source={r.source} />
                <span style={{ fontWeight:600 }}>{r.rating_norm != null ? Number(r.rating_norm).toFixed(1) : '—'} / 5</span>
                <span style={{ color:INK_M, fontSize:11 }}>{fmtDate(r.reviewed_at)}</span>
                <span style={{
                  fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase',
                  padding:'2px 8px', borderRadius:10,
                  background: r.response_status === 'responded' ? '#E4F1E0' : '#FBE8E4',
                  color:      r.response_status === 'responded' ? '#1F5C2C' : RED,
                  border: '1px solid ' + (r.response_status === 'responded' ? '#A9CFA0' : '#E8B7AB'),
                }}>{r.response_status ?? 'unknown'}</span>
                {r.reviewer_name && <span style={{ color:INK_S, fontSize:11 }}>by {r.reviewer_name}</span>}
              </div>
              {r.title && <div style={{ fontStyle:'italic', fontWeight:500, color:INK, marginBottom:4 }}>{r.title}</div>}
              {r.body && <div style={{ fontSize:12, color:INK_S, lineHeight:1.5, whiteSpace:'pre-wrap' }}>{r.body}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}