// app/marketing/taxonomy/page.tsx
// Brand & Marketing · Taxonomy — controlled vocabulary management.
// Owner-only in production. For Phase 2 demo, all roles can view.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import { getTaxonomy, getFreeKeywords } from '@/lib/marketing';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function TaxonomyPage() {
  const [taxonomy, freeKeywords] = await Promise.all([
    getTaxonomy(),
    getFreeKeywords(),
  ]);

  // Group by category
  const byCategory = new Map<string, typeof taxonomy>();
  for (const t of taxonomy) {
    const arr = byCategory.get(t.category) ?? [];
    arr.push(t);
    byCategory.set(t.category, arr);
  }

  const pendingPromotion = freeKeywords.filter(k => !k.promoted_to_tag_id);

  return (
    <Page
      eyebrow="Marketing · Taxonomy"
      title={<>Tag <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>governance</em>.</>}
      subPages={MARKETING_SUBPAGES}
    >
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={taxonomy.length}                                          unit="count" label="Active tags"    tooltip="Canonical tags in marketing.media_taxonomy." />
        <KpiBox value={byCategory.size}                                          unit="count" label="Categories"     tooltip="Distinct category groups." />
        <KpiBox value={pendingPromotion.length}                                  unit="count" label="Pending review" tooltip="Free-text keywords not yet promoted to a canonical tag." />
        <KpiBox value={freeKeywords.filter(k => !!k.promoted_to_tag_id).length} unit="count" label="Promoted"       tooltip="Free-text keywords already merged into the controlled vocab." />
      </div>

      {/* Active tags panel */}
      <Panel
        title="Active tags"
        eyebrow="marketing.media_taxonomy"
      >
        <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)', marginBottom: 14 }}>
          {taxonomy.length} canonical · grouped by category
        </div>
        {Array.from(byCategory.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([cat, items]) => (
            <div key={cat} style={{ marginTop: 14 }}>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                textTransform: 'uppercase',
                letterSpacing: 1.2,
                color: 'var(--ink-mute)',
                marginBottom: 8,
                fontWeight: 600,
              }}>
                {cat} · {items.length}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {items.map(t => (
                  <span
                    key={t.tag_id}
                    title={`tag_id: ${t.tag_id}`}
                    style={{
                      fontSize: 'var(--t-sm)',
                      fontFamily: 'var(--mono)',
                      padding: '3px 8px',
                      background: 'var(--paper-warm)',
                      border: '1px solid var(--line)',
                      color: 'var(--ink)',
                      cursor: 'default',
                    }}
                  >
                    {t.label}
                    {t.used_count != null && (
                      <span style={{ marginLeft: 4, color: 'var(--ink-mute)' }}>· {t.used_count}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
      </Panel>

      {/* Free-text keywords panel */}
      <Panel
        title="Free-text keywords"
        eyebrow="marketing.media_keywords_free"
      >
        <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)', marginBottom: 14 }}>
          {pendingPromotion.length > 0
            ? `${pendingPromotion.length} keyword${pendingPromotion.length === 1 ? '' : 's'} awaiting review · not yet in the controlled vocab`
            : 'All keywords reviewed'}
        </div>

        {pendingPromotion.length === 0 ? (
          <div className="stub" style={{ padding: 24, textAlign: 'center' }}>
            <h3>Nothing waiting</h3>
            <p>Free-text keywords appear here when the AI tagger meets a phrase that&apos;s not in the controlled vocabulary.</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Keyword</th>
                <th className="num">Seen on</th>
                <th>Suggested category</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pendingPromotion.map((k, i) => (
                <tr key={i}>
                  <td className="lbl">
                    <strong style={{ fontFamily: 'var(--mono)' }}>{k.keyword}</strong>
                  </td>
                  <td className="num">{k.seen_count ?? 1} asset{(k.seen_count ?? 1) === 1 ? '' : 's'}</td>
                  <td style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>—</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn" style={{ fontSize: 'var(--t-xs)', marginRight: 4 }}>promote</button>
                    <button className="btn" style={{ fontSize: 'var(--t-xs)' }}>discard</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{
          marginTop: 14,
          padding: '10px 14px',
          background: 'rgba(168,133,74,0.10)',
          borderLeft: '3px solid var(--brass)',
          fontSize: 'var(--t-sm)',
          color: 'var(--ink-soft)',
          lineHeight: 1.6,
        }}>
          <strong>promote</strong> inserts the keyword into <code>marketing.media_taxonomy</code>, sets a category, and back-links the existing assets that already have it. ID stays stable across edits.
        </div>
      </Panel>
    </Page>
  );
}
