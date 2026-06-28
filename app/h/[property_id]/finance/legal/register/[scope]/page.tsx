// app/h/[property_id]/finance/legal/register/[scope]/page.tsx
// Read-only registers — Khoa-style layout for non-case scopes:
//   /register/contracts     — doc_type=legal + CONTRACT_SUBTYPES
//   /register/insurance     — doc_type=insurance
//   /register/licenses      — compliance + legal governance/title subtypes
//                             MINUS docs whose title looks like an application
//   /register/applications  — same families but ONLY docs whose title looks
//                             like an application (Application for / Enquiry
//                             letter / Request letter / Liquidator / Notice
//                             of dissolution).
//
// Each scope renders a Matter column (project / case_ref) so PBS can tell
// Green Tea vs PLL at a glance.

import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };
type Scope = 'contracts' | 'insurance' | 'licenses' | 'applications';
const SCOPE_LABEL: Record<Scope, { title: string; subtitle: string; icon: string }> = {
  contracts: {
    title: 'Contracts register',
    subtitle: 'Loan · security · pledges · lease · share transfer · party-to-party agreements',
    icon: '§',
  },
  insurance: {
    title: 'Insurance register',
    subtitle: 'Coverage policies · past-expiry alerts',
    icon: '🛡',
  },
  licenses: {
    title: 'Licenses register',
    subtitle: 'Issued permits + operating licenses + governance instruments + titles · APPLICATIONS EXCLUDED (see Applications register)',
    icon: '✱',
  },
  applications: {
    title: 'Applications register',
    subtitle: 'Filings + enquiry letters + dissolution notices + liquidator filings · everything you have submitted, not yet a grant',
    icon: '📨',
  },
};

const CONTRACT_SUBTYPES = [
  'contract','lease_agreement','loan_agreement','security_agreement',
  'share_pledge','share_transfer','partnership_agreement',
] as const;

const LICENSE_LEGAL_SUBTYPES = [
  'articles_of_association','shareholder_resolution','power_of_attorney',
  'enterprise_registration','business_registration','land_title_deed','property_deed',
] as const;

// Title-pattern heuristic for "is this an application / submission rather
// than an issued license". Catches:
//   Application for X / Application of X / Application to X
//   Enquiry Letter / Request Letter
//   Public Notice of Dissolution / Notice of Company Dissolution
//   Liquidator's Final Report
const APP_RE = /\bapplication\b|\benquiry letter\b|\brequest letter\b|\bnotice of (company )?dissolution\b|\bliquidator/i;

function isApplication(r: { title: string | null; file_name: string | null }): boolean {
  const t = `${r.title ?? ''} ${r.file_name ?? ''}`;
  return APP_RE.test(t);
}

interface Props {
  params: { property_id: string; scope: string };
  searchParams: Record<string, string | string[] | undefined>;
}

interface DocRow {
  doc_id: string;
  title: string | null;
  file_name: string | null;
  doc_type: string;
  doc_subtype: string | null;
  mime: string | null;
  file_type: string | null;
  doc_date: string | null;
  expiry_date: string | null;
  status: string;
  sensitivity: string | null;
  importance: string | null;
  author: string | null;
  summary: string | null;
  matter: string | null;
}

function asStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' }); }
  catch { return d; }
}

function makeMailto(r: DocRow, origin: string): string {
  const dlHref = `/api/legal/docs/file/${encodeURIComponent(r.doc_id)}?mode=download`;
  const previewHref = `/legal/docs/preview/${encodeURIComponent(r.doc_id)}`;
  const subject = `Doc: ${r.title ?? r.file_name ?? r.doc_id}`;
  const body = `${r.title ?? r.file_name ?? '(untitled)'}`
    + (r.doc_date ? ` (${r.doc_date})` : '')
    + `\n\nPreview: ${origin}${previewHref}`
    + `\nDownload: ${origin}${dlHref}`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const SELECT_COLS = 'doc_id,title,file_name,doc_type,doc_subtype,mime,file_type,doc_date,expiry_date,status,sensitivity,importance,author,summary,matter';

export default async function RegisterPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  const label = KNOWN_LABEL[propertyId];
  if (!label) notFound();
  const scope = params.scope as Scope;
  if (!['contracts','insurance','licenses','applications'].includes(scope)) notFound();
  const statusFilter = asStr(searchParams.status);

  const h = headers();
  const host = h.get('host') ?? 'namkhan-bi.vercel.app';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;

  const supabase = getSupabaseAdmin();

  // Fetch rows per scope.
  let rows: DocRow[] = [];

  if (scope === 'contracts') {
    const { data } = await supabase
      .from('v_doc_register').select(SELECT_COLS)
      .eq('property_id', propertyId).neq('status', 'archived')
      .eq('doc_type', 'legal')
      .in('doc_subtype', CONTRACT_SUBTYPES as unknown as string[])
      .order('doc_date', { ascending: true, nullsFirst: false });
    rows = (data ?? []) as DocRow[];

  } else if (scope === 'insurance') {
    const { data } = await supabase
      .from('v_doc_register').select(SELECT_COLS)
      .eq('property_id', propertyId).neq('status', 'archived')
      .eq('doc_type', 'insurance')
      .order('expiry_date', { ascending: true, nullsFirst: false });
    rows = (data ?? []) as DocRow[];

  } else {
    // licenses + applications both pull the same data pool (compliance family
    // + governance/title subtypes in legal family), then filter by the
    // isApplication() title heuristic.
    const { data: a } = await supabase
      .from('v_doc_register').select(SELECT_COLS)
      .eq('property_id', propertyId).neq('status', 'archived')
      .eq('doc_type', 'compliance');
    const { data: b } = await supabase
      .from('v_doc_register').select(SELECT_COLS)
      .eq('property_id', propertyId).neq('status', 'archived')
      .eq('doc_type', 'legal')
      .in('doc_subtype', LICENSE_LEGAL_SUBTYPES as unknown as string[]);

    const pool = [...((a ?? []) as DocRow[]), ...((b ?? []) as DocRow[])];
    rows = scope === 'applications'
      ? pool.filter(isApplication)
      : pool.filter((r) => !isApplication(r));

    rows.sort((x, y) => {
      if (!x.expiry_date && !y.expiry_date) return 0;
      if (!x.expiry_date) return 1;
      if (!y.expiry_date) return -1;
      return x.expiry_date.localeCompare(y.expiry_date);
    });
  }

  // Group rows into status-named buckets per scope.
  const today = new Date().toISOString().slice(0, 10);
  const in90  = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  type Group = { key: string; title: string; subtitle: string; danger?: boolean; warn?: boolean; rows: DocRow[] };
  let groups: Group[] = [];

  if (scope === 'contracts') {
    groups = [
      { key: 'active', title: 'Active',    subtitle: 'Currently in force',         rows: rows.filter((r) => r.status === 'active') },
      { key: 'draft',  title: 'Draft',     subtitle: 'Pending signature',          warn: true, rows: rows.filter((r) => r.status === 'draft') },
      { key: 'other',  title: 'Other',     subtitle: 'Expired / superseded / TBD', rows: rows.filter((r) => r.status !== 'active' && r.status !== 'draft') },
    ];
  } else if (scope === 'insurance') {
    groups = [
      { key: 'past_expiry',  title: 'Past expiry',         subtitle: 'valid_until in the past — action required', danger: true, rows: rows.filter((r) => r.expiry_date && r.expiry_date < today) },
      { key: 'expiring_90d', title: 'Expiring within 90 days', subtitle: 'Renew now',                              warn: true,   rows: rows.filter((r) => r.expiry_date && r.expiry_date >= today && r.expiry_date <= in90) },
      { key: 'active',       title: 'Current',             subtitle: 'Future expiry',                              rows: rows.filter((r) => r.expiry_date && r.expiry_date > in90) },
      { key: 'no_expiry',    title: 'No expiry on file',   subtitle: 'Set valid_until to enable countdown',        warn: true,   rows: rows.filter((r) => !r.expiry_date) },
    ];
  } else if (scope === 'licenses') {
    groups = [
      { key: 'expired',      title: 'Expired',                 subtitle: 'valid_until in the past',                 danger: true, rows: rows.filter((r) => r.expiry_date && r.expiry_date < today) },
      { key: 'expiring_90d', title: 'Expiring within 90 days', subtitle: 'Renew now',                              warn: true,   rows: rows.filter((r) => r.expiry_date && r.expiry_date >= today && r.expiry_date <= in90) },
      { key: 'current',      title: 'Current',                 subtitle: 'Future expiry on file',                   rows: rows.filter((r) => r.expiry_date && r.expiry_date > in90) },
      { key: 'no_expiry',    title: 'No expiry on file',       subtitle: 'Lao licenses typically renew annually — set valid_until in the register', warn: true, rows: rows.filter((r) => !r.expiry_date) },
    ];
  } else {
    // applications: just group by status — they don't have expiries
    groups = [
      { key: 'active', title: 'Submitted / active',    subtitle: 'Filed and pending response',         rows: rows.filter((r) => r.status === 'active') },
      { key: 'draft',  title: 'Draft',                 subtitle: 'Being prepared',                     warn: true, rows: rows.filter((r) => r.status === 'draft') },
      { key: 'other',  title: 'Other',                 subtitle: 'Withdrawn / closed / unknown',       rows: rows.filter((r) => r.status !== 'active' && r.status !== 'draft') },
    ];
  }

  function shouldBeOpen(g: Group): boolean {
    if (statusFilter) return g.key === statusFilter;
    return !!g.danger;
  }

  const { title: pageTitle, subtitle: pageSubtitle, icon } = SCOPE_LABEL[scope];
  const tabs: DashboardTab[] = financeSubPagesForProperty(propertyId).map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/finance/legal'),
  }));

  return (
    <DashboardPage
      title={`Finance · Legal · ${pageTitle}`}
      subtitle={`${label} · ${rows.length} doc${rows.length === 1 ? '' : 's'} · ${pageSubtitle}`}
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Container title={`${icon}  ${pageTitle}`} subtitle={pageSubtitle} density="compact">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '4px 0', fontSize: 11, color: '#5A5A5A' }}>
            <a href={`/h/${propertyId}/finance/legal`} style={{
              padding: '4px 10px', border: '1px solid #1B1B1B', borderRadius: 3,
              background: '#FFFFFF', color: '#1B1B1B', textDecoration: 'none',
            }}>← Back to Legal</a>
            <a href={`/h/${propertyId}/finance/legal/docs`} style={{
              padding: '4px 10px', border: '1px solid #1B1B1B', borderRadius: 3,
              background: '#FFFFFF', color: '#1B1B1B', textDecoration: 'none',
            }}>📋 Edit in Docs register</a>
            {(scope === 'licenses' || scope === 'applications') && (
              <a href={`/h/${propertyId}/finance/legal/register/${scope === 'licenses' ? 'applications' : 'licenses'}`} style={{
                padding: '4px 10px', border: '1px solid #1B1B1B', borderRadius: 3,
                background: '#FFFFFF', color: '#1B1B1B', textDecoration: 'none',
              }}>{scope === 'licenses' ? '↔ Open Applications register' : '↔ Open Licenses register'}</a>
            )}
            <span style={{ alignSelf: 'center' }}>
              Read-only view for sharing with counsel. Use Docs register to edit a row.
            </span>
          </div>
        </Container>

        {groups.map((g) => (
          <RegisterGroup key={g.key} group={g} origin={origin} open={shouldBeOpen(g)} />
        ))}
      </div>
    </DashboardPage>
  );
}

function RegisterGroup({ group, origin, open }: { group: { key: string; title: string; subtitle: string; danger?: boolean; warn?: boolean; rows: DocRow[] }; origin: string; open: boolean }) {
  const stripe = group.danger ? '#FDECEC' : group.warn ? '#FFF8E1' : undefined;
  return (
    <Container title={`${group.title} · ${group.rows.length}`} subtitle={group.subtitle} density="compact">
      {group.rows.length === 0 ? (
        <div style={{ padding: 12, fontSize: 11, color: '#5A5A5A' }}>No items in this bucket.</div>
      ) : (
        <details {...(open ? { open: true } : {})}>
          <summary style={{
            cursor: 'pointer', userSelect: 'none',
            padding: '6px 8px', fontSize: 11, color: group.danger ? '#C62828' : group.warn ? '#B8860B' : '#5A5A5A',
            listStyle: 'revert', background: stripe ?? 'transparent',
          }}>
            {open ? 'Hide' : 'Show'} {group.rows.length} item{group.rows.length === 1 ? '' : 's'}
          </summary>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: '#1B1B1B', marginTop: 4 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#5A5A5A', borderBottom: '1px solid #E0E0E0' }}>
                <th style={th}>Title</th>
                <th style={th}>Matter</th>
                <th style={th}>Doc date</th>
                <th style={th}>Expiry</th>
                <th style={th}>Subtype</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r) => {
                const dlHref      = `/api/legal/docs/file/${encodeURIComponent(r.doc_id)}?mode=download`;
                const previewHref = `/legal/docs/preview/${encodeURIComponent(r.doc_id)}`;
                const mailto      = makeMailto(r, origin);
                return (
                  <tr key={r.doc_id} style={{ borderBottom: '1px solid #F0F0F0' }}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{r.title || r.file_name || '—'}</span>
                        {r.summary && (
                          <span title={r.summary} style={{ cursor: 'help', color: '#B8860B', fontSize: 12, lineHeight: 1 }}>★</span>
                        )}
                      </div>
                      {r.author && (
                        <div style={{ fontSize: 10, color: '#5A5A5A', marginTop: 2 }}>{r.author}</div>
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {r.matter ? (
                        <span style={{ padding: '1px 6px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 10, background: '#F8F8F8' }}>{r.matter}</span>
                      ) : '—'}
                    </td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtDate(r.doc_date)}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtDate(r.expiry_date)}</td>
                    <td style={td}>{r.doc_subtype ?? '—'}</td>
                    <td style={td}>{r.status ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <a href={previewHref} target="_blank" rel="noopener noreferrer" style={actionLink} title="Preview in new tab">👁 Preview</a>
                      <a href={dlHref} download style={actionLink} title="Download">⤓ Download</a>
                      <a href={mailto} style={actionLink} title="Compose email with link">✉ Email</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}
    </Container>
  );
}

const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'top' };
const actionLink: React.CSSProperties = {
  display: 'inline-block', marginLeft: 8, padding: '2px 8px',
  border: '1px solid #1B1B1B', borderRadius: 3,
  background: '#FFFFFF', color: '#1B1B1B', textDecoration: 'none', fontSize: 10,
};
