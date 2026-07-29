// app/university/paths/page.tsx
// TBC University · Learn layer — the four role paths (design spec item 4:
// FO, F&B, HK, Finance/GM). Each card shows the path, its length, and the
// current user's progress bar. Data: v_university_paths + v_university_path_items
// + v_university_user_progress (bridges, ADR-186).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionScope } from '@/lib/session-scope';
import Breadcrumbs from '../_components/Breadcrumbs';
import { INK, INK_SOFT, HAIR, GREEN, GOLD, WARM, SANS } from '../_lib/theme';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PathRow = {
  slug: string; role_key: string; title: string; description: string;
  audience: string; sort_order: number; certificate: boolean;
};

export default async function LearningPathsPage() {
  let paths: PathRow[] = [];
  const totals = new Map<string, number>();
  const done = new Map<string, number>();

  try {
    const sb = getSupabaseAdmin();
    let email = 'guest';
    try { email = ((await getSessionScope()).email ?? '').toLowerCase() || 'guest'; } catch { /* open mode */ }
    const [pRes, iRes, gRes] = await Promise.all([
      sb.from('v_university_paths').select('slug, role_key, title, description, audience, sort_order, certificate'),
      sb.from('v_university_path_items').select('path_slug'),
      sb.from('v_university_user_progress').select('path_slug, item_id').eq('user_email', email),
    ]);
    paths = (pRes.data as PathRow[] | null) ?? [];
    for (const i of (iRes.data as { path_slug: string }[] | null) ?? []) {
      totals.set(i.path_slug, (totals.get(i.path_slug) ?? 0) + 1);
    }
    for (const g of (gRes.data as { path_slug: string }[] | null) ?? []) {
      done.set(g.path_slug, (done.get(g.path_slug) ?? 0) + 1);
    }
  } catch { /* page still renders */ }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '20px 24px 60px', fontFamily: SANS }}>
      <Breadcrumbs items={[{ label: 'TBC University', href: '/university' }, { label: 'Learning paths' }]} />
      <header style={{ margin: '10px 0 16px' }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: INK }}>Learning paths</h1>
        <p style={{ margin: '5px 0 0', fontSize: 14.5, lineHeight: 1.6, color: INK_SOFT }}>
          Short, ordered courses per role. Tick off each article as you read it — quizzes check what stuck.
        </p>
      </header>

      {paths.length === 0 && (
        <div style={{ border: `1.5px dashed ${HAIR}`, borderRadius: 8, background: WARM, padding: '30px 24px', textAlign: 'center', fontSize: 14, color: INK_SOFT }}>
          The learning paths are being set up — check back soon.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {paths.map((p) => {
          const total = totals.get(p.slug) ?? 0;
          const n = Math.min(done.get(p.slug) ?? 0, total);
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          return (
            <a key={p.slug} href={`/university/paths/${p.slug}`} style={{
              background: '#FFFFFF', border: `1px solid ${HAIR}`, borderTop: `3px solid ${p.certificate ? GOLD : GREEN}`,
              borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8, textDecoration: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: INK }}>{p.title}</span>
                {p.certificate && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 3, padding: '1px 6px', flex: 'none' }}>
                    CERTIFICATE
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13.5, color: INK_SOFT, lineHeight: 1.6 }}>{p.description}</div>
              <div style={{ marginTop: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: INK_SOFT, marginBottom: 4 }}>
                  <span>{total} steps</span>
                  <span style={{ fontWeight: 600, color: pct === 100 ? GREEN : INK_SOFT }}>
                    {pct === 100 ? '✓ complete' : `${n} of ${total} done`}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: WARM, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? GREEN : GOLD, borderRadius: 3 }} />
                </div>
              </div>
            </a>
          );
        })}
      </div>

      <div style={{ marginTop: 18, fontSize: 12.5, color: INK_SOFT }}>
        Supervisors: <a href="/university/paths/supervisor" style={{ color: GREEN, fontWeight: 600 }}>see your team&rsquo;s progress →</a>
      </div>
    </div>
  );
}
