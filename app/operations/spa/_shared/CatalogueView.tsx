// app/operations/spa/_shared/CatalogueView.tsx
// Spa module v1 — treatment catalogue read surface for operations.
// Source of truth: property.spa_treatments (LIVE bridge v_property_spa_treatments;
// CRUD stays in Settings → Property → Spa treatments — NOT duplicated here).
// Audit extra: folio sellers with no catalogue match, so the empty/thin
// catalogue can be seeded from what the spa actually sells.

import { DashboardPage, Container, KpiTile, type KpiTileProps, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { TOKENS, MONO } from '@/components/cockpit/tokens';
import SpaSubnav from './SpaSubnav';
import { getSpaCatalogue, getFolioSpaSellers } from './data';

const fmtUsd = (n: number | null) => n == null ? '—' : `$${Number(n).toLocaleString('en-US')}`;
const fmtLak = (n: number | null) => n == null ? '—' : `₭${Math.round(Number(n)).toLocaleString('en-US')}`;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export default async function CatalogueView({ propertyId }: { propertyId: number }) {
  const [catalogueB, folioSellersB] = await Promise.all([
    getSpaCatalogue(propertyId),
    getFolioSpaSellers(propertyId),
  ]);
  const catalogue = catalogueB.rows;
  const folioSellers = folioSellersB.rows;

  const active = catalogue.filter((c) => c.is_active !== false);
  const categories = Array.from(new Set(active.map((c) => c.category ?? 'uncategorised')));
  const priced = active.filter((c) => c.price_usd != null);
  const avgUsd = priced.length > 0 ? priced.reduce((s, c) => s + Number(c.price_usd ?? 0), 0) / priced.length : 0;

  // folio descriptions that match no catalogue name (loose contains either way)
  const catNorms = active.map((c) => norm(c.name));
  const unmatched = folioSellers.filter((f) => {
    const fn = norm(f.description);
    return fn.length > 2 && !catNorms.some((cn) => cn.includes(fn) || fn.includes(cn));
  }).slice(0, 25);

  const kpis: KpiTileProps[] = [
    { label: 'Active treatments', value: String(active.length), footnote: `${catalogue.length} total incl. inactive`, status: active.length > 0 ? 'green' : 'amber', size: 'sm' },
    { label: 'Categories', value: String(categories.length), footnote: categories.slice(0, 3).join(' · ') || '—', status: 'grey', size: 'sm' },
    { label: 'Signature', value: String(active.filter((c) => c.is_signature).length), footnote: 'flagged signature', status: 'grey', size: 'sm' },
    { label: 'Avg price', value: priced.length > 0 ? fmtUsd(avgUsd) : '—', footnote: `${priced.length} priced in USD`, status: 'grey', size: 'sm' },
    { label: 'Folio sellers unmapped', value: String(unmatched.length), footnote: 'sold in folio, missing from catalogue', status: unmatched.length > 0 ? 'amber' : 'green', size: 'sm' },
  ];

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${TOKENS.ink}`, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: TOKENS.inkSoft, fontFamily: MONO };
  const thR: React.CSSProperties = { ...th, textAlign: 'right' };
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: `1px solid ${TOKENS.border}`, fontSize: 13, color: TOKENS.ink };
  const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: MONO };

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/spa') })) as DashboardTab[];

  return (
    <DashboardPage title="Treatment catalogue" subtitle="Operations · Spa · source of truth: property.spa_treatments (edit in Settings → Property)" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SpaSubnav active="catalogue" />

        <Container title="Catalogue health" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {kpis.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        {active.length === 0 && (
          <div style={{ border: `1px solid ${TOKENS.brass}`, background: `${TOKENS.brass}18`, borderRadius: 6, padding: '14px 16px', fontSize: 13, lineHeight: 1.6 }}>
            <strong>Catalogue is empty.</strong> The CRUD panel is live under Settings → Property → Spa treatments
            (writes via <code style={{ fontFamily: MONO }}>fn_upsert_property_spa_treatment</code>). Seed it from the folio
            sellers below — those are the treatments the spa demonstrably sells today.
          </div>
        )}

        {categories.map((cat) => {
          const rows = active.filter((c) => (c.category ?? 'uncategorised') === cat);
          if (rows.length === 0) return null;
          return (
            <Container key={cat} title={cat} subtitle={`${rows.length} treatment(s)`} density="compact">
              <div style={{ overflowX: 'auto', border: `1px solid ${TOKENS.border}`, borderRadius: 6 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: TOKENS.bgRaised }}>
                  <thead>
                    <tr>
                      <th style={th}>Treatment</th><th style={thR}>Min</th><th style={thR}>USD</th><th style={thR}>LAK</th>
                      <th style={th}>Oil/Dry</th><th style={th}>Couples</th><th style={th}>Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c.treatment_id}>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          {c.short_description && <div style={{ fontSize: 11, color: TOKENS.inkSoft }}>{c.short_description}</div>}
                        </td>
                        <td style={tdR}>{c.duration_min ?? '—'}</td>
                        <td style={tdR}>{fmtUsd(c.price_usd)}</td>
                        <td style={tdR}>{fmtLak(c.price_lak)}</td>
                        <td style={td}>{c.oil_or_dry ?? '—'}</td>
                        <td style={td}>{c.couples_available ? 'yes' : '—'}</td>
                        <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>{[c.is_signature ? 'SIGNATURE' : null].filter(Boolean).join(' ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Container>
          );
        })}

        <Container title="Sold in folio · missing from catalogue" subtitle="Cloudbeds folio descriptions (Other Operated / Spa) with no catalogue match — seed candidates" density="compact">
          {unmatched.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: TOKENS.inkSoft }}>
              {folioSellers.length === 0 ? 'No folio spa sales found for this property.' : 'Every folio seller matches a catalogue entry.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: `1px solid ${TOKENS.border}`, borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: TOKENS.bgRaised }}>
                <thead>
                  <tr><th style={th}>Folio description</th><th style={thR}>Revenue</th><th style={thR}>Units</th><th style={thR}>Last sold</th></tr>
                </thead>
                <tbody>
                  {unmatched.map((f) => (
                    <tr key={f.description}>
                      <td style={td}>{f.description}</td>
                      <td style={tdR}>{fmtUsd(f.total_revenue_usd)}</td>
                      <td style={tdR}>{f.total_units.toLocaleString('en-US')}</td>
                      <td style={tdR}>{f.last_sold ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}
