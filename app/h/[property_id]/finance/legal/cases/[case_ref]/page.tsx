// app/h/[property_id]/finance/legal/cases/[case_ref]/page.tsx
// Read-only case overview. Layout:
//   1. Featured chronology doc at top.
//   2. 6 collapsible buckets (Contracts · Licenses/Registrations · Court
//      filings · Correspondence · Documents · Photos) via native
//      <details>/<summary> — no client JS.
//   3. One full chronology container at the bottom.
// Court filings vs Correspondence: court filings are documents actually filed
// at a court (case_filing, pleading, judgment, declaration). Letters,
// memoranda, enforcement notices and legal opinions stay in Correspondence.

import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

const CHRONOLOGY_TITLE_RE = /^Namkhan Chronology For Counsel/i;

const CONTRACT_SUBTYPES = new Set<string>([
  'contract','lease_agreement','loan_agreement','security_agreement',
  'share_pledge','share_transfer','partnership_agreement',
]);

const LICENSE_SUBTYPES = new Set<string>([
  'articles_of_association','shareholder_resolution','power_of_attorney',
  'enterprise_registration','business_registration','land_title_deed','property_deed',
]);

// Title-pattern heuristic for "this is an application / submission rather
// than an issued license". Catches: Application for X / Enquiry letter /
// Request letter / Notice of (Company) Dissolution / Liquidator's report.
const APP_RE = /\bapplication\b|\benquiry letter\b|\brequest letter\b|\bnotice of (company )?dissolution\b|\bliquidator/i;

function isApplication(r: { title: string | null; file_name: string | null }): boolean {
  return APP_RE.test(`${r.title ?? ''} ${r.file_name ?? ''}`);
}

// Filed-at-court documents only. Pre-litigation correspondence (letters,
// notices) stays in Correspondence.
const COURT_FILING_SUBTYPES = new Set<string>([
  'case_filing','pleading','judgment','declaration',
]);

const CORRESPONDENCE_SUBTYPES = new Set<string>([
  'correspondence','enforcement_notice','memorandum','legal_opinion',
]);

interface Props {
  params: { property_id: string; case_ref: string };
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
  status: string;
  sensitivity: string | null;
  importance: string | null;
  author: string | null;
  summary: string | null;
  uploaded_at: string | null;
}

type Bucket = 'document' | 'contract' | 'license' | 'application' | 'court_filing' | 'correspondence' | 'photo';

function classify(row: DocRow): Bucket {
  if ((row.mime ?? '').startsWith('image/') || row.file_type === 'image') return 'photo';
  // Application title heuristic wins over license/compliance bucketing so
  // "Application for X" submissions land in their own bucket, not Licenses.
  const looksLikeApp = isApplication(row);
  if (row.doc_type === 'compliance') return looksLikeApp ? 'application' : 'license';
  if (row.doc_subtype && CONTRACT_SUBTYPES.has(row.doc_subtype)) return 'contract';
  if (row.doc_subtype && LICENSE_SUBTYPES.has(row.doc_subtype)) return looksLikeApp ? 'application' : 'license';
  if (row.doc_subtype && COURT_FILING_SUBTYPES.has(row.doc_subtype)) return 'court_filing';
  if (row.doc_subtype && CORRESPONDENCE_SUBTYPES.has(row.doc_subtype)) return 'correspondence';
  return 'document';
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch { return d; }
}

function makeMailto(r: DocRow, origin: string): string {
  const dlHref = `/api/legal/docs/file/${encodeURIComponent(r.doc_id)}?mode=download`;
  const previewHref = `/legal/docs/preview/${encodeURIComponent(r.doc_id)}`;
  const subject = `Case doc: ${r.title ?? r.file_name ?? r.doc_id}`;
  const body = `${r.title ?? r.file_name ?? '(untitled)'}`
    + (r.doc_date ? ` (${r.doc_date})` : '')
    + `\n\nPreview: ${origin}${previewHref}`
    + `\nDownload: ${origin}${dlHref}`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function CaseOverviewPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  const label = KNOWN_LABEL[propertyId];
  if (!label) notFound();
  const caseRef = decodeURIComponent(params.case_ref);

  const h = headers();
  const host = h.get('host') ?? 'namkhan-bi.vercel.app';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;

  const supabase = getSupabaseAdmin();

  const { data: caseRow } = await supabase
    .from('v_doc_cases')
    .select('case_ref, title, matter_type, status')
    .eq('property_id', propertyId)
    .eq('case_ref', caseRef)
    .maybeSingle();
  if (!caseRow) notFound();

  const { data: rowsRaw } = await supabase
    .from('v_doc_register')
    .select('doc_id,title,file_name,doc_type,doc_subtype,mime,file_type,doc_date,status,sensitivity,importance,author,summary,uploaded_at,case_refs')
    .eq('property_id', propertyId)
    .contains('case_refs', [caseRef])
    .neq('status', 'archived')
    .order('doc_date', { ascending: true, nullsFirst: false });

  const rows = (rowsRaw ?? []) as DocRow[];

  const chronology = rows
    .filter((r) => r.title && CHRONOLOGY_TITLE_RE.test(r.title))
    .sort((a, b) => (b.uploaded_at ?? '').localeCompare(a.uploaded_at ?? ''))[0];

  const buckets: Record<Bucket, DocRow[]> = {
    document: [], contract: [], license: [], application: [], court_filing: [], correspondence: [], photo: [],
  };
  for (const r of rows) buckets[classify(r)].push(r);

  const tabs: DashboardTab[] = financeSubPagesForProperty(propertyId).map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/finance/legal/docs'),
  }));

  const summary = `${label} · ${caseRow.title ?? '—'} · `
    + `${rows.length} doc${rows.length === 1 ? '' : 's'} · `
    + `${buckets.contract.length} contracts · `
    + `${buckets.license.length} licenses/reg. · `
    + `${buckets.application.length} applications · `
    + `${buckets.court_filing.length} court filings · `
    + `${buckets.correspondence.length} correspondence · `
    + `${buckets.photo.length} photos · `
    + `status: ${caseRow.status ?? '—'}`;

  return (
    <DashboardPage
      title={`Finance · Legal · Case: ${caseRow.case_ref}`}
      subtitle={summary}
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <a href={`/h/${propertyId}/finance/legal`} style={{
            padding: '4px 10px', border: '1px solid #1B1B1B', borderRadius: 3,
            background: '#FFFFFF', color: '#1B1B1B', textDecoration: 'none', fontSize: 11,
          }}>← Back to Legal</a>
          <a href={`/h/${propertyId}/finance/legal/docs?case=${encodeURIComponent(caseRef)}`} style={{
            padding: '4px 10px', border: '1px solid #1B1B1B', borderRadius: 3,
            background: '#FFFFFF', color: '#1B1B1B', textDecoration: 'none', fontSize: 11,
          }}>📋 Edit in Docs register (case-filtered)</a>
        </div>
        {chronology && <FeaturedChronology row={chronology} origin={origin} />}

        <CaseBucket origin={origin} title="Contracts"                subtitle="Loan · security · pledges · lease · share transfer · party-to-party agreements" rows={buckets.contract} />
        <CaseBucket origin={origin} title="Licenses / Registrations" subtitle="Issued permits + operating licenses + articles + POAs + enterprise registration + title deeds" rows={buckets.license} />
        <CaseBucket origin={origin} title="Applications"             subtitle="Filings + enquiry letters + dissolution notices + liquidator filings — submitted, not yet granted" rows={buckets.application} />
        <CaseBucket origin={origin} title="Court filings"            subtitle="Case filings · pleadings · judgments · declarations — anything actually filed at court" rows={buckets.court_filing} />
        <CaseBucket origin={origin} title="Correspondence"           subtitle="Letters · notices · memoranda · legal opinions — pre-litigation paper trail" rows={buckets.correspondence} />
        <CaseBucket origin={origin} title="Documents"                subtitle="Evidence · everything else" rows={buckets.document} />
        <CaseBucket origin={origin} title="Photos"                   subtitle="Field photos · maps · screenshots" rows={buckets.photo} />

        <CaseBucket origin={origin} title="All docs · chronology"    subtitle="Every linked doc · oldest → newest · cross-bucket merged view" rows={rows} initiallyOpen />
      </div>
    </DashboardPage>
  );
}

// --- Featured chronology card -------------------------------------------------
function FeaturedChronology({ row, origin }: { row: DocRow; origin: string }) {
  const dlHref      = `/api/legal/docs/file/${encodeURIComponent(row.doc_id)}?mode=download`;
  const previewHref = `/legal/docs/preview/${encodeURIComponent(row.doc_id)}`;
  const mailto      = makeMailto(row, origin);
  return (
    <Container title="📜 Chronology · for counsel" subtitle="Featured · top of case file" density="compact">
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        padding: '8px 12px', borderLeft: '3px solid #B8860B', background: '#FCFBF5',
      }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1B1B1B' }}>
            {row.title || row.file_name || '—'}
          </div>
          <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 2 }}>
            {row.author ? `${row.author} · ` : ''}{fmtDate(row.doc_date)}{row.importance ? ` · ${row.importance}` : ''}
          </div>
          {row.summary && (
            <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 6, lineHeight: 1.4 }}>
              {row.summary}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <a href={previewHref} target="_blank" rel="noopener noreferrer" style={primaryAction}>👁 Preview</a>
          <a href={dlHref} download style={primaryAction}>⤓ Download</a>
          <a href={mailto} style={primaryAction}>✉ Email</a>
        </div>
      </div>
    </Container>
  );
}

// --- Collapsible bucket -------------------------------------------------------
function CaseBucket({ title, subtitle, rows, origin, initiallyOpen }: {
  title: string; subtitle: string; rows: DocRow[]; origin: string; initiallyOpen?: boolean;
}) {
  const isOpen = !!initiallyOpen;
  return (
    <Container title={`${title} · ${rows.length}`} subtitle={subtitle} density="compact">
      {rows.length === 0 ? (
        <div style={{ padding: 12, fontSize: 11, color: '#5A5A5A' }}>No items yet.</div>
      ) : (
        <details {...(isOpen ? { open: true } : {})}>
          <summary style={{
            cursor: 'pointer', userSelect: 'none',
            padding: '6px 8px', fontSize: 11, color: '#5A5A5A',
            listStyle: 'revert',
          }}>
            {isOpen ? 'Hide' : 'Show'} {rows.length} item{rows.length === 1 ? '' : 's'}
          </summary>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: '#1B1B1B', marginTop: 4 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#5A5A5A', borderBottom: '1px solid #E0E0E0' }}>
                <th style={th}>Title</th>
                <th style={th}>Doc date</th>
                <th style={th}>Sens.</th>
                <th style={th}>Imp.</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
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
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtDate(r.doc_date)}</td>
                    <td style={td}>{r.sensitivity ?? '—'}</td>
                    <td style={td}>{r.importance ?? '—'}</td>
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
const primaryAction: React.CSSProperties = {
  display: 'inline-block', padding: '4px 10px',
  border: '1px solid #1B1B1B', borderRadius: 3,
  background: '#1B1B1B', color: '#FFFFFF', textDecoration: 'none', fontSize: 11,
};
