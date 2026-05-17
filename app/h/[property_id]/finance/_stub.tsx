// app/h/[property_id]/finance/_stub.tsx
//
// Shared stub renderer for Donna finance sub-pages that exist in the Namkhan
// nav strip but haven't been per-property-wired yet. Renders a clear
// "under construction" body with the right Donna nav so PBS doesn't see
// Namkhan content bleeding through.
//
// For Namkhan, the per-property routes redirect to the global /finance/*
// surface (which is the canonical Namkhan implementation today).
//
// PBS 2026-05-15. Replace these stubs with actual Donna-wired pages once
// per-property data flows are in (P&L is the only one done so far — see
// /h/[property_id]/finance/pnl).

import { redirect } from 'next/navigation';
import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

interface Props {
  propertyId: number;
  routeLabel: string;          // 'Ledger'  · 'Transactions' · ...
  namkhanPath: string;         // '/finance/ledger'
  hint?: string;               // optional one-liner about what this page will hold
}

export default function FinanceStub({ propertyId, routeLabel, namkhanPath, hint }: Props) {
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect(namkhanPath);

  return (
    <Page
      eyebrow={`Finance · ${routeLabel} · Donna`}
      title={
        <>
          {routeLabel} ·{' '}
          <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>Donna</em>
        </>
      }
      subPages={financeSubPagesForProperty(propertyId)}
    >
      <Panel
        title={`${routeLabel} · per-Donna wiring pending`}
        eyebrow={`Namkhan source: ${namkhanPath}`}
      >
        <div style={{ padding: 18, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', maxWidth: 720 }}>
          <p style={{ marginTop: 0 }}>
            This page is part of the Donna finance navigation but isn&apos;t wired to
            Donna&apos;s data yet. The canonical implementation lives at{' '}
            <a href={namkhanPath} style={{ color: 'var(--brass)' }}>{namkhanPath}</a>{' '}
            (Namkhan-scoped). Rather than show Namkhan numbers under a Donna URL, we
            stop here.
          </p>
          {hint && (
            <p style={{ color: 'var(--ink-mute)', fontStyle: 'italic' }}>{hint}</p>
          )}
          <p style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-xs)' }}>
            See <Link href={`/h/${propertyId}/finance/pnl`} style={{ color: 'var(--brass)' }}>Donna P&amp;L</Link>
            {' '}for the reference per-property implementation pattern.
          </p>
        </div>
      </Panel>
    </Page>
  );
}
