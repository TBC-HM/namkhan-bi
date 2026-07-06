// app/marketing/seo/page.tsx
// PBS 2026-07-05: migrated to paper-white DashboardPage. All data preserved:
// 4 topic clusters · 6 SEO agents · 4 pipeline items · 8-step workflow · 6 KPIs.
import type { ReactNode } from 'react';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const INK_F='#8A8A8A';
const GREEN='#084838'; const CREAM='#F7F0E1'; const AMBER='#C28F2C'; const RED='#B03826';

interface Cluster { name: string; keyword: string; pages: number; traffic: string; rank: string; score: number; status: 'Scaling'|'Growing'|'Opportunity'|'Stable' }

const CLUSTERS: Cluster[] = [
  { name: 'Wellness Laos',            keyword: 'wellness retreat Laos',        pages: 38, traffic: '+42%', rank: '#3 avg',  score: 92, status: 'Scaling'     },
  { name: 'Luang Prabang Local SEO',  keyword: 'things to do Luang Prabang',   pages: 61, traffic: '+28%', rank: '#5 avg',  score: 84, status: 'Growing'     },
  { name: 'Digital Detox Asia',       keyword: 'digital detox retreat Asia',   pages: 14, traffic: '+63%', rank: '#11 avg', score: 78, status: 'Opportunity' },
  { name: 'Farm To Table Laos',       keyword: 'farm to table Laos',           pages: 22, traffic: '+17%', rank: '#4 avg',  score: 81, status: 'Stable'      },
];

interface SeoAgent { name: string; desc: string; signal: string; cta: string }
const AGENTS: SeoAgent[] = [
  { name: 'Keyword Intelligence', desc: 'Builds keyword clusters, intent groups, seasonal trends and topical authority maps.', signal: '4.2k keywords', cta: 'Research'  },
  { name: 'Local SEO',            desc: 'Targets Luang Prabang and hyperlocal searches with maps, attractions, itineraries.',  signal: '91 local pages',cta: 'Build'     },
  { name: 'Content Architect',    desc: 'Designs article structures, internal linking, FAQ blocks and conversion flow.',       signal: '128 outlines',  cta: 'Structure' },
  { name: 'AI Blog Writer',       desc: 'Creates SEO articles, multilingual variants and funnel-integrated content.',           signal: '312 drafts',    cta: 'Write'     },
  { name: 'Reality & Brand',      desc: 'Checks that content reflects the actual resort, location and real experiences.',      signal: '18 revisions',  cta: 'Validate'  },
  { name: 'SEO Analytics',        desc: 'Tracks rankings, CTR, traffic, bookings, decay and content opportunities.',           signal: '26 insights',   cta: 'Analyze'   },
];

interface PipelineItem { title: string; cluster: string; lang: string; stage: 'Ready to Publish'|'Human Review'|'AI Draft'|'Queued'; seo: number }
const PIPELINE: PipelineItem[] = [
  { title: '7-Day Wellness Retreat in Laos',             cluster: 'Wellness Laos',  lang: 'EN', stage: 'Ready to Publish', seo: 94 },
  { title: 'Best Eco Resorts Near Luang Prabang',        cluster: 'Local SEO',      lang: 'DE', stage: 'Human Review',     seo: 87 },
  { title: 'Digital Detox Retreats in Southeast Asia',   cluster: 'Digital Detox',  lang: 'EN', stage: 'AI Draft',         seo: 81 },
  { title: 'What To Do In Luang Prabang During Rainy…',  cluster: 'Local SEO',      lang: 'FR', stage: 'Queued',           seo: 76 },
];

const WORKFLOW: { step: string; title: string; desc: string }[] = [
  { step: '01', title: 'Research',  desc: 'Google Trends, Search Console, keyword gaps, competitors and seasonality.' },
  { step: '02', title: 'Reason',    desc: 'AI decides if topic has commercial value or is SEO garbage.'               },
  { step: '03', title: 'Structure', desc: 'Outline, entities, FAQs, internal links, CTA and funnel path.'             },
  { step: '04', title: 'Write',     desc: 'Generate multilingual article variants with localized nuance.'             },
  { step: '05', title: 'Review',    desc: 'Human and reality agent validate claims, tone and visuals.'                },
  { step: '06', title: 'Publish',   desc: 'Push to CMS, sitemap, schema, internal links and social distribution.'     },
  { step: '07', title: 'Analyze',   desc: 'Track rankings, CTR, traffic, leads, bookings and decay.'                  },
  { step: '08', title: 'Refine',    desc: 'AI refreshes weak pages, expands clusters and improves conversion.'        },
];

export default function MarketingSeoPage() {
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({ key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/seo' }));
  const tiles: KpiTileProps[] = [
    { label: 'Organic sessions', value: '128k', size: 'sm', footnote: 'GA4 · last 90d (+31pp QoQ)' },
    { label: 'Ranking keywords', value: 4281,  size: 'sm', footnote: '612 in top 10' },
    { label: 'Articles published', value: 318, size: 'sm', footnote: '12 languages' },
    { label: 'Attributed revenue', value: '$412k', size: 'sm', footnote: 'SEO-assisted bookings' },
    { label: 'Weak pages', value: 23, size: 'sm', status: 'red', footnote: 'need refresh' },
    { label: 'CTR improvement', value: '+18pp', size: 'sm', footnote: 'titles + meta' },
  ];

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Marketing · SEO" subtitle="SEO auto-blog · Local SEO engine — Research → Reason → Write → Publish → Refine" tabs={tabs}>
        <div style={{ gridColumn:'1 / -1', padding:'10px 14px', background:'#FFF4D6', border:'1px solid '+AMBER, borderRadius:4, fontSize:12, color:INK, lineHeight:1.6 }}>
          <strong>HARDCODED DATA · Phase 1.</strong> Numbers are static spec. Live wiring needs Search Console + GA4 + booking-engine attribution + <code>seo.*</code> schema.
        </div>

        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* Topic clusters */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:8 }}>Topic clusters · {CLUSTERS.length} strategic territories</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:10 }}>
            {CLUSTERS.map(c => {
              const tone = c.status === 'Scaling' ? GREEN : c.status === 'Growing' ? AMBER : c.status === 'Opportunity' ? RED : INK_M;
              return (
                <div key={c.name} style={{ background:'#FFFFFF', border:'1px solid '+HAIR, borderLeft:'3px solid '+GREEN, borderRadius:6, padding:'12px 14px', display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontFamily:'Georgia, serif', fontSize:15, fontStyle:'italic', color:INK }}>{c.name}</span>
                    <span style={pill(tone)}>{c.status}</span>
                  </div>
                  <div style={{ fontSize:11, color:INK_M, fontStyle:'italic' }}>&ldquo;{c.keyword}&rdquo;</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, borderTop:'1px solid '+HAIR, paddingTop:6 }}>
                    <Stat l="Score" v={`${c.score}/100`} /><Stat l="Pages" v={String(c.pages)} /><Stat l="Traffic" v={c.traffic} /><Stat l="Rank" v={c.rank} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Workflow */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:8 }}>AI production loop · research → refine</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10 }}>
            {WORKFLOW.map(s => (
              <div key={s.step} style={{ background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:6, padding:'10px 12px' }}>
                <div style={{ fontFamily:'ui-monospace, monospace', fontSize:10, letterSpacing:'0.16em', color:GREEN }}>{s.step}</div>
                <div style={{ fontSize:13, fontWeight:600, color:INK }}>{s.title}</div>
                <div style={{ fontSize:11, color:INK_M, lineHeight:1.5, marginTop:2 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Two-column: agents + pipeline */}
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 340px)', gap:14, alignItems:'start' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:8 }}>Agent fleet · {AGENTS.length}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:10 }}>
              {AGENTS.map(a => (
                <div key={a.name} style={{ background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:6, padding:'12px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:12, fontWeight:600, color:INK }}>{a.name}</span>
                    <span style={pill(GREEN)}>{a.signal}</span>
                  </div>
                  <div style={{ fontSize:11, color:INK_M, marginTop:6, lineHeight:1.5, minHeight:54 }}>{a.desc}</div>
                  <div style={{ borderTop:'1px solid '+HAIR, paddingTop:6, marginTop:6, fontFamily:'ui-monospace, monospace', fontSize:10, letterSpacing:'0.14em', color:GREEN, textTransform:'uppercase' }}>{a.cta} →</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:8 }}>Content pipeline · {PIPELINE.length}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {PIPELINE.map(p => {
                const tone = p.stage === 'Ready to Publish' ? GREEN : p.stage === 'Human Review' ? AMBER : p.stage === 'AI Draft' ? INK_M : INK_F;
                return (
                  <div key={p.title} style={{ background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:6, padding:'10px 12px' }}>
                    <div style={{ fontSize:12, color:INK, fontStyle:'italic' }}>{p.title}</div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6 }}>
                      <span style={{ fontFamily:'ui-monospace, monospace', fontSize:10, letterSpacing:'0.12em', color:INK_M, textTransform:'uppercase' }}>{p.cluster} · {p.lang} · SEO {p.seo}</span>
                      <span style={pill(tone)}>{p.stage}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ gridColumn:'1 / -1', marginTop:14, padding:'10px 12px', fontSize:11, color:INK_M, fontStyle:'italic', borderTop:'1px solid '+HAIR }}>
          Phase 1 cockpit · static spec. Phase 2 wires <code>seo.*</code> schema + Search Console + GA4 hooks and lights up the 6 agents.
        </div>
      </DashboardPage>
    </div>
  );
}

function Stat({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <div style={{ fontFamily:'ui-monospace, monospace', fontSize:9, letterSpacing:'0.14em', textTransform:'uppercase' as const, color:INK_F }}>{l}</div>
      <div style={{ fontSize:12, fontWeight:600, color:INK, fontVariantNumeric:'tabular-nums' }}>{v}</div>
    </div>
  );
}
function pill(color: string): React.CSSProperties {
  return { fontFamily:'ui-monospace, monospace', fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color, border:'1px solid '+color, padding:'2px 6px', borderRadius:3, whiteSpace:'nowrap' };
}
