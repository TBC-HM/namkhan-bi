// app/marketing/taxonomy/page.tsx
// PBS 2026-07-05: migrated to paper-white DashboardPage. Data sources preserved:
// marketing.media_taxonomy + marketing.media_keywords_free via getTaxonomy() + getFreeKeywords().
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { getTaxonomy, getFreeKeywords } from '@/lib/marketing';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const CREAM='#F7F0E1'; const GREEN='#084838';

export default async function TaxonomyPage() {
  const [taxonomy, freeKeywords] = await Promise.all([getTaxonomy(), getFreeKeywords()]);

  const byCategory = new Map<string, typeof taxonomy>();
  for (const t of taxonomy) {
    const arr = byCategory.get(t.category) ?? [];
    arr.push(t); byCategory.set(t.category, arr);
  }

  const pending = freeKeywords.filter(k => !k.promoted_to_tag_id);
  const promoted = freeKeywords.filter(k => !!k.promoted_to_tag_id).length;

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({ key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/taxonomy' }));
  const tiles: KpiTileProps[] = [
    { label: 'Active tags',    value: taxonomy.length, size: 'sm', footnote: 'controlled vocab' },
    { label: 'Categories',     value: byCategory.size, size: 'sm' },
    { label: 'Pending review', value: pending.length,  size: 'sm', status: pending.length > 0 ? 'red' : undefined, footnote: 'awaiting promotion' },
    { label: 'Promoted',       value: promoted,        size: 'sm', footnote: 'already mapped' },
  ];

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Marketing · Taxonomy" subtitle="Controlled vocabulary governance · marketing.media_taxonomy + media_keywords_free" tabs={tabs}>
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* Active canonical tags by category */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:6 }}>Active canonical tags · grouped by category</div>
          <div style={{ border:'1px solid '+HAIR, borderRadius:6, background:'#FFFFFF', padding:16 }}>
            {Array.from(byCategory.entries()).sort((a,b) => a[0].localeCompare(b[0])).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom:14 }}>
                <div style={{ fontFamily:'ui-monospace, monospace', fontSize:10, textTransform:'uppercase', letterSpacing:'0.14em', color:INK_M, marginBottom:6, fontWeight:600 }}>
                  {cat} · {items.length}
                </div>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {items.map(t => (
                    <span key={t.tag_id} title={`tag_id: ${t.tag_id}`} style={{ fontSize:12, fontFamily:'ui-monospace, monospace', padding:'3px 8px', background:CREAM, border:'1px solid '+HAIR, color:INK, borderRadius:4 }}>
                      {t.label}
                      {t.used_count != null && <span style={{ marginLeft:4, color:INK_M }}>· {t.used_count}</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Free-text pending promotion */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:6 }}>
            Free-text keywords {pending.length > 0 ? `· ${pending.length} awaiting review` : '· all reviewed'}
          </div>
          <div style={{ border:'1px solid '+HAIR, borderRadius:6, background:'#FFFFFF', overflow:'hidden' }}>
            {pending.length === 0 ? (
              <div style={{ padding:24, textAlign:'center', color:INK_M, fontSize:12 }}>
                Nothing waiting. Free-text keywords appear here when the AI tagger meets a phrase that&apos;s not in the controlled vocabulary.
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#FAFAF7', borderBottom:'1px solid '+HAIR }}>
                    <th style={th}>Keyword</th>
                    <th style={{ ...th, textAlign:'right' }}>Seen on</th>
                    <th style={th}>Suggested category</th>
                    <th style={{ ...th, textAlign:'right', width:160 }} />
                  </tr>
                </thead>
                <tbody>
                  {pending.map((k, i) => (
                    <tr key={i} style={{ borderTop:'1px solid '+HAIR }}>
                      <td style={tdL}><strong style={{ fontFamily:'ui-monospace, monospace' }}>{k.keyword}</strong></td>
                      <td style={{ ...tdL, textAlign:'right', color:INK_M }}>{k.seen_count ?? 1} asset{(k.seen_count ?? 1) === 1 ? '' : 's'}</td>
                      <td style={{ ...tdL, color:INK_M }}>—</td>
                      <td style={{ ...tdL, textAlign:'right' }}>
                        <button style={btn}>promote</button>{' '}
                        <button style={btn}>discard</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ marginTop:12, padding:'10px 14px', background:CREAM, borderLeft:'3px solid '+GREEN, borderRadius:4, fontSize:12, color:INK, lineHeight:1.6 }}>
            <strong>promote</strong> inserts the keyword into <code>marketing.media_taxonomy</code>, sets a category, and back-links existing assets. ID stays stable across edits.
          </div>
        </div>
      </DashboardPage>
    </div>
  );
}

const th = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, color:INK, textAlign:'left' as const };
const tdL = { padding:'8px 10px', fontSize:12, color:INK };
const btn = { background:'#FFFFFF', border:'1px solid '+HAIR, color:INK, borderRadius:4, padding:'3px 9px', fontSize:11, cursor:'pointer' as const };
