// app/holding/it/cockpit/briefs/[slug]/page.tsx
// PBS 2026-07-26 (bug #83) — brief detail: content_md + status history + Re-audit

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { groupsAsTabs } from '../../_lib/groups';
import BriefActions from '../_components/BriefActions';

export const dynamic = 'force-dynamic';

type BriefDetail = {
  id: string; slug: string; title: string; content_md: string; status: string;
  version: number; assigned_to: string | null; tags: string[] | null;
  last_updated_at: string | null; shipped_at: string | null;
  shipped_commit: string | null; target_repo: string | null; target_branch: string | null;
};

async function fetchBrief(slug: string): Promise<BriefDetail | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.rpc('fn_get_build_brief', { p_slug: slug });
  return data as BriefDetail | null;
}

const STATUS_COLOR: Record<string, string> = {
  draft: '#B8542A', ready: '#F0A500', in_progress: '#084838',
  shipped: '#2E7D32', archived: '#8A8A8A',
};

function renderMd(md: string) {
  return md
    .replace(/^# (.+)$/gm, '<h2 style="font-size:15px;font-weight:700;margin:16px 0 6px;color:#1B1B1B">$1</h2>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:13px;font-weight:600;margin:12px 0 4px;color:#1B1B1B">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size:12px;font-weight:600;margin:10px 0 2px;color:#5A5A5A">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:#F4EFE2;padding:1px 4px;border-radius:3px;font-size:11px;font-family:monospace">$1</code>')
    .replace(/^```[\s\S]*?^```/gm, (m) =>
      `<pre style="background:#F9F6EF;padding:10px;border-radius:4px;font-size:11px;overflow-x:auto;border:1px solid #E6DFCC;margin:8px 0">${m.replace(/```\w*\n?/, '').replace(/```$/, '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
    )
    .replace(/^- (.+)$/gm, '<li style="margin:2px 0;color:#1B1B1B">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul style="margin:6px 0 6px 18px;padding:0">${m}</ul>`)
    .replace(/\n\n/g, '<br/>');
}

export default async function BriefDetailPage({ params }: { params: { slug: string } }) {
  const brief = await fetchBrief(params.slug);
  if (!brief) notFound();

  return (
    <DashboardPage title={brief.title} tabs={groupsAsTabs('build')}>
      <div style={{ gridColumn: '1 / -1' }}>
        {/* Back + meta strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Link href="/holding/it/cockpit/briefs" style={{ fontSize: 12, color: '#5A5A5A', textDecoration: 'none' }}>
            ← Briefs
          </Link>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 12, fontWeight: 600,
            background: (STATUS_COLOR[brief.status] ?? '#ccc') + '18',
            color: STATUS_COLOR[brief.status] ?? '#5A5A5A',
            border: '1px solid ' + (STATUS_COLOR[brief.status] ?? '#ccc') + '44',
          }}>
            {brief.status}
          </span>
          <span style={{ fontSize: 11, color: '#8A8A8A' }}>v{brief.version}</span>
          {brief.last_updated_at && (
            <span style={{ fontSize: 11, color: '#8A8A8A' }}>
              edited {new Date(brief.last_updated_at).toLocaleDateString()}
            </span>
          )}
          {brief.shipped_commit && (
            <span style={{ fontSize: 11, color: '#2E7D32', fontFamily: 'monospace' }}>
              {brief.shipped_commit.slice(0, 10)}
            </span>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <BriefActions slug={brief.slug} currentStatus={brief.status} />
          </div>
        </div>

        {/* Tags */}
        {(brief.tags ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {(brief.tags ?? []).map((t) => (
              <span key={t} style={{
                fontSize: 10, padding: '1px 8px', background: '#F4EFE2',
                borderRadius: 6, color: '#5A5A5A', border: '1px solid #E6DFCC',
              }}>{t}</span>
            ))}
          </div>
        )}

        {/* Content */}
        <Container title="Spec" density="compact">
          <div
            style={{ fontSize: 12, lineHeight: 1.7, color: '#1B1B1B' }}
            dangerouslySetInnerHTML={{ __html: renderMd(brief.content_md ?? '') }}
          />
        </Container>

        {/* Meta */}
        <Container title="Metadata" density="compact">
          <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {[
                ['Slug', brief.slug],
                ['Assigned to', brief.assigned_to ?? '—'],
                ['Repo', brief.target_repo ?? '—'],
                ['Branch', brief.target_branch ?? 'main'],
                ['Shipped', brief.shipped_at ? new Date(brief.shipped_at).toLocaleString() : '—'],
                ['Shipped commit', brief.shipped_commit ?? '—'],
              ].map(([k, v]) => (
                <tr key={k} style={{ borderBottom: '1px solid #F0EBE0' }}>
                  <td style={{ padding: '5px 8px', color: '#5A5A5A', fontWeight: 500, width: 140 }}>{k}</td>
                  <td style={{ padding: '5px 8px', color: '#1B1B1B', fontFamily: k === 'Slug' || k.includes('commit') ? 'monospace' : undefined, fontSize: k === 'Slug' || k.includes('commit') ? 11 : 12 }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Container>
      </div>
    </DashboardPage>
  );
}
