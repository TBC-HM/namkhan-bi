// app/h/[property_id]/finance/legal/cases/[case_ref]/page.tsx
// Read-only case overview — 5 containers (Contracts · Licenses / Registrations
// · Correspondence · Documents · Photos). Every doc linked to the named case
// shows up here, classified by subtype + family + mime. No edit/delete
// buttons — only Preview, Download, Email per row. Server-rendered; mailto:
// and download links are static anchors. Dynamic [case_ref] segment so any
// future case_ref gets the same overview.

import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

// Classifier sets:
//   CONTRACT  = party-to-party commercial agreements (legal family).
//   LICENSE   = govt-issued authority + corporate-governance instruments + title
//               deeds + registrations. We also treat the *entire* 'compliance'
//               doc_type as license (alcohol_license / fire_safety_cert /
//               environmental_permit / business_license / etc.) since that
//               family is by definition license / permit / registration docs.
//   CORRESP   = letters, notices, court filings.
//   PHOTO     = any image/* mime.
//   DOCUMENT  = catch-all for everything else.
const CONTRACT_SUBTYPES = new Set<string>([
  'contract',
  'lease_agreement',
  'loan_agreement',
  'security_agreement',
  'share_pledge',
  'share_transfer',
  'partnership_agreement',
]);

const LICENSE_SUBTYPES = new Set<string>([
  // Legal-family governance / title docs
  'articles_of_association',
  'shareholder_resolution',
  'power_of_attorney',
  'enterprise_registration',
  'business_registration',
  'land_title_deed',
  'property_deed',
]);

const CORRESPONDENCE_SUBTYPES = new Set<string>([
  'correspondence','enforcement_notice','memorandum','case_filing',
  'pleading','judgment','declaration','legal_opinion',
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
}

type Bucket = 'document' | 'contract' | 'license' | 'correspondence' | 'photo';

function classify(row: DocRow): Bucket {
  if ((row.mime ?? '').startsWith('image/') || row.file_type === 'image') return 'photo';
  if (row.doc_type === 'compliance') return 'license';
  if (row.doc_subtype && CONTRACT_SUBTYPES.has(row.doc_subtype)) return 'contract';
  if (row.doc_subtype && LICENSE_SUBTYPES.has(row.doc_subtype)) return 'license';
  if (row.doc_subtype && CORRESPONDENCE_SUBTYPES.has(row.doc_subtype)) return 'correspondence';
  return 'document';
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch { return d; }
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
    .select('doc_id,title,file_name,doc_type,doc_subtype,mime,file_type,doc_date,status,sensitivity,importance,author,summary,case_refs')
    .eq('property_id', propertyId)
    .contains('case_refs', [caseRef])
    .neq('status', 'archived')
    .order('doc_date', { ascending: true, nullsFirst: false });

  const rows = (rowsRaw ?? []) as DocRow[];

  const buckets: Record<Bucket, DocRow[]> = {
    document: [], contract: [], license: [], correspondence: [], photo: [],
  };
  for (const r of rows) buckets[classify(r)].push(r);

  const tabs: DashboardTab[] = financeSubPagesForProperty(propertyId).map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/finance/legal/docs'),
  }));

  const summary = `${label} · ${caseRow.title ?? '—'} · `
    + `${rows.length} doc${rows.length === 1 ? '' : 's'} · `
    + `${buckets.contract.length} contracts · `
    + `${buckets.license.length} licenses/reg. · `
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
        <CaseBucket origin={origin} title="Contracts"                subtitle="Loan · security · pledges · lease · share transfer · party-to-party agreements" rows={buckets.contract} />
        <CaseBucket origin={origin} title="Licenses / Registrations" subtitle="Compliance permits · operating licenses · articles · POAs · enterprise registration · title deeds" rows={buckets.license} />
        <CaseBucket origin={origin} title="Correspondence"           subtitle="Letters · notices · case filings · memoranda" rows={buckets.correspondence} />
        <CaseBucket origin={origin} title="Documents"                subtitle="Evidence · filings · everything else" rows={buckets.document} />
        <CaseBucket origin={origin} title="Photos"                   subtitle="Field photos · maps · screenshots" rows={buckets.photo} />
      </div>
    </DashboardPage>
  );
}

function CaseBucket({ title, subtitle, rows, origin }: {
  title: string; subtitle: string; rows: DocRow[]; origin: string;
}) {
  return (
    <Container title={`${title} · ${rows.length}`} subtitle={subtitle} density="compact">
      {rows.length === 0 ? (
        <div style={{ padding: 12, fontSize: 11, color: '#5A5A5A' }}>No items yet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: '#1B1B1B' }}>
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
              const mailSubject = `Case doc: ${r.title ?? r.file_name ?? r.doc_id}`;
              const mailBody    = `${r.title ?? r.file_name ?? '(untitled)'}`
                + (r.doc_date ? ` (${r.doc_date})` : '')
                + `\n\nPreview: ${origin}${previewHref}`
                + `\nDownload: ${origin}${dlHref}`;
              const mailto = `mailto:?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
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
