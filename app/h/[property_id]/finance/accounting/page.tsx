// app/h/[property_id]/finance/accounting/page.tsx
//
// QB Accounting transaction feed — every row from finance.gl_transactions
// via public.v_finance_acc_transactions (REVOKE anon, ADR-277).
//
// Columns match the QuickBooks "Transaction Detail by Account" report:
//   Date · Type · No. · Post · Account · Sub-account · Payee · Class
//   Memo · Amount · CCY · FX · USD · Provisional · Import batch · Imported at
//
// Weekly QB ingest (email → gestoría → xlsx → import pipeline) means
// imported_at tells you WHEN each batch landed; source_file tells you WHICH.

import { createClient } from '@/lib/supabase/server';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';
import AccFilters from './AccFilters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PAGE_SIZE = 300;

interface ARow {
  txn_id: number;
  txn_date: string;
  txn_type: string | null;
  txn_number: string | null;
  posting: boolean | null;
  section_account: string | null;
  line_account: string | null;
  party_name: string | null;
  location: string | null;
  class: string | null;
  description: string | null;
  amount_native: number | null;
  currency_native: string | null;
  fx_rate: number | null;
  amount_usd: number | null;
  is_provisional: boolean | null;
  source_file: string | null;
  source_row: number | null;
  imported_at: string | null;
}

interface Props {
  params: { property_id: string };
  searchParams?: {
    q?: string; type?: string; dept?: string; file?: string;
    provisional?: string; from?: string; until?: string; page?: string;
  };
}

export default async function AccountingPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  const sp = searchParams ?? {};

  const q           = sp.q?.trim() ?? '';
  const typeFilter  = sp.type ?? '';
  const deptFilter  = sp.dept ?? '';
  const fileFilter  = sp.file ?? '';
  const provFilter  = sp.provisional ?? 'all';
  const fromDate    = sp.from ?? '';
  const untilDate   = sp.until ?? '';
  const page        = Math.max(1, Number(sp.page ?? '1'));
  const offset      = (page - 1) * PAGE_SIZE;

  const supabase = createClient();

  // ── Option lists for filter dropdowns ─────────────────────────
  // Fetch distinct values from unfiltered property rows
  const [typesRes, deptsRes, filesRes] = await Promise.all([
    supabase.from('v_finance_acc_transactions')
      .select('txn_type').eq('property_id', propertyId).limit(20000),
    supabase.from('v_finance_acc_transactions')
      .select('class').eq('property_id', propertyId).limit(20000),
    supabase.from('v_finance_acc_transactions')
      .select('source_file').eq('property_id', propertyId).limit(20000),
  ]);

  const txnTypes = [...new Set((typesRes.data ?? []).map((r: { txn_type: string | null }) => r.txn_type).filter(Boolean) as string[])].sort();
  const depts    = [...new Set((deptsRes.data ?? []).map((r: { class: string | null }) => r.class).filter(Boolean) as string[])].sort();
  const files    = [...new Set((filesRes.data ?? []).map((r: { source_file: string | null }) => r.source_file).filter(Boolean) as string[])].sort();

  // ── Main data query ───────────────────────────────────────────
  let query = supabase
    .from('v_finance_acc_transactions')
    .select('txn_id,txn_date,txn_type,txn_number,posting,section_account,line_account,party_name,location,class,description,amount_native,currency_native,fx_rate,amount_usd,is_provisional,source_file,source_row,imported_at')
    .eq('property_id', propertyId)
    .order('txn_date', { ascending: false })
    .order('txn_id', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (typeFilter) query = query.eq('txn_type', typeFilter);
  if (deptFilter) query = query.eq('class', deptFilter);
  if (fileFilter) query = query.eq('source_file', fileFilter);
  if (provFilter === 'true')  query = query.eq('is_provisional', true);
  if (provFilter === 'false') query = query.eq('is_provisional', false);
  if (fromDate)  query = query.gte('txn_date', fromDate);
  if (untilDate) query = query.lte('txn_date', untilDate);
  if (q) {
    query = query.or(
      `party_name.ilike.%${q}%,description.ilike.%${q}%,section_account.ilike.%${q}%,line_account.ilike.%${q}%`,
    );
  }

  // Count total (unfiltered) for badge
  const countQuery = supabase
    .from('v_finance_acc_transactions')
    .select('txn_id', { count: 'exact', head: true })
    .eq('property_id', propertyId);

  const [dataRes, countRes] = await Promise.all([query, countQuery]);
  const rows = (dataRes.data ?? []) as ARow[];
  const totalRows = countRes.count ?? 0;

  const hasNext = rows.length === PAGE_SIZE;
  const hasPrev = page > 1;

  // Page hrefs preserve all current filters
  function pageHref(p: number): string {
    const entries = Object.entries(sp).filter(([k]) => k !== 'page');
    const params = new URLSearchParams(entries as [string, string][]);
    params.set('page', String(p));
    return `?${params.toString()}`;
  }

  const sourceSummary = files.length === 1
    ? shortenFile(files[0])
    : `${files.length} import batches`;

  return (
    <DashboardPage
      title="Accounting"
      subtitle={`QuickBooks transaction feed · ${totalRows.toLocaleString()} rows · ${sourceSummary}`}
      tabs={financeSubPagesForProperty(propertyId).map((s) => ({
        key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/finance/accounting'),
      }))}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <AccFilters
          txnTypes={txnTypes}
          depts={depts}
          files={files}
          totalRows={totalRows}
        />

        <Container
          title={`Transactions · page ${page}`}
          subtitle={`${rows.length} of ${totalRows.toLocaleString()} · sorted date desc · QB as-is`}
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              {hasPrev && (
                <a href={pageHref(page - 1)} style={pageLinkStyle}>← Prev</a>
              )}
              {hasNext && (
                <a href={pageHref(page + 1)} style={pageLinkStyle}>Next →</a>
              )}
            </div>
          }
        >
          <TxnTable rows={rows} />
        </Container>

        {(hasPrev || hasNext) && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            {hasPrev && <a href={pageHref(page - 1)} style={pageLinkStyle}>← Prev</a>}
            <span style={{ fontSize: 'var(--t-xs)', color: 'var(--tbl-fg-mute)' }}>Page {page}</span>
            {hasNext && <a href={pageHref(page + 1)} style={pageLinkStyle}>Next →</a>}
          </div>
        )}
      </div>
    </DashboardPage>
  );
}

// ─── helpers ────────────────────────────────────────────────────

function shortenFile(f: string): string {
  return f.split(/[\\/]/).pop()?.slice(0, 60) ?? f;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''));
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function fmtAmt(n: number | null, ccy: string | null): string {
  if (n == null) return '—';
  const sym = ccy === 'EUR' ? '€' : ccy === 'USD' ? '$' : ccy === 'LAK' ? '₭' : (ccy ?? '');
  const abs = Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${sym}${abs})` : `${sym}${abs}`;
}

function fmtFx(n: number | null): string {
  if (n == null || n === 1) return '—';
  return n.toFixed(4);
}

const pageLinkStyle: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid var(--tbl-border, rgba(26,26,26,0.14))',
  borderRadius: 4,
  fontSize: 'var(--t-xs)',
  color: 'var(--tbl-fg, #1A1A1A)',
  textDecoration: 'none',
  display: 'inline-block',
};

// ─── Table ────────────────────────────────────────────────────────

function TxnTable({ rows }: { rows: ARow[] }) {
  const MUTE = 'var(--tbl-fg-mute, rgba(26,26,26,0.55))';
  const BORDER = 'var(--tbl-border, rgba(26,26,26,0.14))';
  const BORDER_STRONG = 'var(--tbl-border-strong, rgba(26,26,26,0.22))';
  const FG = 'var(--tbl-fg, #1A1A1A)';

  if (rows.length === 0) {
    return (
      <div style={{ padding: 24, color: MUTE, fontSize: 'var(--t-sm)', textAlign: 'center' }}>
        No transactions match the current filters.
      </div>
    );
  }

  const th: React.CSSProperties = {
    textAlign: 'left', padding: '6px 8px', fontWeight: 600,
    fontSize: 'var(--t-xs)', borderBottom: `2px solid ${BORDER_STRONG}`,
    whiteSpace: 'nowrap', color: FG,
  };
  const thR: React.CSSProperties = { ...th, textAlign: 'right' };
  const td: React.CSSProperties = {
    padding: '4px 8px', fontSize: 'var(--t-xs)', borderBottom: `1px solid ${BORDER}`,
    verticalAlign: 'top', color: FG,
  };
  const tdM: React.CSSProperties = { ...td, color: MUTE };
  const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-xs)' }}>
        <thead>
          <tr>
            <th style={th}>Date</th>
            <th style={th}>Type</th>
            <th style={th}>No.</th>
            <th style={th}>Post</th>
            <th style={th}>Account</th>
            <th style={th}>Sub-account</th>
            <th style={th}>Payee</th>
            <th style={th}>Class</th>
            <th style={{ ...th, maxWidth: 240 }}>Memo</th>
            <th style={thR}>Amount</th>
            <th style={thR}>CCY</th>
            <th style={thR}>FX</th>
            <th style={thR}>USD</th>
            <th style={th}>Prov.</th>
            <th style={th}>Import batch</th>
            <th style={th}>Imported</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isNeg = (r.amount_native ?? 0) < 0;
            const amtColor = isNeg ? '#C0392B' : FG;
            return (
              <tr key={r.txn_id}>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDate(r.txn_date)}</td>
                <td style={tdM}>{r.txn_type ?? '—'}</td>
                <td style={tdM}>{r.txn_number ?? '—'}</td>
                <td style={{ ...tdM, textAlign: 'center' }}>
                  {r.posting == null ? '—' : r.posting ? '✓' : '○'}
                </td>
                <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={r.section_account ?? ''}>
                  {r.section_account ?? '—'}
                </td>
                <td style={{ ...tdM, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={r.line_account ?? ''}>
                  {r.line_account ?? '—'}
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.party_name ?? '—'}</td>
                <td style={tdM}>{r.class ?? '—'}</td>
                <td style={{ ...tdM, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={r.description ?? ''}>
                  {r.description ?? '—'}
                </td>
                <td style={{ ...tdR, color: amtColor, fontWeight: isNeg ? 500 : 400 }}>
                  {fmtAmt(r.amount_native, r.currency_native)}
                </td>
                <td style={tdM}>{r.currency_native ?? '—'}</td>
                <td style={tdM}>{fmtFx(r.fx_rate)}</td>
                <td style={{ ...tdR, color: (r.amount_usd ?? 0) < 0 ? '#C0392B' : MUTE }}>
                  {fmtAmt(r.amount_usd, 'USD')}
                </td>
                <td style={{ ...tdM, textAlign: 'center' }}>
                  {r.is_provisional
                    ? <span style={{ background: 'rgba(200,150,0,0.12)', color: '#9B7A00', padding: '1px 5px', borderRadius: 3 }}>P</span>
                    : <span style={{ color: MUTE }}>—</span>}
                </td>
                <td style={{ ...tdM, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={r.source_file ?? ''}>
                  {r.source_file ? shortenFile(r.source_file) : '—'}
                </td>
                <td style={{ ...tdM, whiteSpace: 'nowrap' }}>
                  {r.imported_at ? fmtDate(r.imported_at) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
