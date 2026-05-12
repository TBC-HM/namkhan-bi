// app/h/[property_id]/page.tsx
// v3: Namkhan renders DeptEntry directly. Non-Namkhan properties get a real
// welcome dashboard listing module status (active / planned / disabled).
//
// BUGFIX (2026-05-12): v2 used ModuleStateGate with moduleCode="platform_required"
// — which is `active` for every property — so it rendered the (empty) children
// instead of a roadmap placeholder. That's why /h/1000001 was a blank cream page.

import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

const NAMKHAN_PROPERTY_ID = 260955;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ModuleRow = { module_code: string; status: 'active' | 'planned' | 'disabled' };

const MODULE_LABEL: Record<string, string> = {
  revenue: 'Revenue',
  sales: 'Sales',
  marketing: 'Marketing',
  operations: 'Operations',
  finance: 'Finance',
  guest_crm: 'Guest CRM',
  frontoffice: 'Front Office',
  fb_pos: 'F&B / POS',
  hr_people: 'HR & People',
  spa: 'Spa & Wellness',
  activities: 'Activities',
  utilities: 'Utilities',
  platform_required: 'Platform',
};

const MODULE_HREF: Record<string, string> = {
  revenue: 'revenue',
  sales: 'sales',
  marketing: 'marketing',
  operations: 'operations',
  finance: 'finance',
  guest_crm: 'guest',
  frontoffice: 'guest',
  fb_pos: 'operations',
  hr_people: 'operations',
  spa: 'guest',
  activities: 'guest',
  utilities: 'it',
};

export default async function PropertyHome({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) {
    return <DeptEntry cfg={DEPT_CFG.architect} />;
  }

  const supabase = createClient();
  const [{ data: identity }, { data: modulesRaw }] = await Promise.all([
    supabase
      .schema('property')
      .from('identity')
      .select('trading_name, legal_name, star_rating')
      .eq('property_id', propertyId)
      .maybeSingle(),
    supabase.rpc('get_property_modules', { p_property_id: propertyId }),
  ]);

  const modules: ModuleRow[] = (modulesRaw ?? []) as ModuleRow[];
  const active = modules.filter((m) => m.status === 'active' && m.module_code !== 'platform_required');
  const planned = modules.filter((m) => m.status === 'planned');

  const propertyName = identity?.trading_name ?? 'Property';

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--primary)]">
      <div className="max-w-5xl mx-auto px-8 py-16">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--primary)]/50 mb-2">
            Property Home
          </p>
          <h1 className="text-4xl font-serif mb-2">{propertyName}</h1>
          {identity?.legal_name && (
            <p className="text-sm text-[var(--primary)]/60">
              {identity.legal_name}
              {identity.star_rating ? ` · ${'★'.repeat(identity.star_rating)}` : ''}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="rounded-lg border border-[var(--sand)]/30 bg-[var(--surface)]/60 p-6">
            <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--primary)]/70 mb-4">
              Active modules · {active.length}
            </h2>
            {active.length === 0 ? (
              <p className="text-sm text-[var(--primary)]/50">
                No operational modules active yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {active.map((m) => (
                  <li key={m.module_code}>
                    <Link
                      href={`/h/${propertyId}/${MODULE_HREF[m.module_code] ?? m.module_code}`}
                      className="flex items-center justify-between py-2 px-3 -mx-3 rounded hover:bg-[var(--sand)]/15 transition-colors"
                    >
                      <span className="text-sm font-medium">
                        {MODULE_LABEL[m.module_code] ?? m.module_code}
                      </span>
                      <span className="text-xs text-[var(--primary)]/40">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-[var(--sand)]/30 bg-[var(--surface)]/40 p-6">
            <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--primary)]/70 mb-4">
              Planned · {planned.length}
            </h2>
            {planned.length === 0 ? (
              <p className="text-sm text-[var(--primary)]/50">No planned modules.</p>
            ) : (
              <ul className="space-y-1.5">
                {planned.map((m) => (
                  <li
                    key={m.module_code}
                    className="text-sm text-[var(--primary)]/60 flex items-center justify-between"
                  >
                    <span>{MODULE_LABEL[m.module_code] ?? m.module_code}</span>
                    <span
                      className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(184, 84, 42, 0.08)',
                        color: 'var(--terracotta)',
                      }}
                    >
                      Planned
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-[var(--sand)]/20 flex items-center gap-6 text-sm">
          <Link
            href={`/h/${propertyId}/settings/property`}
            className="text-[var(--primary)]/70 hover:text-[var(--primary)] transition-colors"
          >
            Settings →
          </Link>
          <Link
            href={`/h/${propertyId}/it`}
            className="text-[var(--primary)]/70 hover:text-[var(--primary)] transition-colors"
          >
            IT →
          </Link>
          <span className="text-xs text-[var(--primary)]/30 ml-auto">
            Property ID: {propertyId}
          </span>
        </div>
      </div>
    </div>
  );
}
