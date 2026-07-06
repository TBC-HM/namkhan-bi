// app/marketing/docs/page.tsx
// PBS 2026-07-06: reorganized further into 8 Gold containers, added HILTON & SLH,
// added PARTNER MATERIAL, filtered out non-marketing docs (Supabase/Sabre/Whistle
// integration, land sales, construction approvals, HR templates), renamed "Open"
// → "Preview" and wired an inline preview modal (iframe for PDFs, <img> for images,
// download link for everything else).
//
// DYNAMIC: this page classifies every doc at read-time from doc_type + doc_subtype
// on `v_marketing_docs`. If you change those fields on a doc row in `dms.documents`,
// the doc automatically moves to the matching Gold container on next page load.
// Nothing is deleted — only re-classified.

import Link from 'next/link';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { DEPT_CFG } from '@/lib/dept-cfg';
import DocsClient from './_components/DocsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export interface DocRow {
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

export type GoldKey = 'brand' | 'campaigns' | 'partner_material' | 'hilton_slh' | 'collateral' | 'sustainability' | 'kb' | 'templates';

interface GoldContainer { key: GoldKey; label: string; desc: string }

const GOLD: GoldContainer[] = [
  { key: 'brand',            label: 'Brand & positioning',      desc: 'Voice · positioning · logos · fact sheets · what makes Namkhan special' },
  { key: 'campaigns',        label: 'Campaigns & calendar',     desc: 'Campaign briefs · content calendar · retreat programme · Google Ads strategy' },
  { key: 'partner_material', label: 'Partner material',         desc: 'Room descriptions · F&B menus · facility photos · agent overview · meeting rooms — everything you send to partners, DMCs, OTAs' },
  { key: 'hilton_slh',       label: 'Hilton & SLH',             desc: 'SLH Considerate Collection + Hilton x SLH partnership assets, FAQ, forms, templates' },
  { key: 'collateral',       label: 'Collateral & press',       desc: 'Press releases · guest brochures · booking terms · one-pagers' },
  { key: 'sustainability',   label: 'Sustainability & certs',   desc: 'Travelife · greenhouse gas goals · sustainability toolkits' },
  { key: 'kb',               label: 'Knowledge base',           desc: 'Reference articles · FAQ (marketing-relevant only)' },
  { key: 'templates',        label: 'Templates',                desc: 'Reusable email + form templates (non-HR, non-SLH)' },
];

const NON_MARKETING_MATCHERS = [
  // Tech/architecture — belongs in engineering docs, not marketing
  { subtype: 'architecture' },
  { subtype: 'technical_integration_guide' },
  { titleMatch: /supabase|whistle|synxis|sabre|integration guide|architecture/i },
  // Land / real estate / construction
  { titleMatch: /land ownership|land sale|meeting proposal|pll land|hatsady|construction|approval request document|topographical|reimbursement/i },
  // HR (belongs under People/HR)
  { subtype: 'hr_contract_autonomo' },
  { subtype: 'hr_contract_eventual' },
  { subtype: 'hr_contract_fijo_discontinuo' },
  { subtype: 'hr_contract_indefinido' },
  { subtype: 'hr_termination_disciplinario' },
  { subtype: 'hr_termination_fin_temporal' },
  { subtype: 'hr_termination_improcedente' },
  { subtype: 'hr_termination_objetivo' },
  { subtype: 'hr_warning_grave' },
  { subtype: 'hr_warning_leve' },
  { subtype: 'hr_warning_muy_grave' },
];

function isNonMarketing(d: DocRow): boolean {
  const sub = (d.doc_subtype ?? '').toLowerCase();
  const t = (d.title ?? '').toLowerCase();
  for (const m of NON_MARKETING_MATCHERS) {
    if ('subtype' in m && sub === m.subtype) return true;
    if ('titleMatch' in m && m.titleMatch!.test(t)) return true;
  }
  return false;
}

function isMediaAsset(d: DocRow): boolean {
  const sub = (d.doc_subtype ?? '').toLowerCase();
  if (sub === 'brand_asset') return true;
  if ((d.mime ?? '').startsWith('image/')) return true;
  return false;
}

function isHiltonSlh(d: DocRow): boolean {
  const t = (d.title ?? '').toLowerCase();
  return /slh|considerate|hilton|synxis hotel-build|small luxury hotels/i.test(t);
}

function classify(d: DocRow): GoldKey | null {
  if (isNonMarketing(d)) return null;
  if (isMediaAsset(d)) return null;
  if (isHiltonSlh(d)) return 'hilton_slh';

  const sub = (d.doc_subtype ?? '').toLowerCase();
  const type = (d.doc_type ?? '').toLowerCase();

  if (sub === 'partner_material') return 'partner_material';
  if (sub === 'campaign' || sub === 'content_calendar') return 'campaigns';
  if (sub === 'sustainability_toolkit' || sub === 'sustainability_goals' || sub === 'certification_requirements') return 'sustainability';
  if (sub === 'collateral' || sub === 'press_release' || sub === 'product_catalog' || sub === 'internal_concept_deck' || type === 'presentation') return 'collateral';
  if (type === 'kb_article' || sub === 'faq') return 'kb';
  if (type === 'template') return 'templates';
  if (type === 'partner' || sub === 'correspondence') return 'partner_material';
  if (type === 'marketing') return 'brand';

  return 'kb';
}

const fileUrl = (bucket: string | null, path: string | null) =>
  bucket && path ? `https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/${bucket}/${path}` : '';

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const CREAM='#F5F0E1'; const GREEN='#084838'; const AMBER='#C28F2C';

interface SP { searchParams?: Record<string, string | string[] | undefined> }

export default async function MarketingDocsPage({ searchParams }: SP) {
  const activeContainer = (typeof searchParams?.gold === 'string' ? searchParams.gold : '') as GoldKey | '';

  const { data } = await supabase.from('v_marketing_docs')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .order('updated_at', { ascending: false });
  const rawDocs: DocRow[] = (data as DocRow[]) ?? [];

  const goldMap = new Map<GoldKey, DocRow[]>();
  const hiddenNonMkt: DocRow[] = [];
  const hiddenMedia: DocRow[] = [];
  for (const d of rawDocs) {
    if (isNonMarketing(d)) { hiddenNonMkt.push(d); continue; }
    if (isMediaAsset(d))   { hiddenMedia.push(d); continue; }
    const k = classify(d);
    if (!k) { hiddenNonMkt.push(d); continue; }
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

  // Serialize rows for the client (add computed url)
  const serialized = filteredContainers.map(g => ({
    container: g,
    docs: (goldMap.get(g.key) ?? []).map(d => ({ ...d, _url: fileUrl(d.storage_bucket, d.storage_path) })),
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="Marketing · Documents"
        subtitle={`${totalVisible} docs sorted like a marketing manager thinks · media library at /marketing/gallery`}
        tabs={tabs}
      >
        {/* Dynamic behaviour banner */}
        <div style={{ gridColumn:'1 / -1', padding:'10px 14px', background:'#FFF4D6', border:'1px solid '+AMBER, borderRadius:4, fontSize:12, color:INK, lineHeight:1.6 }}>
          <strong>Dynamic.</strong> Every doc is classified at page-load time from its <code>doc_type</code> + <code>doc_subtype</code> in <code>dms.documents</code>. Change those in the doc registry and it moves to the matching Gold container automatically — nothing is deleted. Hidden here (not marketing): {hiddenNonMkt.length} tech/land/HR docs. Hidden as media: {hiddenMedia.length} images/logos (see <Link href="/marketing/gallery" style={{ color:GREEN }}>Media library</Link>).
        </div>

        {/* Media redirect callout */}
        <div style={{ gridColumn:'1 / -1', padding:'10px 14px', background:CREAM, border:'1px solid '+HAIR, borderLeft:'3px solid '+GREEN, borderRadius:6, fontSize:12, color:INK, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <strong>Photos · logos · videos?</strong> They live in the media library, not here.
          </div>
          <Link href="/marketing/gallery" style={{ padding:'5px 12px', fontSize:11, fontWeight:600, background:GREEN, color:'#FFFFFF', textDecoration:'none', borderRadius:4 }}>Media library →</Link>
        </div>

        {/* KPI strip */}
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* Filter chips */}
        <div style={{ gridColumn:'1 / -1', display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
          <Link href="/marketing/docs" style={chipStyle(!activeContainer)}>All ({totalVisible})</Link>
          {GOLD.map(g => (
            <Link key={g.key} href={`/marketing/docs?gold=${g.key}`} style={chipStyle(activeContainer === g.key)}>
              {g.label} ({goldMap.get(g.key)?.length ?? 0})
            </Link>
          ))}
        </div>

        {/* Client-side sections with preview modal */}
        <div style={{ gridColumn:'1 / -1' }}>
          <DocsClient sections={serialized} />
        </div>
      </DashboardPage>
    </div>
  );
}

function chipStyle(active: boolean) {
  return {
    padding:'5px 12px',
    fontSize:11,
    fontWeight:600 as const,
    background: active ? GREEN : '#FFFFFF',
    color: active ? '#FFFFFF' : INK,
    border: '1px solid ' + (active ? GREEN : HAIR),
    borderRadius: 4,
    textDecoration: 'none' as const,
  };
}
