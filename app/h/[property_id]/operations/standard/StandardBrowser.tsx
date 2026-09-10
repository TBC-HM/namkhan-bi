'use client';
// app/h/[property_id]/operations/standard/StandardBrowser.tsx
// The Namkhan Standard — one merged requirement set built from every external
// standard the property is held to, each atom tagged with where it came from.
//
// NOTHING IS COMPUTED FROM SOURCE DATA HERE. Every count arrives in the payload
// from public.fn_standards_payload. The only arithmetic below is filtering the
// department's own item list, which is client-side because it must be instant.
//
// Dates are formatted by hand, in UTC, for the same reason as the Quality
// dashboard: Node's ICU and the browser's ICU disagree on invisible characters
// (NBSP vs U+202F), which React reports as hydration error #425 and which a
// whitespace-normalising diff cannot see.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { AtomRow, StandardPayload } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number) => (n < 10 ? '0' + n : String(n));
const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const nInt = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? group(Math.round(n)) : '—');
const nDate = (v: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const stamp = (v: string) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
};

// One colour per authority, fixed. The origin tag is the whole point of the merge —
// a head of department reading a requirement must see at a glance whether missing it
// costs an SLH score, a Travelife certificate, or a licence.
const AUTH_CLS: Record<string, string> = {
  SLH:            'bg-emerald-100 text-emerald-900 border-emerald-200',
  ASEAN:          'bg-lime-100 text-lime-900 border-lime-200',
  Travelife:      'bg-sky-100 text-sky-900 border-sky-200',
  GSTC:           'bg-violet-100 text-violet-900 border-violet-200',
  Legal:          'bg-red-100 text-red-900 border-red-200',
  Sustainability: 'bg-teal-100 text-teal-900 border-teal-200',
  PM:             'bg-amber-100 text-amber-900 border-amber-200',
};
const authCls = (a: string) => AUTH_CLS[a] ?? 'bg-neutral-100 text-neutral-700 border-neutral-200';
const splitAuth = (s: string | null): string[] =>
  (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

function Chip({ text }: { text: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none ${authCls(text)}`}>
      {text}
    </span>
  );
}

// Coverage strength badges. Fixed colours, and deliberately NOT the authority
// palette — a reader must never confuse "which standard asks for this" with
// "how well do we cover it".
const badgeCls = (kind: 'exact' | 'declared' | 'suggested' | 'none') =>
  'inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none ' +
  (kind === 'exact'     ? 'border-emerald-300 bg-emerald-100 text-emerald-900'
   : kind === 'declared' ? 'border-amber-300 bg-amber-100 text-amber-900'
   : kind === 'suggested' ? 'border-sky-300 bg-sky-100 text-sky-900'
   :                        'border-red-300 bg-red-100 text-red-900');

// Every SOP code is a door. The viewer already exists — /operations/sops/<code>/preview
// renders the full structured document (cover, numbered sections, revision history,
// signature blocks) with Print / Save as PDF, Download .doc, Edit and Send-by-email.
// It was simply never linked from here, so the code read as dead text.
//
// The canonical /h/<pid>/... form is emitted (L6). For Namkhan that route is a stub
// which redirects to the live legacy path; for a tenant without SOPs it renders the
// wiring-pending page, which is the correct answer rather than a 404.
function SopLink({ pid, code }: { pid: number; code: string | null }) {
  if (!code) return null;
  return (
    <a
      href={`/h/${pid}/operations/sops/${encodeURIComponent(code)}/preview`}
      className="font-medium text-neutral-800 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-800"
      title={`Open ${code} — full document, print, download, send`}
    >
      {code}
    </a>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-l-[3px] border-neutral-200 px-3 py-1">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-xl font-semibold tabular-nums text-neutral-900">{value}</div>
      {sub && <div className="text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

export default function StandardBrowser({ pid, payload }: { pid: number; payload: StandardPayload }) {
  const t = payload.totals;
  const depts = payload.departments ?? [];
  const auths = payload.authorities ?? [];
  const items = payload.items ?? [];

  const [q, setQ] = useState('');
  const [auth, setAuth] = useState('');
  const [cat, setCat] = useState('');
  const [mergedOnly, setMergedOnly] = useState(false);
  const [cover, setCover] = useState('');

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter((c): c is string => !!c))).sort(),
    [items],
  );

  const shown: AtomRow[] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (mergedOnly && i.source_count <= 1) return false;
      if (cover === 'uncovered'  && (i.covered || i.has_suggested)) return false;
      if (cover === 'suggested'  && !i.has_suggested) return false;
      if (cover === 'declared'   && !(i.has_declared && !i.has_exact)) return false;
      if (cover === 'exact'      && !i.has_exact) return false;
      if (cat && i.category !== cat) return false;
      if (auth && !splitAuth(i.authorities).includes(auth)) return false;
      if (needle && !(`${i.title} ${i.requirement_text}`.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [items, q, auth, cat, mergedOnly, cover]);

  const base = `/h/${pid}/operations/standard`;
  const coverPct = t && t.atoms > 0 ? (100 * t.covered) / t.atoms : 0;

  return (
    <div className="mx-auto max-w-[1320px] px-3 py-4">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-neutral-900">The Namkhan Standard</h1>
        <p className="mt-0.5 max-w-3xl text-sm text-neutral-600">
          Every requirement the property is held to, from all {nInt(t?.authorities)} authorities, merged into
          one set. A requirement that several standards ask for the same way is <strong>one</strong> line here,
          tagged with each origin — so one SOP can close several audits at once.
        </p>
        <p className="mt-1 text-xs text-neutral-500">Generated {stamp(payload.generated_at)}</p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Requirements" value={nInt(t?.atoms)} sub="the merged standard" />
        <Stat label="Citations" value={nInt(t?.requirements)} sub="raw questions behind them" />
        <Stat label="Merged" value={nInt(t?.multi_source)} sub="asked by more than one authority" />
        <Stat label="Authorities" value={nInt(t?.authorities)} sub={`${nInt(t?.sources)} documents`} />
        <Stat label="Covered" value={`${coverPct.toFixed(1)}%`} sub={`${nInt(t?.covered)} of ${nInt(t?.atoms)}`} />
        <Stat label="Suggested" value={nInt(t?.suggested)} sub="awaiting your verdict" />
      </div>

      {/* How we actually SCORED. The corpus says what we must do; this says where we
          lost points. Both are keyed by dept_code and both were already in the
          database — the page simply never joined them until now. */}
      {payload.audit?.audited_at && (
        <div className="mb-4 border-l-[3px] border-emerald-700 bg-emerald-50/60 px-3 py-2 text-sm text-neutral-800">
          <strong>SLH blind visit {nDate(payload.audit.audited_at)}</strong>
          {payload.audit.auditor ? ` · ${payload.audit.auditor}` : ''} ·{' '}
          {nInt(payload.audit.departments)} departments scored. Lowest section:{' '}
          <strong className="text-red-800">
            {payload.audit.worst_dept} {payload.audit.worst_pct != null ? `${payload.audit.worst_pct}%` : ''}
          </strong>
          {payload.audit.worst_pct != null && payload.audit.worst_pct < 80
            ? ' — below the SLH 80% fail line.'
            : '.'}
        </div>
      )}

      {/* Three strengths, never one number. Collapsing them would report 504 of
          1,777 covered when 208 are, and the difference is entirely unconfirmed
          machine guesses. */}
      <div className="mb-5 border-l-[3px] border-neutral-300 px-3 py-2 text-sm text-neutral-700">
        <p className="mb-1">
          <strong>{nInt(t?.covered)}</strong> of {nInt(t?.atoms)} requirements are covered by
          one of your {nInt(t?.sops)} active SOPs — and coverage comes in three strengths that
          this page deliberately keeps apart:
        </p>
        <ul className="ml-4 list-disc space-y-0.5">
          <li>
            <span className={badgeCls('exact')}>Exact</span>{' '}
            <strong>{nInt(t?.exact)}</strong> — the SOP names this requirement. Trust it.
          </li>
          <li>
            <span className={badgeCls('declared')}>Declared</span>{' '}
            <strong>{nInt(t?.declared)}</strong> — the SOP names the <em>law</em> this comes from
            and is credited with every obligation under it. Coarse: confirm the SOP really
            covers this particular one.
          </li>
          <li>
            <span className={badgeCls('suggested')}>Suggested</span>{' '}
            <strong>{nInt(t?.suggested)}</strong> — an embedding proposed an SOP section.
            Measured precision is roughly two in three, so these count as{' '}
            <strong>nothing</strong> until you confirm them. They are the cheapest wins on the page.
          </li>
        </ul>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-700">Where it comes from</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="py-1.5 pr-3 font-medium">Authority</th>
                <th className="py-1.5 pr-3 font-medium">Document</th>
                <th className="py-1.5 pr-3 text-right font-medium">Questions</th>
                <th className="py-1.5 pr-3 text-right font-medium">Requirements</th>
              </tr>
            </thead>
            <tbody>
              {auths.map((a) => (
                <tr key={a.authority} className="border-b border-neutral-100 align-top">
                  <td className="py-1.5 pr-3"><Chip text={a.authority} /></td>
                  <td className="py-1.5 pr-3 text-neutral-700">{a.documents ?? '—'}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{nInt(a.requirements)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{nInt(a.atoms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-xs text-neutral-500">
          The Requirements column sums to more than {nInt(t?.atoms)}: a merged requirement is counted
          once under every authority that asks for it. That overlap is the saving.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-700">By department</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="py-1.5 pr-3 font-medium">Department</th>
                <th className="py-1.5 pr-3 text-right font-medium">SLH</th>
                <th className="py-1.5 pr-3 text-right font-medium">Requirements</th>
                <th className="py-1.5 pr-3 text-right font-medium">Exact</th>
                <th className="py-1.5 pr-3 text-right font-medium">Declared</th>
                <th className="py-1.5 pr-3 text-right font-medium">Suggested</th>
                <th className="py-1.5 pr-3 text-right font-medium">Uncovered</th>
                <th className="py-1.5 pr-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {depts.map((d) => {
                const active = d.dept_code === payload.dept;
                return (
                  <tr key={d.dept_code} className={`border-b border-neutral-100 ${active ? 'bg-emerald-50' : ''}`}>
                    <td className="py-1.5 pr-3">
                      <Link href={`${base}?dept=${encodeURIComponent(d.dept_code)}`} className="font-medium text-neutral-900 underline-offset-2 hover:underline">
                        {d.dept_name}
                      </Link>
                    </td>
                    {/* Weighted department score, with the worst section called out beneath it.
                        Housekeeping is 92.6% overall and 79.3% on the pool deck; showing
                        either number alone misleads in opposite directions. */}
                    <td className="py-1.5 pr-3 text-right tabular-nums" title={d.slh_top_miss ?? ''}>
                      {d.slh_pct == null ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <>
                          <span className={d.slh_pct < 80 ? 'font-semibold text-red-800' : 'text-neutral-900'}>
                            {d.slh_pct}%
                          </span>
                          {d.slh_worst_pct != null && d.slh_sections != null && d.slh_sections > 1
                            && d.slh_worst_pct < d.slh_pct && (
                            <div className={`text-[11px] ${d.slh_worst_pct < 80 ? 'text-red-800' : 'text-amber-700'}`}>
                              worst {d.slh_worst_pct}%
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{nInt(d.atoms)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-emerald-900">{nInt(d.exact)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-amber-800">{nInt(d.declared)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-sky-900">{nInt(d.suggested)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-red-800">
                      {nInt(d.atoms - d.covered - d.suggested)}
                    </td>
                    <td className="py-1.5 pr-3 text-xs text-neutral-500">{active ? 'shown below' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {payload.dept ? (
        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
              {payload.dept_name ?? payload.dept} — {nInt(shown.length)} of {nInt(items.length)} shown
            </h2>
            <Link href={base} className="text-xs text-neutral-600 underline-offset-2 hover:underline">
              Clear department
            </Link>
          </div>

          {/* The requirements below say what this department must do. This says where it
              actually lost points at the last blind visit — the two belong on one screen. */}
          {(() => {
            const d = depts.find((x) => x.dept_code === payload.dept);
            if (!d || d.slh_pct == null) return null;
            return (
              <div className="mb-3 border-l-[3px] border-neutral-300 px-3 py-2 text-sm">
                <span className="text-neutral-700">SLH score </span>
                <strong className={d.slh_pct < 80 ? 'text-red-800' : 'text-neutral-900'}>{d.slh_pct}%</strong>
                {d.slh_sections != null && d.slh_sections > 1 && d.slh_worst_pct != null && (
                  <span className="text-neutral-700">
                    {' '}across {nInt(d.slh_sections)} sections · worst{' '}
                    <strong className={d.slh_worst_pct < 80 ? 'text-red-800' : 'text-amber-700'}>
                      {d.slh_worst_pct}%
                    </strong>
                  </span>
                )}
                {d.slh_top_miss && (
                  <p className="mt-0.5 max-w-4xl text-[13px] text-neutral-600">{d.slh_top_miss}</p>
                )}
              </div>
            );
          })()}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search this department…"
              className="w-64 rounded border border-neutral-300 px-2 py-1 text-sm"
            />
            <select value={auth} onChange={(e) => setAuth(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-sm">
              <option value="">All authorities</option>
              {auths.map((a) => <option key={a.authority} value={a.authority}>{a.authority}</option>)}
            </select>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-sm">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={cover} onChange={(e) => setCover(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-sm">
              <option value="">Any coverage</option>
              <option value="suggested">Suggested — needs your verdict</option>
              <option value="declared">Declared — confirm the law covers it</option>
              <option value="exact">Exact</option>
              <option value="uncovered">Uncovered, no suggestion</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm text-neutral-700">
              <input type="checkbox" checked={mergedOnly} onChange={(e) => setMergedOnly(e.target.checked)} />
              Merged only
            </label>
          </div>

          {shown.length === 0 ? (
            <p className="border-l-[3px] border-neutral-300 px-3 py-2 text-sm text-neutral-600">
              Nothing matches those filters.
            </p>
          ) : (
            <ul className="border-t border-neutral-200">
              {shown.map((i) => (
                <li key={i.atom_id} className="border-b border-neutral-100 py-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-medium text-neutral-900">{i.title}</span>
                    {splitAuth(i.authorities).map((a) => <Chip key={a} text={a} />)}
                    {i.source_count > 1 && (
                      <span className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 text-[11px] leading-none text-neutral-600">
                        {i.source_count} sources
                      </span>
                    )}
                    {i.category && <span className="text-[11px] text-neutral-500">{i.category}</span>}
                    {i.dept_code_2 && <span className="text-[11px] text-neutral-500">also {i.dept_code_2}</span>}
                  </div>
                  {i.requirement_text && i.requirement_text !== i.title && (
                    <p className="mt-0.5 max-w-4xl text-sm text-neutral-600">{i.requirement_text}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    {i.has_exact && (
                      <>
                        <span className={badgeCls('exact')}>Exact</span>
                        <SopLink pid={pid} code={i.sop_code} />
                      </>
                    )}
                    {!i.has_exact && i.has_declared && (
                      <>
                        <span className={badgeCls('declared')}>Declared</span>
                        <SopLink pid={pid} code={i.sop_code} />
                        <span className="text-neutral-600">— confirm it covers this obligation</span>
                      </>
                    )}
                    {!i.covered && i.has_suggested && (
                      <>
                        <span className={badgeCls('suggested')}>
                          Suggested {i.suggested_conf != null ? `${Math.round(i.suggested_conf * 100)}%` : ''}
                        </span>
                        <SopLink pid={pid} code={i.suggested_sop} />
                        {i.suggested_note && <span className="text-neutral-500">· {i.suggested_note}</span>}
                      </>
                    )}
                    {!i.covered && !i.has_suggested && <span className={badgeCls('none')}>No SOP</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="border-l-[3px] border-neutral-300 px-3 py-2 text-sm text-neutral-600">
          Pick a department above to read its requirements.
        </p>
      )}
    </div>
  );
}
