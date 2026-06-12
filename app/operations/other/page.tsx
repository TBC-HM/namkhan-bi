// app/operations/other/page.tsx
// PBS 2026-06-09 #197 — Catches everything without a home: Fee, Tax, Adjustment,
// Addon, Front Office, Unclassified. Live from pms.transactions_cb via
// public.v_other_dept_monthly (per-bucket monthly aggregate).

import Link from 'next/link';
import { DashboardPage, Container, KpiTile, type KpiTileProps, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import { FbCategoryChart, FbAvgTicketChart } from '@/components/pl/FbMiniCharts';
import { supabase } from '@/lib/supabase';
import { resolvePeriod } from '@/lib/period';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

const fmtUsd = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

interface OtherRow {
  property_id: number; period_yyyymm: string; bucket: string;
  tx_count: number; revenue: number | string;
}

export default async function OtherPage({ searchParams }: Props) {
  const opPeriodRaw = typeof searchParams.op === 'string' ? searchParams.op : '30d';
  const opPeriod = (['yesterday','7d','30d','ytd'].includes(opPeriodRaw) ? opPeriodRaw : '30d') as 'yesterday'|'7d'|'30d'|'ytd';
  const opToday = new Date(); opToday.setUTCHours(0,0,0,0);
  const opFromIso = (() => {
    const d = new Date(opToday);
    if (opPeriod === 'yesterday') { d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0,10); }
    if (opPeriod === '7d')  { d.setUTCDate(d.getUTCDate() - 6);  return d.toISOString().slice(0,10); }
    if (opPeriod === '30d') { d.setUTCDate(d.getUTCDate() - 29); return d.toISOString().slice(0,10); }
    return `${opToday.getUTCFullYear()}-01-01`;
  })();
  const opLabel = opPeriod === 'yesterday' ? 'Yesterday' : opPeriod === '7d' ? 'Last 7 days' : opPeriod === '30d' ? 'Last 30 days' : 'YTD';

  const period = resolvePeriod(searchParams);

  const [monthlyResp, rawTxnsResp, servicesResp] = await Promise.all([
    supabase.from('v_other_dept_monthly').select('period_yyyymm, bucket, tx_count, revenue')
      .eq('property_id', 260955).order('period_yyyymm', { ascending: true }).then((r) => r),
    supabase.from('v_fnb_raw_txn_enriched')
      .select('transaction_id, reservation_id, transaction_date, local_laos_str, description, amount, currency, category, item_category_name, user_name, usali_dept, usali_subdept, guest_name, room_name, source_name')
      .eq('property_id', 260955)
      // PBS 2026-06-11 #210 — exclude payment-method rows (Bank Transfer / CC / Cash)
      .neq('category', 'payment')
      .or('usali_dept.in.(Fee,Tax,Adjustment),and(usali_dept.eq.Other Operated,usali_subdept.in.(Addon,Front Office)),usali_dept.is.null')
      .order('transaction_date', { ascending: false }).limit(2000)
      .then((r) => r),
    // PBS 2026-06-12 #213 — voucher sales (Services row in QB GL, no Cloudbeds folio source)
    supabase.schema('gl').from('mv_usali_pl_monthly')
      .select('period_yyyymm, amount_usd')
      .eq('usali_line_label', 'Services Revenue')
      .order('period_yyyymm', { ascending: true })
      .then((r) => r),
  ]);

  const monthly = (monthlyResp?.data ?? []) as OtherRow[];

  // KPI by bucket for period (sum from monthly rolled up)
  const periodSlice = monthly.filter((r) => r.period_yyyymm >= opFromIso.slice(0,7));
  const byBucket = new Map<string, { rev: number; n: number }>();
  for (const r of periodSlice) {
    const cur = byBucket.get(r.bucket) ?? { rev: 0, n: 0 };
    cur.rev += Number(r.revenue);
    cur.n   += Number(r.tx_count);
    byBucket.set(r.bucket, cur);
  }
  const buckets = Array.from(byBucket.entries()).sort((a, b) => b[1].rev - a[1].rev);
  const totalRev = buckets.reduce((s, [, v]) => s + v.rev, 0);
  const totalTx  = buckets.reduce((s, [, v]) => s + v.n,   0);

  const row1: KpiTileProps[] = [
    { label: 'Total Other Rev', value: fmtUsd(totalRev), footnote: `${totalTx} tx · ${opLabel}`, status: 'grey', size: 'sm' },
    ...buckets.slice(0, 5).map(([name, v]): KpiTileProps => ({
      label: name, value: fmtUsd(v.rev),
      footnote: `${v.n} tx · ${totalRev > 0 ? ((v.rev / totalRev) * 100).toFixed(1) : '0'}% of other`,
      status: 'grey', size: 'sm',
    })),
  ];

  const opPillStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase',
    color: active ? '#FFFFFF' : '#000', background: active ? '#000' : 'transparent',
    border: 'none', cursor: 'pointer', fontWeight: active ? 600 : 500, textDecoration: 'none',
  });
  const opPills = (
    <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 4, border: '1px solid #E0E0E0', overflow: 'hidden' }}>
      {(['yesterday', '7d', '30d', 'ytd'] as const).map((p) => (
        <Link key={p} href={`?op=${p}`} style={opPillStyle(opPeriod === p)}>{p === 'yesterday' ? 'Yesterday' : p === '7d' ? '7d' : p === '30d' ? '30d' : 'YTD'}</Link>
      ))}
    </div>
  );

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/other') })) as DashboardTab[];

  const summaryStyle: React.CSSProperties = {
    cursor: 'pointer', padding: '10px 14px', fontSize: 12, fontWeight: 600,
    color: '#000', background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 6, letterSpacing: '0.04em',
  };

  // Category-chart-shaped rows for the monthly trend mini-chart (bucket as category)
  const stackedRows = monthly.map((r) => ({ period_yyyymm: r.period_yyyymm, category: r.bucket, revenue: r.revenue }));
  // Avg-ticket aggregate over all buckets per month
  const aggByMonth = new Map<string, { rev: number; n: number }>();
  for (const r of monthly) {
    const cur = aggByMonth.get(r.period_yyyymm) ?? { rev: 0, n: 0 };
    cur.rev += Number(r.revenue);
    cur.n   += Number(r.tx_count);
    aggByMonth.set(r.period_yyyymm, cur);
  }
  const avgRows = Array.from(aggByMonth.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([m, v]) => ({
    period_yyyymm: m, revenue: v.rev, reservations: v.n, avg_check: v.n > 0 ? v.rev / v.n : 0,
  }));

  void period;

  const rawTxns = (rawTxnsResp?.data ?? []) as Array<{
    transaction_id: string; reservation_id?: string | null; description: string;
    amount: number; usali_dept?: string | null; usali_subdept?: string | null;
    local_laos_str?: string | null; guest_name?: string | null; room_name?: string | null;
  }>;

  return (
    <DashboardPage title="Other ops" subtitle="Operations · everything without a home (Fee · Tax · Adjustment · Addon · Front Office · Unclassified)" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* PBS 2026-06-12 #213 — voucher sales · GL-only revenue (no Cloudbeds folio) */}
        <Container title="Voucher sales · Services" subtitle="QB GL · non-refundable voucher revenue · not included in Cloudbeds folio">
          {(() => {
            type SvcRow = { period_yyyymm: string; amount_usd: number | string };
            const rows = ((servicesResp?.data ?? []) as SvcRow[]).map((r) => ({ p: r.period_yyyymm, v: -Number(r.amount_usd ?? 0) })).filter((r) => r.v !== 0);
            const ytd = rows.filter((r) => r.p >= '2026-01' && r.p <= opToIso.slice(0,7)).reduce((s, r) => s + r.v, 0);
            const lifetime = rows.reduce((s, r) => s + r.v, 0);
            const latest = rows.length > 0 ? rows[rows.length - 1] : null;
            const monthLabel = (yyyymm: string) => { const [y, m] = yyyymm.split('-').map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }); };
            const tiles: KpiTileProps[] = [
              { label: 'Vouchers · YTD', value: `$${Math.round(ytd).toLocaleString('en-US')}`, footnote: 'non-refundable · 708125 Services', status: 'grey', size: 'sm' },
              { label: 'Vouchers · lifetime', value: `$${Math.round(lifetime).toLocaleString('en-US')}`, footnote: `${rows.length} mo with activity`, status: 'grey', size: 'sm' },
              ...(latest ? [{ label: `Latest · ${monthLabel(latest.p)}`, value: `$${Math.round(latest.v).toLocaleString('en-US')}`, footnote: 'most recent posting', status: 'grey' as const, size: 'sm' as const }] : []),
            ];
            return (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                  {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
                </div>
                {rows.length > 0 ? (
                  <div style={{ marginTop: 12, fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#5A5A5A' }}>
                    Posted months: {rows.map((r) => `${monthLabel(r.p)} $${Math.round(r.v).toLocaleString('en-US')}`).join(' · ')}
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 12, fontStyle: 'italic', color: '#8a8170' }}>No voucher revenue posted yet.</div>
                )}
              </div>
            );
          })()}
        </Container>

        <Container title="Operating snapshot" subtitle={`bucket totals · ${opLabel}`} density="compact" action={opPills}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row1.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          <Container title="Revenue by bucket" subtitle="since Jan 2025 · stacked monthly" density="compact">
            <FbCategoryChart rows={stackedRows as Array<{ period_yyyymm: string; category: string; revenue: number | string }>} />
          </Container>
          <Container title="Avg ticket" subtitle="all 'other' buckets combined · revenue ÷ tx" density="compact">
            <FbAvgTicketChart rows={avgRows} />
          </Container>
          <Container title="Bucket breakdown" subtitle={`${opLabel} totals`} density="compact">
            <div style={{ padding: 12 }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid #000' }}>
                  <th style={{ textAlign: 'left', padding: 6 }}>Bucket</th>
                  <th style={{ textAlign: 'right', padding: 6 }}>Tx</th>
                  <th style={{ textAlign: 'right', padding: 6 }}>Rev</th>
                  <th style={{ textAlign: 'right', padding: 6 }}>%</th>
                </tr></thead>
                <tbody>{buckets.map(([name, v]) => (
                  <tr key={name} style={{ borderBottom: '1px solid #F0F0F0' }}>
                    <td style={{ padding: 6, fontWeight: 600 }}>{name}</td>
                    <td style={{ padding: 6, textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{v.n}</td>
                    <td style={{ padding: 6, textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{fmtUsd(v.rev)}</td>
                    <td style={{ padding: 6, textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#5A5A5A' }}>{totalRev > 0 ? ((v.rev / totalRev) * 100).toFixed(1) : '0'}%</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Container>
        </div>

        <details open>
          <summary style={summaryStyle}>All transactions · search &amp; reconcile <span style={{ fontWeight: 400, color: '#5A5A5A', marginLeft: 6 }}>({rawTxns.length} most recent)</span></summary>
          <div style={{ marginTop: 10, overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              <thead><tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ textAlign: 'left', padding: 6 }}>Time (Laos)</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Guest</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Item</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Bucket</th>
                <th style={{ textAlign: 'right', padding: 6 }}>Amount</th>
              </tr></thead>
              <tbody>{rawTxns.slice(0, 500).map((t) => (
                <tr key={t.transaction_id} style={{ borderBottom: '1px solid #F0F0F0' }}>
                  <td style={{ padding: 6 }}>{t.local_laos_str ?? '—'}</td>
                  <td style={{ padding: 6, fontFamily: 'inherit' }}>{t.guest_name ?? '—'}</td>
                  <td style={{ padding: 6, fontFamily: 'inherit', fontWeight: 600 }}>{t.description}</td>
                  <td style={{ padding: 6, color: '#5A5A5A' }}>{t.usali_dept ?? 'Unclassified'}{t.usali_subdept ? ' / ' + t.usali_subdept : ''}</td>
                  <td style={{ padding: 6, textAlign: 'right', fontWeight: 600 }}>{fmtUsd(t.amount)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </details>
      </div>
    </DashboardPage>
  );
}
