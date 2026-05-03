// components/settings/SectionSidebar.tsx
// Server component — left rail for /settings/property/[section].

import Link from 'next/link';
import type { SectionRow } from '@/lib/settings';

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

interface Props {
  sections: SectionRow[];
  active: string;
}

export default function SectionSidebar({ sections, active }: Props) {
  return (
    <nav className="settings-sidebar">
      <div className="settings-sidebar-head text-mono">15 sections</div>
      {sections.map((s) => {
        const isActive = s.section_code === active;
        return (
          <Link
            key={s.section_code}
            href={`/settings/property/${s.section_code}`}
            className={`settings-sidebar-item${isActive ? ' active' : ''}`}
          >
            <div className="settings-sidebar-name">{s.display_name}</div>
            <div className="settings-sidebar-meta text-mono">
              {s.row_count} {s.row_count === 1 ? 'item' : 'items'} · {relTime(s.last_edited)}
            </div>
          </Link>
        );
      })}
      <Link href="/settings/property/brief" className="settings-sidebar-item brief">
        <div className="settings-sidebar-name">AI agent brief</div>
        <div className="settings-sidebar-meta text-mono">markdown · derived</div>
      </Link>
    </nav>
  );
}
