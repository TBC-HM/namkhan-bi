// app/h/[property_id]/[...rest]/page.tsx
//
// PBS 2026-05-15: catch-all fallback so every /h/{id}/* URL lands somewhere
// clean instead of 404 or a content bleed to Namkhan.
//
// Next.js routes CONCRETE pages first. So this file only renders when no
// dedicated /h/{id}/{path} page exists. Every menu button across every
// dept that doesn't have a per-property implementation lands here.
//
// Strategy:
//   • For Namkhan (260955) — redirect to the legacy global path (/sales,
//     /marketing, /operations, etc.) which has the full implementation.
//   • For any other property — render an honest "under construction"
//     stub with the right dept theme + nav strip + a link to the Namkhan
//     reference page. Donna stays in Donna palette via the data-property
//     attribute already set by the root layout.

import { redirect, notFound } from 'next/navigation';
import TenantLink from '@/components/nav/TenantLink';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { getDeptCfg, NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import type { DeptSlug } from '@/lib/dept-cfg/types';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_PROPERTIES: Record<number, string> = {
  260955:  'The Namkhan',
  1000001: 'Donna Portals',
};

const KNOWN_DEPTS: ReadonlySet<DeptSlug> = new Set<DeptSlug>([
  'revenue', 'sales', 'marketing', 'operations', 'finance', 'guest', 'it', 'architect',
]);

interface Props {
  params: { property_id: string; rest: string[] };
  // PBS 2026-07-16: catch-all now takes searchParams so we can preserve the
  // query string during the Namkhan redirect. Without this, ?dept=revenue
  // on /h/260955/cockpit/chat vanished → /cockpit/chat received no dept →
  // fell back to Felix instead of Vector.
  searchParams?: Record<string, string | string[] | undefined>;
}

export default function CatchAllPropertyPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (!KNOWN_PROPERTIES[propertyId]) notFound();

  const rest = params.rest ?? [];
  const pathTail = '/' + rest.join('/');

  // Namkhan default → forward to the canonical global page if it exists.
  // The global pages live at /<dept>/<sub> (Namkhan's legacy URL tree).
  if (propertyId === NAMKHAN_PROPERTY_ID) {
    const qs = searchParams
      ? new URLSearchParams(
          Object.entries(searchParams).flatMap(([k, v]) =>
            Array.isArray(v) ? v.map((vv) => [k, vv] as [string, string])
            : v != null ? [[k, String(v)] as [string, string]]
            : []
          )
        ).toString()
      : '';
    redirect(qs ? `${pathTail}?${qs}` : pathTail);
  }

  const propertyLabel = KNOWN_PROPERTIES[propertyId];
  const deptSlug = rest[0] as DeptSlug | undefined;
  const subSlug  = rest[1];
  const namkhanRefPath = pathTail;

  // If the first segment isn't a recognised dept, render a generic stub.
  if (!deptSlug || !KNOWN_DEPTS.has(deptSlug)) {
    return (
      <Page
        eyebrow={`${propertyLabel} · ${pathTail}`}
        title={
          <>
            Page not yet wired ·{' '}
            <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{propertyLabel}</em>
          </>
        }
      >
        <Panel title={`${pathTail} · per-${propertyLabel.split(' ')[0]} wiring pending`}>
          <div style={{ padding: 18, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', maxWidth: 720 }}>
            <p style={{ marginTop: 0 }}>
              This URL is in the property-scoped tree but doesn&apos;t have a per-property
              implementation yet. The canonical Namkhan version lives at{' '}
              <a href={namkhanRefPath} style={{ color: 'var(--brass)' }}>{namkhanRefPath}</a>.
            </p>
          </div>
        </Panel>
      </Page>
    );
  }

  // Recognised dept — use its sub-pages strip (property-scoped) so the nav
  // is correct even on an unwired page.
  const cfg = getDeptCfg(deptSlug, propertyId);
  const deptLabel = cfg.pillTitle;
  const deptHod = cfg.hodName;
  const routeLabel = subSlug
    ? subSlug.charAt(0).toUpperCase() + subSlug.slice(1).replace(/-/g, ' ')
    : deptLabel;

  return (
    <Page
      eyebrow={`${deptLabel} · ${routeLabel} · ${propertyLabel}`}
      title={
        <>
          {routeLabel} ·{' '}
          <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>
            {propertyLabel}
          </em>
        </>
      }
      subPages={rewriteSubPagesForProperty(cfg.subPages ?? [], propertyId)}
    >
      <Panel
        title={`${routeLabel} · per-${propertyLabel.split(' ')[0]} wiring pending`}
        eyebrow={`Namkhan reference: ${namkhanRefPath}`}
      >
        <div style={{ padding: 18, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', maxWidth: 760 }}>
          <p style={{ marginTop: 0 }}>
            This {deptLabel.toLowerCase()} page is part of {propertyLabel}&apos;s navigation but
            hasn&apos;t been wired to {propertyLabel.split(' ')[0]}&apos;s data yet. The canonical
            implementation lives at{' '}
            <a href={namkhanRefPath} style={{ color: 'var(--brass)' }}>{namkhanRefPath}</a>{' '}
            (Namkhan-scoped). Rather than show Namkhan numbers under a {propertyLabel} URL, we
            stop here.
          </p>
          <p style={{ color: 'var(--ink-mute)' }}>
            <strong>HoD:</strong> {deptHod} — chat from{' '}
            <TenantLink href={`/h/${propertyId}/${deptSlug}`} style={{ color: 'var(--brass)' }}>
              /h/{propertyId}/{deptSlug}
            </TenantLink>
            .
          </p>
          <p style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-xs)', marginBottom: 0 }}>
            Wiring this page = the same pattern as{' '}
            <TenantLink href={`/h/${propertyId}/finance/pnl`} style={{ color: 'var(--brass)' }}>
              /h/{propertyId}/finance/pnl
            </TenantLink>{' '}
            (the reference per-property implementation).
          </p>
        </div>
      </Panel>
    </Page>
  );
}
