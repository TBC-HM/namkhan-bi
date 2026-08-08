// app/holding/it2/system/releases/page.tsx
// Doc-release ledger + cut-release form — fleet ops tool relocated from
// /modules/status (module-surface-slice-status-page-merge, 2026-08-08).
// Rule 597: human approval = release. Every release snapshots doc versions with
// sha256 signatures; changelog generated from documents_history diffs.

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '@/components/cockpit/tokens';
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
  const { data, error } = await (sb as any).from('v_doc_releases').select('*');
  if (error) {
    console.error('[it2/system/releases] releases fetch error', error);
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
  if (error) console.error('[it2/system/releases] cut error', error);
  else console.log('[it2/system/releases] cut result', data);
  revalidatePath('/holding/it2/system/releases');
}

function nextSemverHint(current: string): string {
  const major = parseInt(current.split('.')[0] || '1', 10);
  return `${major + 1}.0`;
}

export default async function SystemReleasesPage() {
  const releases = await fetchReleases();
  const platformReleases = releases.filter((r) => r.scope === 'platform');
  const moduleReleases = releases.filter((r) => r.scope.startsWith('module:'));
  const latestPlatform = platformReleases[0] ?? null;

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Platform releases', value: platformReleases.length, foot: latestPlatform ? `latest ${latestPlatform.semver}` : 'none cut yet' },
          { label: 'Module releases', value: moduleReleases.length, foot: 'via sign-off (rule 597)' },
          { label: 'Total releases', value: releases.length, foot: 'append-only ledger' },
        ].map(t => (
          <div key={t.label} style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: TOKENS.text2 }}>{t.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: MONO, margin: '2px 0', color: TOKENS.ink }}>{t.value}</div>
            <div style={{ fontSize: 11, color: TOKENS.text3 }}>{t.foot}</div>
          </div>
        ))}
      </div>

      {/* Cut a platform release (rule 597) */}
      <div style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink, marginBottom: 2 }}>Cut a platform release</div>
        <div style={{ fontSize: 12, color: TOKENS.text3, marginBottom: 10 }}>
          Human approval = release (rule 597). Snapshots every doc_type version with a sha256 signature;
          changelog is generated from documents_history diffs, known issues from open gap lists — never hand-written.
        </div>
        <form action={cutReleaseAction} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            name="semver"
            placeholder={latestPlatform ? nextSemverHint(latestPlatform.semver) : '1.0'}
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
      </div>

      {/* Doc-release ledger */}
      {releases.length === 0 ? (
        <div style={{ fontSize: 12, color: TOKENS.text3 }}>
          No releases yet — cut release 1.0 above to sign the current doc corpus.
        </div>
      ) : (
        <ReleasePicker releases={releases} />
      )}
    </div>
  );
}