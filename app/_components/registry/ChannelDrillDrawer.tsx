// app/_components/registry/ChannelDrillDrawer.tsx
// PBS #199 (2026-05-24) — clicking a source row on /revenue/channels opens
// this right-side drawer with a compact summary + a big CTA to the full
// per-channel page at /revenue/channels/<encoded source>. Booking.com's
// hardwired Bdc* panels live on that full page already.
//
// State via URL: ?drill=<encoded source_name>. Close strips the param via
// router.push, same pattern as DrillDrawer (#145). Drawer primitive is the
// canonical right-side overlay (app/(cockpit)/_design/overlay/Drawer.tsx).
'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Drawer, KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';

export interface ChannelDrillRow {
  source_name: string;
  bookings: number;
  gross_revenue: number;
  adr: number;
  commission_pct: number;
  cancel_pct: number;
  avg_lead_days: number;
  avg_los: number;
  roomnights?: number;
}

interface Props {
  rows: ChannelDrillRow[];
  currencyCode: 'USD' | 'EUR';
  basePath: string;
}

export default function ChannelDrillDrawer({ rows, currencyCode, basePath }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const drill = sp?.get('drill') ?? '';

  const active = useMemo(
    () => (drill ? rows.find((r) => r.source_name === drill) : undefined),
    [drill, rows],
  );

  const onClose = useCallback(() => {
    const params = new URLSearchParams(sp?.toString() ?? '');
    params.delete('drill');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [router, pathname, sp]);

  if (!drill) return null;
  const fullPageHref = `${basePath}/${encodeURIComponent(drill)}`;
  const isBdc = /Booking\.com/i.test(drill);

  const tiles: KpiTileProps[] = active
    ? [
        { label: 'Bookings', value: active.bookings, size: 'sm' },
        { label: 'Revenue', value: Math.round(active.gross_revenue), currency: currencyCode, size: 'sm' },
        { label: 'ADR', value: Math.round(active.adr), currency: currencyCode, size: 'sm' },
        {
          label: 'Commission',
          value: `${Number(active.commission_pct).toFixed(1)}%`,
          size: 'sm',
          status: Number(active.commission_pct) >= 18 ? 'red' : Number(active.commission_pct) >= 12 ? 'amber' : 'green',
        },
        {
          label: 'Cancel rate',
          value: `${Number(active.cancel_pct).toFixed(1)}%`,
          size: 'sm',
          status: Number(active.cancel_pct) >= 25 ? 'red' : Number(active.cancel_pct) >= 10 ? 'amber' : 'green',
        },
        { label: 'Lead time', value: `${Math.round(active.avg_lead_days)}d`, size: 'sm' },
        { label: 'LOS', value: Number(active.avg_los).toFixed(1), size: 'sm', footnote: 'nights/stay' },
        ...(active.roomnights != null
          ? [{ label: 'Room nights', value: active.roomnights, size: 'sm' as const }]
          : []),
      ]
    : [];

  return (
    <Drawer
      open={true}
      onClose={onClose}
      title={drill}
      subtitle={isBdc ? 'Booking.com · hardwired data on full page' : 'Channel summary · click "Open full page" for daily trend + room mix'}
      width="lg"
      footer={
        <Link href={fullPageHref} style={ctaStyle} onClick={onClose}>
          Open full page →
        </Link>
      }
    >
      {active ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {tiles.map((t, i) => (
            <KpiTile key={i} {...t} />
          ))}
        </div>
      ) : (
        <p style={emptyStyle}>
          No summary for <strong>{drill}</strong> in the active window. Open the full page for historical detail.
        </p>
      )}
    </Drawer>
  );
}

const ctaStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '8px 16px',
  background: 'var(--primary, #1F3A2E)',
  color: '#FFFFFF',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  textDecoration: 'none',
};

const emptyStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--ink-soft, #5A5A5A)',
  fontStyle: 'italic',
};
