// app/guest/newsletters/[campaign_id]/preview/page.tsx
// PBS 2026-07-04 v6: Send-test card at top · real IG/FB/TikTok handles from
// property.social · black SLH logo (bigger, linked) · unsub on own line ·
// no booking code shown in footer.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import SendTestCard from './_components/SendTestCard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { campaign_id: string }; }

const SLH_BLACK = 'https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/branding/slh_black.png';

function extractHero(md: string): { hero: string | null; rest: string } {
  const m = md.match(/^!\[[^\]]*\]\(([^)]+)\)\s*\n+/);
  if (m) return { hero: m[1], rest: md.slice(m[0].length) };
  return { hero: null, rest: md };
}

function renderMarkdown(md: string): string {
  const html = md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^### (.+)$/gm,'<h3 style="font-family:Georgia,serif;font-size:15px;color:#1B1B1B;margin:22px 0 8px">$1</h3>')
    .replace(/^## (.+)$/gm,'<h2 style="font-family:Georgia,serif;font-size:22px;color:#084838;margin:28px 0 10px;letter-spacing:0.01em">$1</h2>')
    .replace(/^# (.+)$/gm,'<h1 style="font-family:Georgia,serif;font-size:32px;color:#084838;margin:8px 0 18px;letter-spacing:0.02em;line-height:1.15;font-style:italic">$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,'<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1" style="max-width:100%;height:auto;display:block;margin:14px 0 4px;border-radius:2px" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" style="display:inline-block;color:#FFFFFF;background:#084838;padding:8px 18px;border-radius:2px;text-decoration:none;font-weight:600;font-size:13px;letter-spacing:0.04em;margin:6px 0">$1</a>')
    .replace(/^---$/gm,'<hr style="border:none;border-top:1px solid #C79A6B;width:60px;margin:32px auto" />');
  const paragraphs = html.split(/\n\n+/).map((p) => {
    if (p.startsWith('<h1') || p.startsWith('<h2') || p.startsWith('<h3') || p.startsWith('<hr') || p.startsWith('<img')) return p;
    return '<p style="margin:14px 0">' + p + '</p>';
  });
  return paragraphs.join('\n');
}

const InstagramIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display:'block' }}>
    <rect x="3" y="3" width="18" height="18" rx="5" stroke="#1B1B1B" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="4" stroke="#1B1B1B" strokeWidth="1.5" />
    <circle cx="17.5" cy="6.5" r="1.1" fill="#1B1B1B" />
  </svg>
);
const FacebookIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display:'block' }}>
    <path d="M22 12a10 10 0 1 0-11.56 9.87v-6.99h-2.54V12h2.54V9.79c0-2.51 1.5-3.9 3.79-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.88h-2.33v6.99A10 10 0 0 0 22 12Z" fill="#1B1B1B" />
  </svg>
);
const TikTokIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display:'block' }}>
    <path d="M16.9 6.13c-.9-.53-1.68-1.24-2.28-2.08a4.9 4.9 0 0 1-.9-2.05h-3.05v10.98c0 1.14-.98 2.06-2.18 2.06s-2.18-.92-2.18-2.06.98-2.06 2.18-2.06c.24 0 .48.04.71.12v-3.08a5.3 5.3 0 0 0-.7-.05C5.85 7.91 3.5 10.15 3.5 12.98 3.5 15.8 5.85 18 8.5 18s5.24-2.2 5.24-5.02V8.1a7.87 7.87 0 0 0 4.51 1.42V6.6a4.9 4.9 0 0 1-1.35-.47Z" fill="#1B1B1B" />
  </svg>
);

export default async function CampaignPreviewPage({ params }: Props) {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('guest').from('campaigns')
    .select('*').eq('campaign_id', params.campaign_id).maybeSingle();
  if (!data) notFound();
  const c = data as { property_id: number; campaign_id: string; status: string; body_md: string | null };
  if (c.property_id !== PROPERTY_ID) notFound();

  const { hero, rest } = extractHero(c.body_md ?? '');

  const WHITE='#FFFFFF'; const CREAM='#F7F0E1'; const HAIR='#E6DFCC';
  const INK='#1B1B1B'; const INK_M='#5A5A5A';
  const NK_GREEN='#084838'; const BRASS='#C79A6B';

  return (
    <div style={{ background:'#FAF7EE', minHeight:'100vh', padding:'32px 24px' }}>
      <div style={{ maxWidth: 680, margin:'0 auto' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, fontSize:11, color:INK_M }}>
          <Link href="/guest/newsletters" style={{ color:INK_M, textDecoration:'none' }}>← Back to overview</Link>
          <div>
            <span>Status: <strong style={{ color:INK }}>{c.status}</strong></span>
            <span style={{ margin:'0 8px' }}>·</span>
            <Link href={`/guest/newsletters/${c.campaign_id}`} style={{ color:NK_GREEN, fontWeight:600, textDecoration:'none' }}>Edit →</Link>
          </div>
        </div>

        {/* Send-test card */}
        <SendTestCard campaign_id={c.campaign_id} />

        <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:4, overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }}>

          {/* HEADER */}
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

          {/* FOOTER — SLH bigger + black + linked, REAL social handles from property.social */}
          <div style={{ background:CREAM, borderTop:'2px solid '+BRASS, padding:'20px 24px', fontSize:11, color:INK_M, lineHeight:1.6 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              <a href="https://www.slh.com/experiences/considerate-collection" target="_blank" rel="noopener noreferrer"
                style={{ flex:'0 0 auto', display:'inline-block', textDecoration:'none' }} title="Small Luxury Hotels of the World · Considerate Collection">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SLH_BLACK} alt="SLH · Considerate Collection" style={{ height:44, width:'auto' }} />
              </a>

              <div style={{ flex:'1 1 auto', textAlign:'center', minWidth:180 }}>
                <div style={{ fontWeight:600, color:NK_GREEN, letterSpacing:'0.14em', fontSize:12, fontFamily:'Georgia, serif' }}>THE NAMKHAN</div>
                <div style={{ marginTop:3 }}>Ban Xieng Lom · Luang Prabang · Laos</div>
                <div>hello@thenamkhan.com</div>
              </div>

              <div style={{ flex:'0 0 auto', display:'flex', gap:12, alignItems:'center' }}>
                <a href="https://www.instagram.com/the_namkhan_resort/" target="_blank" rel="noopener noreferrer" title="Instagram" style={{ opacity:0.85 }}>
                  <InstagramIcon />
                </a>
                <a href="https://www.facebook.com/Namkhanecolodge/" target="_blank" rel="noopener noreferrer" title="Facebook" style={{ opacity:0.85 }}>
                  <FacebookIcon />
                </a>
                <a href="https://www.tiktok.com/@the.namkhan" target="_blank" rel="noopener noreferrer" title="TikTok" style={{ opacity:0.85 }}>
                  <TikTokIcon />
                </a>
              </div>
            </div>

            <div style={{ marginTop:14, textAlign:'center', fontSize:10, color:INK_M }}>
              <a href="#" style={{ color:INK_M, textDecoration:'underline', textUnderlineOffset:2 }}>Unsubscribe</a>
              <span style={{ margin:'0 8px', opacity:0.4 }}>·</span>
              <a href="https://thenamkhan.com" style={{ color:INK_M, textDecoration:'underline', textUnderlineOffset:2 }}>thenamkhan.com</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
