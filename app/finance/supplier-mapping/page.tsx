// app/finance/supplier-mapping/page.tsx
//
// Finance · Supplier mapping. Vendor × USALI department roll-up (180d).
// Surfaces multi-dept vendors (need primary-dept override) and any GL
// posting whose account isn't mapped to a USALI line. The fixes happen
// out of band — in QuickBooks (set the class on a bill) or in
// gl.accounts (set usali_subcategory + usali_line_label).
//
// Source: public.v_vendor_dept_mapping + public.v_unmapped_accounts.

import Page from '@/components/page/Page';
import { FINANCE_SUBPAGES } from '../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import VendorMappingTable, { type VendorRow } from './_VendorMappingTable';
import UnmappedAccountsTable, { type AccountRow } from './_UnmappedAccountsTable';
import { SectionHead } from '../_components/FinanceShell';
import { fmtMoney } from '@/lib/format';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

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
    // eslint-disable-next-line no-console
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

  // Top-vendor leak chart — wired from real vendor rows.
  const topLeakers = [...vendors]
    .filter((v) => Number(v.no_class_spend || 0) + Number(v.unmapped_acct_spend || 0) > 0)
    .sort(
      (a, b) =>
        Number(b.no_class_spend || 0) +
        Number(b.unmapped_acct_spend || 0) -
        (Number(a.no_class_spend || 0) + Number(a.unmapped_acct_spend || 0)),
    )
    .slice(0, 8);

  const supEyebrow = [
    'Finance · Supplier mapping',
    'v_vendor_dept_mapping · 180d',
    `${summary.vendors} vendors`,
    `${summary.multi_dept} multi-dept`,
    `${summary.no_class_vendors} no-class (${fmtMoney(summary.total_no_class_spend, 'USD')} leaking)`,
    `${summary.unmapped_accounts} unmapped (${fmtMoney(summary.unmapped_accounts_spend, 'USD')} stuck)`,
  ].filter(Boolean).join(' · ');

  return (
    <Page
      eyebrow={supEyebrow}
      title={<>Vendor → <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>USALI dept</em> — fix the leaks.</>}
      subPages={FINANCE_SUBPAGES}
    >
      {/* ─── 1. KPI tiles ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <KpiBox value={summary.vendors}              unit="count" label="Vendors (180d)" tooltip="Distinct vendor names with at least one bill / cheque / expense in the last 180d" />
        <KpiBox value={summary.multi_dept}           unit="count" label="Multi-dept" tooltip="Vendors whose spend hit more than one USALI department — need a primary-dept override" />
        <KpiBox value={summary.unmapped_acct_vendors} unit="count" label="Unmapped account" tooltip="Vendors with at least one bill on an account that has no USALI line" />
        <KpiBox value={summary.no_class_vendors}     unit="count" label="No QB class" tooltip="Vendors with at least one bill posted without a QuickBooks class — drops out of mv_usali_pl_monthly" />
        <KpiBox value={summary.total_no_class_spend} unit="usd"   label="No-class spend" tooltip="USD spend with no QB class set — invisible in the USALI P&L until corrected in QuickBooks" />
        <KpiBox value={summary.unmapped_accounts}    unit="count" label="Unmapped accts" tooltip="Distinct GL accounts with postings but no USALI line on gl.accounts" />
      </div>

      {/* No period selector — page scope is fixed 180d trailing window. */}

      {/* ─── 3. Graphs ──────────────────────────────────────────────── */}
      {topLeakers.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 12,
            marginTop: 14,
          }}
        >
          <LeakChart rows={topLeakers} />
        </div>
      )}

      {/* ─── 4. Tables ──────────────────────────────────────────────── */}
      <div style={{ marginTop: 18 }}>
        <SectionHead
          title="Vendor queue"
          emphasis={`${vendors.length} active`}
          sub="Multi-dept · no-class · unmapped account · sortable"
          source="v_vendor_dept_mapping"
        />
        <VendorMappingTable rows={vendors} />
      </div>

      {accounts.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <SectionHead
            title="Unmapped GL accounts"
            emphasis={`${accounts.length} accounts`}
            sub={`${fmtMoney(summary.unmapped_accounts_spend, 'USD')} stuck · fix at /finance/mapping`}
            source="v_unmapped_accounts"
          />
          <UnmappedAccountsTable rows={accounts} />
        </div>
      )}

      <div style={{
        marginTop: 22,
        padding: '12px 14px',
        background: 'var(--paper-deep, #f6f3ec)',
        borderLeft: '2px solid var(--brass)',
        fontSize: 'var(--t-xs)',
        color: 'var(--ink-soft)',
        lineHeight: 1.6,
      }}>
        <div style={{
          fontFamily: 'var(--mono)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--ls-extra)',
          color: 'var(--brass)',
          fontSize: 'var(--t-xs)',
          marginBottom: 6,
        }}>How to fix</div>
        <strong>No QB class</strong>: open the bill in QuickBooks, set the <em>Class</em> field to F&amp;B / Spa / Activities / Rooms / etc. The line will then flow into <code style={{ fontFamily: 'var(--mono)' }}>gl.mv_usali_pl_monthly</code> on next refresh. <br />
        <strong>Unmapped account</strong>: open <code style={{ fontFamily: 'var(--mono)' }}>/finance/mapping</code> and set <code style={{ fontFamily: 'var(--mono)' }}>usali_subcategory</code> + <code style={{ fontFamily: 'var(--mono)' }}>usali_line_label</code> on the account in <code style={{ fontFamily: 'var(--mono)' }}>gl.accounts</code>. <br />
        <strong>Multi-dept vendor</strong>: this isn't always wrong (a wholesaler legitimately sells food + cleaning), but it's worth confirming each line is class-tagged correctly so the P&amp;L doesn't pull spend into the wrong dept.
      </div>
    </Page>
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
    <div
      style={{
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderRadius: 8,
        padding: '14px 16px',
        minHeight: 220,
      }}
    >
      <div style={{ fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
        Top P&amp;L leakers · vendor
      </div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-loose)',
          color: 'var(--ink-mute)',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        No-class + unmapped-account spend · 180d
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
        {data.map((d, i) => {
          const y = 8 + i * lineH;
          const noClassW = (d.no_class / max) * barMaxW;
          const unmappedW = (d.unmapped / max) * barMaxW;
          return (
            <g key={d.name}>
              <text
                x={labelW - 4}
                y={y + 14}
                textAnchor="end"
                style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink)' }}
              >
                {String(d.name).slice(0, 20)}
              </text>
              <rect x={labelW} y={y + 4} width={barMaxW} height={14} fill="var(--paper-deep)" />
              <rect x={labelW} y={y + 4} width={noClassW} height={14} fill="var(--st-bad)">
                <title>{`${d.name} · no-class ${fmtMoney(d.no_class, 'USD')} · 180d · v_supplier_mapping_leak`}</title>
              </rect>
              <rect x={labelW + noClassW} y={y + 4} width={unmappedW} height={14} fill="var(--brass)">
                <title>{`${d.name} · unmapped acct ${fmtMoney(d.unmapped, 'USD')} · 180d · v_supplier_mapping_leak`}</title>
              </rect>
              <text
                x={labelW + barMaxW + 4}
                y={y + 14}
                style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink-soft)' }}
              >
                {fmtMoney(d.total, 'USD')}
              </text>
            </g>
          );
        })}
        <g transform={`translate(${labelW}, ${h - 4})`} style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>
          <rect x={0} y={-8} width={9} height={4} fill="var(--st-bad)" />
          <text x={12} y={-3} style={{ fill: 'var(--ink-mute)' }}>No QB class</text>
          <rect x={84} y={-8} width={9} height={4} fill="var(--brass)" />
          <text x={96} y={-3} style={{ fill: 'var(--ink-mute)' }}>Unmapped account</text>
        </g>
      </svg>
    </div>
  );
}
