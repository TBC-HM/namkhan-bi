// app/finance/legal/contracts/page.tsx
// Legal → Contracts list. Reads contracts.v_revenue_contract_status.
// PBS 2026-07-07: Beyond Circle revenue-contract flow surfaced under Legal.

import Link from 'next/link';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

interface Row {
  agreement_id: number;
  agreement_code: string;
  agreement_title: string;
  status: string;
  effective_from: string | null;
  effective_to: string | null;
  fixed_fee_usd: number | null;
  bonus_pct: number | null;
  client_signed: boolean | null;
  beyond_signed: boolean | null;
}

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  draft:     { bg: '#F4EFE2', fg: '#5A5A5A' },
  sent:      { bg: '#FFF1D6', fg: '#8B5A1C' },
  viewed:    { bg: '#E3ECFF', fg: '#1F3A5A' },
  executed:  { bg: '#DFF0DE', fg: '#1F5C2C' },
  expired:   { bg: '#F5D5CE', fg: '#B04A2F' },
  cancelled: { bg: '#F5D5CE', fg: '#B04A2F' },
};

async function fetchRows(): Promise<Row[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .schema('contracts')
    .from('v_revenue_contract_status')
    .select('agreement_id, agreement_code, agreement_title, status, effective_from, effective_to, fixed_fee_usd, bonus_pct, client_signed, beyond_signed')
    .order('agreement_id', { ascending: false })
    .limit(200);
  if (error) {
    console.error('[contracts/list] view read failed', error);
    return [];
  }
  return (data ?? []) as Row[];
}

export default async function ContractsListPage() {
  const rows = await fetchRows();
  const active = rows.filter(r => r.status === 'executed').length;
  const inFlight = rows.filter(r => r.status === 'sent' || r.status === 'viewed').length;
  const draft = rows.filter(r => r.status === 'draft').length;

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Legal · Contracts"
        subtitle="Revenue Management Agreements — Beyond Circle"
        action={
          <Link href="/finance/legal/contracts/new" style={primaryBtn}>New revenue contract</Link>
        }
      >
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          <Stat label="All" value={rows.length} />
          <Stat label="Executed" value={active} tint="#DFF0DE" />
          <Stat label="In-flight" value={inFlight} tint="#FFF1D6" />
          <Stat label="Draft" value={draft} tint="#F4EFE2" />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Revenue Management Agreements" subtitle={`${rows.length} contract${rows.length === 1 ? '' : 's'}`}>
            <div style={{ padding: 0, background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#FAFAF7' }}>
                    <th style={th}>Code</th>
                    <th style={th}>Client / title</th>
                    <th style={th}>Status</th>
                    <th style={{ ...th, textAlign: 'right' }}>Fee (USD)</th>
                    <th style={{ ...th, textAlign: 'right' }}>Bonus %</th>
                    <th style={th}>Effective</th>
                    <th style={th}>Signatures</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#5A5A5A', fontStyle: 'italic', padding: '24px 12px' }}>
                      No revenue contracts yet. Click <strong>New revenue contract</strong> to create one.
                    </td></tr>
                  ) : rows.map(r => {
                    const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.draft;
                    return (
                      <tr key={r.agreement_id} style={{ borderTop: '1px solid #F5F0E1' }}>
                        <td style={{ ...td, fontFamily: 'monospace' }}>
                          <Link href={`/finance/legal/contracts/${r.agreement_id}`} style={{ color: '#084838', textDecoration: 'none' }}>
                            {r.agreement_code}
                          </Link>
                        </td>
                        <td style={td}>{r.agreement_title}</td>
                        <td style={td}>
                          <span style={{ ...pill, background: badge.bg, color: badge.fg }}>{r.status}</span>
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>{r.fixed_fee_usd ? `$${Number(r.fixed_fee_usd).toLocaleString('en-US')}` : '—'}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{r.bonus_pct != null ? `${r.bonus_pct}%` : '—'}</td>
                        <td style={{ ...td, color: '#5A5A5A' }}>
                          {r.effective_from ? new Date(r.effective_from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                          {r.effective_to ? ` → ${new Date(r.effective_to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}` : ''}
                        </td>
                        <td style={td}>
                          <span style={{ color: r.client_signed ? '#1F5C2C' : '#5A5A5A' }}>{r.client_signed ? '✓' : '·'} client</span>
                          {' · '}
                          <span style={{ color: r.beyond_signed ? '#1F5C2C' : '#5A5A5A' }}>{r.beyond_signed ? '✓' : '·'} beyond</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Container>
        </div>
      </DashboardPage>
    </div>
  );
}

function Stat({ label, value, tint }: { label: string; value: number; tint?: string }) {
  return (
    <div style={{ background: tint ?? '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6, padding: '12px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#5A5A5A', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1B1B1B', marginTop: 4 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #E6DFCC', color: '#3A3A3A', fontSize: 11 };
const td: React.CSSProperties = { padding: '10px 12px', color: '#1B1B1B', fontSize: 12 };
const pill: React.CSSProperties = { display: 'inline-block', padding: '2px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', borderRadius: 99, textTransform: 'uppercase' };
const primaryBtn: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  padding: '6px 14px', borderRadius: 4, background: '#084838', color: '#FFFFFF', textDecoration: 'none',
};
