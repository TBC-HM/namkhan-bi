// app/university/page.tsx
// TBC University · landing. THE ASK WINDOW sits on top (owner mandate:
// "prompt window on top"), module cards below. Module cards render from
// public.v_university_modules (read contract); until that view exists the
// FALLBACK_MODULES list keeps the landing rendering. A KPI reference card
// links to /university/kpis.

import type { CSSProperties } from 'react';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import AskWindow from './_components/AskWindow';
import { FALLBACK_MODULES, type ModuleCard } from './_lib/ia';
import { INK, INK_SOFT, HAIR, GREEN, GOLD, WARM, SANS } from './_lib/theme';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const card: CSSProperties = {
  background: '#FFFFFF', border: `1px solid ${HAIR}`, borderRadius: 8,
  padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 7,
};

const ICONS: Record<string, string> = {
  mail: '✉️', image: '🖼️', calendar: '📅', share: '📣', chart: '📊',
  book: '📖', money: '💰', bed: '🛏️', food: '🍽️', people: '👥',
};

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase().replace(/_/g, '-');
  if (s === 'live') {
    return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: '#FFFFFF', background: GREEN, borderRadius: 3, padding: '2px 7px' }}>LIVE</span>;
  }
  if (s === 'being-written' || s === 'draft') {
    return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 3, padding: '1px 6px' }}>BEING WRITTEN</span>;
  }
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: INK_SOFT, border: `1px solid ${HAIR}`, background: WARM, borderRadius: 3, padding: '1px 6px' }}>COMING SOON</span>;
}

export default async function UniversityPage() {
  let modules: ModuleCard[] = [];
  const counts = new Map<string, number>();
  try {
    const sb = getSupabaseAdmin();
    const [{ data: mods }, { data: arts }] = await Promise.all([
      sb.from('v_university_modules')
        .select('slug, title, description, icon_hint, status, sort_order, dept, audience')
        .order('sort_order', { ascending: true }),
      sb.from('v_university_articles').select('module'),
    ]);
    modules = (mods as ModuleCard[] | null) ?? [];
    for (const a of (arts as { module: string }[] | null) ?? []) {
      counts.set(a.module, (counts.get(a.module) ?? 0) + 1);
    }
  } catch { /* landing still renders */ }
  if (modules.length === 0) modules = FALLBACK_MODULES;

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '20px 24px 60px', fontFamily: SANS }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: INK }}>TBC University</h1>
        <p style={{ margin: '5px 0 0', fontSize: 14.5, lineHeight: 1.6, color: INK_SOFT }}>
          How everything works — ask a question, or open a module guide.
        </p>
      </header>

      <AskWindow />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 20 }}>
        {modules.map((m) => {
          const s = (m.status || '').toLowerCase().replace(/_/g, '-');
          const clickable = s === 'live' || s === 'being-written' || s === 'draft';
          const n = counts.get(m.slug) ?? 0;
          const inner = (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden style={{ fontSize: 17 }}>{ICONS[m.icon_hint ?? ''] ?? '📘'}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: INK }}>{m.title}</span>
                <span style={{ marginLeft: 'auto' }}><StatusBadge status={m.status} /></span>
              </div>
              <div style={{ fontSize: 13.5, color: INK_SOFT, lineHeight: 1.6 }}>{m.description}</div>
              {clickable ? (
                <div style={{ marginTop: 'auto', fontSize: 12, fontWeight: 600, color: GREEN }}>
                  {n > 0 ? `${n} article${n === 1 ? '' : 's'} · ` : ''}open the guide →
                </div>
              ) : (
                <div style={{ marginTop: 'auto', fontSize: 12, fontWeight: 600, color: INK_SOFT }}>
                  This guide is on the way.
                </div>
              )}
            </>
          );
          return clickable ? (
            <a key={m.slug} href={`/university/${m.slug}`} style={{ ...card, borderTop: `3px solid ${GREEN}`, textDecoration: 'none' }}>
              {inner}
            </a>
          ) : (
            <div key={m.slug} style={{ ...card, opacity: 0.65 }}>{inner}</div>
          );
        })}

        <a href="/university/kpis" style={{ ...card, borderTop: `3px solid ${GOLD}`, textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden style={{ fontSize: 17 }}>📊</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: INK }}>KPI dictionary</span>
          </div>
          <div style={{ fontSize: 13.5, color: INK_SOFT, lineHeight: 1.6 }}>
            Every number the dashboards show — what it means in plain words, how it is calculated, and what to watch out for.
          </div>
          <div style={{ marginTop: 'auto', fontSize: 12, fontWeight: 600, color: GREEN }}>open the dictionary →</div>
        </a>
      </div>
    </div>
  );
}
