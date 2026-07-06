// app/marketing/prospects/scrape/_components/ScrapeHistory.tsx
// Shows recent Apify scrape runs so PBS can see what was already fetched + avoid double-scraping.
import type { ScrapeLogRow } from '../page';

const ACTOR_LABELS: Record<string, string> = {
  gmaps_contacts:  '1 · Google Maps',
  google_search:   '2 · Google SERP',
  booking:         '3 · Booking hotels',
  email_social:    '4 · Website emails',
  leads_finder:    '5 · B2B leads (Apollo)',
  linkedin_email:  '6 · LinkedIn',
  email_verifier:  '7 · Verify emails',
};

function ago(iso: string): string {
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default function ScrapeHistory({ rows }: { rows: ScrapeLogRow[] }) {
  if (!rows || rows.length === 0) {
    return (
      <div style={box}>
        <div style={header}>Scrape history</div>
        <div style={{ fontSize:12, color:'#5A5A5A' }}>No scrapes yet.</div>
      </div>
    );
  }
  return (
    <div style={box}>
      <div style={header}>
        Scrape history — last {rows.length} runs
        <span style={{ fontSize:10, color:'#5A5A5A', marginLeft:8, fontWeight:400 }}>
          check this before running again to avoid re-scraping the same query
        </span>
      </div>
      <div style={{ overflow:'auto' }}>
        <table style={tbl}>
          <thead>
            <tr>
              <th style={th}>When</th>
              <th style={th}>Actor</th>
              <th style={th}>Query</th>
              <th style={th}>Tags applied</th>
              <th style={{ ...th, textAlign:'right' }}>Returned</th>
              <th style={{ ...th, textAlign:'right' }}>Inserted</th>
              <th style={{ ...th, textAlign:'right' }}>Skipped</th>
              <th style={{ ...th, textAlign:'right' }}>Duration</th>
              <th style={th}>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={td}>{ago(r.created_at)}</td>
                <td style={td}>{ACTOR_LABELS[r.actor] ?? r.actor}</td>
                <td style={{ ...td, maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.input_summary ?? ''}>
                  {r.input_summary ?? '—'}
                </td>
                <td style={{ ...td, fontSize:10 }}>
                  {(r.tag_hints ?? []).map(t => (
                    <span key={t} style={pill}>{t}</span>
                  ))}
                </td>
                <td style={{ ...td, textAlign:'right' }}>{r.items_returned}</td>
                <td style={{ ...td, textAlign:'right', color:'#084838', fontWeight:600 }}>{r.inserted}</td>
                <td style={{ ...td, textAlign:'right', color:'#8B5A1C' }}>{r.skipped}</td>
                <td style={{ ...td, textAlign:'right' }}>{r.duration_ms ? `${(r.duration_ms/1000).toFixed(1)}s` : '—'}</td>
                <td style={td}>
                  {r.ok ? <span style={{ color:'#084838' }}>✓</span> : <span title={r.error ?? ''} style={{ color:'#B04A2F' }}>✕</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const box: React.CSSProperties = { border:'1px solid #E6DFCC', borderRadius:6, background:'#FFFFFF', padding:14, marginTop:20 };
const header: React.CSSProperties = { fontSize:12, fontWeight:600, color:'#1B1B1B', marginBottom:10 };
const tbl: React.CSSProperties = { borderCollapse:'collapse', width:'100%' };
const th: React.CSSProperties = { textAlign:'left', padding:'6px 8px', fontSize:11, fontWeight:600, color:'#5A5A5A', borderBottom:'1px solid #E6DFCC', whiteSpace:'nowrap' };
const td: React.CSSProperties = { padding:'6px 8px', fontSize:12, color:'#1B1B1B', borderBottom:'1px solid #F0EBD9', whiteSpace:'nowrap' };
const pill: React.CSSProperties = { display:'inline-block', background:'#F5EEDF', color:'#8B5A1C', padding:'1px 6px', borderRadius:99, marginRight:4, marginBottom:2, fontSize:10 };