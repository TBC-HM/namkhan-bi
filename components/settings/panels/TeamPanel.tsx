// components/settings/panels/TeamPanel.tsx
// Settings tab 12: Team. Shows GM + HODs + other staff for the current property.

import { PanelHeader, Section, EmptyState } from './_shared';

type PropertyUser = {
  full_name: string | null;
  email: string;
  role: string;
  department: string | null;
  status: string;
};

const DEPT_LABEL: Record<string, string> = {
  fnb: 'F&B',
  sales: 'Sales',
  marketing: 'Marketing',
  finance: 'Finance',
  hk: 'Housekeeping',
  frontoffice: 'Front Office',
  spa: 'Spa & Wellness',
  maintenance: 'Maintenance',
  hr: 'HR',
  ops: 'Operations',
};

const ROLE_LABEL: Record<string, string> = {
  owner: 'General Manager',
  manager: 'Head of Department',
  staff: 'Staff',
  admin: 'Admin',
  viewer: 'Viewer',
  agent: 'Agent',
};

function initials(name: string | null, email: string): string {
  const source = name && name.trim().length > 0 ? name : email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function TeamPanel({ data }: { data: PropertyUser[] }) {
  const users = data ?? [];
  const gm = users.find((u) => u.role === 'owner');
  const hods = users.filter((u) => u.role === 'manager');
  const others = users.filter((u) => u.role !== 'owner' && u.role !== 'manager');

  if (users.length === 0) {
    return (
      <div className="p-8">
        <PanelHeader title="Team" subtitle="Property leadership & department heads" />
        <EmptyState message="No team members assigned yet." />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <PanelHeader
        title="Team"
        subtitle={`${users.length} active member${users.length === 1 ? '' : 's'}`}
      />

      {gm && (
        <Section title="General Manager">
          <div
            className="flex items-center gap-4 p-4 rounded-lg"
            style={{ border: '1px solid var(--border)', background: 'var(--paper-deep)' }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-medium"
              style={{ background: 'var(--brass)', color: 'var(--paper-deep)' }}
            >
              {initials(gm.full_name, gm.email)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate" style={{ fontSize: 'var(--t-md)', color: 'var(--ink)' }}>
                {gm.full_name ?? gm.email}
              </p>
              <p className="truncate" style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>
                {gm.email}
              </p>
            </div>
            <span
              className="px-2 py-1 rounded-full whitespace-nowrap"
              style={{ fontSize: 'var(--t-xs)', background: 'var(--card)', color: 'var(--ink-soft)' }}
            >
              {ROLE_LABEL[gm.role] ?? gm.role}
            </span>
          </div>
        </Section>
      )}

      <Section title={`Heads of Department · ${hods.length}`}>
        {hods.length === 0 ? (
          <EmptyState message="No HODs assigned yet." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {hods.map((u) => (
              <div
                key={u.email}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{ border: '1px solid var(--border)', background: 'var(--paper-deep)' }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-medium"
                  style={{ fontSize: 'var(--t-sm)', background: 'var(--card)', color: 'var(--brass)' }}
                >
                  {initials(u.full_name, u.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>
                    {u.full_name ?? u.email}
                  </p>
                  <p className="truncate" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                    {u.department ? DEPT_LABEL[u.department] ?? u.department : 'HOD'} · {u.email}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {others.length > 0 && (
        <Section title={`Other team members · ${others.length}`}>
          <ul className="space-y-2">
            {others.map((u) => (
              <li
                key={u.email}
                className="flex items-center gap-3"
                style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}
              >
                <span>{u.full_name ?? u.email}</span>
                <span style={{ color: 'var(--ink-faint)' }}>·</span>
                <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                  {ROLE_LABEL[u.role] ?? u.role}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
