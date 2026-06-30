// app/_components/registry/ChannelDrillDrawer.tsx
// PBS #199 (2026-05-24) — clicking a source row on /revenue/channels opens
// this right-side drawer with a compact summary + a big CTA to the full
// per-channel page at /revenue/channels/<encoded source>. Booking.com's
// hardwired Bdc* panels live on that full page already.
//
// PBS 2026-06-29:
//   - Tile footnotes added so every number has a "what is this" line.
//   - Instant-close: local state hides drawer immediately on X / scrim / ESC,
//     URL update happens in background (was waiting on full server re-render).
//   - DMC contract info panel: when the source matches a partner in
//     governance.dmc_contracts (via matchSourceToContract), render expiry +
//     contact + a preview link to the signed PDF.
//
// State via URL: ?drill=<encoded source_name>. Close strips the param via
// router.push, same pattern as DrillDrawer (#145). Drawer primitive is the
// canonical right-side overlay (app/(cockpit)/_design/overlay/Drawer.tsx).
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Drawer, KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';
import type { DmcContract } from '@/lib/dmc';
// PBS 2026-06-29: import the pure matcher from the client-safe sub-module
// (lib/dmc.ts pulls the server-only admin client at top level).
import { matchSourceToContract } from '@/lib/dmc-match';

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
  /** Optional — when provided, drawer matches the source to a contract and
   * renders the contract preview + key fields below the KPI tiles. */
  dmcContracts?: DmcContract[];
}

export default function ChannelDrillDrawer({ rows, currencyCode, basePath, dmcContracts = [] }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const drill = sp?.get('drill') ?? '';

  // PBS 2026-06-29: local "dismissed" so the drawer hides instantly on X,
  // independent of the page-level re-render that the URL push triggers.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    // Re-arm on a new ?drill= URL.
    if (drill) setDismissed(false);
  }, [drill]);

  const active = useMemo(
    () => (drill ? rows.find((r) => r.source_name === drill) : undefined),
    [drill, rows],
  );

  const onClose = useCallback(() => {
    setDismissed(true);                  // instant UI hide
    const params = new URLSearchParams(sp?.toString() ?? '');
    params.delete('drill');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);  // URL/state catch-up
  }, [router, pathname, sp]);

  // PBS 2026-06-30 FIX: ALL hooks must run before any early return. Moved
  // matched useMemo above the !drill||dismissed gate. (Previous order caused
  // "rendered fewer hooks than expected" — the client-side crash.)
  const matched = useMemo(() => {
    if (!drill || dmcContracts.length === 0) return null;
    const m = matchSourceToContract(drill, dmcContracts);
    if (!m.contract_id) return null;
    return dmcContracts.find((c) => c.contract_id === m.contract_id) ?? null;
  }, [drill, dmcContracts]);

  if (!drill || dismissed) return null;
  const fullPageHref = `${basePath}/${encodeURIComponent(drill)}`;
  const isBdc = /Booking\.com/i.test(drill);

  const tiles: KpiTileProps[] = active
    ? [
        { label: 'Bookings',     value: active.bookings, size: 'sm', footnote: 'count this window' },
        { label: 'Revenue',      value: Math.round(active.gross_revenue), currency: currencyCode, size: 'sm', footnote: 'gross, before commission' },
        { label: 'ADR',          value: Math.round(active.adr), currency: currencyCode, size: 'sm', footnote: 'avg daily rate' },
        {
          label: 'Commission',
          value: `${Number(active.commission_pct).toFixed(1)}%`,
          size: 'sm',
          status: Number(active.commission_pct) >= 18 ? 'red' : Number(active.commission_pct) >= 12 ? 'amber' : 'green',
          footnote: 'paid to channel',
        },
        {
          label: 'Cancel rate',
          value: `${Number(active.cancel_pct).toFixed(1)}%`,
          size: 'sm',
          status: Number(active.cancel_pct) >= 25 ? 'red' : Number(active.cancel_pct) >= 10 ? 'amber' : 'green',
          footnote: 'cancelled / total',
        },
        { label: 'Lead time', value: `${Math.round(active.avg_lead_days)}d`, size: 'sm', footnote: 'booking → arrival' },
        { label: 'LOS',       value: Number(active.avg_los).toFixed(1),     size: 'sm', footnote: 'nights / stay' },
        ...(active.roomnights != null
          ? [{ label: 'Room nights', value: active.roomnights, size: 'sm' as const, footnote: 'total nights sold' }]
          : []),
      ]
    : [];

  return (
    <Drawer
      open={true}
      onClose={onClose}
      title={drill}
      subtitle={isBdc ? 'Booking.com · hardwired data on full page' : `Channel summary · ${active ? 'click "Open full page" for daily trend + room mix' : 'no bookings in active window'}`}
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

      {matched && <DmcContractPanel contract={matched} />}
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// DMC contract block — surfaces the "gold" metadata + a PDF preview link.
// Matches /sales/b2b's contract detail surface so the user has parity between
// the channels drawer and the b2b detail page.
// ─────────────────────────────────────────────────────────────────────────
function DmcContractPanel({ contract }: { contract: DmcContract }) {
  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const today = new Date();
  const expiry = contract.expiry_date ? new Date(contract.expiry_date) : null;
  const daysToExpiry = expiry ? Math.round((expiry.getTime() - today.getTime()) / 86_400_000) : null;
  const expiryTone =
    daysToExpiry == null ? 'flat' :
    daysToExpiry < 0  ? 'red'  :
    daysToExpiry < 90 ? 'amber' : 'green';

  const previewHref = contract.pdf_storage_path
    ? `/api/legal/docs/file/${encodeURIComponent(contract.contract_id)}?bucket=documents-confidential&path=${encodeURIComponent(contract.pdf_storage_path)}&mode=preview`
    : null;
  const partnerHref = `/sales/b2b/partner/${encodeURIComponent(contract.contract_id)}`;

  return (
    <section style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink, #1B1B1B)' }}>
          DMC Contract · {contract.partner_short_name}
        </h3>
        <Link href={partnerHref} style={{ fontSize: 11, color: 'var(--primary, #1F3A2E)', textDecoration: 'underline' }}>
          Open in B2B →
        </Link>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: 12 }}>
        <Field label="Status"      value={contract.status ?? '—'} />
        <Field label="Partner type" value={contract.partner_type ?? '—'} />
        <Field label="Country"     value={`${contract.country_flag ?? ''} ${contract.country ?? '—'}`.trim()} />
        <Field label="Signed"      value={fmtDate(contract.signed_date)} />
        <Field
          label={daysToExpiry != null && daysToExpiry < 0 ? 'Expired' : 'Expires'}
          value={
            daysToExpiry == null
              ? fmtDate(contract.expiry_date)
              : `${fmtDate(contract.expiry_date)} · ${Math.abs(daysToExpiry)}d ${daysToExpiry < 0 ? 'ago' : 'left'}`
          }
          tone={expiryTone}
        />
        <Field label="Pricing"     value={contract.pricing_model ?? '—'} />
        {Number(contract.commission_pct) > 0 && (
          <Field label="Commission"  value={`${Number(contract.commission_pct).toFixed(1)}%`} />
        )}
        {Number(contract.group_surcharge_pct) > 0 && (
          <Field label="Group surcharge" value={`${Number(contract.group_surcharge_pct).toFixed(0)}% over ${contract.group_threshold ?? 0} pax`} />
        )}
      </div>

      {/* Contact block */}
      {(contract.contact_name || contract.contact_email || contract.contact_phone) && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--paper-warm, #FAFAFA)', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 4, fontSize: 12 }}>
          <div style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-soft, #5A5A5A)', marginBottom: 6 }}>
            Primary contact
          </div>
          {contract.contact_name && <div style={{ fontWeight: 600 }}>{contract.contact_name}{contract.contact_role ? ` · ${contract.contact_role}` : ''}</div>}
          {contract.contact_email && <div><a href={`mailto:${contract.contact_email}`} style={{ color: 'var(--primary, #1F3A2E)' }}>{contract.contact_email}</a></div>}
          {contract.contact_phone && <div style={{ color: 'var(--ink-soft, #5A5A5A)' }}>{contract.contact_phone}</div>}
          {contract.address && <div style={{ color: 'var(--ink-soft, #5A5A5A)', marginTop: 4 }}>{contract.address}</div>}
        </div>
      )}

      {/* PDF preview */}
      {previewHref ? (
        <div style={{ marginTop: 12 }}>
          <a href={previewHref} target="_blank" rel="noopener noreferrer" style={pdfBtnStyle}>
            📄 Preview signed contract PDF
          </a>
        </div>
      ) : (
        <div style={{ marginTop: 12, padding: 10, background: 'var(--paper, #FAFAFA)', border: '1px dashed var(--hairline, #E6DFCC)', borderRadius: 4, fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>
          No signed PDF on file. Upload via /sales/b2b once countersigned.
        </div>
      )}
    </section>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: 'flat' | 'red' | 'amber' | 'green' }) {
  const color =
    tone === 'red'   ? 'var(--st-bad-tx, #b03826)' :
    tone === 'amber' ? 'var(--st-warn-tx, #8a6418)' :
    tone === 'green' ? 'var(--moss-glow, #4F9B8E)' :
    'var(--ink, #1B1B1B)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-soft, #5A5A5A)' }}>{label}</span>
      <span style={{ fontWeight: 600, color }}>{value}</span>
    </div>
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

const pdfBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  background: 'var(--paper-warm, #FFFFFF)',
  color: 'var(--ink, #1B1B1B)',
  border: '1px solid var(--ink, #1B1B1B)',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 500,
  textDecoration: 'none',
};

const emptyStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--ink-soft, #5A5A5A)',
  fontStyle: 'italic',
};
