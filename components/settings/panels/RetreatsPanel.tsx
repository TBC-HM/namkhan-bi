// components/settings/panels/RetreatsPanel.tsx
// PBS 2026-07-18 · NEW top-level tab. Multi-day packaged experiences (Yoga,
// Detox, Wellness Reset, etc.) — separate concern from single-visit Activities.
// Awaits property.retreats DDL greenlight; renders informational banner + the
// draft schema meanwhile so operator knows what's coming.
'use client';

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const AMBER  = '#B87F26';
const CREAM  = '#F5F0E1';

export default function RetreatsPanel({ propertyId }: { propertyId: number }) {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>Retreats</div>
        <div style={{ fontSize: 11, color: INK_M, marginTop: 2 }}>
          Multi-day packaged experiences · fixed departures · min pax · includes accommodation + meals
        </div>
      </div>

      <div style={{ background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: AMBER, marginBottom: 6 }}>⚠ Awaiting DDL approval</div>
        <div style={{ fontSize: 12, color: INK, lineHeight: 1.6 }}>
          This tab will list every multi-day retreat program (e.g. "Wellness Reset · 5 Days", "Yoga Immersion · 7 Days")
          once the <code>property.retreats</code> table is created. The schema was drafted in chat and awaits PBS greenlight.
        </div>
      </div>

      <details style={{ background: '#FFFFFF', border: '1px solid ' + HAIR, borderRadius: 4, padding: '10px 14px' }}>
        <summary style={{ fontSize: 12, fontWeight: 600, color: INK, cursor: 'pointer' }}>Draft schema · click to view</summary>
        <pre style={{
          marginTop: 10,
          background: CREAM,
          padding: 12,
          borderRadius: 4,
          fontSize: 11,
          lineHeight: 1.5,
          overflow: 'auto',
          color: '#333',
        }}>{`CREATE TABLE property.retreats (
  retreat_id      bigserial PRIMARY KEY,
  property_id     bigint NOT NULL REFERENCES property.identity(property_id),
  name            text   NOT NULL,          -- "Wellness Reset · 5 Days"
  short_pitch     text,
  description     text,
  duration_days   integer,
  min_pax         integer,
  max_pax         integer,
  wellness_focus  text,                     -- detox | yoga | mindfulness | adventure | creative
  includes_accommodation  boolean DEFAULT true,
  includes_meals          boolean DEFAULT true,
  includes_activities     jsonb,            -- linked activity_ids
  price_per_person_usd    numeric,
  price_includes_vat_service boolean DEFAULT true,
  arrival_dates   date[],                   -- fixed departures, or NULL for on-demand
  cover_asset_id  uuid,
  display_order   integer,
  is_active       boolean DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON property.retreats TO service_role;
GRANT USAGE ON SEQUENCE property.retreats_retreat_id_seq TO service_role;`}</pre>
      </details>
    </div>
  );
}