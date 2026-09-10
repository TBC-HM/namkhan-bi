// app/holding/finance/clients/[id]/page.tsx
// One client, everything about them on one screen.
//
// PBS 2026-09-10: the Clients list showed contact fields and nothing else —
// no invoices, no receivables, no revenue, no contracts. This is that page.
//
// LINKAGE WARNING, load-bearing: holding.invoices.recipient_id has a FOREIGN
// KEY to holding.invoice_recipients — the LEGACY table — while the CRM lives in
// holding.clients with its own id sequence. The two id spaces are unrelated, so
// joining an invoice to a client by id is wrong and silently returns nothing
// (which is why the list shows 0 invoices for a client owing six figures).
// Until that FK is repointed, this page matches on recipient_name, which is the
// only field that actually agrees between the two tables. The banner on the
// page says so rather than presenting a name match as a real relationship.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FOREST = '#084838';
const HAIR = '#E6DFCC';
const INK_M = '#5A5A5A';
const RUST = '#B04A2F';

const TH: React.CSSProperties = {
  textAlign: 'left', padding: '6px 8px', fontSize: 10, letterSpacing: '.06em',
  textTransform: 'uppercase', color: INK_M, fontWeight: 700,
  borderBottom: `1px solid ${HAIR}`, whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = { padding: '6px 8px', fontSize: 12, borderBottom: `1px solid ${HAIR}55` };
const TD_N: React.CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
const TABLE: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const SCROLL: React.CSSProperties = { overflowX: 'auto', width: '100%' };

/** Money in the currency the DATA names — never an assumed one. */
function money(v: unknown, ccy: string, dp = 2): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy, minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n);
  } catch {
    return `${n.toLocaleString('en-US', { minimumFractionDigits: dp })} ${ccy}`;
  }
}
function dateLabel(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

interface Client {
  id: number; name: string; legal_name: string | null; contact_person: string | null;
  email: string | null; phone: string | null; address: string | null; tax_id: string | null;
  country: string | null; currency: string; category: string | null; tags: string[] | null;
  notes: string | null; active: boolean; created_at: string; updated_at: string;
  invoices_count: number; total_billed: string | number | null; last_invoice_at: string | null;
}
interface Inv {
  id: number; invoice_number: string; subject: string | null; total: string;
  currency: string; status: string; issued_at: string | null; due_at: string | null;
  paid_at: string | null; recipient_email: string | null;
}
interface Ar {
  invoice_number: string; amount_native: string; currency: string; amount_eur: string | null;
  due_at: string | null; days_overdue: number; ageing_bucket: string;
}
interface RevLine { account_code: string; account_name: string; line_type: string; amount_eur: string | null; period_yyyymm: string }
interface Agreement {
  id: number; agreement_code: string; agreement_title: string; agreement_type: string;
  status: string; effective_from: string; effective_to: string | null; currency: string | null;
  signed_pdf_url: string | null; notes: string | null;
}

function Pill({ text, tone }: { text: string; tone: 'good' | 'warn' | 'bad' | 'mute' }) {
  const map = {
    good: { bg: '#E7F1E9', fg: '#1F5C2C' }, warn: { bg: '#FBF6E7', fg: '#8A6D1F' },
    bad: { bg: '#F5EDEB', fg: RUST }, mute: { bg: '#F4F2EC', fg: INK_M },
  }[tone];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', background: map.bg, color: map.fg,
      borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.06em', whiteSpace: 'nowrap',
    }}>{text}</span>
  );
}

export default async function ClientDetailPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isFinite(id)) notFound();

  const sb = getSupabaseAdmin();
  const { data: cData } = await sb.from('v_holding_clients').select('*').eq('id', id).maybeSingle();
  const client = cData as Client | null;
  if (!client) notFound();

  // Name match, not id match — see the LINKAGE WARNING at the top of this file.
  const [invRes, arRes, revRes, agrRes] = await Promise.all([
    sb.from('v_holding_invoices')
      .select('id, invoice_number, subject, total, currency, status, issued_at, due_at, paid_at, recipient_email')
      .eq('recipient_name', client.name).order('issued_at', { ascending: false }).limit(500),
    sb.from('v_holding_ar_ageing')
      .select('invoice_number, amount_native, currency, amount_eur, due_at, days_overdue, ageing_bucket')
      .eq('recipient_name', client.name).order('days_overdue', { ascending: false }).limit(500),
    sb.from('v_holding_pl_lines')
      .select('account_code, account_name, line_type, amount_eur, period_yyyymm')
      .eq('counterparty', client.name).limit(2000),
    // Plain embed, matched in JS. A .or() across an embedded resource needs
    // foreignTable/referencedTable syntax that differs between supabase-js
    // versions and fails at RUNTIME, not build time — not worth the risk for a
    // table this small.
    sb.schema('contracts').from('agreements')
      .select('id, agreement_code, agreement_title, agreement_type, status, effective_from, effective_to, currency, signed_pdf_url, notes, party_id, parties(legal_name, display_name)')
      .limit(500),
  ]);

  const invoices = (invRes.data ?? []) as Inv[];
  const ar = (arRes.data ?? []) as Ar[];
  const revLines = (revRes.data ?? []) as RevLine[];
  const agreementsError = agrRes.error?.message ?? null;
  const needle = client.name.trim().toLowerCase();
  const agreements = ((agrRes.data ?? []) as unknown as Array<Agreement & {
    parties?: { legal_name?: string; display_name?: string } | null;
  }>).filter((a) => {
    const legal = (a.parties?.legal_name ?? '').trim().toLowerCase();
    const disp = (a.parties?.display_name ?? '').trim().toLowerCase();
    // Match either direction: the CRM name and the legal party name are written
    // differently ("The Namkhan" vs "Green Tea Sole Company Limited").
    return Boolean(needle) && (
      legal === needle || disp === needle ||
      legal.includes(needle) || needle.includes(legal && legal.length > 3 ? legal : '\u0000') ||
      disp.includes(needle) || needle.includes(disp && disp.length > 3 ? disp : '\u0000')
    );
  });

  // Totals per currency — never summed across (L15).
  const billedByCcy = invoices.reduce<Record<string, number>>((a, i) => {
    a[i.currency] = (a[i.currency] ?? 0) + Number(i.total || 0); return a;
  }, {});
  const openEur = ar.reduce((s, r) => s + Number(r.amount_eur || 0), 0);
  const revenueByAccount = revLines
    .filter((l) => l.line_type === 'revenue')
    .reduce<Record<string, { name: string; total: number }>>((a, l) => {
      const k = l.account_code;
      if (!a[k]) a[k] = { name: l.account_name, total: 0 };
      a[k].total += Number(l.amount_eur || 0);
      return a;
    }, {});
  const revenueTotal = Object.values(revenueByAccount).reduce((s, r) => s + r.total, 0);

  const cfg = DEPT_CFG.holding_finance;
  const tabs: DashboardTab[] = cfg.subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/holding/finance/clients',
  }));

  const facts: Array<[string, React.ReactNode]> = [
    ['Legal name', client.legal_name || '—'],
    ['Category', client.category || '—'],
    ['Country', client.country || '—'],
    ['Billing currency', client.currency],
    ['Invoicing email', client.email
      ? <a href={`mailto:${client.email}`} style={{ color: FOREST }}>{client.email}</a>
      : <span style={{ color: RUST }}>none on file — invoices cannot be emailed</span>],
    ['Contact person', client.contact_person || '—'],
    ['Phone', client.phone || '—'],
    ['Tax ID', client.tax_id || '—'],
    ['Address', client.address || '—'],
    ['Notes', client.notes || '—'],
  ];

  return (
    <DashboardPage
      title={`Finance · Holding · ${client.name}`}
      subtitle={`${client.active ? 'Active' : 'Inactive'} client · billed in ${client.currency}${client.country ? ` · ${client.country}` : ''}`}
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Link href="/holding/finance/clients" style={{ fontSize: 12, color: FOREST }}>← all clients</Link>
      </div>

      {!client.active && (
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{
            padding: '10px 14px', border: `1px solid ${RUST}`, borderLeft: `3px solid ${RUST}`,
            borderRadius: 6, background: '#FDF6F4', fontSize: 12, color: RUST,
          }}>
            <strong>This client is marked inactive</strong> and is hidden from the Clients
            list and the invoice picker{ar.length > 0 ? ` — but still has ${ar.length} open receivable(s).` : '.'}
          </div>
        </div>
      )}

      {/* Contact + facts */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 10, alignItems: 'start', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))' }}>
        <Container title="Client record" subtitle="holding.clients" density="compact">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {facts.map(([k, v]) => (
                <tr key={k}>
                  <td style={{
                    padding: '6px 10px 6px 0', fontSize: 11, color: INK_M, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap',
                    verticalAlign: 'top', width: '1%', borderBottom: `1px solid ${HAIR}55`,
                  }}>{k}</td>
                  <td style={{ padding: '6px 0', fontSize: 12, borderBottom: `1px solid ${HAIR}55` }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Container>

        <Container title="Position" subtitle="Billed, outstanding and booked revenue" density="compact">
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, fontWeight: 700 }}>Open receivables</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: openEur > 0 ? RUST : FOREST, fontVariantNumeric: 'tabular-nums' }}>
                {money(openEur, 'EUR')}
              </div>
              <div style={{ fontSize: 11, color: INK_M }}>
                {ar.length} open invoice(s){ar.length > 0 ? ` · oldest ${Math.max(...ar.map((r) => Number(r.days_overdue) || 0))} days overdue` : ''} · EUR reporting layer
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, fontWeight: 700 }}>Billed to date</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {Object.keys(billedByCcy).length === 0
                  ? '—'
                  : Object.entries(billedByCcy).sort().map(([c, v]) => money(v, c, 0)).join(' · ')}
              </div>
              <div style={{ fontSize: 11, color: INK_M }}>
                {invoices.length} invoice(s), in the currency each was billed — never added across currencies.
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, fontWeight: 700 }}>Revenue booked</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(revenueTotal, 'EUR')}</div>
              <div style={{ fontSize: 11, color: INK_M }}>From the P&amp;L ledger, EUR reporting layer</div>
            </div>
          </div>
        </Container>
      </div>

      {/* Revenue by service line */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Revenue by service line" subtitle="public.v_holding_pl_lines · what this client is billed for" density="compact">
          {Object.keys(revenueByAccount).length === 0 ? (
            <div style={{ fontSize: 12, color: INK_M, padding: '8px 2px' }}>
              No revenue line is booked against this counterparty.
            </div>
          ) : (
            <div style={SCROLL}>
              <table style={TABLE}>
                <thead><tr>
                  <th style={TH}>Account</th><th style={TH}>Service</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Revenue (EUR)</th>
                </tr></thead>
                <tbody>
                  {Object.entries(revenueByAccount).sort(([a], [b]) => a.localeCompare(b)).map(([code, r]) => (
                    <tr key={code}>
                      <td style={{ ...TD, fontWeight: 600 }}>{code}</td>
                      <td style={TD}>{r.name}</td>
                      <td style={TD_N}>{money(r.total, 'EUR')}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...TD, borderTop: `1px solid ${HAIR}`, fontWeight: 700 }} colSpan={2}>Total</td>
                    <td style={{ ...TD_N, borderTop: `1px solid ${HAIR}`, fontWeight: 700, color: FOREST }}>{money(revenueTotal, 'EUR')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Contracts */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Contracts" subtitle="contracts.agreements · what is signed and what is not" density="compact" status={agreements.length === 0 ? 'amber' : undefined}>
          {agreementsError ? (
            <div style={{ fontSize: 12, color: RUST }}>Contracts could not be loaded: {agreementsError}</div>
          ) : agreements.length === 0 ? (
            <div style={{ fontSize: 12, color: RUST, lineHeight: 1.6 }}>
              <strong>No agreement is recorded for this client.</strong> Services may be
              running and invoiced regardless — an empty register here means the paperwork
              is not on file, not that the relationship is informal.
            </div>
          ) : (
            <div style={SCROLL}>
              <table style={TABLE}>
                <thead><tr>
                  <th style={TH}>Code</th><th style={TH}>Agreement</th><th style={TH}>Type</th>
                  <th style={TH}>Status</th><th style={TH}>From</th><th style={TH}>To</th><th style={TH}>Signed PDF</th>
                </tr></thead>
                <tbody>
                  {agreements.map((a) => (
                    <tr key={a.id}>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{a.agreement_code}</td>
                      <td style={TD}>{a.agreement_title}</td>
                      <td style={{ ...TD, color: INK_M, whiteSpace: 'nowrap' }}>{a.agreement_type}</td>
                      <td style={TD}>
                        <Pill text={a.status} tone={
                          a.status === 'active' || a.status === 'signed' ? 'good'
                            : a.status === 'draft' || a.status === 'negotiating' ? 'warn' : 'bad'
                        } />
                      </td>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{dateLabel(a.effective_from)}</td>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{a.effective_to ? dateLabel(a.effective_to) : 'open'}</td>
                      <td style={TD}>{a.signed_pdf_url
                        ? <a href={a.signed_pdf_url} target="_blank" rel="noreferrer" style={{ color: FOREST }}>open</a>
                        : <span style={{ color: RUST }}>not signed</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Open receivables */}
      {ar.length > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title={`Open receivables · ${ar.length}`} subtitle="Full carrying value — no impairment or provision applied" density="compact" status="amber">
            <div style={SCROLL}>
              <table style={TABLE}>
                <thead><tr>
                  <th style={TH}>Invoice</th><th style={{ ...TH, textAlign: 'right' }}>Native</th><th style={TH}>Ccy</th>
                  <th style={{ ...TH, textAlign: 'right' }}>EUR</th><th style={TH}>Due</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Days overdue</th><th style={TH}>Bucket</th>
                </tr></thead>
                <tbody>
                  {ar.map((r) => (
                    <tr key={r.invoice_number}>
                      <td style={{ ...TD, fontWeight: 600 }}>{r.invoice_number}</td>
                      <td style={TD_N}>{money(r.amount_native, r.currency)}</td>
                      <td style={{ ...TD, color: INK_M }}>{r.currency}</td>
                      <td style={{ ...TD_N, fontWeight: 600 }}>{money(r.amount_eur, 'EUR')}</td>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{dateLabel(r.due_at)}</td>
                      <td style={{ ...TD_N, color: RUST, fontWeight: 700 }}>{r.days_overdue}</td>
                      <td style={TD}>{r.ageing_bucket}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...TD, borderTop: `1px solid ${HAIR}`, fontWeight: 700 }} colSpan={3}>Total open</td>
                    <td style={{ ...TD_N, borderTop: `1px solid ${HAIR}`, fontWeight: 700, color: RUST }}>{money(openEur, 'EUR')}</td>
                    <td style={{ ...TD, borderTop: `1px solid ${HAIR}` }} colSpan={3} />
                  </tr>
                </tbody>
              </table>
            </div>
          </Container>
        </div>
      )}

      {/* Invoices */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Invoices · ${invoices.length}`} subtitle="public.v_holding_invoices · click an invoice to preview it" density="compact">
          <div style={{
            padding: '8px 12px', marginBottom: 10, border: `1px solid ${HAIR}`,
            borderLeft: `3px solid ${INK_M}`, borderRadius: 6, fontSize: 11, color: INK_M, lineHeight: 1.55,
          }}>
            Matched to this client by <strong>name</strong>, not by key.
            <code> holding.invoices.recipient_id</code> still points at the legacy
            <code> invoice_recipients</code> table rather than the CRM, so an id join returns
            nothing. A renamed client would break this match until that is repointed.
          </div>
          {invoices.length === 0 ? (
            <div style={{ fontSize: 12, color: INK_M }}>No invoice carries this client&apos;s name.</div>
          ) : (
            <div style={SCROLL}>
              <table style={TABLE}>
                <thead><tr>
                  <th style={TH}>Invoice</th><th style={TH}>Subject</th><th style={TH}>Status</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Total</th><th style={TH}>Ccy</th>
                  <th style={TH}>Issued</th><th style={TH}>Due</th><th style={TH}>Paid</th><th style={TH}>Email</th>
                </tr></thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id}>
                      <td style={TD}>
                        <Link href={`/holding/finance/invoices/${i.id}/preview`} style={{ color: FOREST, fontWeight: 600 }}>
                          {i.invoice_number}
                        </Link>
                      </td>
                      <td style={{ ...TD, maxWidth: 280 }}>{i.subject ?? '—'}</td>
                      <td style={TD}>
                        <Pill text={i.status} tone={i.status === 'paid' ? 'good' : i.status === 'sent' ? 'warn' : 'mute'} />
                      </td>
                      <td style={TD_N}>{money(i.total, i.currency)}</td>
                      <td style={{ ...TD, color: INK_M }}>{i.currency}</td>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{dateLabel(i.issued_at)}</td>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{dateLabel(i.due_at)}</td>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{dateLabel(i.paid_at)}</td>
                      <td style={{ ...TD, color: i.recipient_email ? 'inherit' : RUST, fontSize: 11 }}>
                        {i.recipient_email || 'none'}
                      </td>
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
