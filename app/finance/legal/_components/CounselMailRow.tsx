// app/finance/legal/_components/CounselMailRow.tsx
// PBS 2026-07-20 pm · 3 side-by-side email containers on /finance/legal for
// external counsel domains: grandaccountinglao.com · brslawyers.com ·
// grandeurlaw.com. Feed = public.v_legal_counsel_emails (bridge over
// sales.email_messages) — inbound + outbound in one merged list, newest first,
// last 10 per domain.

import { Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

interface CounselMail {
  id: string;
  domain: string;
  direction: 'inbound' | 'outbound';
  mailbox: string | null;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  received_at: string;
  snippet: string | null;
}

const DOMAINS = [
  { key: 'grandaccountinglao.com', label: 'Grand Accounting Lao', accent: '#7A4E20' },
  { key: 'brslawyers.com',         label: 'BRS Lawyers',           accent: '#3A5C7A' },
  { key: 'grandeurlaw.com',        label: 'Grandeur Law',          accent: '#084838' },
];

async function loadPerDomain() {
  const sb = getSupabaseAdmin();
  const out: Record<string, CounselMail[]> = {};
  for (const d of DOMAINS) {
    const { data } = await sb.from('v_legal_counsel_emails')
      .select('id, domain, direction, mailbox, from_email, from_name, subject, received_at, snippet')
      .eq('domain', d.key)
      .order('received_at', { ascending: false })
      .limit(15);
    out[d.key] = ((data ?? []) as CounselMail[]);
  }
  return out;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

export default async function CounselMailRow({ propertyId }: { propertyId: number }) {
  void propertyId;
  const perDomain = await loadPerDomain();
  const total = Object.values(perDomain).reduce((s, arr) => s + arr.length, 0);

  return (
    <>
      {DOMAINS.map(d => {
        const rows = perDomain[d.key] ?? [];
        const inb = rows.filter(r => r.direction === 'inbound').length;
        const out = rows.filter(r => r.direction === 'outbound').length;
        return (
          <Container
            key={d.key}
            title={d.label}
            subtitle={`${d.key} · ${inb} inbound · ${out} outbound (last 15)`}
            density="compact"
          >
            {rows.length === 0 ? (
              <div style={{ padding: '6px 0', fontSize: 11, color: '#5A5A5A' }}>
                No email from / to this domain on file yet. Deep backfill is running against pb@thenamkhan.com — check back in a few minutes.
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rows.map(r => (
                  <li key={r.id} style={{ padding: '6px 0', borderTop: '1px solid #E6DFCC' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700,
                        padding: '1px 6px', borderRadius: 99,
                        background: r.direction === 'inbound' ? '#EBF1EE' : '#FBEFD9',
                        color:      r.direction === 'inbound' ? '#1F5C2C' : '#B87F26',
                      }}>{r.direction === 'inbound' ? 'IN' : 'OUT'}</span>
                      <span style={{ fontSize: 10, color: '#5A5A5A', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.received_at)}</span>
                      <span style={{ fontSize: 11, color: '#3A3A3A', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.direction === 'inbound' ? (r.from_name || r.from_email || 'unknown sender') : (r.mailbox || 'us')}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#1B1B1B', fontWeight: 500, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.subject || '(no subject)'}
                    </div>
                    {r.snippet && (
                      <div style={{ fontSize: 10, color: '#8A8A8A', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.snippet.slice(0, 140)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #E6DFCC', fontSize: 10, color: d.accent, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {rows.length} on file · newest {rows[0] ? fmt(rows[0].received_at) : '—'}
            </div>
          </Container>
        );
      })}
    </>
  );
}
