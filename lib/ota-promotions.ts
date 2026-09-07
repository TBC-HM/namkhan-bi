// lib/ota-promotions.ts
// PBS 2026-08-25: single source of truth for the OTA promotion surfaces.
// slug ↔ channel key ↔ display name ↔ member programme, in one place, so the
// static per-OTA routes, the dynamic [source] route and the promotions hub can
// never drift apart again (the Expedia page's subtitle had been advertising 3
// programmes while the panel rendered 9).
//
// `channel` MUST match public.channel_promotions.channel exactly.
// `slug` MUST match the URL segment under /revenue/channels/<slug>/promotions.

export interface OtaPromotionChannel {
  slug: string;
  channel: string;
  display: string;
  /** The OTA's member/loyalty programme — the Genius analogue. Tiered on every
   *  major OTA; see lib/ota-member-tiers.ts for the tier ladders. */
  memberProgramme: string;
  /** One-line summary of the programme families the panel exposes. */
  programNote: string;
  /** The member-tier ladder, lowest first, in the OTA's OWN vocabulary.
   *  channel_promotions.member_tier_floor stores one of these keys and means
   *  "this tier AND ABOVE" — both Genius and One Key target a floor, not an
   *  exact tier. Empty array = tier ladder not modelled for this OTA yet
   *  (deliberately empty rather than invented). */
  memberTiers: readonly { key: string; label: string }[];
}

export const OTA_PROMOTION_CHANNELS: readonly OtaPromotionChannel[] = [
  {
    slug: 'booking-com',
    channel: 'booking.com',
    display: 'Booking.com',
    memberProgramme: 'Genius',
    programNote: 'Genius · Preferred · Country · LOS · Weekend · Last-minute · Early-booker',
    // Partner opts into a level; the discount applies to that level and above.
    memberTiers: [
      { key: 'l1', label: 'Level 1 (10%)' },
      { key: 'l2', label: 'Level 2 (15%)' },
      { key: 'l3', label: 'Level 3 (20%)' },
    ],
  },
  {
    slug: 'expedia',
    channel: 'expedia',
    display: 'Expedia',
    memberProgramme: 'One Key',
    programNote: 'One Key · Member-only deals · VIP Access · Accelerator · Package+ · Country · LOS',
    // Blue on join; Silver at 5 trip elements, Gold at 15, Platinum at 30.
    // Member Only Deals target all members (blue) or a floor of silver/gold.
    memberTiers: [
      { key: 'blue',     label: 'Blue (all members)' },
      { key: 'silver',   label: 'Silver+' },
      { key: 'gold',     label: 'Gold+' },
      { key: 'platinum', label: 'Platinum' },
    ],
  },
  {
    slug: 'agoda',
    channel: 'agoda',
    display: 'Agoda',
    memberProgramme: 'AgodaVIP',
    programNote: 'AgodaVIP · Insider Deals · Country · Mobile · LOS',
    memberTiers: [
      { key: 'vip',      label: 'AgodaVIP' },
      { key: 'vip_plus', label: 'AgodaVIP Plus' },
    ],
  },
  {
    slug: 'trip-com',
    channel: 'trip.com',
    display: 'Trip.com',
    memberProgramme: 'Trip Coins',
    programNote: 'Trip Coins · Preferred · Country · App-only · LOS',
    // Ladder not researched — left empty rather than guessed.
    memberTiers: [],
  },
  {
    slug: 'tiket',
    channel: 'tiket',
    display: 'Tiket',
    memberProgramme: 'Tiket Elite',
    programNote: 'Tiket Elite · Country · Flash sale · LOS',
    // Ladder not researched — left empty rather than guessed.
    memberTiers: [],
  },
] as const;

export const OTA_PROMOTION_SLUGS: readonly string[] =
  OTA_PROMOTION_CHANNELS.map((c) => c.slug);

export function otaChannelForSlug(slug: string): OtaPromotionChannel | null {
  return OTA_PROMOTION_CHANNELS.find((c) => c.slug === slug) ?? null;
}

export function otaChannelForKey(channel: string): OtaPromotionChannel | null {
  return OTA_PROMOTION_CHANNELS.find((c) => c.channel === channel) ?? null;
}

/**
 * Resolve a PMS/BI source name (mv_channel_economics.source_name — e.g.
 * "Expedia", "Booking.com", "CM-Agoda", "Trip.com Ltd") to a promotions slug.
 * Returns null for non-OTA sources (direct, DMC, wholesale) — the caller then
 * hides the Promotions action rather than linking to an empty register.
 */
const SOURCE_NAME_PATTERNS: ReadonlyArray<{ re: RegExp; slug: string }> = [
  { re: /booking\.?com/i,        slug: 'booking-com' },
  { re: /expedia|hotels\.com/i,  slug: 'expedia'     },
  { re: /agoda/i,                slug: 'agoda'       },
  { re: /trip\.?com|ctrip/i,     slug: 'trip-com'    },
  { re: /tiket/i,                slug: 'tiket'       },
];

export function otaSlugForSourceName(sourceName: string): string | null {
  if (!sourceName) return null;
  return SOURCE_NAME_PATTERNS.find((p) => p.re.test(sourceName))?.slug ?? null;
}

/** What the guest actually receives. cost_pct only means a rate cut for
 *  'rate_discount'; for value_add / visibility it is not a discount at all,
 *  which is why every non-discount row used to sit at null and read as free. */
export const BENEFIT_KINDS: readonly { key: string; label: string }[] = [
  { key: 'rate_discount', label: 'Rate discount' },
  { key: 'value_add',     label: 'Value add (perk)' },
  { key: 'visibility',    label: 'Visibility boost' },
  { key: 'loyalty',       label: 'Loyalty enrolment' },
  { key: 'commission',    label: 'Commission uplift' },
];
