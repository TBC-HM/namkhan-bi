'use client';
// app/guest/newsletters/[campaign_id]/_components/CampaignEditor.tsx
// PBS 2026-07-05 v2 · 2026-07-21 v3: shared renderEmailFrame() for live preview.

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import TenantLink from '@/components/nav/TenantLink';
import { supabase } from '@/lib/supabase';
import MediaPicker from './MediaPicker';
import RefineNewsletterButton from './RefineNewsletterButton';
import { renderEmailFrame, markdownToInlineHtml } from '@/lib/emailFrame';

interface Props { initial: Record<string, unknown>; }

const WHITE='#FFFFFF'; const HAIR='#E6DFCC'; const INK='#1B1B1B';
const INK_M='#5A5A5A'; const GREEN='#1F3A2E'; const RED='#B03826';

// Extract first ![](url) as hero, strip it from body_md before rendering the frame.
function splitHeroAndBody(md: string): { heroUrl: string | null; bodyMd: string } {
  const m = /!\[[^\]]*\]\(([^)]+)\)/m.exec(md);
  if (!m) return { heroUrl: null, bodyMd: md };
  const url = m[1];
  const bodyMd = md.replace(m[0], '').replace(/^\s*\n+/, '');
  return { heroUrl: url, bodyMd };
}

export default function CampaignEditor({ initial }: Props) {
  const router = useRouter();
  const init = initial as {
    campaign_id: string; name?: string; subject?: string; body_md?: string; from_name?: string;
    from_email?: string; reply_to?: string; booking_code?: string; booking_url?: string;
    status?: string; template_key?: string | null; created_at: string; planned_date?: string | null;
    campaign_kind?: string | null;
    relative_kind?: 'booking_confirm' | 'before_checkin' | 'after_checkout' | null;
    relative_days?: number | null;
    relative_hour?: number | null;
  };
  const isLifecycle = (init.campaign_kind ?? 'broadcast') === 'lifecycle';
  const [name,     setName]     = useState<string>(init.name ?? '');
  const [subject,  setSubject]  = useState<string>(init.subject ?? '');
  const [bodyMd,   setBodyMd]   = useState<string>(init.body_md ?? '');
  const [fromName, setFromName] = useState<string>(init.from_name ?? 'The Namkhan');
  const [fromEmail,setFromEmail]= useState<string>(init.from_email ?? 'info@thenamkhan.com');
  const [replyTo,  setReplyTo]  = useState<string>(init.reply_to ?? 'info@thenamkhan.com');
  const [bookCode, setBookCode] = useState<string>(init.booking_code ?? '');
  const [bookUrl,  setBookUrl]  = useState<string>(init.booking_url ?? '');
  const [status,   setStatus]   = useState<string>(init.status ?? 'draft');
  const [plannedDate, setPlannedDate] = useState<string>(init.planned_date ?? '');
  // Lifecycle trigger fields
  const [relKind, setRelKind]   = useState<'booking_confirm'|'before_checkin'|'after_checkout'>(init.relative_kind ?? 'before_checkin');
  const [relDays, setRelDays]   = useState<number>(init.relative_days ?? (init.relative_kind === 'booking_confirm' ? 0 : init.relative_kind === 'after_checkout' ? 1 : 7));
  const [relHour, setRelHour]   = useState<number>(init.relative_hour ?? 10);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<null | 'insert' | 'replace-hero'>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const { error } = await supabase.rpc('fn_update_campaign', {
        p_campaign_id: init.campaign_id,
        p_name: name, p_subject: subject, p_body_md: bodyMd,
        p_from_name: fromName, p_from_email: fromEmail, p_reply_to: replyTo,
        p_booking_code: bookCode, p_booking_url: bookUrl,
        p_status: status, p_scheduled_at: null,
        p_relative_kind: isLifecycle ? relKind : null,
        p_relative_days: isLifecycle ? relDays : null,
        p_relative_hour: isLifecycle ? relHour : null,
      });
      if (error) throw error;

      // planned_date only applies to broadcast campaigns
      if (!isLifecycle) {
        const { error: err2 } = await supabase.rpc('fn_set_campaign_planned_date', {
          p_campaign_id: init.campaign_id,
          p_planned_date: plannedDate ? plannedDate : null,
        });
        if (err2) throw err2;
      }

      setMsg('Saved.'); router.refresh();
    } catch (e) {
      const em = e instanceof Error ? e.message : String(e);
      setMsg('Error: ' + em);
    } finally { setSaving(false); }
  }

  async function del() {
    if (!confirm('Delete this campaign? This removes it and all its recipients.')) return;
    setSaving(true); setMsg(null);
    try {
      const { error } = await supabase.rpc('fn_delete_campaign', { p_campaign_id: init.campaign_id });
      if (error) throw error;
      router.push('/guest/newsletters');
    } catch (e) {
      const em = e instanceof Error ? e.message : String(e);
      setMsg('Error: ' + em); setSaving(false);
    }
  }

  function insertImage(url: string) {
    const ta = bodyRef.current;
    const markdown = `![](${url})`;
    if (!ta) { setBodyMd(bodyMd + '\n\n' + markdown + '\n'); return; }
    const start = ta.selectionStart; const end = ta.selectionEnd;
    setBodyMd(bodyMd.slice(0, start) + markdown + bodyMd.slice(end));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + markdown.length, start + markdown.length); }, 0);
  }
  function replaceHero(url: string) {
    // find first ![](...) and replace or prepend
    const heroRe = /^!\[[^\]]*\]\([^)]*\)/m;
    if (heroRe.test(bodyMd)) setBodyMd(bodyMd.replace(heroRe, `![](${url})`));
    else setBodyMd(`![](${url})\n\n` + bodyMd);
  }

  // Live preview via shared frame
  const { heroUrl, bodyMd: bodyWithoutHero } = splitHeroAndBody(bodyMd);
  const previewHtml = renderEmailFrame({
    heroImageUrl: heroUrl,
    heroAlt: subject || name,
    bodyHtml: markdownToInlineHtml(bodyWithoutHero),
    propertyName: 'THE NAMKHAN',
    propertyEmail: fromEmail || 'info@thenamkhan.com',
    propertyWebsite: 'thenamkhan.com',
    unsubscribeUrl: '#unsubscribe',
  });

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:12, marginBottom:16 }}>
        <div>
          <div style={{ fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase', color:INK_M }}>Guest · Newsletter</div>
          <h1 style={{ fontSize:22, fontWeight:600, margin:'4px 0 0 0', color:INK }}>{init.name}</h1>
          <div style={{ fontSize:12, color:INK_M, marginTop:4 }}>
            Status: <strong style={{ color:INK }}>{status}</strong> · Template: {init.template_key ?? '—'} · Created {new Date(init.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
          </div>
        </div>
        <TenantLink href="/guest/newsletters" style={{ padding:'6px 14px', fontSize:12, color:INK_M, textDecoration:'none' }}>← Back to overview</TenantLink>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:'16px 18px' }}>
          {field('Campaign name', <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={ip} />)}
          {field('Subject', <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} style={ip} />)}
          {isLifecycle ? (
            <>
              <div style={{ fontSize:11, color:INK_M, marginBottom:6 }}>
                Lifecycle send is <strong style={{ color:INK }}>event-driven</strong> — this email fires for each guest at their own trigger date.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:12 }}>
                {field('Trigger event',
                  <select value={relKind}
                    onChange={(e) => setRelKind(e.target.value as 'booking_confirm'|'before_checkin'|'after_checkout')}
                    style={{ ...ip, background:WHITE }}>
                    <option value="booking_confirm">On booking (booking_date + N days)</option>
                    <option value="before_checkin">Before check-in (arrival − N days)</option>
                    <option value="after_checkout">After check-out (departure + N days)</option>
                  </select>)}
                {field('Days offset',
                  <input type="number" min={0} max={365} value={relDays}
                    onChange={(e) => setRelDays(Math.max(0, Math.min(365, Number(e.target.value) || 0)))} style={ip} />)}
                {field('Send hour (Vientiane)',
                  <input type="number" min={0} max={23} value={relHour}
                    onChange={(e) => setRelHour(Math.max(0, Math.min(23, Number(e.target.value) || 0)))} style={ip} />)}
                {field('Status',
                  <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...ip, background:WHITE }}>
                    <option value="draft">draft</option>
                    <option value="scheduled">scheduled</option>
                    <option value="archived">archived</option>
                  </select>)}
              </div>
            </>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {field('Planned send date', <input type="date" value={plannedDate ?? ''} onChange={(e) => setPlannedDate(e.target.value)} style={ip} />)}
              {field('Status',
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...ip, background:WHITE }}>
                  <option value="draft">draft</option>
                  <option value="scheduled">scheduled</option>
                  <option value="archived">archived</option>
                </select>)}
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {field('From name', <input type="text" value={fromName} onChange={(e) => setFromName(e.target.value)} style={ip} />)}
            {field('From email', <input type="text" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} style={ip} />)}
          </div>
          {field('Reply-to', <input type="text" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} style={ip} />)}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:12 }}>
            {field('Booking code', <input type="text" value={bookCode} onChange={(e) => setBookCode(e.target.value)} style={ip} />)}
            {field('Booking URL', <input type="text" value={bookUrl} onChange={(e) => setBookUrl(e.target.value)} style={ip} />)}
          </div>

          <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center', flexWrap:'wrap' }}>
            <label style={{ fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, flex:1 }}>Body (Markdown)</label>
            <RefineNewsletterButton
              campaignId={init.campaign_id}
              currentSubject={subject}
              currentBodyMd={bodyMd}
              onAccept={(newSubject, newBodyMd) => {
                if (newSubject != null) setSubject(newSubject);
                if (newBodyMd != null) setBodyMd(newBodyMd);
                setMsg('AI proposal accepted — click Save changes to persist.');
              }}
            />
            <button type="button" onClick={() => setPickerMode('replace-hero')} style={smallBtn}>Change hero photo</button>
            <button type="button" onClick={() => setPickerMode('insert')} style={smallBtn}>Insert photo</button>
          </div>
          <textarea ref={bodyRef} rows={18} value={bodyMd} onChange={(e) => setBodyMd(e.target.value)}
            style={{ ...ip, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:12, resize:'vertical', marginBottom:12 }} />

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
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, marginBottom:8 }}>Live preview (shared frame)</div>
          <div style={{ background:'#FAFAF7', border:'1px solid '+HAIR, borderRadius:6, overflow:'hidden' }}>
            <div style={{ padding:'8px 12px', background:'#F5F0E1', borderBottom:'1px solid '+HAIR, fontSize:11, color:INK_M }}>
              Subject: <strong style={{ color:INK }}>{subject || '(no subject)'}</strong>
            </div>
            <iframe title="campaign-preview" srcDoc={previewHtml} style={{ width:'100%', height:720, border:'none', background:'#F0EBE1', display:'block' }} />
          </div>
        </div>
      </div>

      {pickerMode && (
        <MediaPicker
          onPick={(url) => { if (pickerMode === 'replace-hero') replaceHero(url); else insertImage(url); setPickerMode(null); }}
          onClose={() => setPickerMode(null)}
        />
      )}
    </div>
  );
}

function field(label: string, child: React.ReactNode) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:12 }}>
      <label style={{ fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#5A5A5A' }}>{label}</label>
      {child}
    </div>
  );
}

const ip: React.CSSProperties = { padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:4, fontSize:13, color:INK, boxSizing:'border-box', width:'100%' };
const smallBtn: React.CSSProperties = { padding:'4px 10px', fontSize:10, fontWeight:600, background:WHITE, color:GREEN, border:'1px solid '+HAIR, borderRadius:3, cursor:'pointer' };
