// app/operations/suppliers/[supplier]/page.tsx
//
// Operations · Suppliers · detail. Mirrors the channels-detail pattern:
// hero KPI strip + daily/monthly spend bars + USALI-department breakdown
// + ledger of QB transactions + open AP bills (if any).
//
// Param: ?supplier= encoded vendor_name (matches gl.v_supplier_overview.vendor_name
// AND messy.unpaid_bills.supplier exactly for ~35 of the 135 suppliers; for
// the rest, the unpaid panel is empty by design).

import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fmtMoney, fmtIsoDate, EMPTY, FX_LAK_PER_USD } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

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
  const { data, error } = await admin
    .schema('gl')
    .from('v_supplier_overview')
    .select('vendor_name,line_count,active_periods,first_txn_date,last_txn_date,gross_spend_usd,net_amount_usd,distinct_accounts,distinct_classes,currency_guess,is_active_recent')
    .eq('vendor_name', name)
    .limit(1);
  if (error) {
    console.error('getOverview error', error);
    return null;
  }
  return ((data ?? [])[0] as OverviewRow) ?? null;
}

async function getMeta(name: string): Promise<VendorMeta | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .schema('gl')
    .from('vendors')
    .select('vendor_name,category,terms,email,phone,is_active,display_name')
    .eq('vendor_name', name)
    .limit(1);
  return ((data ?? [])[0] as VendorMeta) ?? null;
}

async function getTxns(name: string): Promise<TxnRow[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .schema('gl')
    .from('v_supplier_transactions')
    .select('txn_date,qb_txn_type,qb_txn_number,account_name,usali_subcategory,usali_department,memo,amount_usd,txn_currency')
    .eq('vendor_name', name)
    .order('txn_date', { ascending: false })
    .limit(500);
  if (error) {
    console.error('getTxns error', error);
    return [];
  }
  return (data ?? []) as TxnRow[];
}

async function getUnpaid(name: string): Promise<UnpaidRow[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .schema('messy')
    .from('unpaid_bills')
    .select('id,due_date,amount_lak,balance_lak,status_raw,class_raw,human_status')
    .eq('supplier', name)
    .order('due_date', { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) {
    console.error('getUnpaid error', error);
    return [];
  }
  return (data ?? []) as UnpaidRow[];
}

function shortDay(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }
  catch { return iso; }
}

function initials(name: string): string {
  const cleaned = name
    .replace(/\s*-\s*lao kip\s*$/i, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/\.com$/i, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface Props {
  params: { supplier: string };
}

export default async function SupplierDetailPage({ params }: Props) {
  const supplierName = decodeURIComponent(params.supplier);

  const [overview, meta, txns, unpaid] = await Promise.all([
    getOverview(supplierName),
    getMeta(supplierName),
    getTxns(supplierName),
    getUnpaid(supplierName),
  ]);

  if (!overview) {
    return (
      <Page
        eyebrow={`Operations · Suppliers · ${supplierName}`}
        title={<>{supplierName}</>}
        subPages={OPERATIONS_SUBPAGES}
      >
        <div style={{ padding: 24, color: 'var(--ink-mute)' }}>
          No QB activity for <strong>{supplierName}</strong>. Source: gl.v_supplier_overview.
          {' '}<Link href="/operations/suppliers" style={{ color: 'var(--brass)' }}>← back to register</Link>
        </div>
      </Page>
    );
  }

  const grossUsd = Number(overview.gross_spend_usd ?? 0);
  const netUsd = Number(overview.net_amount_usd ?? 0);
  const lineCount = Number(overview.line_count ?? 0);
  const periods = Number(overview.active_periods ?? 0);

  // KPI: 90d activity + open AP
  const since90Iso = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const txns90 = txns.filter((t) => (t.txn_date ?? '') >= since90Iso);
  const spend90 = txns90.reduce((s, t) => s + Number(t.amount_usd ?? 0), 0);

  const openUnpaid = unpaid.filter((u) => {
    const st = u.human_status ?? 'open';
    return st !== 'reconciled' && st !== 'paid_off_book';
  });
  const openLak = openUnpaid.reduce((s, u) => s + Number(u.balance_lak ?? 0), 0);
  const openUsd = openLak / FX_LAK_PER_USD;

  // USALI-department breakdown
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

  // Monthly spend bars (last 12 months, including empties)
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

  return (
    <Page
      eyebrow={`Operations · Suppliers · ${supplierName}`}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
          <span
            aria-hidden
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--brass)', color: 'var(--ink)',
              fontFamily: 'var(--mono)', fontSize: 'var(--t-md)',
              fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, flexShrink: 0,
            }}
          >
            {initials(supplierName)}
          </span>
          <span>{supplierName}</span>
        </span>
      }
      subPages={OPERATIONS_SUBPAGES}
    >
      {/* CONTACT / META strip */}
      {(meta?.email || meta?.phone || meta?.terms || meta?.category || overview.currency_guess) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 14, padding: '8px 12px', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 6 }}>
          {meta?.category && <Field label="Category" value={meta.category} />}
          {overview.currency_guess && <Field label="Currency" value={overview.currency_guess} />}
          {meta?.terms && <Field label="Terms" value={meta.terms} />}
          {meta?.email && <Field label="Email" value={<a href={`mailto:${meta.email}`} style={{ color: 'var(--brass)' }}>{meta.email}</a>} />}
          {meta?.phone && <Field label="Phone" value={<a href={`tel:${meta.phone}`} style={{ color: 'var(--brass)' }}>{meta.phone}</a>} />}
          <Field label="QB display name" value={meta?.display_name ?? meta?.vendor_name ?? supplierName} />
        </div>
      )}

      {/* HERO KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={grossUsd} unit="usd" label="Gross spend · all-time"
          tooltip={`Total absolute USD spend across ${lineCount} ledger lines (${periods} active months). Source: gl.v_supplier_overview.gross_spend_usd.`} />
        <KpiBox value={netUsd} unit="usd" label="Net amount · all-time"
          tooltip="Net signed amount (debits − credits). Source: gl.v_supplier_overview.net_amount_usd." />
        <KpiBox value={spend90} unit="usd" label="Spend · last 90d"
          tooltip="Sum of amount_usd across the last 90 days of QB transactions for this vendor." />
        <KpiBox value={lineCount} unit="count" label="Ledger lines"
          tooltip="Distinct GL entry rows attributed to this vendor across all time." />
        <KpiBox value={openUsd} unit="usd" label="Open AP · debt"
          tooltip={`${openUnpaid.length} unreconciled bills · ₭${openLak.toLocaleString('en-US')} converted at FX ${FX_LAK_PER_USD.toLocaleString('en-US')}. Source: messy.unpaid_bills.`} />
        <KpiBox value={overview.last_txn_date ? Math.floor((Date.now() - new Date(overview.last_txn_date).getTime()) / 86_400_000) : null}
          unit="nights" dp={0} label="Days since last txn"
          tooltip={`Last QB activity: ${overview.last_txn_date ?? '—'}. Source: gl.v_supplier_overview.last_txn_date.`} />
      </div>

      {/* MONTHLY SPEND BARS */}
      <Panel
        title="Monthly spend · last 12 months"
        eyebrow={`max $${maxMonth.toFixed(0)}`}
        actions={<ArtifactActions context={{ kind: 'panel', title: 'Monthly spend · 12m', dept: 'operations' }} />}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 140, padding: '8px 0', borderBottom: '1px solid var(--paper-deep)' }}>
          {monthBars.map((b) => {
            const h = (b.usd / maxMonth) * 120;
            return (
              <div
                key={b.ym}
                title={`${b.ym} · ${fmtMoney(b.usd, 'USD')}`}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
              >
                <div style={{ width: '100%', height: Math.max(2, h), background: b.usd > 0 ? 'var(--brass)' : 'var(--paper-deep)', opacity: 0.85, borderRadius: '2px 2px 0 0' }} />
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{b.ym.slice(5)}</div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      {/* USALI-DEPARTMENT BREAKDOWN */}
      <Panel
        title="USALI department breakdown"
        eyebrow="gl.v_supplier_transactions"
        actions={<ArtifactActions context={{ kind: 'table', title: 'USALI dept breakdown', dept: 'operations' }} />}
      >
        {deptRows.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>No transactions on file.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Department</th>
                <th className="num">Lines</th>
                <th className="num">USD spend</th>
                <th className="num">Share</th>
                <th>Bar</th>
              </tr>
            </thead>
            <tbody>
              {deptRows.map((d) => {
                const share = deptTotal ? (d.usd / deptTotal) * 100 : 0;
                return (
                  <tr key={d.dept}>
                    <td className="lbl"><strong>{d.dept}</strong></td>
                    <td className="num">{d.lines}</td>
                    <td className="num">{fmtMoney(d.usd, 'USD')}</td>
                    <td className="num">{share.toFixed(1)}%</td>
                    <td><div style={{ height: 8, background: 'var(--brass)', opacity: 0.6, width: `${Math.min(100, share)}%`, maxWidth: 200, borderRadius: 2 }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <div style={{ height: 14 }} />

      {/* OPEN BILLS (if any) */}
      {openUnpaid.length > 0 && (
        <>
          <Panel
            title={`Open bills · ${openUnpaid.length}`}
            eyebrow="messy.unpaid_bills"
            actions={<ArtifactActions context={{ kind: 'table', title: 'Open bills', dept: 'operations' }} />}
          >
            <table className="tbl">
              <thead>
                <tr>
                  <th>Due date</th>
                  <th className="num">Amount</th>
                  <th className="num">Balance</th>
                  <th>Status (raw)</th>
                  <th>Class</th>
                  <th>Human status</th>
                </tr>
              </thead>
              <tbody>
                {openUnpaid.map((b) => (
                  <tr key={b.id}>
                    <td className="lbl text-mute">{b.due_date ? fmtIsoDate(b.due_date) : EMPTY}</td>
                    <td className="num">₭{Number(b.amount_lak ?? 0).toLocaleString('en-US')}</td>
                    <td className="num"><span style={{ color: 'var(--oxblood)' }}>₭{Number(b.balance_lak ?? 0).toLocaleString('en-US')}</span></td>
                    <td className="lbl text-mute">{b.status_raw ?? EMPTY}</td>
                    <td className="lbl text-mute">{b.class_raw ?? EMPTY}</td>
                    <td className="lbl text-mute">{b.human_status ?? EMPTY}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <div style={{ height: 14 }} />
        </>
      )}

      {/* TRANSACTIONS LEDGER */}
      <Panel
        title={`Transactions · last ${Math.min(txns.length, 200)}`}
        eyebrow={`${txns.length} total · gl.v_supplier_transactions`}
        actions={<ArtifactActions context={{ kind: 'table', title: 'Transactions', dept: 'operations' }} />}
      >
        {txns.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>No transactions on file.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>QB #</th>
                  <th>Account</th>
                  <th>Department</th>
                  <th>Memo</th>
                  <th className="num">Amount (USD)</th>
                  <th>Ccy</th>
                </tr>
              </thead>
              <tbody>
                {txns.slice(0, 200).map((t, i) => (
                  <tr key={`${t.txn_date}-${i}`}>
                    <td className="lbl text-mute">{shortDay(t.txn_date)}</td>
                    <td className="lbl text-mute">{t.qb_txn_type ?? EMPTY}</td>
                    <td className="lbl text-mute" style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{t.qb_txn_number ?? EMPTY}</td>
                    <td className="lbl">{t.account_name ?? EMPTY}</td>
                    <td className="lbl text-mute">{t.usali_department ?? EMPTY}</td>
                    <td className="lbl text-mute" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.memo ?? ''}>{t.memo ?? EMPTY}</td>
                    <td className="num">{fmtMoney(Number(t.amount_usd ?? 0), 'USD')}</td>
                    <td className="lbl text-mute">{t.txn_currency ?? EMPTY}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div style={{ marginTop: 14, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
        <Link href="/operations/suppliers" style={{ color: 'var(--brass)', textDecoration: 'none' }}>← back to supplier register</Link>
      </div>
    </Page>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)' }}>{label}</span>
      <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}
