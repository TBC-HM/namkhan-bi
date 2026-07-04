// app/guest/newsletters/[campaign_id]/preview/page.tsx
// PBS 2026-07-04 v4: trimmer footer + SLH logo bottom-left · greeting stays formal · hero pulled from first ![]() in body

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { campaign_id: string }; }

const SLH_SAGE = 'https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/documents-public/marketing/2026/marketing/slh-considerate-sage-brand-asset-moqc2kgi.svg';

function extractHero(md: string): { hero: string | null; rest: string } {
  const m = md.match(/^!\[[^\]]*\]\(([^)]+)\)\s*\n+/);
  if (m) return { hero: m[1], rest: md.slice(m[0].length) };
  return { hero: null, rest: md };
}

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^### (.+)$/gm,'<h3 style="font-family:Georgia,serif;font-size:15px;color:#1B1B1B;margin:22px 0 8px">$1</h3>')
    .replace(/^## (.+)$/gm,'<h2 style="font-family:Georgia,serif;font-size:22px;color:#084838;margin:28px 0 10px;letter-spacing:0.01em">$1</h2>')
    .replace(/^# (.+)$/gm,'<h1 style="font-family:Georgia,serif;font-size:32px;color:#084838;margin:8px 0 18px;letter-spacing:0.02em;line-height:1.15;font-style:italic">$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,'<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" style="display:inline-block;color:#FFFFFF;background:#084838;padding:8px 18px;border-radius:2px;text-decoration:none;font-weight:600;font-size:13px;letter-spacing:0.04em;margin:6px 0">$1</a>')
    .replace(/^---$/gm,'<hr style="border:none;border-top:1px solid #C79A6B;width:60px;margin:32px auto" />')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1" style="max-width:100%;height:auto;display:block;margin:14px 0 4px;border-radius:2px" />');
  const paragraphs = html.split(/\n\n+/).map((p) => {
    if (p.startsWith('<h1') || p.startsWith('<h2') || p.startsWith('<h3') || p.startsWith('<hr') || p.startsWith('<img')) return p;
    return '<p style="margin:14px 0">' + p + '</p>';
  });
  return paragraphs.join('\n');
}

export default async function CampaignPreviewPage({ params }: Props) {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('guest').from('campaigns')
    .select('*').eq('campaign_id', params.campaign_id).maybeSingle();
  if (!data) notFound();
  const c = data as any;
  if (c.property_id !== PROPERTY_ID) notFound();

  const { hero, rest } = extractHero(c.body_md ?? '');

  const WHITE='#FFFFFF'; const CREAM='#F7F0E1'; const HAIR='#E6DFCC';
  const INK='#1B1B1B'; const INK_M='#5A5A5A';
  const NK_GREEN='#084838'; const BRASS='#C79A6B';

  return (
    <div style={{ background:'#FAF7EE', minHeight:'100vh', padding:'32px 24px' }}>
      <div style={{ maxWidth: 680, margin:'0 auto' }}>

        {/* Meta bar (not part of email — for you) */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, fontSize:11, color:INK_M }}>
          <Link href="/guest/newsletters" style={{ color:INK_M, textDecoration:'none' }}>← Back to overview</Link>
          <div>
            <span>Status: <strong style={{ color:INK }}>{c.status}</strong></span>
            <span style={{ margin:'0 8px' }}>·</span>
            <Link href={`/guest/newsletters/${c.campaign_id}`} style={{ color:NK_GREEN, fontWeight:600, textDecoration:'none' }}>Edit →</Link>
          </div>
        </div>

        <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:4, overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }}>

          {/* HEADER — Namkhan wordmark (text placeholder · Forest Green) + SLH badge */}
          <div style={{ padding:'28px 24px 18px', textAlign:'center', background:CREAM, borderBottom:'2px solid '+BRASS }}>
            <div style={{ fontSize:26, fontWeight:400, letterSpacing:'0.34em', color:NK_GREEN, fontFamily:'Georgia, "Times New Roman", serif', marginBottom:6 }}>
              THE NAMKHAN
            </div>
            <div style={{ display:'inline-block', height:1, width:36, background:BRASS, verticalAlign:'middle', margin:'0 10px 4px' }} />
            <div style={{ display:'inline-block', fontSize:9, letterSpacing:'0.22em', color:INK_M, textTransform:'uppercase', verticalAlign:'middle' }}>
              Luang Prabang · Laos
            </div>
            <div style={{ display:'inline-block', height:1, width:36, background:BRASS, verticalAlign:'middle', margin:'0 10px 4px' }} />
            <div style={{ marginTop:10, fontSize:8, letterSpacing:'0.30em', color:INK_M, textTransform:'uppercase', fontStyle:'italic' }}>
              A Small Luxury Hotel of the World
            </div>
          </div>

          {hero && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero} alt="" style={{ width:'100%', height:340, objectFit:'cover', display:'block' }} />
          )}

          <div style={{ padding:'8px 32px 32px', color:INK, fontSize:15, lineHeight:1.75, fontFamily:'Georgia, "Times New Roman", serif' }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(rest) }} />

          {/* FOOTER — trimmer + SLH logo bottom-left */}
          <div style={{ background:CREAM, borderTop:'2px solid '+BRASS, padding:'16px 22px', fontSize:10, color:INK_M, lineHeight:1.6 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              {/* SLH logo bottom-left · clickable */}
              <a href="https://www.slh.com/experiences/considerate-collection" target="_blank" rel="noopener noreferrer"
                style={{ flex:'0 0 auto', display:'inline-block', textDecoration:'none' }} title="Small Luxury Hotels · Considerate Collection">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SLH_SAGE} alt="SLH Considerate Collection" style={{ height:34, width:'auto', opacity:0.9 }} />
              </a>

              {/* Address centre */}
              <div style={{ flex:'1 1 auto', textAlign:'center', minWidth:180 }}>
                <div style={{ fontWeight:600, color:NK_GREEN, letterSpacing:'0.14em', fontSize:11, fontFamily:'Georgia, serif' }}>THE NAMKHAN</div>
                <div style={{ marginTop:2 }}>Ban Xieng Lom · Luang Prabang · Laos</div>
                <div>hello@thenamkhan.com</div>
              </div>

              {/* Social right */}
              <div style={{ flex:'0 0 auto', textAlign:'right', fontSize:10 }}>
                <a href="https://www.instagram.com/namkhanretreat/" style={{ color:INK, textDecoration:'none', margin:'0 4px', fontWeight:500 }}>IG</a>·
                <a href="https://thenamkhan.com" style={{ color:INK, textDecoration:'none', margin:'0 4px', fontWeight:500 }}>Web</a>·
                <a href="#" style={{ color:INK, textDecoration:'none', margin:'0 4px', fontWeight:500 }}>Unsub.</a>
              </div>
            </div>
            {c.booking_code && (
              <div style={{ marginTop:8, fontSize:8, color:INK_M, fontFamily:'ui-monospace, SFMono-Regular, monospace', textAlign:'center', opacity:0.6 }}>
                {c.booking_code}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
