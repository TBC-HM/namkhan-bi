// app/marketing/docs/page.tsx
// PBS 2026-07-03: Marketing docs library — brand assets, partner materials,
// collateral, sustainability. Reads from public.v_marketing_docs bridge view.

import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { DEPT_CFG } from '@/lib/dept-cfg';

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
  sensitivity: string | null;
  updated_at: string | null;
  tags: string[] | null;
}

export const dynamic = 'force-dynamic';
export const revalidate = 60;

function fileUrl(bucket: string | null, path: string | null): string {
  if (!bucket || !path) return '#';
  return `https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/${bucket}/${path}`;
}
function fmtSize(n: number | null): string {
  if (!n) return '';
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n/1024)}KB`;
  return `${(n/1024/1024).toFixed(1)}MB`;
}
function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

const WHITE='#FFFFFF'; const HAIR='#E6DFCC'; const INK='#1B1B1B';
const INK_S='#3A3A3A'; const INK_M='#5A5A5A'; const CREAM='#F5F0E1';

export default async function MarketingDocsPage() {
  const { data } = await supabase.from('v_marketing_docs')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .order('updated_at', { ascending: false });
  const docs: DocRow[] = (data as DocRow[]) ?? [];

  const brand = docs.filter(d => d.doc_subtype === 'brand_asset');
  const partner = docs.filter(d => d.doc_type === 'partner' || d.doc_subtype === 'partner_material');
  const collateral = docs.filter(d => d.doc_subtype === 'collateral');
  const sustain = docs.filter(d => ['sustainability_toolkit','certification_requirements'].includes(d.doc_subtype ?? ''));
  const faq = docs.filter(d => d.doc_subtype === 'faq');
  const templates = docs.filter(d => d.doc_subtype === 'template' || d.doc_type === 'template');
  const other = docs.filter(d => ![...brand, ...partner, ...collateral, ...sustain, ...faq, ...templates].includes(d));

  const cfg = DEPT_CFG.marketing;
  const tabs: DashboardTab[] = cfg.subPages.map((s: any) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/docs',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Total docs',     value: docs.length,     size: 'sm' },
    { label: 'Brand assets',   value: brand.length,    size: 'sm' },
    { label: 'Partner materials', value: partner.length, size: 'sm' },
    { label: 'Collateral',     value: collateral.length, size: 'sm' },
    { label: 'Sustainability', value: sustain.length,  size: 'sm' },
  ];

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Documents"
        subtitle={`${docs.length} marketing docs — brand assets, partner materials, collateral, sustainability certifications.`}
        tabs={tabs}
      >
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        <DocSection title="Brand assets" docs={brand} showThumb />
        <DocSection title="Partner materials" docs={partner} />
        <DocSection title="Templates" docs={templates} />
        <DocSection title="Collateral & fact sheets" docs={collateral} />
        <DocSection title="Sustainability & certifications" docs={sustain} />
        <DocSection title="FAQ" docs={faq} />
        <DocSection title="Other" docs={other} />
      </DashboardPage>
    </div>
  );
}

function DocSection({ title, docs, showThumb }: { title: string; docs: DocRow[]; showThumb?: boolean }) {
  if (docs.length === 0) return null;
  return (
    <div style={{ gridColumn:'1 / -1' }}>
      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, margin:'8px 2px 8px' }}>
        {title} · {docs.length}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:8 }}>
        {docs.map(d => {
          const url = fileUrl(d.storage_bucket, d.storage_path);
          const isImage = d.mime?.startsWith('image/');
          return (
            <a key={d.doc_id} href={url} target="_blank" rel="noopener noreferrer"
              style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, textDecoration:'none', color:INK, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              {showThumb && isImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" style={{ width:'100%', height:100, objectFit:'contain', background:CREAM, borderBottom:'1px solid '+HAIR }} />
              )}
              <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:4 }}>
                <div style={{ fontSize:13, fontWeight:600, color:INK, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                  {d.title}
                </div>
                <div style={{ fontSize:10, color:INK_M, display:'flex', gap:8, flexWrap:'wrap' }}>
                  {d.doc_subtype && <span>{d.doc_subtype}</span>}
                  {d.mime && <span>{d.mime.split('/').pop()}</span>}
                  {d.file_size_bytes && <span>{fmtSize(d.file_size_bytes)}</span>}
                </div>
                <div style={{ fontSize:10, color:'#8A8A8A' }}>Updated {fmtDate(d.updated_at)}</div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
