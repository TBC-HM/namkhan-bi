'use client';
// app/guest/newsletters/templates/[key]/_components/TemplateEditor.tsx
// PBS 2026-07-03: client-side template editor. Form + live markdown preview.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, PROPERTY_ID } from '@/lib/supabase';

interface Props { initial: any | null; isNew: boolean; }

const CATEGORIES = ['transactional', 'marketing', 'editorial'];
const TRIGGERS = [
  { key: 'manual',                    label: 'Manual (you pick when to send)' },
  { key: 'relative_before_checkin',   label: 'Auto — X days before check-in' },
  { key: 'relative_after_checkout',   label: 'Auto — X days after check-out' },
  { key: 'quarterly',                 label: 'Quarterly (auto)' },
];

const WHITE='#FFFFFF'; const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_S='#3A3A3A';
const INK_M='#5A5A5A'; const GREEN='#1F3A2E'; const RED='#B03826';

function fieldWrap(label: string, children: any, hint?: string) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:14 }}>
      <label style={{ fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize:11, color:INK_M }}>{hint}</div>}
    </div>
  );
}

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

export default function TemplateEditor({ initial, isNew }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [templateKey, setTemplateKey] = useState<string>(initial?.template_key ?? '');
  const [label,       setLabel]       = useState<string>(initial?.label ?? '');
  const [description, setDescription] = useState<string>(initial?.description ?? '');
  const [subject,     setSubject]     = useState<string>(initial?.subject ?? '');
  const [category,    setCategory]    = useState<string>(initial?.category ?? 'marketing');
  const [heroImage,   setHeroImage]   = useState<string>(initial?.hero_image_url ?? '');
  const [bodyMd,      setBodyMd]      = useState<string>(initial?.body_md ?? '');
  const [triggerKind, setTriggerKind] = useState<string>(initial?.trigger_kind ?? 'manual');
  const [triggerDays, setTriggerDays] = useState<string>(initial?.trigger_days != null ? String(initial.trigger_days) : '');
  const [audience,    setAudience]    = useState<string>(initial?.audience_hint ?? '');
  const [variantsRaw, setVariantsRaw] = useState<string>(initial?.variants_json ? JSON.stringify(initial.variants_json, null, 2) : '{}');
  const [isActive,    setIsActive]    = useState<boolean>(initial?.is_active ?? true);

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const cleanKey = (templateKey || '').trim().toLowerCase().replace(/[^a-z0-9_]/g,'_');
      if (!cleanKey) throw new Error('Template key is required');
      if (!label.trim()) throw new Error('Label is required');
      let variants: any = {};
      try { variants = JSON.parse(variantsRaw); } catch { throw new Error('Variants JSON is not valid JSON'); }
      const blocksJson = initial?.blocks_json ?? [];
      const { error } = await supabase.rpc('fn_upsert_newsletter_template', {
        p_template_key: cleanKey, p_property_id: PROPERTY_ID,
        p_label: label, p_description: description, p_subject: subject, p_category: category,
        p_hero_image_url: heroImage || null, p_blocks_json: blocksJson, p_body_md: bodyMd,
        p_variants_json: variants, p_trigger_kind: triggerKind,
        p_trigger_days: triggerDays.trim() ? Number(triggerDays) : null,
        p_audience_hint: audience, p_is_active: isActive,
      });
      if (error) throw error;
      setMsg('Saved.');
      if (isNew) router.push('/guest/newsletters/templates/' + cleanKey);
      else router.refresh();
    } catch (e: any) {
      setMsg('Error: ' + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
      <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:'16px 18px' }}>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, marginBottom:12 }}>Template</div>
        {fieldWrap('Key', <input type="text" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} disabled={!isNew} placeholder="e.g. anticipation" style={{ padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:4, fontSize:13, color:INK }} />, isNew ? 'Lowercase / digits / underscores. Locked after create.' : 'Locked.')}
        {fieldWrap('Label', <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Anticipation" style={{ padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:4, fontSize:13, color:INK }} />)}
        {fieldWrap('Description', <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} style={{ padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:4, fontSize:12, color:INK, resize:'vertical' }} />)}
        {fieldWrap('Subject', <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Your Namkhan stay is coming up, {{first_name}}" style={{ padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:4, fontSize:13, color:INK }} />, 'Use {{first_name}}, {{days_to_arrival}}, {{booking_code}}.')}
        {fieldWrap('Category', <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:4, fontSize:13, color:INK, background:WHITE }}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>)}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:12 }}>
          {fieldWrap('Trigger', <select value={triggerKind} onChange={(e) => setTriggerKind(e.target.value)} style={{ padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:4, fontSize:13, color:INK, background:WHITE }}>{TRIGGERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select>)}
          {fieldWrap('Days', <input type="number" value={triggerDays} onChange={(e) => setTriggerDays(e.target.value)} disabled={triggerKind === 'manual' || triggerKind === 'quarterly'} placeholder="e.g. 5" style={{ padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:4, fontSize:13, color:INK }} />)}
        </div>
        {fieldWrap('Audience hint', <input type="text" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Guests with upcoming arrival · 3–7 days" style={{ padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:4, fontSize:13, color:INK }} />)}
        {fieldWrap('Hero image URL', <input type="text" value={heroImage} onChange={(e) => setHeroImage(e.target.value)} placeholder="https://..." style={{ padding:'6px 10px', border:'1px solid '+HAIR, borderRadius:4, fontSize:13, color:INK }} />)}
        {fieldWrap('Body (Markdown)', <textarea rows={12} value={bodyMd} onChange={(e) => setBodyMd(e.target.value)} style={{ padding:'8px 10px', border:'1px solid '+HAIR, borderRadius:4, fontSize:12, color:INK, resize:'vertical', fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace' }} />, 'Use ## / ** ** / [link](url). Tokens: {{first_name}}, {{days_to_arrival}}, {{booking_code}}, {{weather_summary}}, {{transfer_status}}.')}
        {fieldWrap('Variants JSON (advanced)', <textarea rows={8} value={variantsRaw} onChange={(e) => setVariantsRaw(e.target.value)} style={{ padding:'8px 10px', border:'1px solid '+HAIR, borderRadius:4, fontSize:11, color:INK, resize:'vertical', fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace' }} />, 'Override subject/copy for specific language/party/tier.')}
        <label style={{ display:'flex', gap:8, alignItems:'center', fontSize:12, color:INK_S, marginTop:6, marginBottom:12 }}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
        </label>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:6 }}>
          <button type="button" onClick={save} disabled={saving} style={{ padding:'8px 16px', fontSize:13, fontWeight:600, background: saving ? '#8A8A8A' : GREEN, color:WHITE, border:'none', borderRadius:4, cursor: saving ? 'default' : 'pointer' }}>{saving ? 'Saving…' : (isNew ? 'Create template' : 'Save changes')}</button>
          <a href="/guest/newsletters/templates" style={{ fontSize:12, color:INK_M, textDecoration:'none' }}>Cancel</a>
          {msg && <span style={{ marginLeft:'auto', fontSize:12, color: msg.startsWith('Error') ? RED : GREEN }}>{msg}</span>}
        </div>
      </div>
      <div>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, marginBottom:8 }}>Preview</div>
        <div style={{ background:'#FAFAF7', border:'1px solid '+HAIR, borderRadius:6, overflow:'hidden' }}>
          <div style={{ padding:'18px', textAlign:'center', background:'#F5F0E1', borderBottom:'1px solid '+HAIR }}>
            <div style={{ fontSize:16, fontWeight:600, letterSpacing:'0.08em', color:INK, fontFamily:'Georgia, serif' }}>THE NAMKHAN</div>
            <div style={{ fontSize:10, color:INK_M, marginTop:4, letterSpacing:'0.06em' }}>Luang Prabang · Laos</div>
          </div>
          {heroImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImage} alt="" style={{ width:'100%', height:200, objectFit:'cover', display:'block' }} />
          )}
          <div style={{ padding:'20px 24px', background:WHITE, color:INK, fontSize:14, lineHeight:1.6 }}>
            <div style={{ fontSize:11, color:INK_M, marginBottom:8 }}>Subject preview:</div>
            <div style={{ fontWeight:600, marginBottom:16, fontSize:15, color:INK }}>{subject || '(no subject)'}</div>
            <div style={{ borderTop:'1px solid '+HAIR, paddingTop:12 }} dangerouslySetInnerHTML={{ __html: renderMarkdownLite(bodyMd || '_(empty body)_') }} />
          </div>
          <div style={{ padding:'18px 24px', background:'#F5F0E1', borderTop:'1px solid '+HAIR, textAlign:'center', fontSize:11, color:INK_M, lineHeight:1.6 }}>
            <div style={{ fontWeight:600, color:INK, letterSpacing:'0.08em' }}>THE NAMKHAN</div>
            <div>Ban Xieng Lom, Luang Prabang, Laos</div>
            <div>hello@thenamkhan.com</div>
            <div style={{ margin:'10px 0' }}>[ IG ] [ FB ] [ TikTok ] [ Website ]</div>
            <div>You are receiving this because you stayed with us or booked an upcoming stay.</div>
            <div style={{ marginTop:4 }}>Unsubscribe · Update preferences</div>
          </div>
        </div>
      </div>
    </div>
  );
}
