// components/settings/panels/RetreatsPanel.tsx
// PBS 2026-07-18 · wired to public.v_property_retreats — bridge view over
// content.retreat_programs. Namkhan has 3 programs (Harmony & Mindfulness,
// Detox, Serene Couples) each with 2 tiers (essential + immersion inclusions)
// and 8 pricing rows (tier × season × audience).
'use client';

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const AMBER  = '#B87F26';
const CREAM  = '#F5F0E1';

interface RetreatRow {
  retreat_id: number;
  code: string;
  display_name: string;
  short_pitch: string | null;
  long_description: string | null;
  ideal_for: string[] | null;
  min_nights: number | null;
  max_nights: number | null;
  min_age: number | null;
  pricing_basis: string | null;
  eligible_room_types: string[] | null;
  excluded_seasons: string[] | null;
  essential_inclusions: string[] | null;
  immersion_inclusions: string[] | null;
  is_active: boolean;
  notes: string | null;
  pricing: Array<{ tier: string; season: string; audience: string; price_usd: string; taxes_included: boolean; effective_from: string | null; effective_to: string | null; notes: string | null }> | null;
}

interface Props {
  retreats: RetreatRow[];
  propertyId: number;
}

function fmtPrice(row: { price_usd: string; taxes_included: boolean }): string {
  const n = Number(row.price_usd);
  return 'USD ' + (Number.isFinite(n) ? n.toFixed(0) : row.price_usd) + (row.taxes_included ? ' inc.' : ' +tax');
}

export default function RetreatsPanel({ retreats }: Props) {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>Retreats</div>
        <div style={{ fontSize: 11, color: INK_M, marginTop: 2 }}>
          {retreats.length} program{retreats.length === 1 ? '' : 's'} · each has 2 tiers (Essential · Immersion) sourced from content.retreat_programs
        </div>
      </div>

      {retreats.length === 0 ? (
        <div style={{ background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4, padding: 20, textAlign: 'center', color: INK_M }}>
          No retreat programs yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {retreats.map((r) => {
            const essential = (r.pricing ?? []).filter((p) => p.tier === 'essential');
            const immersion = (r.pricing ?? []).filter((p) => p.tier === 'immersion');
            return (
              <div key={r.retreat_id} style={{ background: '#FFFFFF', border: '1px solid ' + HAIR, borderRadius: 6, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                  <div style={{ fontFamily: 'ui-serif, Georgia, serif', fontSize: 18, fontWeight: 500, color: INK }}>{r.display_name}</div>
                  {r.pricing_basis && (
                    <span style={{ fontSize: 10, background: CREAM, color: INK_M, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {r.pricing_basis.replace(/_/g, ' ')}
                    </span>
                  )}
                  {r.min_nights != null && r.max_nights != null && (
                    <span style={{ fontSize: 11, color: INK_M }}>{r.min_nights}–{r.max_nights} nights</span>
                  )}
                  {r.min_age != null && (
                    <span style={{ fontSize: 11, color: INK_M }}>min age {r.min_age}</span>
                  )}
                </div>

                {r.short_pitch && (
                  <div style={{ fontSize: 13, color: INK, fontStyle: 'italic', marginBottom: 8 }}>{r.short_pitch}</div>
                )}
                {r.long_description && (
                  <div style={{ fontSize: 12, color: INK_M, lineHeight: 1.55, marginBottom: 12 }}>{r.long_description}</div>
                )}

                {(r.ideal_for ?? []).length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    <span style={{ fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.06em', alignSelf: 'center' }}>Ideal for:</span>
                    {(r.ideal_for ?? []).map((t) => (
                      <span key={t} style={{ fontSize: 10, background: '#EBF1EE', color: FOREST, padding: '2px 8px', borderRadius: 3 }}>{t.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                )}

                {/* Two tiers side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 8 }}>
                  <TierCard label="Essential" color={INK_M} inclusions={r.essential_inclusions} pricing={essential} />
                  <TierCard label="Immersion" color={FOREST} inclusions={r.immersion_inclusions} pricing={immersion} />
                </div>

                {(r.eligible_room_types ?? []).length > 0 && (
                  <div style={{ fontSize: 11, color: INK_M, marginTop: 10 }}>
                    <span style={{ fontWeight: 600 }}>Room types:</span> {(r.eligible_room_types ?? []).join(' · ')}
                  </div>
                )}
                {(r.excluded_seasons ?? []).length > 0 && (
                  <div style={{ fontSize: 11, color: AMBER, marginTop: 4 }}>
                    <span style={{ fontWeight: 600 }}>Excluded seasons:</span> {(r.excluded_seasons ?? []).join(' · ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TierCard({ label, color, inclusions, pricing }: { label: string; color: string; inclusions: string[] | null; pricing: RetreatRow['pricing'] }) {
  return (
    <div style={{ background: '#FAF7EE', border: '1px solid ' + HAIR, borderRadius: 4, padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      {(pricing ?? []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {(pricing ?? []).map((p, i) => (
            <div key={i} style={{ background: '#FFFFFF', border: '1px solid ' + HAIR, borderRadius: 3, padding: '4px 8px', fontSize: 11 }}>
              <div style={{ color: INK_M, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.season} · {p.audience.replace(/_/g, ' ')}</div>
              <div style={{ fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(p)}</div>
            </div>
          ))}
        </div>
      )}
      {(inclusions ?? []).length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: INK, lineHeight: 1.55 }}>
          {(inclusions ?? []).map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      ) : (
        <div style={{ fontSize: 11, color: INK_M, fontStyle: 'italic' }}>no inclusions defined</div>
      )}
    </div>
  );
}