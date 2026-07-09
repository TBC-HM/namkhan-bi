// app/h/[property_id]/_shared/DeptSubpageStub.tsx
// PBS 2026-07-08 — generic Donna dept-subpage stub. Same shape as the
// existing FinanceStub but reusable across marketing / operations / sales /
// guest so every Donna dept subpage renders identical chrome to its Namkhan
// counterpart: DashboardPage title + auto-computed sub-strip (from
// nav-subgroups.ts based on pathname) + Container body explaining the
// wiring-pending state and pointing at the Namkhan reference.
//
// PBS 2026-07-09: pass DEPT_CFG.<slug>.subPages as `tabs` so the main
// dept strip stays visible when the operator clicks INTO a child page
// (was disappearing on /h/1000001/marketing/campaigns etc — no tabs prop
// meant DashboardPage skipped rendering the TabStrip).

import { redirect } from 'next/navigation';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import type { DeptSlug } from '@/lib/dept-cfg/types';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

interface Props {
  propertyId: number;
  deptLabel: string;     // e.g. "Marketing", "Contacts", "Sales", "Operations"
  routeLabel: string;    // e.g. "Library", "Directory", "Pipeline"
  namkhanPath: string;   // canonical Namkhan URL for the reference implementation
  hint?: string;         // optional 1-liner about what will land here
}

// Derive DEPT_CFG slug from the Namkhan reference path. Falls back to null
// if the first segment doesn't map to a known slug — in that case we render
// without a tab strip rather than crash.
function slugFromNamkhanPath(p: string): DeptSlug | null {
  const first = p.split('/').filter(Boolean)[0] ?? '';
  return (first in DEPT_CFG) ? (first as DeptSlug) : null;
}

export default function DeptSubpageStub({
  propertyId, deptLabel, routeLabel, namkhanPath, hint,
}: Props) {
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect(namkhanPath);

  const slug = slugFromNamkhanPath(namkhanPath);
  const cfg = slug ? DEPT_CFG[slug] : null;
  const subPages = cfg ? rewriteSubPagesForProperty(cfg.subPages ?? [], propertyId) : [];

  // PBS 2026-07-09: mark the current page's tab active so the underline
  // shows PBS which surface he's on. Compare on the tenant-prefixed href.
  const currentHref = `/h/${propertyId}${namkhanPath}`;
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href === currentHref,
  }));

  return (
    <DashboardPage
      title={`${deptLabel} · ${routeLabel}`}
      subtitle={`Donna · property_id=${propertyId} · per-Donna wiring pending`}
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title={`${routeLabel} · awaiting Donna feed`}
          subtitle={`Namkhan source: ${namkhanPath}`}
          density="compact"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720, padding: '4px 2px' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#1B1B1B', lineHeight: 1.55 }}>
              This page is part of the Donna {deptLabel.toLowerCase()} navigation but isn&apos;t wired to
              Donna&apos;s data yet. The canonical implementation lives at{' '}
              <a href={namkhanPath} style={{ color: '#1F3A2E', fontWeight: 600 }}>{namkhanPath}</a>
              {' '}(Namkhan-scoped). Rather than show Namkhan numbers under a Donna URL, we stop here.
            </p>
            {hint && (
              <p style={{ margin: 0, fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>{hint}</p>
            )}
            <p style={{ margin: 0, fontSize: 11, color: '#5A5A5A' }}>
              See <a href={`/h/${propertyId}/finance/pnl`} style={{ color: '#1F3A2E' }}>Donna P&amp;L</a>
              {' '}for the reference per-property implementation pattern.
            </p>
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
