// app/holding/finance/page.tsx
// PBS 2026-07-09: Holding · Finance HoD landing — same block layout as
// Vector's /revenue and Intel's /finance (HodLanding v2):
//   Shortcuts · My Reports · My Tasks · External Links
//   Conclusions
//   Build a report
//   Scheduled reports + Send log
//
// Adds a Holding-specific "Beyond Circle at-a-glance" strip on top (invoices YTD /
// open / total billed / next number) with a "Manage invoices" CTA so PBS still
// sees the finance-holding numbers without leaving the HoD landing.

import HodLanding from '@/app/_components/HodLanding';
import { Container } from '@/app/(cockpit)/_design';
import TenantLink from '@/components/nav/TenantLink';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { Insight } from '@/app/_components/ConclusionBlock';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HOLDING_PID = 0;

const REPORT_PRESETS: { code: string; label: string; desc: string; href: string }[] = [
  { code: 'invoice_new',   label: 'Create invoice',      desc: 'Issue a new Beyond Circle invoice',                   href: '/holding/finance/invoices/create'   },
  { code: 'invoice_log',   label: 'Invoices · Send log', desc: 'Every invoice ever issued · sortable + Preview',      href: '/holding/finance/invoices/send-log' },
  { code: 'invoice_tpl',   label: 'Invoice template',    desc: 'Edit brand + Sender + defaults · live A4 preview',    href: '/holding/finance/invoices/template' },
  { code: 'clients',       label: 'Clients (CRM)',       desc: 'Add / edit / deactivate · linked invoice counts',     href: '/holding/finance/clients'           },
];

async function loadHoldingFinanceSummary(sb: ReturnType<typeof getSupabaseAdmin>) {
  const [invRes, clientsRes, nextRes] = await Promise.all([
    sb.from('v_holding_invoices').select('total, currency, status, issued_at').limit(500),
    sb.from('v_holding_clients').select('id, invoices_count').eq('active', true).limit(500),
    sb.rpc('fn_holding_invoice_peek_next'),
  ]);
  const invoices = (invRes.data ?? []) as Array<{ total: string; currency: string; status: string; issued_at: string }>;
  const clients  = (clientsRes.data ?? []) as Array<{ id: number; invoices_count: number | null }>;
  const year = new Date().getUTCFullYear();
  const ytd = invoices.filter((i) => new Date(i.issued_at).getUTCFullYear() === year);
  const ytdBilled = ytd.reduce((s, i) => s + Number(i.total), 0);
  const openCount = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled').length;
  const nextNumber = typeof nextRes.data === 'string' ? nextRes.data : 'BC-2026-01001';
  const activeClients = clients.length;
  return { ytdCount: ytd.length, ytdBilled, openCount, nextNumber, activeClients, totalInvoices: invoices.length };
}

function buildInsights(s: Awaited<ReturnType<typeof loadHoldingFinanceSummary>>): Insight[] {
  const out: Insight[] = [];
  if (s.openCount === 0 && s.totalInvoices > 0) {
    out.push({ id: 'no-open', kind: 'ok', title: 'No open invoices', body: 'Every issued invoice is marked paid or cancelled.' });
  }
  if (s.openCount > 0) {
    out.push({ id: 'open-inv', kind: 'watch', title: `${s.openCount} open invoice${s.openCount === 1 ? '' : 's'}`, body: 'Not yet marked paid or cancelled — chase or reconcile.' });
  }
  if (s.activeClients === 0) {
    out.push({ id: 'no-clients', kind: 'watch', title: 'No clients on file', body: 'Add clients in the Clients tab before issuing invoices.' });
  } else {
    out.push({ id: 'clients-ready', kind: 'ok', title: `${s.activeClients} active client${s.activeClients === 1 ? '' : 's'}`, body: 'CRM populated — use the Pick-a-client dropdown on Create.' });
  }
  if (s.ytdCount === 0) {
    out.push({ id: 'no-ytd', kind: 'watch', title: 'No invoices issued YTD', body: 'Beyond Circle has not billed this calendar year yet.' });
  }
  return out;
}

export default async function HoldingFinancePage() {
  const sb = getSupabaseAdmin();
  const summary = await loadHoldingFinanceSummary(sb);
  const insights = buildInsights(summary);

  return (
    <>
      <HodLanding
        slug="holding_finance"
        propertyId={HOLDING_PID}
        liveTiles={[
          { label: 'Next invoice #',    value: summary.nextNumber,                                                          size: 'sm' },
          { label: 'Invoices YTD',      value: String(summary.ytdCount),                                                    size: 'sm', footnote: `${summary.totalInvoices} total on file` },
          { label: 'Open',              value: String(summary.openCount),                                                   size: 'sm', footnote: 'not paid / cancelled' },
          { label: 'Billed YTD',        value: `${summary.ytdBilled.toLocaleString('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}`, size: 'sm' },
          { label: 'Active clients',    value: String(summary.activeClients),                                               size: 'sm' },
        ]}
        conclusions={{
          insights,
          title: 'CONCLUSIONS · invoices · clients · settlement',
          subtitle: `Holding scope (Beyond Circle) · ${summary.totalInvoices} invoice${summary.totalInvoices === 1 ? '' : 's'} · ${summary.activeClients} client${summary.activeClients === 1 ? '' : 's'}`,
        }}
        extraContainers={
          <div style={{ gridColumn: '1 / -1' }}>
            <Container title="Quick launch" subtitle="Jump into an invoice flow or the CRM · same links as the tabs above.">
              <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {REPORT_PRESETS.map((r) => (
                  <TenantLink key={r.code} href={r.href}
                    style={{
                      textDecoration: 'none', color: 'inherit',
                      border: '1px solid #E6DFCC', borderRadius: 6, padding: '12px 14px',
                      background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1B1B1B' }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: '#5A5A5A' }}>{r.desc}</div>
                  </TenantLink>
                ))}
              </div>
            </Container>
          </div>
        }
      />
    </>
  );
}
