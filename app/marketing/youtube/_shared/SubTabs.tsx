// app/marketing/youtube/_shared/SubTabs.tsx
// PBS 2026-07-13 — YT area is split into 4 sub-pages. This strip renders as a
// second-level nav under the DashboardPage marketing tabs.
import Link from 'next/link';

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';

const SUBTABS: Array<{ key: string; label: string; href: string }> = [
  { key: 'dashboard',  label: 'Dashboard',  href: '/marketing/youtube/dashboard' },
  { key: 'playlists',  label: 'Playlists',  href: '/marketing/youtube/playlists' },
  { key: 'planning',   label: 'Planning',   href: '/marketing/youtube/planning' },
  { key: 'production', label: 'Production', href: '/marketing/youtube/production' },
];

export default function YtSubTabs({ current }: { current: 'dashboard' | 'playlists' | 'planning' | 'production' }) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${HAIR}`, marginBottom: 12, gridColumn: '1 / -1' }}>
      {SUBTABS.map((t) => {
        const active = t.key === current;
        return (
          <Link key={t.key} href={t.href} style={{
            padding: '8px 14px', fontSize: 12, letterSpacing: '.05em', textTransform: 'uppercase',
            textDecoration: 'none',
            color: active ? FOREST : INK_M,
            borderBottom: active ? `2px solid ${FOREST}` : '2px solid transparent',
            fontWeight: active ? 700 : 500, marginBottom: -1,
          }}>{t.label}</Link>
        );
      })}
    </div>
  );
}
