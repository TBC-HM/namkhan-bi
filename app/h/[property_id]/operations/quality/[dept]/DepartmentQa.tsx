'use client';
// app/h/[property_id]/operations/quality/[dept]/DepartmentQa.tsx
// Task 5 of the department-qa-discharge-modes plan.
//
// NO METRIC IS COMPUTED HERE. Every count, every score, every list comes from
// public.fn_dept_qa_payload (the department block) and public.fn_audit_documents
// (the property-wide reports block). This component groups the obligations array by
// its own `mode` field for display and formats values — it does not derive a single
// number that isn't already a field on the payload.
//
// Never imports '@/lib/supabase' — that silently downgrades to anon in a client
// component and returns nothing (CLAUDE.md "Data access gotchas").
//
// Theme tokens: --tbl-* only (app/h/[property_id]/** law). NEVER --ink-*/--bd-*/
// --surf-* — those fall through to the Namkhan globals and render black-on-black on
// Donna's cream palette.

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { AuditDocument, DeptQaPayload, DischargeMode, Obligation } from './types';

/* ---------- theme tokens ---------- */
const FG = 'var(--tbl-fg, #1A1A1A)';
const MUTE = 'var(--tbl-fg-mute, rgba(26,26,26,0.55))';
const BORDER = 'var(--tbl-border, rgba(26,26,26,0.14))';
const BORDER_STRONG = 'var(--tbl-border-strong, rgba(26,26,26,0.32))';
const BG = 'var(--tbl-bg, #fff)';
const BG_ELEV = 'var(--tbl-bg-elev, #f4f4f4)';
const RED = '#b91c1c';
const AMBER = '#b45309';
const GREEN = '#0f6b4c';

/* ---------- hand-built formatting (display only) — NEVER Intl. Node's ICU and the
   browser's ICU disagree on invisible characters (NBSP vs U+202F), which React
   reports as hydration error #425 and which a whitespace-normalising diff can't see.
   Dates render in UTC on both server and client, matching the database. ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const nInt = (v: number | null | undefined) =>
  typeof v === 'number' && Number.isFinite(v) ? group(Math.round(v)) : '—';
const nPct = (v: number | null | undefined, d = 1) =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) + '%' : '—';
const nDate = (v: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const nBytes = (v: number | null) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1024 * 1024) return (v / (1024 * 1024)).toFixed(1) + ' MB';
  if (v >= 1024) return Math.round(v / 1024) + ' KB';
  return v + ' B';
};

/* ---------- discharge-mode chrome (labels are UI chrome, not payload content) ---------- */
const MODE_TITLE: Record<DischargeMode, string> = {
  procedure: 'Procedures',
  evidence: 'Evidence on file',
  rule: 'Trained rules',
  observation: 'Scored by audit',
};
const MODE_EXPLAIN: Record<DischargeMode, string> = {
  procedure: 'Closed by a written SOP that names how staff do this.',
  evidence: 'Closed by proof kept on file — not scored by an SLH section.',
  rule: 'A constraint staff are trained to follow. There is no document store this closes into.',
  observation: 'Closed only by an SLH mystery-inspection score, never by a document — see “How we scored” below.',
};
/** a materially lower worst section is worth calling out separately from the
 *  headline score; a single-section department (worst === overall) is not. */
const MATERIAL_GAP_PCT = 3;

/* ---------- small building blocks ---------- */

// Every SOP code is a door — same pattern as StandardBrowser.tsx's SopLink. The
// canonical /h/<pid>/... form (L6); the target route degrades to a wiring-pending
// page for a tenant without SOPs rather than 404ing.
function SopLink({ pid, code }: { pid: number; code: string | null }) {
  if (!code) return null;
  return (
    <a
      href={`/h/${pid}/operations/sops/${encodeURIComponent(code)}/preview`}
      style={{ color: FG, borderBottom: `1px solid ${BORDER_STRONG}`, fontWeight: 600 }}
      title={`Open ${code} — full document, print, download, send`}
    >
      {code}
    </a>
  );
}

// An obligation with no procedure behind it gets a door too — same ActivateLink
// pattern as StandardBrowser.tsx: generating an SOP is an action ON a named gap, not
// a destination you visit and type into.
function ActivateLink({ pid, deptCode, item }: { pid: number; deptCode: string; item: Obligation }) {
  const q = new URLSearchParams({
    atom: item.atom_id,
    dept: deptCode,
    title: item.title,
    requirement: item.text || item.title,
  });
  return (
    <a
      href={`/h/${pid}/operations/qa/generate?${q.toString()}`}
      style={{ border: `1px solid ${GREEN}`, color: GREEN, borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600, lineHeight: '16px' }}
      title="Write the SOP that closes this requirement"
    >
      Activate — write this SOP
    </a>
  );
}

function SectionHeading({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} style={{ color: FG, fontSize: 18, fontWeight: 600, marginTop: 0, marginBottom: 4, fontFamily: 'serif' }}>
      {children}
    </h2>
  );
}

function ObligationRow({ pid, deptCode, item }: { pid: number; deptCode: string; item: Obligation }) {
  const wording = item.staff_wording || item.text;
  return (
    <li style={{ borderBottom: `1px solid ${BORDER}`, padding: '8px 0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 6 }}>
        <span style={{ color: FG, fontWeight: 600 }}>{item.title}</span>
        {item.is_shared && (
          <span style={{ fontSize: 11, color: MUTE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '0 4px' }}>
            shared obligation
          </span>
        )}
        {item.category && <span style={{ fontSize: 11, color: MUTE }}>{item.category}</span>}
        {item.authorities && <span style={{ fontSize: 11, color: MUTE }}>· {item.authorities}</span>}
      </div>
      {wording && wording !== item.title && (
        <p style={{ margin: '2px 0 0', fontSize: 13, color: MUTE, maxWidth: '68ch' }}>{wording}</p>
      )}
      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 11 }}>
        {item.mode === 'procedure' && item.covered && (
          <>
            <span style={{ color: GREEN, fontWeight: 600 }}>Covered</span>
            <SopLink pid={pid} code={item.sop_code} />
          </>
        )}
        {item.mode === 'procedure' && !item.covered && <ActivateLink pid={pid} deptCode={deptCode} item={item} />}
        {item.mode === 'evidence' && (
          <span style={{ color: item.covered ? GREEN : RED, fontWeight: 600 }}>{item.covered ? 'Held' : 'Missing'}</span>
        )}
        {item.mode === 'observation' && (
          <a href="#how-we-scored" style={{ color: MUTE, borderBottom: `1px dotted ${BORDER_STRONG}` }}>
            See SLH score ↓
          </a>
        )}
        {/* mode === 'rule': plain list entry, no coverage claim — a rule has no
            document store to check against. */}
      </div>
    </li>
  );
}

/* ---------- the five blocks + the audit-reports block ---------- */

export default function DepartmentQa({
  pid,
  payload,
  auditDocs,
}: {
  pid: number;
  payload: DeptQaPayload;
  auditDocs: AuditDocument[];
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [docError, setDocError] = useState<Record<string, string>>({});

  const deptLabel = payload.dept_name ?? payload.dept_code;
  const s = payload.scores;
  const audited = s.slh_pct != null;
  const worstMaterial =
    audited && s.slh_worst_pct != null && s.slh_pct - s.slh_worst_pct >= MATERIAL_GAP_PCT;

  async function downloadDoc(doc: AuditDocument) {
    setDocError((e) => ({ ...e, [doc.doc_id]: '' }));
    setPending(doc.doc_id);
    try {
      const res = await fetch(`/api/docs/signed-url?doc_id=${encodeURIComponent(doc.doc_id)}&exp=600`);
      const json = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (json.ok && json.url) {
        window.open(json.url, '_blank', 'noopener,noreferrer');
      } else {
        setDocError((e) => ({ ...e, [doc.doc_id]: json.error ?? 'could not get a download link' }));
      }
    } catch (err) {
      setDocError((e) => ({ ...e, [doc.doc_id]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setPending(null);
    }
  }

  return (
    <div style={{ background: BG, color: FG, maxWidth: 1100, margin: '0 auto', padding: '16px 20px 48px' }}>
      <p style={{ color: MUTE, fontSize: 13, marginTop: 0 }}>
        {deptLabel} · property {payload.property_id}
      </p>

      {/* 1 — Who we are */}
      <section style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 16, marginBottom: 16 }}>
        <SectionHeading>Who we are</SectionHeading>
        {payload.people.active === 0 ? (
          <p style={{ color: MUTE, fontSize: 14, maxWidth: '70ch' }}>
            No one in the staff register for this department — these obligations sit with management.
          </p>
        ) : (
          <>
            <p style={{ color: MUTE, fontSize: 13 }}>{nInt(payload.people.active)} active staff</p>
            <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '2px 16px', fontSize: 13, padding: 0, margin: 0, listStyle: 'none' }}>
              {payload.people.rows.map((p) => (
                <li key={p.staff_id} style={{ padding: '2px 0' }}>
                  <span style={{ color: FG, fontWeight: 600 }}>{p.name}</span>
                  {p.position && <span style={{ color: MUTE }}> — {p.position}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* 2 — What we must do */}
      <section style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 16, marginBottom: 16 }}>
        <SectionHeading>What we must do</SectionHeading>
        <p style={{ color: MUTE, fontSize: 13, marginTop: 0, marginBottom: 10 }}>
          {nInt(payload.obligations.length)} obligations, grouped by how they are discharged.
        </p>
        {payload.by_mode.map((row) => {
          const items = payload.obligations.filter((o) => o.mode === row.mode);
          return (
            <details key={row.mode} open style={{ marginBottom: 10, border: `1px solid ${BORDER}`, borderRadius: 6 }}>
              <summary style={{ cursor: 'pointer', padding: '8px 10px', background: BG_ELEV, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontWeight: 700, color: FG }}>{MODE_TITLE[row.mode]}</span>
                <span style={{ fontSize: 12, color: MUTE }}>
                  {row.coverable ? `${nInt(row.covered)} of ${nInt(row.atoms)} covered` : `${nInt(row.atoms)} obligations`}
                </span>
                <span style={{ fontSize: 12, color: MUTE, flexBasis: '100%' }}>{MODE_EXPLAIN[row.mode]}</span>
              </summary>
              <ul style={{ listStyle: 'none', padding: '0 10px', margin: 0 }}>
                {items.map((o) => (
                  <ObligationRow key={o.atom_id} pid={pid} deptCode={payload.dept_code} item={o} />
                ))}
              </ul>
            </details>
          );
        })}
        {payload.by_mode.length === 0 && (
          <p style={{ color: MUTE, fontSize: 14 }}>No obligations are mapped to this department.</p>
        )}
      </section>

      {/* 3 — How we scored */}
      <section id="how-we-scored" style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 16, marginBottom: 16 }}>
        <SectionHeading>How we scored</SectionHeading>
        {!audited ? (
          <p style={{ color: MUTE, fontSize: 14, maxWidth: '70ch' }}>
            Not yet audited — no SLH mystery-inspection score has been recorded for this department.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 34, fontWeight: 300, lineHeight: 1, color: FG }}>{nPct(s.slh_pct)}</div>
              <div style={{ fontSize: 13, color: MUTE }}>
                across {nInt(s.slh_sections)} section{s.slh_sections === 1 ? '' : 's'} · last audited {nDate(s.slh_audited_at)}
              </div>
            </div>
            {worstMaterial && (
              <p style={{ marginTop: 6, fontSize: 13, color: RED }}>
                Weakest section: {nPct(s.slh_worst_pct)} — well below the overall score above.
              </p>
            )}
            {s.slh_top_miss && (
              <p style={{ marginTop: 6, fontSize: 13, color: MUTE, maxWidth: '80ch' }}>{s.slh_top_miss}</p>
            )}
          </>
        )}
      </section>

      {/* 4 — What's open */}
      <section style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 16, marginBottom: 16 }}>
        <SectionHeading>What&apos;s open</SectionHeading>
        {payload.open.findings_total === 0 ? (
          <p style={{ color: MUTE, fontSize: 14 }}>No QA findings have been recorded for this department.</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontSize: 28, fontWeight: 300, color: payload.open.findings_open > 0 ? RED : GREEN }}>
              {nInt(payload.open.findings_open)}
            </div>
            <div style={{ fontSize: 13, color: MUTE }}>
              open of {nInt(payload.open.findings_total)} total finding{payload.open.findings_total === 1 ? '' : 's'}
              {payload.open.findings_open === 0 && ' — all closed'}
            </div>
          </div>
        )}
      </section>

      {/* 5 — Run an audit */}
      <section style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 16, marginBottom: 16 }}>
        <SectionHeading>Run an audit</SectionHeading>
        <button
          type="button"
          disabled
          title="The self-audit engine has not shipped yet"
          style={{ border: `1px solid ${BORDER}`, color: MUTE, background: BG_ELEV, borderRadius: 4, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'not-allowed' }}
        >
          Self-audits — coming in the next build
        </button>
      </section>

      {/* Audit reports — property-wide, NOT specific to this department (PBS
          request, additional scope beyond the brief). */}
      <section>
        <SectionHeading>Audit reports · property-wide</SectionHeading>
        <p style={{ color: MUTE, fontSize: 13, marginTop: 0, marginBottom: 10, maxWidth: '70ch' }}>
          The same reports appear on every department&apos;s QA page — they belong to the property, not to {deptLabel} alone.
        </p>
        {auditDocs.length === 0 ? (
          <p style={{ color: MUTE, fontSize: 14 }}>No audit reports are on file for this property.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {auditDocs.map((d) => {
              const sensitive = !!d.sensitivity && d.sensitivity !== 'internal' && d.sensitivity !== 'public';
              return (
                <li key={d.doc_id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BORDER}`, padding: '8px 0' }}>
                  <span style={{ color: FG, fontWeight: 600 }}>{d.title}</span>
                  {sensitive && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: AMBER, borderRadius: 4, padding: '0 5px', textTransform: 'uppercase' }}>
                      {d.sensitivity}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: MUTE }}>
                    {nDate(d.dated)} · {nBytes(d.file_size_bytes)}
                  </span>
                  <button
                    type="button"
                    onClick={() => downloadDoc(d)}
                    disabled={pending === d.doc_id}
                    style={{ marginLeft: 'auto', border: `1px solid ${BORDER_STRONG}`, color: FG, background: BG, borderRadius: 4, padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: pending === d.doc_id ? 'wait' : 'pointer' }}
                  >
                    {pending === d.doc_id ? 'Getting link…' : 'Download'}
                  </button>
                  {docError[d.doc_id] && (
                    <span style={{ flexBasis: '100%', fontSize: 12, color: RED }}>{docError[d.doc_id]}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
