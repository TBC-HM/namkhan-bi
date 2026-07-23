'use client';
// app/guest/newsletters/templates/[key]/_components/TemplateEditor.tsx
// PBS 2026-07-03: client-side template editor. Form + live markdown preview.
// PBS 2026-07-23: preview now renders through THE canonical renderer
// (lib/emailRenderer.renderNewsletterEmail) in an iframe — same output as the
// campaign preview and the real send. Fake hardcoded chrome removed.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { renderNewsletterEmail } from '@/lib/emailRenderer';

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

  // Canonical preview: hero URL (if set) becomes the leading markdown image —
  // the renderer's hero convention — so templates preview exactly like sends.
  const previewHtml = renderNewsletterEmail({
    subjectForTitle: subject || label || 'Template',
    bodyMd: (heroImage ? `![](${heroImage})\n\n` : '') + (bodyMd || ''),
    mode: 'full',
  });

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
        {fieldWrap('Body (Markdown)', <textarea rows={12} value={bodyMd} onChange={(e) => setBodyMd(e.target.value)} style={{ padding:'8px 10px', border:'1px solid '+HAIR, borderRadius:4, fontSize:12, color:INK, resize:'vertical', fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace' }} />, 'Conventions: # H1 · ## H2 · ^^EYEBROW^^ · > pull-quote · - lists · [[CTA]] [label](url) for THE one button · image then **[anchor](url)** — blurb for a product card. Tokens: {{first_name}}, {{days_to_arrival}}, {{booking_code}}.')}
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
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, marginBottom:8 }}>Preview (canonical renderer)</div>
        <div style={{ background:'#FAFAF7', border:'1px solid '+HAIR, borderRadius:6, overflow:'hidden' }}>
          <div style={{ padding:'8px 12px', background:'#F5F0E1', borderBottom:'1px solid '+HAIR, fontSize:11, color:INK_M }}>
            Subject: <strong style={{ color:INK }}>{subject || '(no subject)'}</strong>
          </div>
          <iframe title="template-preview" srcDoc={previewHtml} style={{ width:'100%', height:760, border:'none', background:'#FFFFFF', display:'block' }} />
        </div>
      </div>
    </div>
  );
}
