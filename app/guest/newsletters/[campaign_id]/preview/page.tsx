// app/guest/newsletters/[campaign_id]/preview/page.tsx
// PBS 2026-07-03: full-page preview of a saved campaign — locked chrome
// (Namkhan header + footer) wrapped around the campaign body_md.
// Read-only; edit is at /guest/newsletters/[campaign_id].

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { campaign_id: string }; }

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^## (.+)$/gm,'<h2>$1</h2>')
    .replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,'<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" style="color:#1F3A2E;text-decoration:underline">$1</a>')
    .replace(/^---$/gm,'<hr style="border:none;border-top:1px solid #E6DFCC;margin:18px 0" />')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1" style="max-width:100%;height:auto;display:block;margin:16px 0;border-radius:4px" />');
  const paragraphs = html.split(/\n\n+/).map((p) => {
    if (p.startsWith('<h1') || p.startsWith('<h2') || p.startsWith('<h3') || p.startsWith('<hr') || p.startsWith('<img')) return p;
    return '<p style="margin:12px 0">' + p + '</p>';
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

  const WHITE='#FFFFFF'; const CREAM='#F5F0E1'; const HAIR='#E6DFCC';
  const INK='#1B1B1B'; const INK_M='#5A5A5A'; const GREEN='#1F3A2E';

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

        <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:8, overflow:'hidden' }}>
          {/* Header (locked chrome) */}
          <div style={{ padding:'28px 24px', textAlign:'center', background:CREAM, borderBottom:'1px solid '+HAIR }}>
            <div style={{ fontSize:22, fontWeight:600, letterSpacing:'0.14em', color:INK, fontFamily:'Georgia, serif' }}>THE NAMKHAN</div>
            <div style={{ fontSize:11, color:INK_M, marginTop:6, letterSpacing:'0.08em' }}>Luang Prabang · Laos</div>
          </div>

          {/* Meta before body */}
          <div style={{ padding:'16px 24px 0', fontSize:11, color:INK_M }}>
            <div>From: <strong style={{ color:INK }}>{c.from_name}</strong> &lt;{c.from_email}&gt;</div>
            {c.reply_to && <div>Reply-to: {c.reply_to}</div>}
            <div>Subject: <strong style={{ color:INK }}>{c.subject}</strong></div>
          </div>

          {/* Body */}
          <div style={{ padding:'12px 24px 32px', color:INK, fontSize:14, lineHeight:1.7, fontFamily:'Georgia, serif' }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(c.body_md ?? '') }} />

          {/* Footer (locked chrome) */}
          <div style={{ padding:'22px 24px', background:CREAM, borderTop:'1px solid '+HAIR, textAlign:'center', fontSize:11, color:INK_M, lineHeight:1.7 }}>
            <div style={{ fontWeight:600, color:INK, letterSpacing:'0.08em', marginBottom:6 }}>THE NAMKHAN</div>
            <div>Ban Xieng Lom, Luang Prabang, Laos</div>
            <div>hello@thenamkhan.com</div>
            <div style={{ margin:'12px 0', fontSize:12 }}>
              <a href="https://www.instagram.com/namkhanretreat/" style={{ color:INK_M, textDecoration:'none', margin:'0 8px' }}>Instagram</a>·
              <a href="https://thenamkhan.com" style={{ color:INK_M, textDecoration:'none', margin:'0 8px' }}>Website</a>·
              <a href="#" style={{ color:INK_M, textDecoration:'none', margin:'0 8px' }}>Unsubscribe</a>
            </div>
            {c.booking_code && (
              <div style={{ marginTop:8, fontSize:10, color:INK_M, fontFamily:'ui-monospace, SFMono-Regular, monospace' }}>
                Tracking code: {c.booking_code}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
