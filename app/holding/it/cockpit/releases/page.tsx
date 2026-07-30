// app/holding/it/cockpit/releases/page.tsx
//
// Releases — ONE truthful production cockpit (brief releases-cockpit-v2).
// PBS order 2026-07-29: this table is the single cockpit for everything in
// production and in flight — "otherwise I forget half of what's in production".
//
// Top: the live module table from public.v_module_completion_queue (no cache,
// no hardcoded rows — force-dynamic + revalidate 0, straight from the view).
// Sort: needs-owner rows (open_questions set) first, then in_production desc,
// then priority.
//
// Below: the rule-597 doc-release ledger (platform + module releases),
// preserved from v1. A RELEASE is an append-only, sha256-signed snapshot of
// the canonical doc corpus:
//   · platform scope — explicit human cut here (fn_cut_platform_release):
//     refs of all 30 doc_type versions + changelog generated from
//     documents_history diffs + known issues from open gap_lists +
//     module completion table. Generated from live truth, never hand-written.
//   · module:<doc_type> scope — appended automatically by fn_module_sign_off
//     on successful sign-off (gap_list empty · completion 100% · brief shipped).
// documentation.releases is append-only (UPDATE/DELETE blocked by trigger).
//
// Also renders at /holding/it2/modules/status via the IT2 shim re-export —
// keep the default export.

import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { Container, MetricRow } from '@/app/(cockpit)/_design';
import { TOKENS, MONO } from '../_components/tokens';
import { ReleasePicker } from './ReleasePicker';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ── module completion queue ─────────────────────────────────────────────

type QueueRow = {
  module_doc_type: string;
  display_name: string | null;
  priority: number | null;
  status: string | null;
  completion_estimate: number | null;
  brief_slug: string | null;
  specialist_persona: string | null;
  entry_url: string | null;
  in_production: boolean | null;
  expected_delivery: string | null;
  open_questions: string | null;
  updated_at: string | null;
};

async function fetchQueue(): Promise<QueueRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any)
    .from('v_module_completion_queue')
    .select(
      'module_doc_type, display_name, priority, status, completion_estimate, brief_slug, specialist_persona, entry_url, in_production, expected_delivery, open_questions, updated_at'
    );
  if (error) {
    console.error('[cockpit/releases] queue fetch error', error);
    return [];
  }
  const rows = ((data as QueueRow[]) ?? []).slice();
  // needs-owner first, then in production, then priority.
  rows.sort((a, b) => {
    const aQ = a.open_questions ? 0 : 1;
    const bQ = b.open_questions ? 0 : 1;
    if (aQ !== bQ) return aQ - bQ;
    const aP = a.in_production ? 0 : 1;
    const bP = b.in_production ? 0 : 1;
    if (aP !== bP) return aP - bP;
    return (a.priority ?? 999) - (b.priority ?? 999);
  });
  return rows;
}

function moduleName(r: QueueRow): string {
  if (r.display_name) return r.display_name;
  return r.module_doc_type.replace(/_module$/, '').replace(/_/g, ' ');
}

function needsOwnerAction(q: string | null): boolean {
  if (!q) return false;
  const t = q.trimStart();
  return t.startsWith('BLOCKED') || t.startsWith('DO');
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const th: React.CSSProperties = {
  textAlign: 'left',
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  color: TOKENS.text3,
  padding: '6px 10px',
  borderBottom: `1px solid ${TOKENS.border}`,
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  fontSize: 13,
  color: TOKENS.ink,
  padding: '8px 10px',
  borderBottom: `1px solid ${TOKENS.border}`,
  verticalAlign: 'top',
};

function ProductionBadge({ live }: { live: boolean }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: 0.6,
        padding: '2px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        background: live ? '#E8F5E9' : '#FFF3E0',
        color: live ? '#2E7D32' : '#B45309',
        border: `1px solid ${live ? '#2E7D3244' : '#B4530944'}`,
      }}
    >
      {live ? 'IN PRODUCTION' : 'IN FLIGHT'}
    </span>
  );
}

function CompletionCell({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) {
    return <span style={{ color: TOKENS.text3, fontSize: 12 }}>not yet audited</span>;
  }
  const color = pct >= 100 ? '#2E7D32' : pct >= 80 ? TOKENS.forest : TOKENS.brass;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          width: 64,
          height: 6,
          borderRadius: 3,
          background: TOKENS.border,
          overflow: 'hidden',
          display: 'inline-block',
        }}
      >
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${Math.min(100, Math.max(0, pct))}%`,
            background: color,
          }}
        />
      </span>
      <span style={{ fontFamily: MONO, fontSize: 12, color: TOKENS.ink }}>{pct}%</span>
    </span>
  );
}

function ModuleTable({ rows }: { rows: QueueRow[] }) {
  const live = rows.filter((r) => r.in_production).length;
  const questions = rows.filter((r) => r.open_questions).length;
  return (
    <Container
      title="Module production table"
      subtitle={`Live from governance.module_completion_queue — ${rows.length} modules · ${live} in production · ${questions} awaiting an answer or action from PBS. Never cached, never hand-written.`}
    >
      {rows.length === 0 ? (
        <div style={{ color: TOKENS.text2, fontSize: 13 }}>
          Queue is empty — check the v_module_completion_queue bridge view.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>Module</th>
                <th style={th}>Status</th>
                <th style={th}>Completion</th>
                <th style={th}>Stage</th>
                <th style={th}>Delivery</th>
                <th style={th}>Open question</th>
                <th style={th}>Brief</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const urgent = needsOwnerAction(r.open_questions);
                return (
                  <tr
                    key={r.module_doc_type}
                    style={urgent ? { background: '#FFEBEE66' } : undefined}
                  >
                    <td style={{ ...td, fontWeight: 600, minWidth: 180 }}>
                      {r.entry_url ? (
                        <Link
                          href={r.entry_url}
                          style={{ color: TOKENS.forest, textDecoration: 'underline' }}
                        >
                          {moduleName(r)}
                        </Link>
                      ) : (
                        moduleName(r)
                      )}
                    </td>
                    <td style={td}>
                      <ProductionBadge live={!!r.in_production} />
                    </td>
                    <td style={td}>
                      <CompletionCell pct={r.completion_estimate} />
                    </td>
                    <td style={{ ...td, fontFamily: MONO, fontSize: 11, color: TOKENS.text2, whiteSpace: 'nowrap' }}>
                      {r.status ?? '—'}
                    </td>
                    <td style={{ ...td, fontFamily: MONO, fontSize: 12, whiteSpace: 'nowrap' }}>
                      {fmtDate(r.expected_delivery)}
                    </td>
                    <td style={{ ...td, maxWidth: 340, fontSize: 12, color: urgent ? '#B71C1C' : TOKENS.text2 }}>
                      {r.open_questions ?? ''}
                    </td>
                    <td style={td}>
                      {r.brief_slug ? (
                        <Link
                          href={`/holding/it/cockpit/briefs/${r.brief_slug}`}
                          style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.forest, textDecoration: 'underline', whiteSpace: 'nowrap' }}
                        >
                          brief →
                        </Link>
                      ) : (
                        <span style={{ color: TOKENS.text3, fontSize: 11 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}

// ── doc-release ledger (rule 597, preserved from v1) ────────────────────

export type Release = {
  id: number;
  semver: string;
  scope: string;
  released_at: string;
  approved_by: string;
  changelog_md: string | null;
  doc_snapshot_refs: Array<{
    doc_type: string;
    version: number;
    hist_id: number | null;
    sha256: string;
  }> | null;
};

async function fetchReleases(): Promise<Release[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).from('v_doc_releases').select('*');
  if (error) {
    console.error('[cockpit/releases] fetch error', error);
    return [];
  }
  return (data as Release[]) ?? [];
}

async function cutReleaseAction(formData: FormData) {
  'use server';
  const semver = String(formData.get('semver') ?? '').trim();
  if (!semver) return;
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('fn_cut_platform_release', {
    p_semver: semver,
    p_actor: 'PBS',
  });
  if (error) console.error('[cockpit/releases] cut error', error);
  else console.log('[cockpit/releases] cut result', data);
  revalidatePath('/holding/it/cockpit/releases');
}

export default async function ReleasesPage() {
  const [queue, releases] = await Promise.all([fetchQueue(), fetchReleases()]);
  const platform = releases.filter((r) => r.scope === 'platform');
  const modules = releases.filter((r) => r.scope.startsWith('module:'));
  const latest = platform[0] ?? null;
  const liveCount = queue.filter((r) => r.in_production).length;
  const questionCount = queue.filter((r) => r.open_questions).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100 }}>
      <MetricRow
        size="sm"
        tiles={[
          { label: 'Modules in production', value: liveCount, footnote: `${queue.length} tracked total` },
          { label: 'Needs PBS', value: questionCount, footnote: 'open questions / actions' },
          { label: 'Platform releases', value: platform.length, footnote: latest ? `latest ${latest.semver}` : 'none cut yet' },
          { label: 'Module releases', value: modules.length, footnote: 'via sign-off (rule 597)' },
        ]}
      />

      <ModuleTable rows={queue} />

      <Container
        title="Cut a platform release"
        subtitle="Human approval = release (rule 597). Snapshots every doc_type version with a sha256 signature; changelog is generated from documents_history diffs, known issues from open gap lists — never hand-written."
      >
        <form action={cutReleaseAction} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            name="semver"
            placeholder={latest ? nextSemverHint(latest.semver) : '1.0'}
            required
            pattern="\d+\.\d+(\.\d+)?"
            style={{
              fontFamily: MONO, fontSize: 13, padding: '8px 10px',
              border: `1px solid ${TOKENS.border}`, borderRadius: 6,
              background: TOKENS.bgRaised, color: TOKENS.ink, width: 120,
            }}
          />
          <button
            type="submit"
            style={{
              fontFamily: MONO, fontSize: 12, letterSpacing: 0.5, cursor: 'pointer',
              padding: '9px 16px', border: 'none', borderRadius: 6,
              background: TOKENS.forest, color: '#FFFFFF',
            }}
          >
            Cut release
          </button>
          <span style={{ fontSize: 12, color: TOKENS.text3 }}>
            Append-only — a semver can never be re-cut or edited.
          </span>
        </form>
      </Container>

      {releases.length === 0 ? (
        <Container title="No releases yet">
          <div style={{ color: TOKENS.text2, fontSize: 13 }}>
            Cut release 1.0 above to sign the current doc corpus.
          </div>
        </Container>
      ) : (
        <ReleasePicker releases={releases} />
      )}
    </div>
  );
}

function nextSemverHint(current: string): string {
  const major = parseInt(current.split('.')[0] || '1', 10);
  return `${major + 1}.0`;
}
