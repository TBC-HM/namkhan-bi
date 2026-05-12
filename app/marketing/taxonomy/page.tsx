// app/marketing/taxonomy/page.tsx
// Brand & Marketing · Taxonomy — controlled vocabulary management.
// Owner-only in production. For Phase 2 demo, all roles can view.
//
// 2026-05-12: ported off legacy PanelHero+Card chrome onto the canonical
// <Page>+<Panel> shell. Same data sources (marketing.media_taxonomy +
// marketing.media_keywords_free), same KPIs and actions.

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

  // Group canonical tags by category
  const byCategory = new Map<string, typeof taxonomy>();
  for (const t of taxonomy) {
    const arr = byCategory.get(t.category) ?? [];
    arr.push(t);
    byCategory.set(t.category, arr);
  }

  const pendingPromotion = freeKeywords.filter((k) => !k.promoted_to_tag_id);
  const promotedCount = freeKeywords.filter((k) => !!k.promoted_to_tag_id).length;

  return (
    <Page
      eyebrow="Brand · Marketing · taxonomy"
      title={
        <>
          Tag <em style={{ color: 'var(--accent, #a8854a)', fontStyle: 'italic' }}>governance</em>
        </>
      }
      subPages={MARKETING_SUBPAGES}
    >
      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
          marginBottom: 20,
        }}
      >
        <KpiBox label="Active tags" value={taxonomy.length} unit="count" />
        <KpiBox label="Categories" value={byCategory.size} unit="count" />
        <KpiBox
          label="Pending review"
          value={pendingPromotion.length}
          unit="count"
          tooltip="Free-text keywords awaiting promotion to the controlled vocab"
        />
        <KpiBox label="Promoted" value={promotedCount} unit="count" tooltip="Historical: keywords already mapped to canonical tags" />
      </div>

      <Panel
        title="Active"
        eyebrow={`${taxonomy.length} canonical · grouped by category · marketing.media_taxonomy`}
      >
        {Array.from(byCategory.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([cat, items]) => (
            <div key={cat} style={{ marginTop: 14 }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  color: 'var(--text-mute, #9b907a)',
                  marginBottom: 8,
                  fontWeight: 600,
                }}
              >
                {cat} · {items.length}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {items.map((t) => (
                  <span
                    key={t.tag_id}
                    title={`tag_id: ${t.tag_id}`}
                    style={{
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      padding: '3px 8px',
                      background: 'var(--surf-2, #15110b)',
                      border: '1px solid var(--border-2, #2a261d)',
                      color: 'var(--text-0, #e9e1ce)',
                      borderRadius: 4,
                    }}
                  >
                    {t.label}
                    {t.used_count != null && (
                      <span style={{ marginLeft: 4, color: 'var(--text-mute, #9b907a)' }}>
                        · {t.used_count}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
      </Panel>

      <div style={{ height: 16 }} />

      <Panel
        title="Free-text"
        eyebrow={
          pendingPromotion.length > 0
            ? `${pendingPromotion.length} keyword${pendingPromotion.length === 1 ? '' : 's'} awaiting review · marketing.media_keywords_free`
            : 'all keywords reviewed · marketing.media_keywords_free'
        }
      >
        {pendingPromotion.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-mute, #9b907a)' }}>
            <h3
              style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontStyle: 'italic',
                fontWeight: 300,
                color: 'var(--text-0, #e9e1ce)',
                margin: '0 0 6px',
              }}
            >
              Nothing waiting
            </h3>
            <p style={{ margin: 0, fontSize: 13 }}>
              Free-text keywords appear here when the AI tagger meets a phrase that&apos;s not in
              the controlled vocabulary.
            </p>
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
              color: 'var(--text-0, #e9e1ce)',
            }}
          >
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-2, #2a261d)' }}>
                <th style={thStyle}>Keyword</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Seen on</th>
                <th style={thStyle}>Suggested category</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pendingPromotion.map((k, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-1, #1f1c15)' }}>
                  <td style={{ padding: '8px 6px' }}>
                    <strong style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                      {k.keyword}
                    </strong>
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-mute, #9b907a)' }}>
                    {k.seen_count ?? 1} asset{(k.seen_count ?? 1) === 1 ? '' : 's'}
                  </td>
                  <td style={{ padding: '8px 6px', fontSize: 12, color: 'var(--text-mute, #9b907a)' }}>—</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                    <button style={btnStyle}>promote</button>{' '}
                    <button style={btnStyle}>discard</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div
          style={{
            marginTop: 14,
            padding: '10px 14px',
            background: 'rgba(168,133,74,0.10)',
            borderLeft: '3px solid var(--accent, #a8854a)',
            fontSize: 12,
            color: 'var(--text-2, #d8cca8)',
            lineHeight: 1.6,
          }}
        >
          <strong>promote</strong> inserts the keyword into <code>marketing.media_taxonomy</code>,
          sets a category, and back-links the existing assets that already have it. ID stays stable
          across edits.
        </div>
      </Panel>
    </Page>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 6px',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--text-mute, #9b907a)',
  fontWeight: 600,
};

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border-2, #2a261d)',
  color: 'var(--text-dim, #7d7565)',
  borderRadius: 4,
  padding: '3px 9px',
  fontSize: 11,
  cursor: 'pointer',
};
