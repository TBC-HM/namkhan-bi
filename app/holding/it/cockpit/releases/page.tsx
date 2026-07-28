// app/holding/it/cockpit/releases/page.tsx
//
// Releases — rule 597 (doc release law) auditor lens.
// Brief documentation-architecture-v2 (goal 48): a RELEASE is an append-only,
// sha256-signed snapshot of the canonical doc corpus.
//   · platform scope — explicit human cut here (fn_cut_platform_release):
//     refs of all 30 doc_type versions + changelog generated from
//     documents_history diffs + known issues from open gap_lists +
//     module completion table. Generated from live truth, never hand-written.
//   · module:<doc_type> scope — appended automatically by fn_module_sign_off
//     on successful sign-off (gap_list empty · completion 100% · brief shipped).
// documentation.releases is append-only (UPDATE/DELETE blocked by trigger).

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { Container, MetricRow } from '@/app/(cockpit)/_design';
import { Markdown } from '../_components/Markdown';
import { TOKENS, MONO } from '../_components/tokens';
import { ReleasePicker } from './ReleasePicker';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  const { data, error } = await sb.from('v_doc_releases').select('*');
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
  const { data, error } = await sb.rpc('fn_cut_platform_release', {
    p_semver: semver,
    p_actor: 'PBS',
  });
  if (error) console.error('[cockpit/releases] cut error', error);
  else console.log('[cockpit/releases] cut result', data);
  revalidatePath('/holding/it/cockpit/releases');
}

export default async function ReleasesPage() {
  const releases = await fetchReleases();
  const platform = releases.filter((r) => r.scope === 'platform');
  const modules = releases.filter((r) => r.scope.startsWith('module:'));
  const latest = platform[0] ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100 }}>
      <MetricRow
        size="sm"
        tiles={[
          { label: 'Platform releases', value: platform.length, footnote: latest ? `latest ${latest.semver}` : 'none cut yet' },
          { label: 'Module releases', value: modules.length, footnote: 'via sign-off (rule 597)' },
          { label: 'Docs signed', value: latest?.doc_snapshot_refs?.length ?? 0, footnote: 'sha256 refs in latest' },
          { label: 'Ledger', value: releases.length, footnote: 'append-only rows' },
        ]}
      />

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
