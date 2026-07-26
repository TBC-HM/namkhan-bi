// app/holding/it/cockpit/briefs/page.tsx
// PBS 2026-07-26 (bug #83) — Build Briefs cockpit. Loop integration: "Confirm → build"
// releases brief into the standing pipeline. Re-audit fires the autospec sweep.

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { groupsAsTabs } from '../_lib/groups';
import BriefActions from './_components/BriefActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type BriefRow = {
  slug: string; title: string; status: string; version: number;
  assigned_to: string | null; tags: string[] | null;
  last_updated_at: string | null; shipped_at: string | null;
};

const STATUS_ORDER: Record<string, number> = {
  draft: 0, ready: 1, in_progress: 2, shipped: 3, archived: 4,
};

const STATUS_COLOR: Record<string, string> = {
  draft: '#B8542A', ready: '#F0A500', in_progress: '#084838',
  shipped: '#2E7D32', archived: '#8A8A8A',
};

async function fetchBriefs() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_build_briefs_index').select('*').order('last_updated_at', { ascending: false });
  return (data ?? []) as BriefRow[];
}

async function fetchQueueCounts() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_build_briefs_index').select('status');
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }
  return counts;
}

export default async function BriefsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const [briefs, counts] = await Promise.all([fetchBriefs(), fetchQueueCounts()]);

  const statusFilter = searchParams.status ?? '';
  const filtered = statusFilter
    ? briefs.filter((b) => b.status === statusFilter)
    : [...briefs].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

  const inFlight = (counts['in_progress'] ?? 0) + (counts['ready'] ?? 0);
  const shipped  = counts['shipped'] ?? 0;

  return (
    <DashboardPage title="Build Briefs" tabs={groupsAsTabs('build')}>
      <div style={{ gridColumn: '1 / -1' }}>
        {/* Queue header */}
        <div style={{
          display: 'flex', gap: 24, padding: '10px 0 16px', alignItems: 'center',
          borderBottom: '1px solid #E6DFCC', marginBottom: 16,
        }}>
          <span style={{ fontSize: 12, color: '#5A5A5A' }}>
            Queue — <strong style={{ color: '#084838' }}>{inFlight}</strong> in flight ·{' '}
            <strong style={{ color: '#2E7D32' }}>{shipped}</strong> shipped ·{' '}
            <strong style={{ color: '#B8542A' }}>{counts['draft'] ?? 0}</strong> draft
          </span>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            {['', 'draft', 'ready', 'in_progress', 'shipped', 'archived'].map((s) => (
              <Link
                key={s}
                href={s ? `/holding/it/cockpit/briefs?status=${s}` : '/holding/it/cockpit/briefs'}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 12,
                  background: statusFilter === s ? '#084838' : '#F4EFE2',
                  color: statusFilter === s ? '#fff' : '#5A5A5A',
                  textDecoration: 'none', border: '1px solid #E6DFCC',
                }}
              >
                {s || 'All'} {s ? `(${counts[s] ?? 0})` : `(${briefs.length})`}
              </Link>
            ))}
          </div>
        </div>

        <Container title="" density="compact">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E6DFCC', color: '#5A5A5A', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>Brief</th>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>v</th>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>Last edit</th>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>Tags</th>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.slug} style={{ borderBottom: '1px solid #F0EBE0' }}>
                  <td style={{ padding: '8px 8px' }}>
                    <Link
                      href={`/holding/it/cockpit/briefs/${b.slug}`}
                      style={{ color: '#084838', textDecoration: 'none', fontWeight: 500, fontSize: 12 }}
                    >
                      {b.title}
                    </Link>
                    <div style={{ color: '#8A8A8A', fontSize: 10, marginTop: 2 }}>{b.slug}</div>
                  </td>
                  <td style={{ padding: '8px 8px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                      background: STATUS_COLOR[b.status] + '18',
                      color: STATUS_COLOR[b.status] ?? '#5A5A5A',
                      border: '1px solid ' + (STATUS_COLOR[b.status] ?? '#ccc') + '44',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[b.status] }} />
                      {b.status}
                    </span>
                  </td>
                  <td style={{ padding: '8px 8px', color: '#5A5A5A' }}>v{b.version}</td>
                  <td style={{ padding: '8px 8px', color: '#5A5A5A' }}>
                    {b.last_updated_at ? new Date(b.last_updated_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '8px 8px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(b.tags ?? []).slice(0, 3).map((t) => (
                        <span key={t} style={{
                          fontSize: 10, padding: '1px 6px', background: '#F4EFE2',
                          borderRadius: 6, color: '#5A5A5A', border: '1px solid #E6DFCC',
                        }}>{t}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '8px 8px' }}>
                    <BriefActions slug={b.slug} currentStatus={b.status} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#8A8A8A' }}>
                    No briefs
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Container>
      </div>
    </DashboardPage>
  );
}
