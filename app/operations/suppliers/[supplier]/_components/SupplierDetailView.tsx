// app/operations/suppliers/[supplier]/_components/SupplierDetailView.tsx
// Shared body for the supplier-detail page. Mounted from
//   /operations/suppliers/[supplier]  → surface = Operations, OPERATIONS_SUBPAGES
//   /finance/suppliers/[supplier]     → surface = Finance,    FINANCE_SUBPAGES
// via thin wrappers passing subPages + activeHrefSuffix.
//
// Rebuilt onto the new design primitives:
//   DashboardPage shell
//   MetricRow (6 KpiTiles · hero KPIs)
//   Container around each panel (meta strip · monthly bars · USALI table ·
//   open bills · transactions ledger).
// SuppliersTable client component is untouched.

import Link from 'next/link';
import { DashboardPage, Container, MetricRow, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fmtMoney, fmtIsoDate, EMPTY, FX_LAK_PER_USD } from '@/lib/format';

interface Props {
  supplierName: string;
  subPages: { label: string; href: string }[];
  activeHrefSuffix: string;
  surfaceLabel: string;          // "Operations" or "Finance"
  registerHref: string;          // "/operations/suppliers" or "/finance/suppliers"
}

interface OverviewRow {
  vendor_name: string;
  line_count: number | null;
  active_periods: number | null;
  first_txn_date: string | null;
  last_txn_date: string | null;
  gross_spend_usd: number | string | null;
  net_amount_usd: number | string | null;
  distinct_accounts: number | null;
  distinct_classes: number | null;
  currency_guess: string | null;
  is_active_recent: boolean | null;
}

interface VendorMeta {
  vendor_name: string;
  category: string | null;
  terms: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean | null;
  display_name: string | null;
}

interface TxnRow {
  txn_date: string;
  qb_txn_type: string | null;
  qb_txn_number: string | null;
  account_name: string | null;
  usali_subcategory: string | null;
  usali_department: string | null;
  memo: string | null;
  amount_usd: number | string | null;
  txn_currency: string | null;
}

interface UnpaidRow {
  id: number;
  due_date: string | null;
  amount_lak: number | string | null;
  balance_lak: number | string | null;
  status_raw: string | null;
  class_raw: string | null;
  human_status: string | null;
}

async function getOverview(name: string): Promise<OverviewRow | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.schema('gl').from('v_supplier_overview')
    .select('vendor_name,line_count,active_periods,first_txn_date,last_txn_date,gross_spend_usd,net_amount_usd,distinct_accounts,distinct_classes,currency_guess,is_active_recent')
    .eq('vendor_name', name).limit(1);
  return ((data ?? [])[0] as OverviewRow) ?? null;
}
async function getMeta(name: string): Promise<VendorMeta | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.schema('gl').from('vendors')
    .select('vendor_name,category,terms,email,phone,is_active,display_name')
    .eq('vendor_name', name).limit(1);
  return ((data ?? [])[0] as VendorMeta) ?? null;
}
async function getTxns(name: string): Promise<TxnRow[]> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.schema('gl').from('v_supplier_transactions')
    .select('txn_date,qb_txn_type,qb_txn_number,account_name,usali_subcategory,usali_department,memo,amount_usd,txn_currency')
    .eq('vendor_name', name).order('txn_date', { ascending: false }).limit(500);
  return (data ?? []) as TxnRow[];
}
async function getUnpaid(name: string): Promise<UnpaidRow[]> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.schema('messy').from('unpaid_bills')
    .select('id,due_date,amount_lak,balance_lak,status_raw,class_raw,human_status')
    .eq('supplier', name).order('due_date', { ascending: false, nullsFirst: false }).limit(100);
  return (data ?? []) as UnpaidRow[];
}

function shortDay(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }
  catch { return iso; }
}

function initials(name: string): string {
  const cleaned = name.replace(/\s*-\s*lao kip\s*$/i, '').replace(/\s*\(.*?\)\s*/g, '').replace(/\.com$/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default async function SupplierDetailView({ supplierName, subPages, activeHrefSuffix, surfaceLabel, registerHref }: Props) {
  const [overview, meta, txns, unpaid] = await Promise.all([
    getOverview(supplierName),
    getMeta(supplierName),
    getTxns(supplierName),
    getUnpaid(supplierName),
  ]);

  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith(activeHrefSuffix),
  }));

  if (!overview) {
    return (
      <DashboardPage title={`${surfaceLabel} · ${supplierName}`} subtitle="No QB activity on file" tabs={tabs.length ? tabs : undefined}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Supplier not found in QB" subtitle="Source: gl.v_supplier_overview" density="compact">
            <div style={{ padding: 16, fontSize: 13, color: '#5A5A5A' }}>
              No QB activity for <strong>{supplierName}</strong>.{' '}
              <Link href={registerHref} style={{ color: '#1B1B1B' }}>← back to register</Link>
            </div>
          </Container>
        </div>
      </DashboardPage>
    );
  }

  const grossUsd = Number(overview.gross_spend_usd ?? 0);
  const netUsd = Number(overview.net_amount_usd ?? 0);
  const lineCount = Number(overview.line_count ?? 0);
  const periods = Number(overview.active_periods ?? 0);

  const since90Iso = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const txns90 = txns.filter((t) => (t.txn_date ?? '') >= since90Iso);
  const spend90 = txns90.reduce((s, t) => s + Number(t.amount_usd ?? 0), 0);

  const openUnpaid = unpaid.filter((u) => {
    const st = u.human_status ?? 'open';
    return st !== 'reconciled' && st !== 'paid_off_book';
  });
  const openLak = openUnpaid.reduce((s, u) => s + Number(u.balance_lak ?? 0), 0);
  const openUsd = openLak / FX_LAK_PER_USD;

  const byDept = new Map<string, { dept: string; usd: number; lines: number }>();
  for (const t of txns) {
    const k = t.usali_department ?? 'Unmapped';
    const cur = byDept.get(k) ?? { dept: k, usd: 0, lines: 0 };
    cur.usd += Number(t.amount_usd ?? 0);
    cur.lines += 1;
    byDept.set(k, cur);
  }
  const deptRows = [...byDept.values()].sort((a, b) => b.usd - a.usd);
  const deptTotal = deptRows.reduce((s, d) => s + d.usd, 0);

  const monthly = new Map<string, number>();
  for (const t of txns) {
    if (!t.txn_date) continue;
    const ym = t.txn_date.slice(0, 7);
    monthly.set(ym, (monthly.get(ym) ?? 0) + Number(t.amount_usd ?? 0));
  }
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const monthBars = months.map((m) => ({ ym: m, usd: monthly.get(m) ?? 0 }));
  const maxMonth = Math.max(1, ...monthBars.map((b) => b.usd));

  const daysSinceLast = overview.last_txn_date
    ? Math.floor((Date.now() - new Date(overview.last_txn_date).getTime()) / 86_400_000)
    : null;

  const tiles: KpiTileProps[] = [
    { label: 'Gross spend · all-time', value: fmtMoney(grossUsd, 'USD'), footnote: `${lineCount} lines · ${periods} active months` },
    { label: 'Net amount · all-time',  value: fmtMoney(netUsd, 'USD'),   footnote: 'Debits − credits' },
    { label: 'Spend · last 90d',       value: fmtMoney(spend90, 'USD'),  footnote: `${txns90.length} txns in last 90 days` },
    { label: 'Ledger lines',           value: lineCount, unit: 'count',  footnote: 'Distinct GL entry rows' },
    { label: 'Open AP · debt',         value: fmtMoney(openUsd, 'USD'),  footnote: `${openUnpaid.length} unreconciled · ₭${openLak.toLocaleString('en-US')}`, status: openUsd > 0 ? 'warning' : 'neutral' },
    { label: 'Days since last txn',    value: daysSinceLast ?? '—', unit: daysSinceLast != null ? 'days' : undefined, footnote: `Last QB activity: ${overview.last_txn_date ?? '—'}` },
  ];

  return (
    <DashboardPage
      title={`${surfaceLabel} · Supplier · ${supplierName}`}
      subtitle={`${meta?.category ?? 'uncategorised'}${overview.currency_guess ? ` · ${overview.currency_guess}` : ''}${meta?.terms ? ` · ${meta.terms}` : ''}`}
      tabs={tabs.length ? tabs : undefined}
    >
      {/* Back link + meta strip */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={supplierName}
        subtitle="Vendor profile · QB overview · open AP · transactions ledger"
        density="compact">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '4px 0', fontSize: 11, color: '#5A5A5A' }}>
            <span aria-hidden style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#B8860B', color: '#FFFFFF',
              fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, flexShrink: 0,
            }}>{initials(supplierName)}</span>
            <a href={registerHref} style={{
              padding: '4px 10px', border: '1px solid #1B1B1B', borderRadius: 3,
              background: '#FFFFFF', color: '#1B1B1B', textDecoration: 'none',
            }}>← Back to supplier register</a>
            {meta?.email && <span><strong>Email:</strong> <a href={`mailto:${meta.email}`} style={{ color: '#1B1B1B' }}>{meta.email}</a></span>}
            {meta?.phone && <span><strong>Phone:</strong> <a href={`tel:${meta.phone}`} style={{ color: '#1B1B1B' }}>{meta.phone}</a></span>}
            {meta?.display_name && meta.display_name !== supplierName && <span><strong>QB name:</strong> {meta.display_name}</span>}
          </div>
        </Container>
      </div>

      {/* Hero KPI strip */}
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow tiles={tiles} size="md" />
      </div>

      {/* Monthly spend bars */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Monthly spend · last 12 months" subtitle={`max $${maxMonth.toFixed(0)} · gl.v_supplier_transactions`} density="compact">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 140, padding: '8px 0', borderBottom: '1px solid #E0E0E0' }}>
            {monthBars.map((b) => {
              const h = (b.usd / maxMonth) * 120;
              return (
                <div key={b.ym} title={`${b.ym} · ${fmtMoney(b.usd, 'USD')}`}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', height: Math.max(2, h), background: b.usd > 0 ? '#B8860B' : '#E0E0E0', opacity: 0.85, borderRadius: '2px 2px 0 0' }} />
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#5A5A5A' }}>{b.ym.slice(5)}</div>
                </div>
              );
            })}
          </div>
        </Container>
      </div>

      {/* USALI dept breakdown */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="USALI department breakdown" subtitle="gl.v_supplier_transactions · grouped by usali_department" density="compact">
          {deptRows.length === 0 ? (
            <div style={{ padding: 16, fontSize: 11, color: '#5A5A5A' }}>No transactions on file.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: '#1B1B1B' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#5A5A5A', borderBottom: '1px solid #E0E0E0' }}>
                  <th style={th}>Department</th>
                  <th style={{ ...th, textAlign: 'right' }}>Lines</th>
                  <th style={{ ...th, textAlign: 'right' }}>USD spend</th>
                  <th style={{ ...th, textAlign: 'right' }}>Share</th>
                  <th style={th}>Bar</th>
                </tr>
              </thead>
              <tbody>
                {deptRows.map((d) => {
                  const share = deptTotal ? (d.usd / deptTotal) * 100 : 0;
                  return (
                    <tr key={d.dept} style={{ borderBottom: '1px solid #F0F0F0' }}>
                      <td style={td}><strong>{d.dept}</strong></td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.lines}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(d.usd, 'USD')}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{share.toFixed(1)}%</td>
                      <td style={td}><div style={{ height: 8, background: '#B8860B', opacity: 0.6, width: `${Math.min(100, share)}%`, maxWidth: 200, borderRadius: 2 }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Container>
      </div>

      {/* Open bills (if any) */}
      {openUnpaid.length > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title={`Open bills · ${openUnpaid.length}`} subtitle="messy.unpaid_bills · unreconciled" density="compact">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: '#1B1B1B' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#5A5A5A', borderBottom: '1px solid #E0E0E0' }}>
                  <th style={th}>Due date</th>
                  <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                  <th style={{ ...th, textAlign: 'right' }}>Balance</th>
                  <th style={th}>Status (raw)</th>
                  <th style={th}>Class</th>
                  <th style={th}>Human status</th>
                </tr>
              </thead>
              <tbody>
                {openUnpaid.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #F0F0F0' }}>
                    <td style={{ ...td, color: '#5A5A5A' }}>{b.due_date ? fmtIsoDate(b.due_date) : EMPTY}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>₭{Number(b.amount_lak ?? 0).toLocaleString('en-US')}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#C62828' }}>₭{Number(b.balance_lak ?? 0).toLocaleString('en-US')}</td>
                    <td style={{ ...td, color: '#5A5A5A' }}>{b.status_raw ?? EMPTY}</td>
                    <td style={{ ...td, color: '#5A5A5A' }}>{b.class_raw ?? EMPTY}</td>
                    <td style={{ ...td, color: '#5A5A5A' }}>{b.human_status ?? EMPTY}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Container>
        </div>
      )}

      {/* Transactions ledger */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Transactions · last ${Math.min(txns.length, 200)}`} subtitle={`${txns.length} total · gl.v_supplier_transactions`} density="compact">
          {txns.length === 0 ? (
            <div style={{ padding: 16, fontSize: 11, color: '#5A5A5A' }}>No transactions on file.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: '#1B1B1B' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#5A5A5A', borderBottom: '1px solid #E0E0E0' }}>
                    <th style={th}>Date</th>
                    <th style={th}>Type</th>
                    <th style={th}>QB #</th>
                    <th style={th}>Account</th>
                    <th style={th}>Department</th>
                    <th style={th}>Memo</th>
                    <th style={{ ...th, textAlign: 'right' }}>Amount (USD)</th>
                    <th style={th}>Ccy</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.slice(0, 200).map((t, i) => (
                    <tr key={`${t.txn_date}-${i}`} style={{ borderBottom: '1px solid #F0F0F0' }}>
                      <td style={{ ...td, color: '#5A5A5A' }}>{shortDay(t.txn_date)}</td>
                      <td style={{ ...td, color: '#5A5A5A' }}>{t.qb_txn_type ?? EMPTY}</td>
                      <td style={{ ...td, color: '#5A5A5A', fontFamily: 'monospace', fontSize: 10 }}>{t.qb_txn_number ?? EMPTY}</td>
                      <td style={td}>{t.account_name ?? EMPTY}</td>
                      <td style={{ ...td, color: '#5A5A5A' }}>{t.usali_department ?? EMPTY}</td>
                      <td style={{ ...td, color: '#5A5A5A', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.memo ?? ''}>{t.memo ?? EMPTY}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(Number(t.amount_usd ?? 0), 'USD')}</td>
                      <td style={{ ...td, color: '#5A5A5A' }}>{t.txn_currency ?? EMPTY}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}

const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'top' };
