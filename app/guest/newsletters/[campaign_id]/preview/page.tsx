// app/guest/newsletters/[campaign_id]/preview/page.tsx
// PBS 2026-07-03 v2: proper chrome — Namkhan wordmark logo · SLH badge · hero image at top.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { campaign_id: string }; }

function extractHero(md: string): { hero: string | null; rest: string } {
  const m = md.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*\n+/);
  if (m) return { hero: m[2], rest: md.slice(m[0].length) };
  return { hero: null, rest: md };
}

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^### (.+)$/gm,'<h3 style="font-family:Georgia,serif;font-size:15px;color:#1B1B1B;margin:22px 0 8px">$1</h3>')
    .replace(/^## (.+)$/gm,'<h2 style="font-family:Georgia,serif;font-size:20px;color:#1B1B1B;margin:26px 0 10px;letter-spacing:0.01em">$1</h2>')
    .replace(/^# (.+)$/gm,'<h1 style="font-family:Georgia,serif;font-size:26px;color:#1B1B1B;margin:28px 0 14px;letter-spacing:0.01em;line-height:1.25">$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,'<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" style="color:#1F3A2E;text-decoration:underline;text-underline-offset:2px">$1</a>')
    .replace(/^---$/gm,'<hr style="border:none;border-top:1px solid #E6DFCC;margin:24px 0" />')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1" style="max-width:100%;height:auto;display:block;margin:20px 0;border-radius:4px" />');
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

  const WHITE='#FFFFFF'; const CREAM='#F5F0E1'; const HAIR='#E6DFCC';
  const INK='#1B1B1B'; const INK_M='#5A5A5A'; const GREEN='#1F3A2E'; const BRASS='#C79A6B';

  return (
    <div style={{ background:'#FAF7EE', minHeight:'100vh', padding:'32px 24px' }}>
      <div style={{ maxWidth: 680, margin:'0 auto' }}>

        {/* Meta bar (not part of email — for you) */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, fontSize:11, color:INK_M }}>
          <Link href="/guest/newsletters" style={{ color:INK_M, textDecoration:'none' }}>← Back to overview</Link>
          <div>
            <span>Status: <strong style={{ color:INK }}>{c.status}</strong></span>
            <span style={{ margin:'0 8px' }}>·</span>
            <Link href={`/guest/newsletters/${c.campaign_id}`} style={{ color:GREEN, fontWeight:600, textDecoration:'none' }}>Edit →</Link>
          </div>
        </div>

        <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:8, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>

          {/* HEADER (locked chrome) — Namkhan wordmark + SLH badge */}
          <div style={{ padding:'36px 24px 28px', textAlign:'center', background:CREAM, borderBottom:'3px solid '+BRASS }}>
            <div style={{ fontSize:28, fontWeight:400, letterSpacing:'0.32em', color:INK, fontFamily:'Georgia, "Times New Roman", serif', marginBottom:6 }}>
              THE NAMKHAN
            </div>
            <div style={{ display:'inline-block', height:1, width:44, background:BRASS, verticalAlign:'middle', margin:'0 12px 4px' }} />
            <div style={{ display:'inline-block', fontSize:9, letterSpacing:'0.24em', color:INK_M, textTransform:'uppercase', verticalAlign:'middle' }}>
              Luang Prabang · Laos
            </div>
            <div style={{ display:'inline-block', height:1, width:44, background:BRASS, verticalAlign:'middle', margin:'0 12px 4px' }} />
            <div style={{ marginTop:14, fontSize:8, letterSpacing:'0.30em', color:INK_M, textTransform:'uppercase', fontStyle:'italic' }}>
              A Small Luxury Hotel of the World
            </div>
          </div>

          {/* Hero image if present in body_md */}
          {hero && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero} alt="" style={{ width:'100%', height:280, objectFit:'cover', display:'block' }} />
          )}

          {/* Meta before body */}
          <div style={{ padding:'20px 28px 0', fontSize:11, color:INK_M }}>
            <div>From: <strong style={{ color:INK }}>{c.from_name}</strong> &lt;{c.from_email}&gt;</div>
            {c.reply_to && <div>Reply-to: {c.reply_to}</div>}
            <div>Subject: <strong style={{ color:INK }}>{c.subject}</strong></div>
          </div>

          {/* Body */}
          <div style={{ padding:'12px 28px 32px', color:INK, fontSize:14, lineHeight:1.75, fontFamily:'Georgia, "Times New Roman", serif' }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(rest) }} />

          {/* FOOTER (locked chrome) */}
          <div style={{ padding:'28px 24px 24px', background:CREAM, borderTop:'3px solid '+BRASS, textAlign:'center', fontSize:11, color:INK_M, lineHeight:1.75 }}>
            <div style={{ fontSize:16, fontWeight:400, letterSpacing:'0.24em', color:INK, fontFamily:'Georgia, serif', marginBottom:4 }}>THE NAMKHAN</div>
            <div style={{ fontSize:8, letterSpacing:'0.28em', color:INK_M, textTransform:'uppercase', fontStyle:'italic', marginBottom:14 }}>A Small Luxury Hotel of the World</div>
            <div>Ban Xieng Lom, Luang Prabang, Laos</div>
            <div>hello@thenamkhan.com</div>
            <div style={{ margin:'14px 0', fontSize:12 }}>
              <a href="https://www.instagram.com/namkhanretreat/" style={{ color:INK, textDecoration:'none', margin:'0 10px', fontWeight:500 }}>Instagram</a>·
              <a href="https://thenamkhan.com" style={{ color:INK, textDecoration:'none', margin:'0 10px', fontWeight:500 }}>Website</a>·
              <a href="#" style={{ color:INK, textDecoration:'none', margin:'0 10px', fontWeight:500 }}>Unsubscribe</a>
            </div>
            <div style={{ marginTop:8, fontSize:9, color:INK_M, letterSpacing:'0.06em' }}>
              You are receiving this because you stayed with us or booked an upcoming stay.
            </div>
            {c.booking_code && (
              <div style={{ marginTop:10, fontSize:9, color:INK_M, fontFamily:'ui-monospace, SFMono-Regular, monospace' }}>
                Tracking code: {c.booking_code}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
