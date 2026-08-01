// app/operations/suppliers/page.tsx
// PBS 2026-07-07 · Operations Supplier master list
// 2026-08-01 · Gold-layer fix: split USD vs LAK vendors; KPI tiles → YTD;
//              v_operations_suppliers rebuilt with ytd_spend_usd / ytd_spend_lak.
import Link from 'next/link';
import { DashboardPage, Container, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

const LAK_RATE = 21800; // LAK per USD (Namkhan standard rate)

interface SupplierRow {
  vendor_name: string; display_name: string | null; category: string | null;
  email: string | null; phone: string | null; currency: string;
  terms: string | null; is_active: boolean; property_id: number;
  line_count: number; first_txn_date: string | null; last_txn_date: string | null;
  gross_spend_usd: number; gross_spend_lak: number; net_amount_usd: number;
  ytd_spend_usd: number; ytd_spend_lak: number; ytd_txn_count: number;
  distinct_accounts: number; is_active_recent: boolean;
}

async function getData(): Promise<SupplierRow[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('v_operations_suppliers').select('*').limit(1500);
    if (error) { console.error('[ops/suppliers]', error); return []; }
    return (data ?? []) as SupplierRow[];
  } catch (e) { console.error('[ops/suppliers]', e); return []; }
}

function fmtUSD(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US');
}
function fmtLAK(n: number) {
  if (n === 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M LAK`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K LAK`;
  return `${Math.round(n)} LAK`;
}

const HAIR = '#E6DFCC'; const INK = '#1B1B1B'; const INK_M = '#5A5A5A';
const CREAM = '#F5F0E1'; const OK = '#0E7A4B'; const AMBER = '#B48A3A';
const RED = '#B03826'; const WHITE = '#FFFFFF';

const tdStyle = { padding: '6px 10px', borderBottom: `1px solid ${HAIR}`, fontSize: 12, color: INK };
const thStyle = { padding: '7px 10px', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: INK_M, background: CREAM, borderBottom: `1px solid ${HAIR}` };

export default async function OperationsSuppliersPage() {
  const rows = await getData();
  const cfg = DEPT_CFG.operations;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/operations/suppliers',
  }));

  const usdRows = rows.filter(r => r.currency === 'USD').sort((a,b) => Number(b.ytd_spend_usd) - Number(a.ytd_spend_usd));
  const lakRows = rows.filter(r => r.currency === 'LAK').sort((a,b) => Number(b.ytd_spend_lak) - Number(a.ytd_spend_lak));

  const ytdUSD = rows.reduce((s,r) => s + Number(r.ytd_spend_usd || 0), 0);
  const ytdLAK = rows.reduce((s,r) => s + Number(r.ytd_spend_lak || 0), 0);
  const ytdLAKinUSD = ytdLAK / LAK_RATE;
  const activeRecent = rows.filter(r => r.is_active_recent).length;
  const missingContact = rows.filter(r => !r.email).length;
  const currentYear = new Date().getFullYear();

  const tiles: KpiTileProps[] = [
    { label: `USD suppliers · ${currentYear} YTD`,
      value: fmtUSD(ytdUSD), size: 'sm',
      footnote: `${usdRows.length} USD vendors · excl. LAK`, status: 'green' },
    { label: `LAK suppliers · ${currentYear} YTD`,
      value: fmtLAK(ytdLAK), size: 'sm',
      footnote: `≈ ${fmtUSD(ytdLAKinUSD)} USD · ${lakRows.length} LAK vendors`, status: 'grey' },
    { label: `Combined YTD · ${currentYear}`,
      value: fmtUSD(ytdUSD + ytdLAKinUSD), size: 'sm',
      footnote: 'USD direct + LAK÷21,800 equiv', status: 'grey' },
    { label: 'Active suppliers',
      value: activeRecent, size: 'sm',
      footnote: 'txn in last 90 days', status: activeRecent > 0 ? 'green' : 'amber' },
    { label: 'Total vendors',
      value: rows.length, size: 'sm',
      footnote: 'gl.vendors · property 260955' },
    { label: 'Missing contact',
      value: missingContact, size: 'sm',
      footnote: 'no email on file', status: missingContact > 10 ? 'amber' : 'green' },
  ];

  function SupplierTable({ data, showLAK }: { data: SupplierRow[]; showLAK: boolean }) {
    if (data.length === 0) return <div style={{ padding: 12, fontSize: 12, color: INK_M }}>No suppliers.</div>;
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', width: 240 }}>Vendor</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>Category</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>YTD Spend</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>All-time</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Txns</th>
              <th style={{ ...thStyle }}>Last txn</th>
              <th style={{ ...thStyle }}>Contact</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => {
              const ytdAmt = showLAK ? Number(r.ytd_spend_lak) : Number(r.ytd_spend_usd);
              const allAmt = showLAK ? Number(r.gross_spend_lak) : Number(r.gross_spend_usd);
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? WHITE : '#FAFAF7' }}>
                  <td style={tdStyle}>
                    <Link href={`/operations/suppliers/${encodeURIComponent(r.vendor_name)}`}
                      style={{ fontWeight: 600, color: '#084838', textDecoration: 'none', fontSize: 12 }}>
                      {r.display_name ?? r.vendor_name}
                    </Link>
                    {r.display_name && <div style={{ fontSize: 10, color: INK_M }}>{r.vendor_name}</div>}
                  </td>
                  <td style={tdStyle}>
                    {r.category
                      ? <span style={{ fontSize: 10, padding: '1px 7px', background: CREAM, borderRadius: 10 }}>{r.category}</span>
                      : <span style={{ fontSize: 10, color: AMBER }}>Unclassified</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: ytdAmt > 0 ? INK : INK_M }}>
                    {ytdAmt > 0 ? (showLAK ? fmtLAK(ytdAmt) : fmtUSD(ytdAmt)) : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: INK_M, fontVariantNumeric: 'tabular-nums' }}>
                    {allAmt > 0 ? (showLAK ? fmtLAK(allAmt) : fmtUSD(allAmt)) : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: INK_M }}>{r.ytd_txn_count || '—'}</td>
                  <td style={{ ...tdStyle, color: INK_M }}>
                    {r.last_txn_date ? (
                      <span style={{ color: r.is_active_recent ? OK : INK_M }}>
                        {r.last_txn_date.slice(0,7)}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={tdStyle}>
                    {r.email
                      ? <a href={`mailto:${r.email}`} style={{ color: OK, fontSize: 11 }}>{r.email}</a>
                      : <span style={{ fontSize: 10, color: AMBER }}>No email</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <DashboardPage
      title="Operations · Suppliers"
      subtitle={`v_operations_suppliers · ${rows.length} vendors · YTD ${currentYear}: ${fmtUSD(ytdUSD)} USD + ${fmtLAK(ytdLAK)} LAK`}
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 16 }}>

        {/* KPI Tiles */}
        <Container title="Supplier headline" density="compact"
          subtitle={`Gold layer: USD and LAK split correctly · ${currentYear} YTD`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        {/* USD Suppliers */}
        <Container
          title={`USD Suppliers · ${currentYear} YTD`}
          subtitle={`${usdRows.length} vendors · sorted by YTD spend · ${fmtUSD(ytdUSD)} total`}>
          <SupplierTable data={usdRows} showLAK={false} />
        </Container>

        {/* LAK Suppliers */}
        <Container
          title={`LAK Suppliers · ${currentYear} YTD`}
          subtitle={`${lakRows.length} vendors · amounts in LAK · equiv ≈ ${fmtUSD(ytdLAKinUSD)} USD`}>
          <SupplierTable data={lakRows} showLAK={true} />
        </Container>
      </div>
    </DashboardPage>
  );
}
