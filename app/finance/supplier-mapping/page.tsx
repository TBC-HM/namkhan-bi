// app/finance/supplier-mapping/page.tsx — PBS #205 v2 (2026-05-25)
// Full primitive adoption: DashboardPage + Container per section + KpiTile.
// LeakChart custom SVG retained (it's a tight horizontal-bar viz built for
// this surface — Chart primitive doesn't have a stacked-horizontal variant
// yet). Vendor + unmapped-account tables each get their own Container.

import { DashboardPage, Container, KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';
import { FINANCE_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import VendorMappingTable, { type VendorRow } from './_VendorMappingTable';
import UnmappedAccountsTable, { type AccountRow } from './_UnmappedAccountsTable';
import { fmtMoney } from '@/lib/format';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

interface Summary {
  vendors: number;
  multi_dept: number;
  unmapped_acct_vendors: number;
  no_class_vendors: number;
  total_unmapped_spend: number;
  total_no_class_spend: number;
  unmapped_accounts: number;
  unmapped_accounts_spend: number;
}

async function getData(): Promise<{ vendors: VendorRow[]; accounts: AccountRow[]; summary: Summary }> {
  const empty: Summary = { vendors: 0, multi_dept: 0, unmapped_acct_vendors: 0, no_class_vendors: 0, total_unmapped_spend: 0, total_no_class_spend: 0, unmapped_accounts: 0, unmapped_accounts_spend: 0 };
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e) {
    console.error('[supplier-mapping] supabaseAdmin', e);
    return { vendors: [], accounts: [], summary: empty };
  }
  const [{ data: vData, error: vErr }, { data: aData, error: aErr }] = await Promise.all([
    admin.from('v_vendor_dept_mapping').select('*').limit(1500),
    admin.from('v_unmapped_accounts').select('*').limit(500),
  ]);
  if (vErr) console.error('[supplier-mapping] vendors', vErr);
  if (aErr) console.error('[supplier-mapping] accounts', aErr);
  const vendors = (vData ?? []) as VendorRow[];
  const accounts = (aData ?? []) as AccountRow[];

  const summary: Summary = {
    vendors: vendors.length,
    multi_dept:                vendors.filter(r => r.f_multi_dept).length,
    unmapped_acct_vendors:     vendors.filter(r => r.f_unmapped_account).length,
    no_class_vendors:          vendors.filter(r => r.f_no_class).length,
    total_unmapped_spend:      vendors.reduce((s, r) => s + Number(r.unmapped_acct_spend || 0), 0),
    total_no_class_spend:      vendors.reduce((s, r) => s + Number(r.no_class_spend || 0), 0),
    unmapped_accounts:         accounts.length,
    unmapped_accounts_spend:   accounts.reduce((s, r) => s + Number(r.spend_usd || 0), 0),
  };
  return { vendors, accounts, summary };
}

export default async function SupplierMappingPage() {
  const { vendors, accounts, summary } = await getData();

  const topLeakers = [...vendors]
    .filter((v) => Number(v.no_class_spend || 0) + Number(v.unmapped_acct_spend || 0) > 0)
    .sort(
      (a, b) =>
        Number(b.no_class_spend || 0) + Number(b.unmapped_acct_spend || 0) -
        (Number(a.no_class_spend || 0) + Number(a.unmapped_acct_spend || 0)),
    )
    .slice(0, 8);

  const subtitle = `v_vendor_dept_mapping · 180d · ${summary.vendors} vendors · ${summary.no_class_vendors} no-class (${fmtMoney(summary.total_no_class_spend, 'USD')} leaking) · ${summary.unmapped_accounts} unmapped accts`;

  const tabs = FINANCE_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href }));

  const tiles: KpiTileProps[] = [
    { label: 'Vendors (180d)', value: summary.vendors, size: 'sm', footnote: 'distinct payees with bills' },
    { label: 'Multi-dept', value: summary.multi_dept, size: 'sm', footnote: 'need primary-dept override', status: summary.multi_dept > 0 ? 'amber' : 'green' },
    { label: 'Unmapped acct', value: summary.unmapped_acct_vendors, size: 'sm', footnote: 'bill on no-USALI account', status: summary.unmapped_acct_vendors > 0 ? 'amber' : 'green' },
    { label: 'No QB class', value: summary.no_class_vendors, size: 'sm', footnote: 'drops out of USALI P&L', status: summary.no_class_vendors > 0 ? 'red' : 'green' },
    { label: 'No-class spend', value: Math.round(summary.total_no_class_spend), currency: 'USD', size: 'sm', footnote: 'invisible until classed', status: summary.total_no_class_spend > 0 ? 'red' : 'green' },
    { label: 'Unmapped accts', value: summary.unmapped_accounts, size: 'sm', footnote: 'GL accts with no USALI line', status: summary.unmapped_accounts > 0 ? 'amber' : 'green' },
  ];

  return (
    <DashboardPage title="Supplier mapping" subtitle={subtitle} tabs={tabs}>
      {/* PBS 2026-07-07: page is being moved to /operations/suppliers. */}
      <div style={fullRow}>
        <div style={{ padding:'8px 12px', background:'#FFF3F1', border:'1px solid #E6C9BF', borderRadius:4, fontSize:12, color:'#B04A2F', marginBottom:12 }}>
          This page has moved to <a href="/operations/suppliers" style={{color:'#1F3A2E'}}>/operations/suppliers</a>. This page continues to work but new work should happen there.
        </div>
      </div>
      <div style={fullRow}>
        <Container title="Headline" subtitle="vendor × USALI dept · trailing 180d" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
            {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

      {topLeakers.length > 0 && (
        <div style={fullRow}>
          <Container title="Top P&L leakers" subtitle="no-class + unmapped-account spend · 180d" density="compact">
            <LeakChart rows={topLeakers} />
          </Container>
        </div>
      )}

      <div style={fullRow}>
        <Container
          title="Vendor queue"
          subtitle={`${vendors.length} active · multi-dept · no-class · unmapped account · sortable · v_vendor_dept_mapping`}
          density="compact"
        >
          <VendorMappingTable rows={vendors} />
        </Container>
      </div>

      {accounts.length > 0 && (
        <div style={fullRow}>
          <Container
            title="Unmapped GL accounts"
            subtitle={`${accounts.length} accounts · ${fmtMoney(summary.unmapped_accounts_spend, 'USD')} stuck · fix at /finance/mapping`}
            density="compact"
          >
            <UnmappedAccountsTable rows={accounts} />
          </Container>
        </div>
      )}

      <div style={fullRow}>
        <Container title="How to fix" density="compact">
          <div style={{ fontSize: 12, color: 'var(--ink-soft, #5a5a5a)', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 6px' }}><strong>No QB class</strong>: open the bill in QuickBooks, set the <em>Class</em> field to F&amp;B / Spa / Activities / Rooms / etc. The line flows into <code>gl.mv_usali_pl_monthly</code> on next refresh.</p>
            <p style={{ margin: '0 0 6px' }}><strong>Unmapped account</strong>: open <code>/finance/mapping</code> and set <code>usali_subcategory</code> + <code>usali_line_label</code> on the account in <code>gl.accounts</code>.</p>
            <p style={{ margin: 0 }}><strong>Multi-dept vendor</strong>: not always wrong (a wholesaler legitimately sells food + cleaning), but confirm each line is class-tagged correctly so the P&amp;L doesn't pull spend into the wrong dept.</p>
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}

function LeakChart({ rows }: { rows: VendorRow[] }) {
  const data = rows.map((r) => ({
    name: (r as any).vendor_name ?? (r as any).vendor ?? 'Vendor',
    no_class: Number(r.no_class_spend || 0),
    unmapped: Number(r.unmapped_acct_spend || 0),
    total: Number(r.no_class_spend || 0) + Number(r.unmapped_acct_spend || 0),
  }));
  const max = Math.max(1, ...data.map((d) => d.total));
  const w = 520, lineH = 24, h = Math.max(200, data.length * lineH + 16);
  const labelW = 150, valueW = 80;
  const barMaxW = w - labelW - valueW - 8;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
      {data.map((d, i) => {
        const y = 8 + i * lineH;
        const noClassW = (d.no_class / max) * barMaxW;
        const unmappedW = (d.unmapped / max) * barMaxW;
        return (
          <g key={d.name}>
            <text x={labelW - 4} y={y + 14} textAnchor="end" style={{ fontSize: 10, fill: 'var(--ink, #1b1b1b)' }}>
              {String(d.name).slice(0, 20)}
            </text>
            <rect x={labelW} y={y + 4} width={barMaxW} height={14} fill="var(--ink-soft, #ececec)" />
            <rect x={labelW} y={y + 4} width={noClassW} height={14} fill="#c44">
              <title>{`${d.name} · no-class ${fmtMoney(d.no_class, 'USD')} · 180d`}</title>
            </rect>
            <rect x={labelW + noClassW} y={y + 4} width={unmappedW} height={14} fill="#b8a878">
              <title>{`${d.name} · unmapped acct ${fmtMoney(d.unmapped, 'USD')} · 180d`}</title>
            </rect>
            <text x={labelW + barMaxW + 4} y={y + 14} style={{ fontSize: 10, fill: 'var(--ink-soft, #5a5a5a)' }}>
              {fmtMoney(d.total, 'USD')}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${labelW}, ${h - 4})`} style={{ fontSize: 9 }}>
        <rect x={0} y={-8} width={9} height={4} fill="#c44" />
        <text x={12} y={-3} style={{ fill: 'var(--ink-soft, #5a5a5a)' }}>No QB class</text>
        <rect x={84} y={-8} width={9} height={4} fill="#b8a878" />
        <text x={96} y={-3} style={{ fill: 'var(--ink-soft, #5a5a5a)' }}>Unmapped account</text>
      </g>
    </svg>
  );
}
