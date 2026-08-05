'use client';
// app/marketing/website/_components/TranslationEditor.tsx
// website-module-v1 CMS-3 — translation editor (EN/LO side-by-side, AI prefill, fallback)
import { useState, useEffect } from 'react';

const HAIR = '#E6DFCC'; const INK = '#1B1B1B'; const INK_M = '#5A5A5A'; const INK_F = '#8A8A8A';
const GREEN = '#2E7D32'; const AMBER = '#B8A878'; const BG = '#F4EFE2';

export interface WebsiteSectionRow {
  id: number; page_id: number; property_id: number; sort_order: number | null;
  kind: string | null; heading: string | null; body_md: string | null;
  data: Record<string, unknown> | null; updated_at: string | null;
}

export interface WebsiteTranslationRow {
  translation_id: number; page_id: number | null; section_id: number | null;
  property_id: number; locale: string; fields: Record<string, unknown>;
  status: string | null; translated_by: string | null; translated_at: string | null;
}

interface TranslationEditorProps {
  pageId: number;
  propertyId: number;
  sections: WebsiteSectionRow[];
  onSave: () => void;
}

const inputStyle: React.CSSProperties = { 
  width: '100%', padding: '6px 8px', fontSize: 13, 
  border: `1px solid ${HAIR}`, borderRadius: 4, color: INK, 
  background: '#FFFFFF', boxSizing: 'border-box' 
};
const taStyle: React.CSSProperties = { 
  ...inputStyle, minHeight: 80, fontFamily: 'inherit', resize: 'vertical' 
};
const btnStyle: React.CSSProperties = { 
  padding: '7px 14px', fontSize: 12.5, fontWeight: 600, 
  border: `1px solid ${HAIR}`, borderRadius: 4, background: '#FFFFFF', 
  color: INK, cursor: 'pointer' 
};

export default function TranslationEditor({ pageId, propertyId, sections, onSave }: TranslationEditorProps) {
  const [translations, setTranslations] = useState<Record<number, WebsiteTranslationRow>>({});
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [loHeading, setLoHeading] = useState('');
  const [loBody, setLoBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    loadTranslations();
  }, [pageId]);

  async function loadTranslations() {
    try {
      const r = await fetch(`/api/website/translations?page_id=${pageId}&locale=lo`);
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      const map: Record<number, WebsiteTranslationRow> = {};
      for (const t of j.translations ?? []) {
        if (t.section_id) map[t.section_id] = t;
      }
      setTranslations(map);
    } catch (e) {
      console.error('Load translations failed:', e);
    }
  }

  function openEdit(section: WebsiteSectionRow) {
    const trans = translations[section.id];
    setEditingSection(section.id);
    setLoHeading((trans?.fields?.heading as string) ?? '');
    setLoBody((trans?.fields?.body_md as string) ?? '');
    setMsg(null);
  }

  function closeEdit() {
    setEditingSection(null);
    setLoHeading('');
    setLoBody('');
    setMsg(null);
  }

  async function saveLao(sectionId: number) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/website/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          section_id: sectionId,
          locale: 'lo',
          fields: { heading: loHeading, body_md: loBody },
          status: 'published'
        })
      });
      if (!r.ok) throw new Error(`${r.status}`);
      setMsg('✓ Lao translation saved');
      await loadTranslations();
      onSave();
      setTimeout(closeEdit, 800);
    } catch (e) {
      setMsg(`Save failed: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  async function aiPrefill(sectionId: number) {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    
    setBusy(true);
    setMsg('⟳ Generating Lao translation...');
    try {
      const r = await fetch('/api/website/translations/ai-prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          section_id: sectionId,
          locale: 'lo',
          source_text: {
            heading: section.heading ?? '',
            body_md: section.body_md ?? ''
          }
        })
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      setLoHeading(j.fields?.heading ?? '');
      setLoBody(j.fields?.body_md ?? '');
      setMsg('✓ AI translation ready (review before saving)');
    } catch (e) {
      setMsg(`AI prefill failed: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  const translatableSections = sections.filter(s => 
    s.kind !== 'nav' && s.kind !== 'footer' && s.kind !== 'embed'
  );

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12, fontSize: 13, color: INK_M }}>
        Translation coverage: {Object.keys(translations).length}/{translatableSections.length} sections
      </div>

      {editingSection === null ? (
        <div>
          {translatableSections.map(section => {
            const trans = translations[section.id];
            const hasLao = !!trans;
            return (
              <div 
                key={section.id}
                style={{ 
                  marginBottom: 12, padding: 12, 
                  border: `1px solid ${HAIR}`, borderRadius: 4,
                  background: hasLao ? '#F0F7F0' : '#FFFFFF'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11.5, color: INK_F, textTransform: 'uppercase', marginBottom: 4 }}>
                      {section.kind} #{section.sort_order}
                    </div>
                    <div style={{ fontSize: 13, color: INK, fontWeight: 500 }}>
                      {section.heading || <em style={{ color: INK_F }}>No heading</em>}
                    </div>
                    <div style={{ fontSize: 12, color: INK_M, marginTop: 4, maxHeight: 40, overflow: 'hidden' }}>
                      {section.body_md?.substring(0, 120)}...
                    </div>
                  </div>
                  <button 
                    onClick={() => openEdit(section)}
                    style={{ 
                      ...btnStyle, 
                      marginLeft: 12,
                      background: hasLao ? GREEN : '#FFFFFF',
                      color: hasLao ? '#FFFFFF' : INK,
                      borderColor: hasLao ? GREEN : HAIR
                    }}
                  >
                    {hasLao ? '✓ Edit Lao' : '+ Add Lao'}
                  </button>
                </div>
                {hasLao && (
                  <div style={{ fontSize: 12, color: INK_F, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${HAIR}` }}>
                    ລາວ: {(trans.fields?.heading as string) || (trans.fields?.body_md as string)?.substring(0, 60)}...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          {(() => {
            const section = sections.find(s => s.id === editingSection);
            if (!section) return null;
            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>
                    Translate {section.kind} #{section.sort_order}
                  </div>
                  <button onClick={closeEdit} style={{ ...btnStyle, padding: '4px 10px' }}>
                    ← Back to list
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  {/* English (source) */}
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: INK_M, marginBottom: 8, textTransform: 'uppercase' }}>
                      English (source)
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: INK_F, marginBottom: 4 }}>Heading</div>
                      <div style={{ ...inputStyle, background: BG, color: INK_M, cursor: 'not-allowed' }}>
                        {section.heading || <em>—</em>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: INK_F, marginBottom: 4 }}>Body</div>
                      <div style={{ ...taStyle, background: BG, color: INK_M, cursor: 'not-allowed', minHeight: 200 }}>
                        {section.body_md || <em>—</em>}
                      </div>
                    </div>
                  </div>

                  {/* Lao (editable) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: INK_M, textTransform: 'uppercase' }}>
                        ພາສາລາວ (Lao)
                      </div>
                      <button 
                        onClick={() => aiPrefill(editingSection)}
                        disabled={busy}
                        style={{ 
                          ...btnStyle, 
                          padding: '4px 10px', 
                          fontSize: 11.5,
                          background: AMBER,
                          color: '#FFFFFF',
                          borderColor: AMBER,
                          opacity: busy ? 0.6 : 1
                        }}
                      >
                        ✨ AI Prefill
                      </button>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: INK_F, marginBottom: 4 }}>Heading</div>
                      <input
                        type="text"
                        value={loHeading}
                        onChange={e => setLoHeading(e.target.value)}
                        placeholder="ຫົວຂໍ້..."
                        style={inputStyle}
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: INK_F, marginBottom: 4 }}>Body</div>
                      <textarea
                        value={loBody}
                        onChange={e => setLoBody(e.target.value)}
                        placeholder="ເນື້ອຫາ..."
                        style={{ ...taStyle, minHeight: 200 }}
                        disabled={busy}
                      />
                    </div>
                  </div>
                </div>

                {msg && (
                  <div style={{ 
                    padding: 10, marginBottom: 12, borderRadius: 4,
                    background: msg.startsWith('✓') ? GREEN : (msg.startsWith('⟳') ? AMBER : '#FFE0E0'),
                    color: msg.startsWith('✓') || msg.startsWith('⟳') ? '#FFFFFF' : '#8B0000',
                    fontSize: 12.5
                  }}>
                    {msg}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => saveLao(editingSection)}
                    disabled={busy || (!loHeading && !loBody)}
                    style={{
                      ...btnStyle,
                      background: GREEN,
                      color: '#FFFFFF',
                      borderColor: GREEN,
                      opacity: (busy || (!loHeading && !loBody)) ? 0.6 : 1
                    }}
                  >
                    Save Lao Translation
                  </button>
                  <button onClick={closeEdit} style={btnStyle} disabled={busy}>
                    Cancel
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
