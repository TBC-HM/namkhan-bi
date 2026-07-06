// components/DismissedContainer.tsx
// PBS 2026-07-07: shows the ConclusionBlock dismissal ledger — count + top reasons.
// Reads guest.guardrail_dismissals via a public bridge view.
// Purpose: the CEO can see WHICH rules operators are silencing + WHY, so
// guardrails can be tuned (or the rule dropped).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

interface Row {
  insight_key: string | null;
  reason: string | null;
  note: string | null;
  ts: string | null;
}

const REASON_LABEL: Record<string, string> = {
  handled:      'Already handled',
  not_relevant: 'Not relevant',
  threshold:    'Threshold too tight',
  false_signal: 'Wrong signal',
  other:        'Other',
};

const REASON_COLOR: Record<string, string> = {
  handled:      '#1F5C2C',
  not_relevant: '#5A5A5A',
  threshold:    '#8B5A1C',
  false_signal: '#B04A2F',
  other:        '#1F3A5A',
};

export default async function DismissedContainer() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('guest').from('guardrail_dismissals')
    .select('insight_key, reason, note, ts')
    .order('ts', { ascending: false })
    .limit(500);

  const rows: Row[] = (data as Row[]) ?? [];
  const total = rows.length;

  // PBS 2026-07-07 evening: pending conclusions count is the total number of
  // active guardrail rules (across all depts + all domains) — a rough proxy for
  // "what conclusions could fire". Dismissed rate = total dismissed / (pending + total).
  const { data: guardrailsData } = await sb.from('guardrails')
    .select('id, active').eq('active', true).limit(2000);
  const pending = (guardrailsData as { id: number; active: boolean }[] ?? []).length;
  const dismissRate = pending + total > 0 ? Math.round((total / (pending + total)) * 100) : 0;

  const byReason = new Map<string, number>();
  for (const r of rows) {
    const k = r.reason ?? 'unknown';
    byReason.set(k, (byReason.get(k) ?? 0) + 1);
  }
  const reasonRows = Array.from(byReason.entries()).sort((a, b) => b[1] - a[1]);

  const byInsight = new Map<string, number>();
  for (const r of rows) {
    const k = r.insight_key ?? 'unknown';
    byInsight.set(k, (byInsight.get(k) ?? 0) + 1);
  }
  const insightRows = Array.from(byInsight.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const otherNotes = rows
    .filter(r => r.reason === 'other' && r.note)
    .slice(0, 8)
    .map(r => ({ note: r.note!, ts: r.ts ?? '', insight_key: r.insight_key ?? '' }));

  return (
    <div style={boxOuter}>
      <div style={boxHeader}>
        <span style={boxTitle}>Conclusions ledger · {pending} pending · {total} dismissed</span>
        <span style={boxSubtitle}>Dismiss rate {dismissRate}% · patterns below tell you where to tune the guardrails</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 8 }}>
        <div style={statCell}>
          <div style={statValue}>{pending}</div>
          <div style={statLabel}>Pending rules</div>
        </div>
        <div style={statCell}>
          <div style={{ ...statValue, color: '#B04A2F' }}>{total}</div>
          <div style={statLabel}>Dismissed all-time</div>
        </div>
        <div style={statCell}>
          <div style={{ ...statValue, color: dismissRate > 20 ? '#B04A2F' : dismissRate > 10 ? '#8B5A1C' : '#1F5C2C' }}>{dismissRate}%</div>
          <div style={statLabel}>Dismiss rate</div>
        </div>
      </div>
      {total === 0 ? (
        <div style={{ fontSize: 12, color: '#5A5A5A', fontStyle: 'italic', padding: '10px 4px' }}>
          No dismissals yet — every conclusion so far has been kept or acted on.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
          <div>
            <div style={sectionLabel}>By reason</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {reasonRows.map(([r, n]) => (
                <div key={r} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 40px', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: REASON_COLOR[r] ?? '#1B1B1B', fontWeight: 500 }}>{REASON_LABEL[r] ?? r}</span>
                  <div style={{ height: 6, background: '#F0EBD9', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${(n / total) * 100}%`, height: '100%', background: REASON_COLOR[r] ?? '#1B1B1B' }} />
                  </div>
                  <span style={{ textAlign: 'right', color: '#3A3A3A', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={sectionLabel}>Most-dismissed rules (top 10)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {insightRows.map(([k, n]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#3A3A3A' }}>
                  <span style={{ fontFamily: 'monospace' }}>{k}</span>
                  <span style={{ color: '#5A5A5A' }}>{n}× dismissed</span>
                </div>
              ))}
            </div>
          </div>

          {otherNotes.length > 0 && (
            <div>
              <div style={sectionLabel}>Recent “Other” notes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {otherNotes.map((o, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#3A3A3A', padding: '4px 6px', background: '#FAFAF7', border: '1px dashed #E6DFCC', borderRadius: 3 }}>
                    <div style={{ color: '#1B1B1B' }}>{o.note}</div>
                    <div style={{ fontSize: 10, color: '#8A8A8A', marginTop: 2, fontFamily: 'monospace' }}>{o.insight_key} · {o.ts.slice(0, 10)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const boxOuter: React.CSSProperties = { border: '1px solid #E6DFCC', borderRadius: 6, background: '#FFFFFF', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 };
const statCell: React.CSSProperties = { padding: '8px 10px', background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 4 };
const statValue: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#1B1B1B', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' };
const statLabel: React.CSSProperties = { fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A', marginTop: 2 };
const boxHeader: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 6, borderBottom: '1px solid #F0EBD9' };
const boxTitle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#1B1B1B' };
const boxSubtitle: React.CSSProperties = { fontSize: 11, color: '#5A5A5A' };
const sectionLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#5A5A5A', marginBottom: 4,
};
