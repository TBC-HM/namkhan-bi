'use client';
// app/guest/newsletters/[campaign_id]/_components/CampaignEditor.tsx
// PBS 2026-07-03: view + edit a campaign with live preview + Save + Delete.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Props { initial: any; }

const WHITE='#FFFFFF'; const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_S='#3A3A3A';
const INK_M='#5A5A5A'; const GREEN='#1F3A2E'; const RED='#B03826';

function renderMarkdownLite(md: string): string {
  let html = md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^## (.+)$/gm,'<h2>$1</h2>')
    .replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,'<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>')
    .replace(/^---$/gm,'<hr />')
    .replace(/\n\n/g,'</p><p>');
  return '<p>'+html+'</p>';
}

export default function CampaignEditor({ initial }: Props) {
  const router = useRouter();
  const [name,     setName]     = useState<string>(initial.name ?? '');
  const [subject,  setSubject]  = useState<string>(initial.subject ?? '');
  const [bodyMd,   setBodyMd]   = useState<string>(initial.body_md ?? '');
  const [fromName, setFromName] = useState<string>(initial.from_name ?? 'Felix at The Namkhan');
  const [fromEmail,setFromEmail]= useState<string>(initial.from_email ?? 'hello@thenamkhan.com');
  const [replyTo,  setReplyTo]  = useState<string>(initial.reply_to ?? 'hello@thenamkhan.com');
  const [bookCode, setBookCode] = useState<string>(initial.booking_code ?? '');
  const [bookUrl,  setBookUrl]  = useState<string>(initial.booking_url ?? '');
  const [status,   setStatus]   = useState<string>(initial.status ?? 'draft');
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState<string | null>(null);

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const { error } = await supabase.rpc('fn_update_campaign', {
        p_campaign_id: initial.campaign_id,
        p_name: name, p_subject: subject, p_body_md: bodyMd,
        p_from_name: fromName, p_from_email: fromEmail, p_reply_to: replyTo,
        p_booking_code: bookCode, p_booking_url: bookUrl,
        p_status: status, p_scheduled_at: null,
        p_relative_kind: null, p_relative_days: null, p_relative_hour: null,
      });
      if (error) throw error;
      setMsg('Saved.'); router.refresh();
    } catch (e: any) {
      setMsg('Error: ' + (e?.message ?? e));
    } finally { setSaving(false); }
  }

  async function del() {
    if (!confirm('Delete this campaign? This removes it and all its recipients.')) return;
    setSaving(true); setMsg(null);
    try {
      const { error } = await supabase.rpc('fn_delete_campaign', { p_campaign_id: initial.campaign_id });
      if (error) throw error;
      router.push('/guest/newsletters');
    } catch (e: any) {
      setMsg('Error: ' + (e?.message ?? e));
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:12, marginBottom:16 }}>
        <div>
          <div style={{ fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase', color:INK_M }}>Guest · Newsletter</div>
          <h1 style={{ fontSize:22, fontWeight:600, margin:'4px 0 0 0', color:INK }}>{initial.name}</h1>
          <div style={{ fontSize:12, color:INK_M, marginTop:4 }}>
            Status: <strong style={{ color:INK }}>{status}</strong> · Template: {initial.template_key ?? '—'} · Created {new Date(initial.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
          </div>
        </div>
        <Link href="/guest/newsletters" style={{ padding:'6px 14px', fontSize:12, color:INK_M, textDecoration:'none' }}>← Back to overview</Link>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:'16px 18px' }}>
          {field('Campaign name', <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={ip} />)}
          {field('Subject', <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} style={ip} />)}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {field('From name', <input type="text" value={fromName} onChange={(e) => setFromName(e.target.value)} style={ip} />)}
            {field('From email', <input type="text" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} style={ip} />)}
          </div>
          {field('Reply-to', <input type="text" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} style={ip} />)}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:12 }}>
            {field('Booking code', <input type="text" value={bookCode} onChange={(e) => setBookCode(e.target.value)} style={ip} />)}
            {field('Booking URL', <input type="text" value={bookUrl} onChange={(e) => setBookUrl(e.target.value)} style={ip} />)}
          </div>
          {field('Body (Markdown)',
            <textarea rows={18} value={bodyMd} onChange={(e) => setBodyMd(e.target.value)}
              style={{ ...ip, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:12, resize:'vertical' }} />)}
          {field('Status',
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...ip, background:WHITE }}>
              <option value="draft">draft</option>
              <option value="scheduled">scheduled</option>
              <option value="archived">archived</option>
            </select>)}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:12 }}>
            <button type="button" onClick={save} disabled={saving} style={{
              padding:'8px 16px', fontSize:13, fontWeight:600,
              background: saving ? '#8A8A8A' : GREEN, color:WHITE, border:'none', borderRadius:4, cursor: saving ? 'default' : 'pointer',
            }}>{saving ? 'Saving…' : 'Save changes'}</button>
            <button type="button" onClick={del} disabled={saving} style={{
              padding:'8px 16px', fontSize:13, fontWeight:600,
              background:WHITE, color:RED, border:'1px solid '+RED, borderRadius:4, cursor:'pointer',
            }}>Delete</button>
            {msg && <span style={{ marginLeft:'auto', fontSize:12, color: msg.startsWith('Error') ? RED : GREEN }}>{msg}</span>}
          </div>
        </div>

        <div>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, marginBottom:8 }}>Live preview</div>
          <div style={{ background:'#FAFAF7', border:'1px solid '+HAIR, borderRadius:6, overflow:'hidden' }}>
            <div style={{ padding:'18px', textAlign:'center', background:'#F5F0E1', borderBottom:'1px solid '+HAIR }}>
              <div style={{ fontSize:16, fontWeight:600, letterSpacing:'0.08em', color:INK, fontFamily:'Georgia, serif' }}>THE NAMKHAN</div>
              <div style={{ fontSize:10, color:INK_M, marginTop:4, letterSpacing:'0.06em' }}>Luang Prabang · Laos</div>
            </div>
            <div style={{ padding:'20px 24px', background:WHITE, color:INK, fontSize:14, lineHeight:1.6 }}>
              <div style={{ fontSize:11, color:INK_M, marginBottom:8 }}>Subject preview:</div>
              <div style={{ fontWeight:600, marginBottom:16, fontSize:15 }}>{subject}</div>
              <div style={{ borderTop:'1px solid '+HAIR, paddingTop:12 }} dangerouslySetInnerHTML={{ __html: renderMarkdownLite(bodyMd) }} />
            </div>
            <div style={{ padding:'18px 24px', background:'#F5F0E1', borderTop:'1px solid '+HAIR, textAlign:'center', fontSize:11, color:INK_M, lineHeight:1.6 }}>
              <div style={{ fontWeight:600, color:INK, letterSpacing:'0.08em' }}>THE NAMKHAN</div>
              <div>Ban Xieng Lom, Luang Prabang, Laos</div>
              <div>hello@thenamkhan.com</div>
              <div style={{ margin:'10px 0' }}>[ IG ] [ FB ] [ TikTok ] [ Website ]</div>
              <div>Unsubscribe · Update preferences</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function field(label: string, child: any) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:12 }}>
      <label style={{ fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M }}>{label}</label>
      {child}
    </div>
  );
}

const ip: React.CSSProperties = { padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:4, fontSize:13, color:INK, boxSizing:'border-box', width:'100%' };
