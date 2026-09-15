// app/finance/archive/_components/ArchiveOverviewPage.tsx
// Archive overview — the Administration · Archive tab (PBS 2026-07-24).
// NOT the doc registry: a brain-backed landing page in the Revenue-HoD design language.
// 2026-08-06 (PBS): brain tiles were global totals on a property-scoped page — fixed.
// 2026-09-15 (PBS) v2:
//   · the nine doc_type tiles became ONE table (family x live/archived/excluded/needs-human/no-text)
//   · added a document-YEAR table. created_at is the ingest date (the drive dump), never the
//     document date, so the year is resolved valid_from -> period_year -> year in the filename,
//     and "Unknown" is a visible row rather than a silent omission.
//   · fn_brain_resurface counters were platform-wide under a property heading — the function was
//     repaired and the extra counters it returns are now shown.
//   · new: the brain's open questions with Confirm / Wrong guess / Not brain material.
// Counting SQL lives in the database, not here: fn_dms_archive_by_family / fn_dms_archive_by_year.
// Nav, tabs and sub-tabs are untouched — everything new sits below the existing structure.

import { DashboardPage, Container, KpiTile } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import BrainQuestionQueue from './BrainQuestionQueue';

interface Props {
  propertyId: number;
  propertyLabel?: string;
  subPagesOverride?: { label: string; href: string }[];
}

interface CaseRow { case_ref: string; status: string | null; n_docs: number }

interface BrainStatus {
  total_docs: number; classified: number; needs_human: number; human_confirmed: number;
  excluded: number; chunks_total: number; chunks_embedded: number; ocr_needed: number;
}

interface FamilyRow {
  doc_type: string; label: string; total: number; live_for_brain: number;
  archived: number; brain_excluded: number; needs_human: number; no_text: number;
}

interface YearRow {
  doc_year: number | null; label: string; source: string; total: number;
  live_for_brain: number; archived: number; brain_excluded: number; no_text: number;
}

interface Resurface {
  expiring?: Array<{ doc_id: string; title: string | null; expiry: string; days_left: number }>;
  cases?: Array<{ case_ref: string; status: string | null; next_deadline: string | null; deadline_note: string | null; days_since_last_doc: number }>;
  unanswered_questions?: Array<{ question: string; asked_at: string; reason: string | null }>;
  counters?: {
    needs_human?: number; ocr_backlog?: number; distilled?: number; distill_open?: number;
    no_text?: number; archived?: number; brain_excluded?: number; total?: number;
    ocr_terminal_failed?: number; missing_storage_object?: number; missing_no_source?: number;
    missing_empty_file?: number;
  };
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 };
const th: React.CSSProperties = {
  textAlign: 'right', padding: '6px 8px', fontWeight: 600, fontSize: 11.5,
  color: 'var(--ink-mute, #5A5A5A)', borderBottom: '1px solid var(--hair, #E6DFCC)', whiteSpace: 'nowrap',
};
const thLeft: React.CSSProperties = { ...th, textAlign: 'left' };
const td: React.CSSProperties = {
  textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hair, #E6DFCC)',
  color: 'var(--ink, #1B1B1B)', whiteSpace: 'nowrap',
};
const tdLeft: React.CSSProperties = { ...td, textAlign: 'left' };
const tfoot: React.CSSProperties = { ...td, fontWeight: 600, borderBottom: 'none' };
const tfootLeft: React.CSSProperties = { ...tfoot, textAlign: 'left' };
const dim = (n: number): React.CSSProperties => (n === 0 ? { opacity: 0.35 } : {});

function sum(rows: Array<Record<string, number | string | null>>, key: string): number {
  return rows.reduce((acc, r) => acc + (typeof r[key] === 'number' ? (r[key] as number) : 0), 0);
}

export default async function ArchiveOverviewPage({ propertyId, propertyLabel, subPagesOverride }: Props) {
  const title = `Archive · ${propertyLabel ?? 'Property'}`;
  const subtitle = 'Company document archive — ask in plain language, or scan the tables. Human review + rules live on the Brain console.';

  const tabs = (subPagesOverride ?? []).map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/finance/archive'),
  }));

  const sb = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  const [totalRes, reviewRes, archivedRes, signedRes, expiringRes, noFileRes, casesRes, brainRes, familyRes, yearRes, resurfaceRes] = await Promise.all([
    sb.from('v_doc_register').select('doc_id', { count: 'exact', head: true }).eq('property_id', propertyId),
    sb.from('v_doc_register').select('doc_id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('needs_review', true),
    sb.from('v_doc_register').select('doc_id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('is_archived', true),
    sb.from('v_doc_register').select('doc_id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('signed', true),
    sb.from('v_doc_register').select('doc_id', { count: 'exact', head: true }).eq('property_id', propertyId).gte('expiry_date', today).lte('expiry_date', in90),
    sb.from('v_doc_register').select('doc_id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('has_file', false),
    sb.from('v_doc_cases').select('case_ref, status, n_docs').eq('property_id', propertyId).order('case_ref'),
    sb.rpc('fn_brain_pipeline_status', { p_property_id: propertyId }),
    sb.rpc('fn_dms_archive_by_family', { p_property_id: propertyId }),
    sb.rpc('fn_dms_archive_by_year', { p_property_id: propertyId }),
    sb.rpc('fn_brain_resurface', { p_property_id: propertyId }),
  ]);

  const families = (familyRes.data ?? []) as FamilyRow[];
  const years = (yearRes.data ?? []) as YearRow[];
  const resurface = (resurfaceRes.data ?? {}) as Resurface;
  const counters = resurface.counters ?? {};
  const cases = ((casesRes.data ?? []) as Partial<CaseRow>[])
    .map((c) => ({ case_ref: c.case_ref ?? '', status: c.status ?? null, n_docs: typeof c.n_docs === 'number' ? c.n_docs : 0 }))
    .filter((c) => c.case_ref);
  const brainRows = (brainRes.data ?? []) as BrainStatus[];
  const brain = (Array.isArray(brainRows) ? brainRows[0] : (brainRows as unknown as BrainStatus)) ?? null;
  const noFile = noFileRes.count ?? 0;

  const docsHref = `/h/${propertyId}/finance/legal/docs`;
  const tile = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 } as React.CSSProperties;

  return (
    <DashboardPage title={title} subtitle={subtitle} tabs={tabs.length ? tabs : undefined}>
      {/* Stripe 1 · registry health */}
      <div style={fullRow}>
        <Container title="Registry" subtitle="What is on file right now" density="compact">
          <div style={tile}>
            <KpiTile label="Documents" value={totalRes.count ?? 0} size="sm" footnote="total on file" />
            <KpiTile label="Needs review" value={reviewRes.count ?? 0} size="sm" footnote="subtype / expiry gaps" />
            <KpiTile label="Metadata only" value={noFile} size="sm" footnote="no file bytes — cannot preview" />
            <KpiTile label="Expiring ≤ 90d" value={expiringRes.count ?? 0} size="sm" footnote="licenses · insurance · permits" />
            <KpiTile label="Signed" value={signedRes.count ?? 0} size="sm" footnote="signed on file" />
            <KpiTile label="Archived" value={archivedRes.count ?? 0} size="sm" footnote="status = archived" />
          </div>
          {noFile > 0 ? (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-mute, #5A5A5A)' }}>
              {noFile} record{noFile === 1 ? '' : 's'} carry metadata only — filename, type and size were ingested but the file itself was never stored, so preview and OCR are unavailable for them.
            </div>
          ) : null}
        </Container>
      </div>

      {/* Stripe 2 · by family (table) */}
      <div style={fullRow}>
        <Container title="By family" subtitle="Every document family, and how much of it the brain can actually read" density="compact">
          {families.length === 0 ? (
            <div style={{ fontSize: 12.5, opacity: 0.65 }}>No documents registered for this property.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={thLeft}>Family</th>
                    <th style={th}>Total</th>
                    <th style={th}>Live for brain</th>
                    <th style={th}>Archived</th>
                    <th style={th}>Excluded</th>
                    <th style={th}>Needs human</th>
                    <th style={th}>No text</th>
                  </tr>
                </thead>
                <tbody>
                  {families.map((f) => (
                    <tr key={f.doc_type}>
                      <td style={tdLeft}>
                        {f.label}
                        <span style={{ opacity: 0.5, fontSize: 11.5 }}> · {f.doc_type}</span>
                      </td>
                      <td style={td}>{f.total}</td>
                      <td style={{ ...td, ...dim(f.live_for_brain) }}>{f.live_for_brain}</td>
                      <td style={{ ...td, ...dim(f.archived) }}>{f.archived}</td>
                      <td style={{ ...td, ...dim(f.brain_excluded) }}>{f.brain_excluded}</td>
                      <td style={{ ...td, ...dim(f.needs_human) }}>{f.needs_human}</td>
                      <td style={{ ...td, ...dim(f.no_text) }}>{f.no_text}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={tfootLeft}>All families</td>
                    <td style={tfoot}>{sum(families as unknown as Array<Record<string, number>>, 'total')}</td>
                    <td style={tfoot}>{sum(families as unknown as Array<Record<string, number>>, 'live_for_brain')}</td>
                    <td style={tfoot}>{sum(families as unknown as Array<Record<string, number>>, 'archived')}</td>
                    <td style={tfoot}>{sum(families as unknown as Array<Record<string, number>>, 'brain_excluded')}</td>
                    <td style={tfoot}>{sum(families as unknown as Array<Record<string, number>>, 'needs_human')}</td>
                    <td style={tfoot}>{sum(families as unknown as Array<Record<string, number>>, 'no_text')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Stripe 2b · by document year */}
      <div style={fullRow}>
        <Container
          title="By document year"
          subtitle="Resolved from valid_from, then period_year, then the year in the filename — never from the upload date"
          density="compact"
        >
          {years.length === 0 ? (
            <div style={{ fontSize: 12.5, opacity: 0.65 }}>No documents registered for this property.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={thLeft}>Year</th>
                    <th style={th}>Total</th>
                    <th style={th}>Live for brain</th>
                    <th style={th}>Archived</th>
                    <th style={th}>Excluded</th>
                    <th style={th}>No text</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y.label}>
                      <td style={tdLeft}>
                        {y.label}
                        {y.doc_year === null ? (
                          <span style={{ opacity: 0.5, fontSize: 11.5 }}> · no date anywhere in the record</span>
                        ) : null}
                      </td>
                      <td style={td}>{y.total}</td>
                      <td style={{ ...td, ...dim(y.live_for_brain) }}>{y.live_for_brain}</td>
                      <td style={{ ...td, ...dim(y.archived) }}>{y.archived}</td>
                      <td style={{ ...td, ...dim(y.brain_excluded) }}>{y.brain_excluded}</td>
                      <td style={{ ...td, ...dim(y.no_text) }}>{y.no_text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Stripe 3 · brain coverage + running cases */}
      <div style={fullRow}>
        <Container title="Company brain" subtitle={`How much of this property's archive is readable by the ask window`} density="compact">
          <div style={tile}>
            <KpiTile label="Classified" value={(brain?.classified ?? 0) + (brain?.human_confirmed ?? 0)} size="sm" footnote={`${brain?.human_confirmed ?? 0} human-confirmed`} />
            <KpiTile label="Needs human" value={counters.needs_human ?? brain?.needs_human ?? 0} size="sm" footnote="decide below" />
            <KpiTile label="Chunks embedded" value={brain?.chunks_embedded ?? 0} size="sm" footnote={`of ${brain?.chunks_total ?? 0}`} />
            <KpiTile label="Excluded" value={counters.brain_excluded ?? brain?.excluded ?? 0} size="sm" footnote="never retrievable" />
            <KpiTile label="No text" value={counters.no_text ?? 0} size="sm" footnote="nothing to classify or answer from" />
            <KpiTile label="Extraction failed" value={counters.ocr_terminal_failed ?? 0} size="sm" footnote="terminal — needs OCR" />
          </div>
          {cases.length > 0 ? (
            <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--ink, #1B1B1B)' }}>
              ⌛ Running cases:{' '}
              {cases.map((c, i) => (
                <span key={c.case_ref}>
                  {i > 0 ? ' · ' : ''}
                  <a href={`/h/${propertyId}/finance/legal/cases/${encodeURIComponent(c.case_ref)}`} style={{ textDecoration: 'underline' }}>
                    {c.case_ref}
                  </a>
                  <span style={{ opacity: 0.6 }}> ({c.n_docs} docs{c.status ? ` · ${c.status}` : ''})</span>
                </span>
              ))}
            </div>
          ) : null}
        </Container>
      </div>

      {/* Brain questions · confirm or dismiss */}
      <div style={fullRow}>
        <Container
          title="The brain has a question"
          subtitle="Documents it classified but is not sure about. Confirm keeps the proposal, Wrong guess sends it back to the classifier, Not brain material excludes it for good."
          density="compact"
        >
          <BrainQuestionQueue propertyId={propertyId} />
        </Container>
      </div>

      {/* Resurfaced · needs attention */}
      <div style={fullRow}>
        <Container title="Resurfaced · needs attention" subtitle="The brain proactively resurfaces what is about to matter — expiries, case deadlines, questions it could not answer" density="compact">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
            {(resurface.expiring ?? []).map((e) => (
              <div key={e.doc_id}>
                🟡 <a href={`/api/legal/docs/file/${e.doc_id}?mode=preview`} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{e.title ?? e.doc_id.slice(0, 8)}</a>
                <span style={{ opacity: 0.65 }}> — expires {e.expiry} ({e.days_left}d)</span>
              </div>
            ))}
            {(resurface.cases ?? []).map((c) => (
              <div key={c.case_ref}>
                ⌛ <a href={`/h/${propertyId}/finance/legal/cases/${encodeURIComponent(c.case_ref)}`} style={{ textDecoration: 'underline' }}>{c.case_ref}</a>
                <span style={{ opacity: 0.65 }}>
                  {' — '}{c.next_deadline ? `next deadline ${c.next_deadline}${c.deadline_note ? ` (${c.deadline_note})` : ''} · ` : ''}
                  {c.days_since_last_doc > 30 ? `no new document in ${c.days_since_last_doc} days` : `last document ${c.days_since_last_doc}d ago`}
                </span>
              </div>
            ))}
            {(resurface.unanswered_questions ?? []).length > 0 ? (
              <div style={{ marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>Questions the brain could not answer</span>{' '}
                <span style={{ opacity: 0.6 }}>(content gaps — upload or OCR the missing docs):</span>
                {(resurface.unanswered_questions ?? []).map((q, i) => (
                  <div key={i} style={{ opacity: 0.8, paddingLeft: 14 }}>· {q.question}</div>
                ))}
              </div>
            ) : null}
            {(counters.ocr_backlog ?? 0) > 0 ? (
              <div style={{ opacity: 0.7 }}>
                📄 {counters.ocr_backlog} scanned PDFs await OCR — their content is invisible to the ask window until processed.
              </div>
            ) : null}
            {(counters.missing_storage_object ?? 0) + (counters.missing_no_source ?? 0) + (counters.missing_empty_file ?? 0) > 0 ? (
              <div style={{ opacity: 0.7 }}>
                🗂 Missing files: {counters.missing_storage_object ?? 0} storage object gone · {counters.missing_no_source ?? 0} no source · {counters.missing_empty_file ?? 0} empty.
              </div>
            ) : null}
            <div style={{ opacity: 0.6, fontSize: 11.5 }}>
              Distilled key-terms summaries: {counters.distilled ?? 0} done · {counters.distill_open ?? 0} queued (contracts · legal · land · loans · financial)
            </div>
            <div style={{ opacity: 0.6, fontSize: 11.5 }}>
              Full register: <a href={docsHref} style={{ textDecoration: 'underline' }}>open the document archive</a>
            </div>
          </div>
        </Container>
      </div>

    </DashboardPage>
  );
}
