// app/marketing/docs/page.tsx
// PBS 2026-07-05: reorganized like a marketing manager thinks — Gold containers
// (BRAND · CAMPAIGNS · PARTNERS · COLLATERAL · SUSTAINABILITY · KB · TEMPLATES)
// at the top, then silver row list underneath. MEDIA/brand_asset images are
// hidden here — they belong at /marketing/gallery (media library).
// HR templates hidden — they belong under People/HR.

import Link from 'next/link';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface DocRow {
  doc_id: string;
  title: string;
  doc_type: string;
  doc_subtype: string | null;
  file_name: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime: string | null;
  file_size_bytes: number | null;
  importance: string | null;
  updated_at: string | null;
  tags: string[] | null;
}

type GoldKey = 'brand' | 'campaigns' | 'partners' | 'collateral' | 'sustainability' | 'kb' | 'templates';

interface GoldContainer {
  key: GoldKey;
  label: string;
  emoji: string;
  desc: string;
}

const GOLD: GoldContainer[] = [
  { key: 'brand',          label: 'Brand & positioning',     emoji: '',  desc: 'Voice · logo usage · positioning statement · style guide' },
  { key: 'campaigns',      label: 'Campaigns & calendar',    emoji: '',  desc: 'Campaign briefs · content calendar · quarterly plans' },
  { key: 'partners',       label: 'Partners & DMC',          emoji: '',  desc: 'Partner packs · DMC agreements · commission sheets · correspondence' },
  { key: 'collateral',     label: 'Collateral & press',      emoji: '',  desc: 'Press releases · fact sheets · product catalogs · presentations' },
  { key: 'sustainability', label: 'Sustainability & certs',  emoji: '',  desc: 'SLH considerate collection · Travelife · sustainability goals' },
  { key: 'kb',             label: 'Knowledge base',          emoji: '',  desc: 'Reference articles · integration guides · FAQ' },
  { key: 'templates',      label: 'Templates',               emoji: '',  desc: 'Social media · press release · self-assessment forms' },
];

function classify(d: DocRow): GoldKey | null {
  const sub = (d.doc_subtype ?? '').toLowerCase();
  const type = (d.doc_type ?? '').toLowerCase();

  // HIDE brand_asset here — it's mostly images/logos, belongs in /marketing/gallery
  if (sub === 'brand_asset' || (d.mime ?? '').startsWith('image/')) return null;
  // HIDE HR templates — belong under People/HR
  if (sub.startsWith('hr_')) return null;

  if (sub === 'campaign' || sub === 'content_calendar') return 'campaigns';
  if (type === 'partner' || sub === 'partner_material' || sub === 'correspondence') return 'partners';
  if (sub === 'sustainability_toolkit' || sub === 'sustainability_goals' || sub === 'certification_requirements') return 'sustainability';
  if (sub === 'collateral' || sub === 'press_release' || sub === 'product_catalog' || sub === 'internal_concept_deck' || type === 'presentation') return 'collateral';
  if (type === 'kb_article' || sub === 'faq' || sub === 'architecture' || sub === 'technical_integration_guide') return 'kb';
  if (type === 'template') return 'templates';
  if (type === 'marketing') return 'brand';

  return 'kb';
}

const fileUrl = (bucket: string | null, path: string | null) =>
  bucket && path ? `https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/${bucket}/${path}` : '#';
const fmtSize = (n: number | null) => !n ? '' : n < 1024 ? `${n}B` : n < 1_048_576 ? `${Math.round(n/1024)}KB` : `${(n/1_048_576).toFixed(1)}MB`;
const fmtDate = (d: string | null) => !d ? '—' : new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

const WHITE='#FFFFFF'; const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A';
const CREAM='#F5F0E1'; const GREEN='#084838'; const AMBER='#C28F2C';

interface SP { searchParams?: Record<string, string | string[] | undefined> }

export default async function MarketingDocsPage({ searchParams }: SP) {
  const activeContainer = (typeof searchParams?.gold === 'string' ? searchParams.gold : '') as GoldKey | '';

  const { data } = await supabase.from('v_marketing_docs')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .order('updated_at', { ascending: false });
  const rawDocs: DocRow[] = (data as DocRow[]) ?? [];

  const goldMap = new Map<GoldKey, DocRow[]>();
  const hidden: DocRow[] = [];
  for (const d of rawDocs) {
    const k = classify(d);
    if (!k) { hidden.push(d); continue; }
    (goldMap.get(k) ?? goldMap.set(k, []).get(k))!.push(d);
  }

  const filteredContainers = activeContainer ? GOLD.filter(g => g.key === activeContainer) : GOLD;
  const totalVisible = Array.from(goldMap.values()).reduce((s, arr) => s + arr.length, 0);

  const cfg = DEPT_CFG.marketing;
  const tabs: DashboardTab[] = cfg.subPages.map((s: { href: string; label: string }) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/docs',
  }));

  const tiles: KpiTileProps[] = GOLD.map(g => ({
    label: g.label,
    value: goldMap.get(g.key)?.length ?? 0,
    size: 'sm' as const,
  }));

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Documents"
        subtitle={`${totalVisible} docs sorted the way a marketing manager thinks · media library lives at /marketing/gallery`}
        tabs={tabs}
      >
        {/* Media redirect callout */}
        <div style={{ gridColumn:'1 / -1', padding:'10px 14px', background:CREAM, border:'1px solid '+HAIR, borderLeft:'3px solid '+GREEN, borderRadius:6, fontSize:12, color:INK, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <strong>Looking for photos, logos, videos?</strong> They live in the media library, not here.
            {hidden.length > 0 && <span style={{ color:INK_M, marginLeft:6 }}>({hidden.length} media/HR docs hidden from this view)</span>}
          </div>
          <Link href="/marketing/gallery" style={{ padding:'5px 12px', fontSize:11, fontWeight:600, background:GREEN, color:WHITE, textDecoration:'none', borderRadius:4 }}>Media library →</Link>
        </div>

        {/* KPI strip — one tile per Gold container */}
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* Filter chips — jump to a Gold container */}
        <div style={{ gridColumn:'1 / -1', display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
          <Link href="/marketing/docs" style={{ ...chipStyle(!activeContainer) }}>All ({totalVisible})</Link>
          {GOLD.map(g => (
            <Link key={g.key} href={`/marketing/docs?gold=${g.key}`} style={{ ...chipStyle(activeContainer === g.key) }}>
              {g.label} ({goldMap.get(g.key)?.length ?? 0})
            </Link>
          ))}
        </div>

        {/* Gold container sections */}
        {filteredContainers.map(g => {
          const docs = goldMap.get(g.key) ?? [];
          if (docs.length === 0 && activeContainer !== g.key) return null;
          return <GoldSection key={g.key} container={g} docs={docs} />;
        })}
      </DashboardPage>
    </div>
  );
}

function chipStyle(active: boolean) {
  return {
    padding:'5px 12px',
    fontSize:11,
    fontWeight:600 as const,
    background: active ? GREEN : WHITE,
    color: active ? WHITE : INK,
    border: '1px solid ' + (active ? GREEN : HAIR),
    borderRadius: 4,
    textDecoration: 'none' as const,
  };
}

function GoldSection({ container, docs }: { container: GoldContainer; docs: DocRow[] }) {
  return (
    <div style={{ gridColumn:'1 / -1', marginTop:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8, gap:8 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:INK }}>{container.label}</div>
          <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>{container.desc}</div>
        </div>
        <div style={{ fontSize:11, color:INK_M, fontVariantNumeric:'tabular-nums' as const }}>{docs.length} doc{docs.length === 1 ? '' : 's'}</div>
      </div>
      {docs.length === 0 ? (
        <div style={{ padding:'20px 24px', fontSize:12, color:INK_M, background:WHITE, border:'1px solid '+HAIR, borderRadius:6, textAlign:'center' }}>
          Nothing in this container yet. Add a document tagged with the matching doc_type/doc_subtype.
        </div>
      ) : (
        <div style={{ border:'1px solid '+HAIR, borderRadius:6, background:WHITE, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'#FAFAF7', borderBottom:'1px solid '+HAIR }}>
                <th style={th}>Title</th>
                <th style={th}>Subtype</th>
                <th style={th}>Type</th>
                <th style={{ ...th, textAlign:'right' }}>Size</th>
                <th style={th}>Updated</th>
                <th style={{ ...th, textAlign:'right', width:80 }} />
              </tr>
            </thead>
            <tbody>
              {docs.map(d => {
                const url = fileUrl(d.storage_bucket, d.storage_path);
                return (
                  <tr key={d.doc_id} style={{ borderTop:'1px solid '+HAIR }}>
                    <td style={{ ...tdL, maxWidth:400 }}>
                      <a href={url} target="_blank" rel="noreferrer" style={{ color:INK, textDecoration:'none', fontWeight:600 }}>{d.title}</a>
                    </td>
                    <td style={tdL}>{d.doc_subtype ?? '—'}</td>
                    <td style={tdL}>{d.mime?.split('/').pop() ?? '—'}</td>
                    <td style={tdR}>{fmtSize(d.file_size_bytes)}</td>
                    <td style={tdL}>{fmtDate(d.updated_at)}</td>
                    <td style={{ ...tdL, textAlign:'right' }}>
                      <a href={url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:GREEN, textDecoration:'none', fontWeight:600 }}>Open ↗</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, color:INK, textAlign:'left' as const };
const tdL = { padding:'8px 10px', fontSize:12, color:INK };
const tdR = { padding:'8px 10px', fontSize:12, color:INK, textAlign:'right' as const, fontVariantNumeric:'tabular-nums' as const };
