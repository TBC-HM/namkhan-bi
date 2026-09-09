// components/settings/SectionSidebar.tsx
// Server component — left rail for /settings/property/[section].

import TenantLink from '@/components/nav/TenantLink';
import type { SettingsSectionSummary } from '@/lib/settings';

interface Props {
  sections: SettingsSectionSummary[];
  active: string;
  /** Carried into every section link so picking a tenant once sticks across the rail. */
  propertyId?: number | null;
}

export default function SectionSidebar({ sections, active, propertyId }: Props) {
  const q = propertyId != null ? `?property_id=${propertyId}` : '';
  return (
    <nav className="settings-sidebar">
      <div className="settings-sidebar-head text-mono">{sections.length} sections</div>
      {sections.map((s) => {
        const isActive = s.section_code === active;
        return (
          <TenantLink
            key={s.section_code}
            href={`/settings/property/${s.section_code}${q}`}
            className={`settings-sidebar-item${isActive ? ' active' : ''}`}
          >
            <div className="settings-sidebar-name">{s.display_name}</div>
            <div className="settings-sidebar-meta text-mono">
              {s.missing ? 'disconnected · no table' : s.source_table}
            </div>
          </TenantLink>
        );
      })}
      <TenantLink href={`/settings/property/brief${q}`} className="settings-sidebar-item brief">
        <div className="settings-sidebar-name">AI agent brief</div>
        <div className="settings-sidebar-meta text-mono">markdown · derived</div>
      </TenantLink>
    </nav>
  );
}
