// components/HODTeamPanel.tsx
// Shows the team for the current property: GM + HODs + staff.
// Drops into Users & Roles page or any settings area.

import { createClient } from '@/lib/supabase/server';

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

export default async function HODTeamPanel({ propertyId }: { propertyId: number }) {
  const supabase = createClient();
  const { data: users } = await supabase
    .schema('tenancy')
    .from('property_users')
    .select('full_name, email, role, department, status')
    .eq('property_id', propertyId)
    .eq('status', 'active')
    .order('role', { ascending: true }) // owner before manager
    .order('department', { ascending: true });

  const rows: PropertyUser[] = (users ?? []) as PropertyUser[];

  const gm = rows.find((u) => u.role === 'owner');
  const hods = rows.filter((u) => u.role === 'manager');
  const others = rows.filter((u) => u.role !== 'owner' && u.role !== 'manager');

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--sand,#B8A878)] font-medium mb-2">
          Team
        </h2>
        <h1 className="text-2xl font-serif text-[var(--primary,#1F3A2E)]">
          Property leadership · {rows.length} active
        </h1>
      </header>

      {/* GM card */}
      {gm && (
        <section>
          <h3 className="text-[0.7rem] uppercase tracking-[0.18em] text-[var(--sand,#B8A878)] font-medium mb-3">
            General Manager
          </h3>
          <div className="flex items-center gap-4 p-4 rounded-lg border border-[var(--primary,#1F3A2E)]/15 bg-[var(--primary,#1F3A2E)]/5">
            <div className="w-12 h-12 rounded-full bg-[var(--primary,#1F3A2E)] text-[var(--bg,#F4EFE2)] flex items-center justify-center font-medium">
              {initials(gm.full_name, gm.email)}
            </div>
            <div className="flex-1">
              <p className="text-base font-medium text-[var(--primary,#1F3A2E)]">
                {gm.full_name ?? gm.email}
              </p>
              <p className="text-sm text-[var(--primary,#1F3A2E)]/60">{gm.email}</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--primary,#1F3A2E)]/10 text-[var(--primary,#1F3A2E)]">
              {ROLE_LABEL[gm.role] ?? gm.role}
            </span>
          </div>
        </section>
      )}

      {/* HOD grid */}
      <section>
        <h3 className="text-[0.7rem] uppercase tracking-[0.18em] text-[var(--sand,#B8A878)] font-medium mb-3">
          Heads of Department · {hods.length}
        </h3>
        {hods.length === 0 ? (
          <div className="p-4 rounded-lg border border-dashed border-[var(--sand,#B8A878)]/40 text-sm text-[var(--primary,#1F3A2E)]/50 italic">
            No HODs assigned yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {hods.map((u) => (
              <div
                key={u.email}
                className="flex items-center gap-3 p-3 rounded-lg border border-[var(--sand,#B8A878)]/30 bg-[var(--bg,#F4EFE2)]"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--sand,#B8A878)]/30 text-[var(--primary,#1F3A2E)] flex items-center justify-center text-sm font-medium">
                  {initials(u.full_name, u.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--primary,#1F3A2E)] truncate">
                    {u.full_name ?? u.email}
                  </p>
                  <p className="text-xs text-[var(--primary,#1F3A2E)]/55 truncate">
                    {u.department ? DEPT_LABEL[u.department] ?? u.department : 'HOD'} · {u.email}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Others */}
      {others.length > 0 && (
        <section>
          <h3 className="text-[0.7rem] uppercase tracking-[0.18em] text-[var(--sand,#B8A878)] font-medium mb-3">
            Other team members · {others.length}
          </h3>
          <ul className="space-y-2">
            {others.map((u) => (
              <li key={u.email} className="text-sm text-[var(--primary,#1F3A2E)]/80">
                {u.full_name ?? u.email} <span className="text-[var(--primary,#1F3A2E)]/40">· {ROLE_LABEL[u.role] ?? u.role}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
