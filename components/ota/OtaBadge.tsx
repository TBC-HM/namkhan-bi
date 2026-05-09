// components/ota/OtaBadge.tsx
// Server component — tiny brand-coloured tile + OTA name. Lookup is
// case-insensitive and tolerant of common variants ("Booking.com PSM",
// "BOOKING_COM", etc.). When the source is not a recognised OTA the
// MaybeOtaBadge wrapper falls back to plain text so existing
// (non-OTA) source labels remain untouched.
//
// Brand hex sourced from each OTA's media kit, simplified to a single
// dominant color per brand. Mirrors the PlatformBadge pattern in
// /app/marketing/social/page.tsx.

import * as React from 'react';

type Tint = { bg: string; fg: string; letter: string };

// Keys are the canonical lower-case slug. Lookups normalise input first.
const OTA_TINT: Record<string, Tint> = {
  booking:   { bg: '#003580', fg: '#ffffff', letter: 'B' },
  expedia:   { bg: '#FFC72C', fg: '#000000', letter: 'E' },
  stripe:    { bg: '#635BFF', fg: '#ffffff', letter: 'S' },
  airbnb:    { bg: '#FF5A5F', fg: '#ffffff', letter: 'A' },
  agoda:     { bg: '#5392F9', fg: '#ffffff', letter: 'A' },
  trip:      { bg: '#287DFA', fg: '#ffffff', letter: 'T' },
  hotels:    { bg: '#D32F2F', fg: '#ffffff', letter: 'H' },
};

// Map raw user-facing strings to the slug keys above. Whitespace and
// punctuation are stripped, then we test against ordered patterns.
function resolveOtaKey(raw: string): string | null {
  if (!raw) return null;
  const norm = raw.toLowerCase();
  // Order matters — `hotels.com` must beat the bare "hotel" word.
  if (/booking(\.com|_com)?\b|\bbdc\b/.test(norm)) return 'booking';
  if (/\bexpedia\b/.test(norm))                    return 'expedia';
  if (/\bstripe\b/.test(norm))                     return 'stripe';
  if (/\bairbnb\b/.test(norm))                     return 'airbnb';
  if (/\bagoda\b/.test(norm))                      return 'agoda';
  if (/\btrip\.com\b|\bctrip\b/.test(norm))        return 'trip';
  if (/\bhotels\.com\b/.test(norm))                return 'hotels';
  return null;
}

export function OtaBadge({ name }: { name: string }) {
  const key = resolveOtaKey(name);
  const tint: Tint = (key && OTA_TINT[key]) || { bg: 'var(--ink-mute, #555)', fg: '#fff', letter: (name || '?').charAt(0).toUpperCase() };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: 3,
          background: tint.bg,
          color: tint.fg,
          fontFamily: 'var(--mono, ui-monospace, SF Mono, Menlo, monospace)',
          fontSize: 'var(--t-xs)',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {tint.letter}
      </span>
      <span>{name}</span>
    </span>
  );
}

export function MaybeOtaBadge({ name }: { name: string }) {
  if (!name) return <>{name}</>;
  const key = resolveOtaKey(name);
  if (!key) return <>{name}</>;
  return <OtaBadge name={name} />;
}

export default OtaBadge;
