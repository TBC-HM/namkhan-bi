'use client';
// app/h/[property_id]/operations/quality/QualityDashboard.tsx
// Brief quality-dashboard-v1 — six tabs, deep-linkable (#today … #guest, ?tab=), ←/→ switch tabs.
//
// NO METRIC IS COMPUTED HERE. Every number comes from fn_qa_dash_payload; the
// helpers below format and colour only.
//
// Deviations from the handoff copy: `any` removed from the display helpers (they
// take the payload's own `Val`); table rows use the typed interfaces in ./types;
// the <dt>/<dd> pairs use a keyed Fragment instead of an unkeyed one; arrays are
// `?? []` guarded so a tenant with a thin payload renders instead of throwing.

import { Fragment, useEffect, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import Link from 'next/link';
import type {
  QaPayload, TabKey, Action, Row, Val,
  DeptMatrixRow, SopByDeptRow, StaffByDeptRow, CertCoverageRow, SkillDemandRow,
  PmByDeptRow, ThemeRow, LowReviewRow, GoalRow, FreshnessRow, AgendaRow,
  Pillar, SusStandard, LegalCategoryRow,
} from './types';
import { TABS } from './types';

/* ---------- formatting (display only) ---------- */
const num = (v: Val): number | null => {
  if (v == null || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const nInt = (v: Val) => { const n = num(v); return n == null ? '—' : Math.round(n).toLocaleString('en-US'); };
const nPct = (v: Val, d = 1) => { const n = num(v); return n == null ? '—' : n.toFixed(d) + '%'; };
const nDate = (v: Val) => {
  if (typeof v !== 'string' || !v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
const cls = { bad: 'text-red-800', warn: 'text-amber-700', ok: 'text-emerald-900', na: 'text-neutral-500' };
const statusCls = (s: string) => (s === 'live' ? 'bg-emerald-100 text-emerald-900' : s === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800');
const flagCls = (f: string | null) => (f === 'bad' ? cls.bad : f === 'warn' ? cls.warn : f === 'ok' ? cls.ok : cls.na);

function Tile({ title, sub, big, bigTone, chip, chipTone, rows, cta, ctaHref, note, noteRed, wide, children }: {
  title: string; sub?: string; big: string; bigTone?: string; chip?: string; chipTone?: 'ok' | 'near' | 'miss';
  rows?: [string, string, string?][]; cta: string; ctaHref: string; note?: string; noteRed?: boolean; wide?: boolean; children?: ReactNode;
}) {
  const chipCls = chipTone === 'miss' ? 'bg-red-100 text-red-800' : chipTone === 'near' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-900';
  return (
    <div className={`flex min-h-[270px] flex-col bg-white p-4 ${wide ? 'lg:col-span-2' : ''}`}>
      <h3 className="flex items-baseline justify-between text-sm font-semibold">{title}{sub && <span className="text-xs font-normal text-neutral-500">{sub}</span>}</h3>
      <div className="mt-2 flex flex-wrap items-baseline gap-3"><div className={`font-serif text-3xl leading-none ${bigTone ?? ''}`}>{big}</div>{chip && <span className={`rounded px-2 py-0.5 text-xs ${chipCls}`}>{chip}</span>}</div>
      {rows && (
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs">
          {rows.map(([k, v, t], i) => (
            <Fragment key={`${k}-${i}`}>
              <dt className="text-neutral-500">{k}</dt>
              <dd className={`text-right font-medium ${t ?? ''}`}>{v}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      {children}
      <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs"><Link href={ctaHref} className="border-b border-emerald-200 font-medium text-emerald-900 hover:border-emerald-900">{cta}</Link>{note && <span className={`text-right ${noteRed ? cls.bad : 'text-neutral-500'}`}>{note}</span>}</div>
    </div>
  );
}
const Th = ({ c, r }: { c: string; r?: boolean }) => <th className={`pb-1.5 font-medium text-neutral-500 ${r ? 'text-right' : 'text-left'}`}>{c}</th>;

export default function QualityDashboard({ pid, payload, initialTab }: { pid: number; payload: QaPayload; initialTab?: string }) {
  const base = `/h/${pid}`;
  const href = (p: string) => (p.startsWith('/') ? `${base}${p}` : p);
  const valid = (t?: string): t is TabKey => !!t && TABS.some((x) => x.key === t);
  const [tab, setTab] = useState<TabKey>(valid(initialTab) ? initialTab : 'today');
  useEffect(() => {
    const h = window.location.hash.replace('#', '');
    if (valid(h)) setTab(h);
    const f = () => { const x = window.location.hash.replace('#', ''); if (valid(x)) setTab(x); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const go = (t: TabKey) => { setTab(t); history.replaceState(null, '', '#' + t); window.scrollTo({ top: 0 }); };
  const onKey = (e: ReactKeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    go(TABS[(i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length].key);
  };

  const { badges: B, metrics: m, loops: L, standards: S, people: P, verification: V, guest: G } = payload;
  const actions: Action[] = payload.actions ?? [];
  const goals: GoalRow[] = payload.goals ?? [];
  const freshness: FreshnessRow[] = payload.freshness ?? [];
  const agenda: AgendaRow[] = payload.agenda ?? [];
  const deptMatrix: DeptMatrixRow[] = payload.dept_matrix ?? [];

  const badge: Record<TabKey, { text: string; bad: boolean }> = {
    today: { text: `${B.today.actions} actions · ${nInt(B.today.loops_live)} of 5 loops live`, bad: B.today.actions_red > 0 },
    depts: { text: `${nInt(B.depts.audit_ready)} of ${nInt(B.depts.total)} audit-ready`, bad: Number(B.depts.audit_ready ?? 0) === 0 },
    standards: { text: `${nPct(B.standards.in_date_pct, 0)} in date · ${nInt(B.standards.lao)} Lao`, bad: Number(B.standards.in_date_pct ?? 0) < 80 },
    people: { text: `${nInt(B.people.certs_held)} certs of ${nInt(B.people.cert_fte_required)} required`, bad: Number(B.people.certs_held ?? 0) < Number(B.people.cert_fte_required ?? 0) },
    verify: { text: `PM ${nPct(B.verify.pm_pct_30d)}`, bad: Number(B.verify.pm_pct_30d ?? 0) < 95 },
    guest: { text: `${nInt(B.guest.low_180d)} low reviews · ${nInt(B.guest.findings_open)} findings`, bad: Number(B.guest.low_180d ?? 0) > 0 && Number(B.guest.findings_open ?? 0) === 0 },
  };
  const loopsLive = Number(m.loops_live ?? 0);
  const wf: Row = P.workforce ?? {}, pm: Row = V.pm ?? {}, au: Row = V.audits ?? {};
  const su = V.sustainability, lg = V.legal;
  const dq: Row = V.dq ?? {}, gs: Row = G.summary ?? {}, ss: Row = S.summary ?? {}, le: Row = P.learning ?? {};

  return (
    <div className="mx-auto max-w-[1320px] px-7 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-3">
        <h1 className="font-serif text-3xl leading-tight">Quality dashboard<small className="mt-1 block font-sans text-sm text-neutral-500">Property {pid} · generated {new Date(payload.generated_at).toLocaleString('en-GB')}{payload.cached ? ` · cached ${Math.round((payload.cache_age_sec ?? 0) / 60)} min` : ''}</small></h1>
        <div className="text-right text-xs text-neutral-500">Audits recorded <b className="text-neutral-900">{nInt(au.audits)}</b> · training records <b className="text-neutral-900">{nInt(wf.training_records)}</b> · certifications <b className="text-neutral-900">{nInt(wf.certifications)}</b> · PM done <b className="text-neutral-900">{nInt(pm.done_30d)} of {nInt(pm.sched_30d)}</b></div>
      </header>
      <div role="tablist" aria-label="Quality dashboard sections" className="flex gap-0.5 overflow-x-auto border-b-2 border-neutral-900">
        {TABS.map((t, i) => (<button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)} onKeyDown={(e) => onKey(e, i)} className={`-mb-0.5 flex items-baseline gap-2 whitespace-nowrap border-b-[3px] px-3.5 pb-2 pt-2.5 text-sm font-medium ${tab === t.key ? 'border-emerald-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'}`}>{t.label}<small className={`text-xs font-normal ${badge[t.key].bad ? cls.bad : 'text-neutral-500'}`}>{badge[t.key].text}</small></button>))}
      </div>

      {tab === 'today' && (
        <div role="tabpanel">
          <section className="grid gap-7 border-b border-neutral-200 py-5 lg:grid-cols-[320px_1fr]">
            <div>
              <h2 className="font-serif text-lg font-semibold">Quality loop</h2>
              <div className={`mt-2 font-serif text-5xl leading-none ${loopsLive >= 4 ? cls.ok : loopsLive >= 2 ? cls.warn : cls.bad}`}>{loopsLive} of 5<small className="ml-2 font-sans text-sm text-neutral-500">loops producing data</small></div>
              <p className="mt-2 max-w-[36ch] text-sm text-neutral-500">Standards written → people trained and certified → work verified (audits, PM) → guest signal → corrective action back into standards and training.</p>
            </div>
            <div className="grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-5">
              {([
                ['1 · Standards', L.standards_status, `${nInt(m.sops_in_date)} / ${nInt(m.sops)}`, `SOPs in date · ${nInt(m.sops_never_reviewed)} never reviewed, ${nInt(m.sops_overdue)} overdue · ${nInt(m.sops_lao)} Lao of ${nInt(m.sops_with_body)} · ${nInt(m.proposals_open)} proposals open`],
                ['2 · People', L.people_status, nInt(L.people_certs_held), `certificates evidenced vs ${nInt(L.people_cert_fte_required)} FTE required · ${nInt(m.platform_users)} of ${nInt(m.staff_active)} staff have a login · ${nInt(m.departments_with_hod)} of ${nInt(m.departments)} HODs`],
                ['3 · Verification', L.verification_status, nPct(L.verification_pm_pct), `PM done in 30 d (${nInt(m.pm_done_30d)} of ${nInt(m.pm_sched_30d)}), ${nInt(m.pm_past_due)} past due · ${nInt(m.audits)} audits ever · ${nInt(m.sus_compliant)} of ${nInt(m.sus_reqs)} sustainability requirements`],
                ['4 · Guest signal', L.guest_status, nInt(L.guest_themed_reviews), `reviews themed · ${nInt(L.guest_low_180d)} under 4 in 180 d · ${nInt(L.guest_unanswered)} never answered · ${nInt(m.recovery_cases)} recovery cases`],
                ['5 · Corrective action', L.capa_status, nInt(L.capa_findings_open), `findings open · ${nInt(L.capa_low_reviews_without_finding)} low reviews without a finding · ${nInt(m.findings_overdue)} overdue`],
              ] as [string, string, string, string][]).map(([t, st, v, d], i) => (
                <div key={i} className="flex min-h-[150px] flex-col bg-white p-3.5">
                  <h4 className="flex justify-between text-xs font-semibold">{t}<span className={`rounded px-1.5 text-[11px] font-medium ${statusCls(st)}`}>{st}</span></h4>
                  <div className={`my-2 font-serif text-2xl leading-none ${st === 'live' ? '' : st === 'partial' ? cls.warn : cls.bad}`}>{v}</div>
                  <div className="text-xs text-neutral-500">{d}</div>
                </div>))}
            </div>
          </section>
          <div className="grid gap-x-8 lg:grid-cols-[2fr_1fr]">
            <section className="py-5"><h2 className="font-serif text-lg font-semibold">What needs action</h2><p className="mb-3 text-sm text-neutral-500">Ranked by what unblocks the most downstream. Rules live in ops.qa_dash_action_rules.</p>
              <ol className="divide-y divide-neutral-200">{actions.map((a: Action, i) => (
                <li key={a.rule_key} className="grid grid-cols-[34px_1fr] items-start gap-x-3 py-3.5 md:grid-cols-[34px_1fr_auto]"><span className="font-serif text-2xl text-neutral-400">{i + 1}</span>
                  <div><div className="text-[15px] font-semibold">{a.title}<span className={`ml-2 rounded px-1.5 py-px align-[2px] text-[11px] font-medium ${a.severity === 'red' ? 'bg-red-100 text-red-800' : a.severity === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600'}`}>{a.category}</span></div><div className="mt-0.5 max-w-[72ch] text-sm text-neutral-500">{a.detail}</div></div>
                  <div className="col-start-2 mt-2 flex flex-wrap gap-1.5 md:col-start-3 md:mt-0 md:min-w-[200px] md:flex-col"><Link href={href(a.route_path)} className="rounded border border-emerald-900 bg-emerald-900 px-3 py-1.5 text-center text-xs font-medium text-white">{a.cta_label}</Link>{a.route_path_2 && a.cta_label_2 && <Link href={href(a.route_path_2)} className="rounded border border-emerald-900 px-3 py-1.5 text-center text-xs font-medium text-emerald-900">{a.cta_label_2}</Link>}</div></li>))}
                {actions.length === 0 && <li className="py-3 text-sm text-neutral-500">No rule is firing.</li>}</ol></section>
            <div>
              <section className="border-b border-neutral-200 py-5"><h2 className="font-serif text-lg font-semibold">Goals this area owns</h2>
                <table className="w-full text-xs"><thead><tr><Th c="Goal" /><Th c="Target" r /><Th c="Now" r /></tr></thead><tbody>{goals.map((g: GoalRow) => (<tr key={g.goal_id} className="border-b border-neutral-200"><td className="py-1.5 pr-2">{g.title}</td><td className="text-right">{g.target_value ?? '—'}</td><td className={`text-right font-medium ${flagCls(g.status_flag)}`}>{g.computed_label ?? 'not measured'}</td></tr>))}</tbody></table>
                <p className="mt-2 text-xs text-neutral-500">{nInt(m.goals_measured)} of {nInt(m.goals_total)} goals measurable from live data; {nInt(m.goals_stored)} written back.</p></section>
              <section className="border-b border-neutral-200 py-5"><h2 className="font-serif text-lg font-semibold">Data freshness</h2><ul className="space-y-1.5 text-sm">{freshness.map((f: FreshnessRow) => (<li key={f.source_key}><i className={`mr-1.5 inline-block h-2 w-2 rounded-full ${f.status === 'fresh' ? 'bg-emerald-600' : f.status === 'warn' ? 'bg-amber-600' : f.status === 'bad' ? 'bg-red-800' : 'bg-neutral-300'}`} /><b>{f.label}</b> <span className="text-neutral-500">— {f.asof ? `${nDate(f.asof)}${(f.days_old ?? 0) > 7 ? ` (${f.days_old} d)` : ''}` : 'no rows ever'}</span></li>))}</ul></section>
              <section className="py-5"><h2 className="font-serif text-lg font-semibold">Next 60 days</h2><ul className="divide-y divide-neutral-200 text-sm">{agenda.map((g: AgendaRow, i) => (<li key={i} className="grid grid-cols-[64px_1fr] gap-2 py-2"><span className="font-semibold">{nDate(g.item_date)}</span><span>{g.title} <span className="text-neutral-500">· {g.item_type.replace(/_/g, ' ')}{g.detail ? ' · ' + g.detail : ''}</span></span></li>))}{agenda.length === 0 && <li className="py-2 text-neutral-500">Nothing dated — no review dates, expiries or audit dates are set.</li>}</ul></section>
            </div>
          </div>
        </div>
      )}

      {tab === 'depts' && (
        <div role="tabpanel">
          <div className="mb-2 mt-5 flex items-baseline gap-3"><h2 className="font-serif text-lg font-semibold">Department matrix</h2><span className="text-sm text-neutral-500">who works there · what standard they follow · certified? · verified? · what guests say</span></div>
          <p className="mb-3 max-w-[90ch] text-sm text-neutral-500"><b className="text-neutral-900">Audit-ready</b> = SOPs in date ∧ certificates cover the required FTE ∧ PM ≥ 90% in 30 d ∧ an audit in the last 90 d. Department codes are unified through ops.qa_dept_alias; themes map through ops.qa_theme_dept_map.</p>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr><Th c="Department" /><Th c="Staff" r /><Th c="Left 12 m" r /><Th c="Skills/p" r /><Th c="Login" r /><Th c="HOD" r /><Th c="SOPs" r /><Th c="In date" r /><Th c="Lao" r /><Th c="Certs required" /><Th c="Req FTE" r /><Th c="Held" r /><Th c="PM tasks" r /><Th c="PM done 30 d" r /><Th c="Past due" r /><Th c="Audit" r /><Th c="Guest themes" /><Th c="Neg 180 d" r /><Th c="Ready" r /></tr></thead>
            <tbody>{deptMatrix.map((d: DeptMatrixRow) => (<tr key={d.dept_code} className="border-b border-neutral-200 align-top"><td className="py-1.5 pr-2 font-medium">{d.dept_name}</td><td className="text-right">{nInt(d.staff_active)}</td><td className={`text-right ${Number(d.left_12m) > 0 ? cls.warn : ''}`}>{nInt(d.left_12m)}</td><td className="text-right">{d.avg_skills ?? '—'}</td><td className={`text-right ${Number(d.platform_users) === 0 ? cls.bad : ''}`}>{nInt(d.platform_users)}</td><td className={`text-right ${d.hod_set ? cls.ok : cls.bad}`}>{d.hod_set ? 'yes' : 'no'}</td><td className={`text-right ${Number(d.sops) === 0 && Number(d.staff_active) > 0 ? cls.bad : ''}`}>{nInt(d.sops)}</td><td className={`text-right ${d.ok_standards ? cls.ok : cls.warn}`}>{nInt(d.sops_in_date)}</td><td className={`text-right ${Number(d.sops_lao) === 0 && Number(d.sops) > 0 ? cls.bad : ''}`}>{nInt(d.sops_lao)}</td><td className="max-w-[16ch] pr-2 text-neutral-600">{d.certs_required ?? '—'}</td><td className="text-right">{d.cert_fte_required ?? '—'}</td><td className={`text-right ${d.ok_certs ? cls.ok : cls.bad}`}>{nInt(d.certs_held)}</td><td className="text-right">{nInt(d.pm_tasks)}</td><td className={`text-right ${d.ok_pm ? cls.ok : cls.bad}`}>{Number(d.pm_sched_30d) > 0 ? `${nInt(d.pm_done_30d)} / ${nInt(d.pm_sched_30d)}` : '—'}</td><td className={`text-right ${Number(d.pm_past_due) > 0 ? cls.bad : ''}`}>{nInt(d.pm_past_due)}</td><td className={`text-right ${d.ok_audit ? cls.ok : cls.na}`}>{d.last_audit_date ? `${nDate(d.last_audit_date)} · ${nPct(d.audit_pct_180d, 0)}` : 'none'}</td><td className="max-w-[18ch] pr-2 text-neutral-600">{d.themes ?? '—'}</td><td className={`text-right ${Number(d.negative_180d) > 0 ? cls.bad : cls.ok}`}>{nInt(d.negative_180d)}</td><td className="text-right"><i className={`inline-block h-2.5 w-2.5 rounded-full ${d.audit_ready ? 'bg-emerald-600' : 'bg-red-800'}`} /></td></tr>))}</tbody></table></div>
          <p className="mt-3 border-l-[3px] border-amber-600 bg-amber-50 px-3 py-2 text-sm">{nInt(m.depts_audit_ready)} of {nInt(m.depts_total)} departments audit-ready; {nInt(m.depts_without_sop)} departments have staff but no SOP. The correlation becomes readable when certificates, audits and PM completions exist — today the matrix shows where wiring is missing.</p>
        </div>
      )}

      {tab === 'standards' && (
        <div role="tabpanel">
          <div className="mb-2 mt-5 flex items-baseline gap-3"><h2 className="font-serif text-lg font-semibold">Standards &amp; SOPs</h2><span className="text-sm text-neutral-500">knowledge.sop_meta · sop_content · sop_proposals</span></div>
          <div className="grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-2 lg:grid-cols-4">
            <Tile title="SOP registry" sub={`${nInt(ss.sops)} documents`} big={`${nInt(ss.in_date)} / ${nInt(ss.sops)}`} bigTone={Number(ss.in_date_pct) < 50 ? cls.warn : ''} chip={`reviewed and in date · ${nPct(ss.in_date_pct, 0)}`} chipTone={Number(ss.in_date_pct) >= 80 ? 'ok' : 'near'} rows={[['Operational · platform', `${nInt(ss.sops_operational)} · ${nInt(ss.sops_platform)}`], ['Never reviewed', nInt(ss.never_reviewed), cls.bad], ['Review overdue', nInt(ss.review_overdue), cls.bad], ['Scored (qa_score)', `${nInt(ss.scored)} · avg ${ss.avg_score ?? '—'} · ${nInt(ss.below_mandate)} below mandate`, cls.bad], ['With body · active', `${nInt(ss.with_body)} · ${nInt(ss.body_active)}`], ['Consumed by agents', nInt(ss.agent_consumed)]]} cta="Open registry" ctaHref={`${base}/operations/sops`} note={`last review ${nDate(ss.last_review_date)}`} />
            <Tile title="Language & visuals" sub="who can read them" big={nInt(ss.lao)} bigTone={cls.bad} chip={`Lao versions · ${nInt(ss.english)} English`} chipTone="miss" rows={[['Visual pack required', nInt(ss.visual_required)], ['Visual packs present', nInt(ss.visual_present), cls.bad], ['Lao share', nPct(ss.lao_pct, 0), cls.bad]]} cta="Start translation batch" ctaHref={`${base}/operations/sops`} note="core defect of the standards loop" noteRed />
            <Tile title="Proposals backlog" sub="AI-generated" big={nInt(ss.proposals_open)} bigTone={cls.bad} chip={`untouched of ${nInt(ss.proposals)}`} chipTone="miss" rows={[['Priority 1 open', nInt(ss.proposals_open_p1), cls.warn], ['Accepted · linked to an SOP', `${nInt(ss.proposals_accepted)} · ${nInt(ss.proposals_linked)}`], ['Department codes used', `${nInt(ss.proposal_dept_codes)} (${nInt(ss.proposal_dept_codes_unmapped)} unmapped)`], ['Days since generated', nInt(ss.proposals_days_old), cls.bad]]} cta="Triage P1" ctaHref={`${base}/operations/sops`} note="archive P3; codes unified via qa_dept_alias" />
            <Tile title="SOP ↔ task ↔ agent" sub="is the standard wired to work?" big={`${nInt(ss.tasks_with_sop)} / ${nInt(ss.tasks)}`} bigTone={cls.warn} chip={`PM tasks with a linked SOP · ${nPct(ss.tasks_with_sop_pct, 0)}`} chipTone="near" rows={[['Q&A bank entries', nInt(ss.qa_bank_entries)], ['Kinds', Object.entries(S.kinds ?? {}).map(([k, v]) => `${v} ${k}`).join(' · ')]]} cta="Link SOPs to tasks" ctaHref={`${base}/operations/pm`} note="the checklist on the task should be the SOP" />
          </div>
          <section className="border-b border-neutral-200 py-5"><h2 className="font-serif text-lg font-semibold">Registry by department</h2>
            <table className="mt-2 w-full text-xs"><thead><tr><Th c="Department" /><Th c="SOPs" r /><Th c="In date" r /><Th c="Never reviewed" r /><Th c="Overdue" r /><Th c="Lao" r /><Th c="Visual req · present" r /><Th c="Scored · avg" r /><Th c="Proposals open · P1" r /></tr></thead><tbody>{(S.by_dept ?? []).map((d: SopByDeptRow) => (<tr key={d.dept_code} className="border-b border-neutral-200"><td className="py-1.5">{d.dept_code}</td><td className="text-right">{nInt(d.sops)}</td><td className="text-right">{nInt(d.in_date)}</td><td className={`text-right ${Number(d.never_reviewed) > 0 ? cls.warn : ''}`}>{nInt(d.never_reviewed)}</td><td className={`text-right ${Number(d.review_overdue) > 0 ? cls.warn : ''}`}>{nInt(d.review_overdue)}</td><td className={`text-right ${Number(d.lao) === 0 && Number(d.sops) > 0 ? cls.bad : ''}`}>{nInt(d.lao)}</td><td className="text-right">{nInt(d.visual_required)} · {nInt(d.visual_present)}</td><td className="text-right">{nInt(d.scored)} · {d.avg_score ?? '—'}</td><td className={`text-right ${Number(d.proposals_open) > 50 ? cls.bad : ''}`}>{nInt(d.proposals_open)} · {nInt(d.proposals_open_p1)}</td></tr>))}</tbody></table></section>
        </div>
      )}

      {tab === 'people' && (
        <div role="tabpanel">
          <div className="mb-2 mt-5 flex items-baseline gap-3"><h2 className="font-serif text-lg font-semibold">People &amp; training</h2><span className="text-sm text-neutral-500">ops.staff_employment · hr.positions · training.* · university.*</span></div>
          <div className="grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-2 lg:grid-cols-4">
            <Tile title="Certification coverage" sub="required by position" big={`${nInt(m.certs_held)} / ${nInt(m.cert_fte_required)}`} bigTone={cls.bad} chip="FTE with an evidenced certificate" chipTone="miss" rows={(P.cert_coverage ?? []).slice(0, 7).map((c: CertCoverageRow) => [c.cert.replace(/_/g, ' '), `${c.fte_required} FTE · ${nInt(c.positions)} pos · held ${nInt(c.certs_held)}`, Number(c.certs_held) < Number(c.fte_required) ? cls.bad : cls.ok] as [string, string, string])} cta="Record certificates" ctaHref={`${base}/hr/training`} note="legal exposure: child protection, food safety" noteRed />
            <Tile title="Skills & single points of failure" sub="ops.skills · task demand" big={String(wf.avg_skills ?? '—')} bigTone={cls.warn} chip="skills tagged per person" chipTone="near" rows={(P.skill_demand ?? []).filter((s: SkillDemandRow) => s.single_point_of_failure || Number(s.tasks) >= 5).slice(0, 8).map((s: SkillDemandRow) => [s.skill, `${nInt(s.tasks)} tasks · ${nInt(s.staff_with)} people`, s.single_point_of_failure ? cls.bad : Number(s.staff_with) <= 2 ? cls.warn : cls.ok] as [string, string, string])} cta="Open skills matrix" ctaHref={`${base}/operations/staff`} note={`${nInt(m.spof_skills)} skills held by ≤1 person`} noteRed />
            <Tile title="Learning platform" sub="TBC University" big={nInt(le.learners)} bigTone={cls.bad} chip={`real learners · ${nInt(le.progress_rows)} progress rows`} chipTone="miss" rows={[['Modules · articles', `${nInt(le.modules)} · ${nInt(le.articles)}`], ['Paths live · with certificate', `${nInt(le.paths_live)} · ${nInt(le.paths_with_certificate)}`], ['Quiz items · questions', `${nInt(le.quiz_items)} · ${nInt(le.quiz_questions)}`], ['Modules about the platform', nInt(le.modules_platform_docs), cls.warn], ['SOPs courseable · cert types · theme modules', `${nInt(le.sops_courseable)} · ${nInt(le.statutory_cert_types)} · ${nInt(le.guest_theme_modules)}`], ['Staff who could log in', `${nInt(wf.platform_users)} of ${nInt(wf.active)}`, cls.bad]]} cta="Open university" ctaHref={`${base}/university`} note="platform manual, not staff training" />
            <Tile title="Workforce stability" sub="register, 12 months" big={nPct(wf.turnover_pct)} bigTone={Number(wf.turnover_pct) > 20 ? cls.warn : cls.ok} chip="turnover · goal < 20%" chipTone={Number(wf.turnover_pct) > 20 ? 'miss' : 'ok'} rows={[['Active · left 12 m · hired 12 m', `${nInt(wf.active)} · ${nInt(wf.left_12m)} · ${nInt(wf.hired_12m)}`], ['Departments with HOD', `${nInt(wf.departments_with_hod)} of ${nInt(wf.departments)}`, cls.bad], ['Positions ↔ staff linked', `${nInt(wf.positions_linked)} of ${nInt(wf.positions)} · FTE ${wf.fte_filled ?? 0} / ${wf.fte_target ?? '—'}`, cls.bad], ['Attendance import · timeclock', `${nDate(wf.attendance_last)} · ${nInt(wf.timeclock_events)} events`, cls.warn], ['Performance · disciplinary · H&S', `${nInt(wf.performance_reviews)} · ${nInt(wf.disciplinary)} · ${nInt(wf.hs_incidents)}`, cls.bad]]} cta="Open staff register" ctaHref={`${base}/operations/staff`} />
          </div>
          <section className="border-b border-neutral-200 py-5"><h2 className="font-serif text-lg font-semibold">By department</h2>
            <table className="mt-2 w-full text-xs"><thead><tr><Th c="Department" /><Th c="Active" r /><Th c="Left 12 m" r /><Th c="Hired 12 m" r /><Th c="With skills" r /><Th c="Avg skills" r /><Th c="Logins" r /><Th c="HOD" r /></tr></thead><tbody>{(P.by_dept ?? []).map((d: StaffByDeptRow) => (<tr key={d.dept_code} className="border-b border-neutral-200"><td className="py-1.5">{d.dept_code}</td><td className="text-right">{nInt(d.staff_active)}</td><td className="text-right">{nInt(d.left_12m)}</td><td className="text-right">{nInt(d.hired_12m)}</td><td className="text-right">{nInt(d.with_skills)}</td><td className="text-right">{d.avg_skills ?? '—'}</td><td className={`text-right ${Number(d.platform_users) === 0 ? cls.bad : ''}`}>{nInt(d.platform_users)}</td><td className={`text-right ${d.hod_set ? cls.ok : cls.bad}`}>{d.hod_set ? 'yes' : 'no'}</td></tr>))}</tbody></table></section>
        </div>
      )}

      {tab === 'verify' && (
        <div role="tabpanel">
          <div className="mb-2 mt-5 flex items-baseline gap-3"><h2 className="font-serif text-lg font-semibold">Audits &amp; preventive maintenance</h2><span className="text-sm text-neutral-500">knowledge.qa_audits · ops.task_instances · sustainability_* · legal register</span></div>
          <div className="grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-2 lg:grid-cols-4">
            <Tile wide title="Preventive maintenance" sub={`${nInt(pm.tasks)} tasks · ${nInt(pm.instances)} instances`} big={nPct(pm.pm_pct_30d)} bigTone={Number(pm.pm_pct_30d) < 95 ? cls.bad : cls.ok} chip="done on time, 30 d · goal 95%" chipTone={Number(pm.pm_pct_30d) < 95 ? 'miss' : 'ok'} cta="Open PM planner" ctaHref={`${base}/operations/pm`} note="generate → assign → verify: broken at assign" noteRed>
              <div className="mt-3 flex text-xs">{([[nInt(pm.tasks), 'tasks in catalogue', false], [nInt(pm.instances), 'instances generated', false], [nInt(pm.assigned), 'assigned to staff', true], [nInt(pm.done_30d), 'done in 30 d', true], [nInt(pm.instances_with_evidence), 'with evidence', true]] as [string, string, boolean][]).map(([b, l, bad], i) => (<div key={i} className={`flex-1 border-t-[3px] pt-1 ${bad ? 'border-red-800' : 'border-emerald-900'} ${i ? 'ml-1.5' : ''}`}><b className="block font-serif text-lg font-normal leading-tight">{b}</b>{l}</div>))}</div>
              <dl className="mt-3 grid grid-cols-[1fr_auto_1fr_auto] gap-x-4 gap-y-0.5 text-xs">{(V.pm_by_dept ?? []).slice(0, 6).map((d: PmByDeptRow) => (<Fragment key={d.dept_code}><dt className="text-neutral-500">{d.dept_code}</dt><dd className="text-right">{nInt(d.tasks)} tasks · {nInt(d.done_30d)}/{nInt(d.sched_30d)} · {nInt(d.past_due_open)} past due</dd></Fragment>))}</dl>
              <div className="mt-2 text-xs text-neutral-500">Past due {nInt(pm.past_due_open)} · next 7 d {nInt(pm.next_7d)} · next 30 d {nInt(pm.next_30d)} · evidence {nInt(pm.evidence_items)} (last {nDate(pm.evidence_last)}) · tickets {nInt(pm.tickets)} ({nInt(pm.tickets_open)} open)</div>
            </Tile>
            <Tile title="QA audits" sub="knowledge.qa_audits" big={nInt(au.audits)} bigTone={Number(au.audits) === 0 ? cls.bad : ''} chip={`audits · ${nInt(au.audits_90d)} in 90 d`} chipTone={Number(au.audits_90d) === 0 ? 'miss' : 'ok'} rows={[['Last audit · avg score 180 d', `${nDate(au.last_audit_date)} · ${au.avg_pct_180d ?? '—'}`], ['Below mandate', nInt(au.audits_below_mandate)], ['Findings open · overdue · critical', `${nInt(au.findings_open)} · ${nInt(au.findings_overdue)} · ${nInt(au.findings_critical_open)}`, Number(au.findings_overdue) > 0 ? cls.bad : ''], ['Findings closed', nInt(au.findings_closed)], ['SOPs with a qa_score', nInt(au.sops_scored)], ['Walkthrough feedback', nInt(au.walkthroughs)]]} cta="Run first audit" ctaHref={`${base}/operations/qa`} note="housekeeping, 10 rooms, this week" />
            <Tile title="External standards" sub={`${nInt(su?.standards_n)} certifying bodies`} big={`${nInt(su?.compliant)} / ${nInt(su?.reqs)}`} bigTone={cls.warn} chip={`requirements compliant · ${nPct(su?.compliant_pct, 0)}`} chipTone="near" rows={[...((su?.pillars ?? []).map((p: Pillar) => [p.pillar.replace(/_/g, ' '), `${nInt(p.compliant)} of ${nInt(p.reqs)} · ${nInt(p.partial)} partial`, Number(p.compliant) < Number(p.reqs) ? cls.warn : cls.ok] as [string, string, string])), ['Evidence last updated', `${nDate(su?.evidence_last_updated)} (${nInt(su?.evidence_days_old)} d)`, Number(su?.evidence_days_old) > 60 ? cls.bad : ''], ['Evidence reviews overdue', nInt(su?.evidence_review_overdue), cls.bad]]} cta="Open evidence" ctaHref={`${base}/operations/sustainability`} note={(su?.standards ?? []).map((s: SusStandard) => `${s.code} ${s.questions}q`).join(' · ')} />
          </div>
          <div className="grid gap-x-8 lg:grid-cols-[2fr_1fr]">
            <section className="py-5"><h2 className="font-serif text-lg font-semibold">Compliance register</h2>
              <table className="mt-2 w-full text-xs"><thead><tr><Th c="Category" /><Th c="Laws" r /><Th c="Needs verification" r /></tr></thead><tbody>{(lg?.by_category ?? []).map((c: LegalCategoryRow) => (<tr key={c.category} className="border-b border-neutral-200"><td className="py-1.5">{c.category}</td><td className="text-right">{nInt(c.laws)}</td><td className={`text-right ${Number(c.needs_verification) > 0 ? cls.warn : ''}`}>{nInt(c.needs_verification)}</td></tr>))}<tr className="font-semibold"><td className="py-1.5">Total</td><td className="text-right">{nInt(lg?.laws)}</td><td className="text-right">{nInt(lg?.needs_verification)}</td></tr></tbody></table>
              <p className="mt-2 text-xs text-neutral-500">{nInt(lg?.never_reviewed)} never reviewed · {nInt(lg?.no_review_date)} without a review date · {nInt(lg?.review_overdue)} overdue.</p></section>
            <section className="py-5"><h2 className="font-serif text-lg font-semibold">Data-quality exceptions</h2><ul className="space-y-1.5 text-sm"><li><b className={Number(dq.open) > 0 ? cls.bad : ''}>{nInt(dq.open)} open</b> <span className="text-neutral-500">— {nInt(dq.critical_open)} critical, {nInt(dq.systemic_open)} systemic; last seen {nDate(dq.last_seen)}</span></li><li><b>{nInt(dq.fixed)} fixed · {nInt(dq.waived)} waived</b></li></ul><p className="mt-2 text-xs text-neutral-500">The one exception loop that runs — the pattern to copy for operations.</p></section>
          </div>
        </div>
      )}

      {tab === 'guest' && (
        <div role="tabpanel">
          <div className="mb-2 mt-5 flex items-baseline gap-3"><h2 className="font-serif text-lg font-semibold">Guest signal &amp; corrective action</h2><span className="text-sm text-neutral-500">marketing.reviews · guest.review_themes · knowledge.qa_findings</span></div>
          <div className="grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-2 lg:grid-cols-4">
            <Tile title="Low reviews" sub="under 4, last 180 d" big={nInt(gs.low_180d)} bigTone={Number(gs.low_180d) > 0 ? cls.bad : cls.ok} chip={`${nInt(gs.low_90d)} in 90 d · avg 90 d ${gs.avg_90d ?? '—'}`} chipTone="miss" rows={[['Without a theme tag', nInt(gs.low_without_theme), cls.warn], ['Unanswered', nInt(gs.low_unanswered), cls.bad], ['Without a finding', nInt(gs.low_without_finding), cls.bad], ['Never answered (all time)', `${nInt(gs.unanswered)} of ${nInt(gs.reviews)} · ${nPct(gs.unanswered_pct, 0)}`, cls.bad], ['Recovery cases · NPS', `${nInt(gs.recovery_cases)} · ${nInt(gs.nps_responses)}`, cls.bad], ['Named staff in tags', `${nInt(gs.named_staff_tags)} of ${nInt(gs.theme_tags)}`]]} cta="Open reputation" ctaHref={`${base}/guest/reputation`} note="signal without a receiver" noteRed />
            <Tile wide title="Themes → departments" sub={`${nInt(gs.themed_reviews)} themed reviews · 180 d`} big={nInt(gs.negative_theme_tags_90d)} bigTone={Number(gs.negative_theme_tags_90d) > 0 ? cls.bad : cls.ok} chip="negative theme tags, 90 d" chipTone={Number(gs.negative_theme_tags_90d) > 0 ? 'miss' : 'ok'} cta="Open themes" ctaHref={`${base}/guest/reputation`} note="mapping lives in ops.qa_theme_dept_map">
              <table className="mt-2 w-full text-xs"><thead><tr><Th c="Theme" /><Th c="Mentions" r /><Th c="Positive" r /><Th c="Negative" r /><Th c="Mixed" r /><Th c="Owner" /></tr></thead><tbody>{(G.themes ?? []).map((t: ThemeRow) => (<tr key={t.theme} className="border-b border-neutral-200"><td className="py-1">{t.theme}</td><td className="text-right">{nInt(t.mentions_180d)}</td><td className="text-right">{nInt(t.positive)}</td><td className={`text-right ${Number(t.negative) > 0 ? cls.bad : ''}`}>{nInt(t.negative)}</td><td className="text-right">{nInt(t.mixed)}</td><td>{t.dept_code ?? '—'}{t.dept_code_2 ? ` · ${t.dept_code_2}` : ''}</td></tr>))}</tbody></table>
            </Tile>
            <Tile title="CAPA loop" sub="corrective & preventive action" big={nInt(au.findings_open)} bigTone={Number(gs.low_without_finding) > 0 ? cls.bad : ''} chip={`findings open · ${nInt(au.findings)} ever`} chipTone={Number(au.findings) === 0 ? 'miss' : 'ok'} rows={[['Low reviews without a finding', nInt(gs.low_without_finding), cls.bad], ['Findings overdue · critical', `${nInt(au.findings_overdue)} · ${nInt(au.findings_critical_open)}`], ['Closed', nInt(au.findings_closed)], ['Convention', 'category = guest_review, description carries the review id'], ['Owner', 'department HOD (see Departments tab)']]} cta="Open first case" ctaHref={`${base}/operations/qa`} note={`${nInt(gs.low_without_finding)} candidates waiting`} />
          </div>
          <section className="border-b border-neutral-200 py-5"><h2 className="font-serif text-lg font-semibold">Low reviews, last 180 days</h2>
            <table className="mt-2 w-full text-xs"><thead><tr><Th c="Date" /><Th c="Source" /><Th c="Rating" r /><Th c="Themes" /><Th c="Departments implicated" /><Th c="Answered" r /><Th c="Finding" r /></tr></thead><tbody>{(G.low_reviews ?? []).map((r: LowReviewRow) => (<tr key={r.review_id} className="border-b border-neutral-200 align-top"><td className="whitespace-nowrap py-1.5">{nDate(r.reviewed_at)}</td><td>{r.source}</td><td className="text-right">{r.rating_norm}</td><td className="max-w-[40ch] text-neutral-600">{r.themes ?? <span className={cls.warn}>no theme</span>}</td><td>{r.depts_implicated ?? '—'}</td><td className={`text-right ${r.answered ? cls.ok : cls.bad}`}>{r.answered ? 'yes' : 'no'}</td><td className={`text-right ${r.has_finding ? cls.ok : cls.bad}`}>{r.has_finding ? 'yes' : 'no'}</td></tr>))}</tbody></table></section>
        </div>
      )}
    </div>
  );
}
