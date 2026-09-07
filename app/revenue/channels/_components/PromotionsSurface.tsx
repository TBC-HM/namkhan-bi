// app/revenue/channels/_components/PromotionsSurface.tsx
// PBS 2026-08-25: THE promotions implementation. Every promotions route —
// static /revenue/channels/{booking-com,expedia}/promotions, dynamic
// /revenue/channels/[source]/promotions, and every /h/{pid} counterpart —
// renders this and nothing else. Four near-identical copies used to exist;
// three of them carried stale header copy.
//
// propertyId is REQUIRED and has no fallback (L22). The caller resolves it
// from the route param (/h tree) or from the explicit Namkhan constant (the
// legacy unprefixed tree, which is Namkhan-only by construction). A missing
// or non-finite property_id must fail before this component is reached.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { otaChannelForSlug } from '@/lib/ota-promotions';
import ChannelPromotionsPanel, { type PromotionRow } from './ChannelPromotionsPanel';

interface Props {
  /** URL slug, e.g. 'expedia'. Must exist in OTA_PROMOTION_CHANNELS. */
  slug: string;
  /** Verified property scope. No default — callers must resolve it. */
  propertyId: number;
}

export default async function PromotionsSurface({ slug, propertyId }: Props) {
  const cfg = otaChannelForSlug(slug);
  if (!cfg) {
    return (
      <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
        <DashboardPage title="Promotions" subtitle="Unknown channel">
          <div style={{ gridColumn: '1 / -1' }}>
            <Container title="Unknown channel" subtitle={`No OTA is registered for slug "${slug}".`}>
              <p style={noteStyle}>Add it to <code>lib/ota-promotions.ts</code> first.</p>
            </Container>
          </div>
        </DashboardPage>
      </div>
    );
  }

  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    // Fail closed rather than silently falling through to Namkhan.
    return (
      <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
        <DashboardPage title={`${cfg.display} · Promotions`} subtitle="No property scope">
          <div style={{ gridColumn: '1 / -1' }}>
            <Container title="Property scope missing" subtitle="This surface is per-property.">
              <p style={noteStyle}>
                Open it from a property URL — <code>/h/&lt;property_id&gt;/revenue/channels/{cfg.slug}/promotions</code>.
              </p>
            </Container>
          </div>
        </DashboardPage>
      </div>
    );
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('channel_promotions')
    .select('channel, promo_key, label, is_active, cost_pct, cost_flat, notes, programme, member_tier_floor, benefit_kind, valid_from, valid_to')
    .eq('property_id', propertyId)
    .eq('channel', cfg.channel)
    .order('promo_key');

  const initial = (data ?? []) as PromotionRow[];
  const activeCount = initial.filter((r) => r.is_active).length;

  const subtitle = initial.length === 0
    ? `No ${cfg.display} programmes registered for this property yet — add one below.`
    : `${initial.length} programme${initial.length === 1 ? '' : 's'} · ${activeCount} active · property ${propertyId}`;

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage title={`${cfg.display} · Promotions`} subtitle={cfg.programNote}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Activation" subtitle={subtitle}>
            {error ? (
              <p style={{ ...noteStyle, color: '#B04A2F' }}>Could not load promotions: {error.message}</p>
            ) : (
              <ChannelPromotionsPanel
                channel={cfg.channel}
                propertyId={propertyId}
                initial={initial}
              />
            )}
          </Container>
        </div>
      </DashboardPage>
    </div>
  );
}

const noteStyle: React.CSSProperties = {
  margin: 0, fontSize: 13, color: '#3A3A3A', lineHeight: 1.55, padding: '4px 2px',
};
