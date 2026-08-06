'use client';
// app/marketing/website/_components/TranslationEditor.tsx
// website-module-v1 CMS-3b — side-by-side EN/LO translation editor
// Page-level fields (title, meta) + section body_md + heading, draft/published toggle.
// AI prefill button is v1 placeholder (disabled, tooltip).
import { useState, useEffect } from 'react';

const HAIR = '#E6DFCC'; const INK = '#1B1B1B'; const INK_M = '#5A5A5A'; const INK_F = '#8A8A8A';
const GREEN = '#2E7D32'; const AMBER = '#B8A878'; const BG = '#F4EFE2';

const inputStyle: React.CSSProperties = { 
  width: '100%', padding: '8px 10px', fontSize: 13, 
  border: `1px solid ${HAIR}`, borderRadius: 4, color: INK, 
  background: '#FFFFFF', boxSizing: 'border-box' 
};
const taStyle: React.CSSProperties = { 
  ...inputStyle, minHeight: 80, fontFamily: 'inherit', resize: 'vertical' 
};
const btnStyle: React.CSSProperties = { 
  padding: '8px 16px', fontSize: 13, fontWeight: 600, 
  border: `1px solid ${HAIR}`, borderRadius: 4, 
  background: '#FFFFFF', color: INK, cursor: 'pointer' 
};

interface PageData {
  id: number;
  property_id: number;
  slug: string;
  title: string | null;
  meta: Record<string, unknown> | null;
}

interface SectionData {
  id: number;
  page_id: number;
  sort_order: number | null;
  kind: string | null;
  heading: string | null;
  body_md: string | null;
}

interface TranslationData {
  translation_id?: number;
  page_id: number | null;
  section_id: number | null;
  locale: string;
  status: 'draft' | 'published';
  fields: Record<string, unknown>;
}

export default function TranslationEditor({
  propertyId,
  page,
  sections,
  locale = 'lo',
  onClose,
  onSaved,
}: {
  propertyId: number;
  page: PageData;
  sections: SectionData[];
  locale?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  
  // Page-level translation
  const [pageTitle, setPageTitle] = useState('');
  const [pageMetaTitle, setPageMetaTitle] = useState('');
  const [pageMetaDesc, setPageMetaDesc] = useState('');
  
  // Section translations: map section_id -> {heading, body_md}
  const [sectionTranslations, setSectionTranslations] = useState<
    Record<number, { heading: string; body_md: string }>
  >({});

  // Active nav item
  const [activeNav, setActiveNav] = useState<'page' | number>('page');

  useEffect(() => {
    void loadTranslations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTranslations() {
    try {
      const r = await fetch(`/api/website/translations?property_id=${propertyId}&page_id=${page.id}&locale=${locale}`);
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      const trans: TranslationData[] = j.translations ?? [];
      
      // Page translation
      const pageTrans = trans.find(t => t.section_id === null);
      if (pageTrans) {
        setPageTitle(String(pageTrans.fields.title ?? ''));
        setPageMetaTitle(String((pageTrans.fields.meta as any)?.title ?? ''));
        setPageMetaDesc(String((pageTrans.fields.meta as any)?.description ?? ''));
        setStatus(pageTrans.status);
      }
      
      // Section translations
      const secMap: Record<number, { heading: string; body_md: string }> = {};
      trans.forEach(t => {
        if (t.section_id !== null) {
          secMap[t.section_id] = {
            heading: String(t.fields.heading ?? ''),
            body_md: String(t.fields.body_md ?? ''),
          };
          if (t.status === 'published' && status === 'draft') {
            setStatus('published');
          }
        }
      });
      setSectionTranslations(secMap);
    } catch (e) {
      setMsg({ kind: 'err', text: `Load translations failed: ${e}` });
    }
  }

  async function saveAll() {
    setBusy(true);
    setMsg(null);
    try {
      // Save page-level translation
      const pageFields: Record<string, unknown> = { title: pageTitle };
      if (pageMetaTitle || pageMetaDesc) {
        pageFields.meta = { title: pageMetaTitle, description: pageMetaDesc };
      }
      
      const pageRes = await fetch('/api/website/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          page_id: page.id,
          section_id: null,
          locale,
          fields: pageFields,
          status,
        }),
      });
      if (!pageRes.ok) throw new Error(`Page save ${pageRes.status}`);
      
      // Save each section translation
      for (const sec of sections) {
        const trans = sectionTranslations[sec.id];
        if (!trans || (!trans.heading && !trans.body_md)) continue;
        
        const secFields: Record<string, unknown> = {};
        if (trans.heading) secFields.heading = trans.heading;
        if (trans.body_md) secFields.body_md = trans.body_md;
        
        const secRes = await fetch('/api/website/translations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyId,
            page_id: page.id,
            section_id: sec.id,
            locale,
            fields: secFields,
            status,
          }),
        });
        if (!secRes.ok) throw new Error(`Section ${sec.id} save ${secRes.status}`);
      }
      
      setMsg({ kind: 'ok', text: `Saved ${locale.toUpperCase()} translation as ${status}` });
      if (onSaved) onSaved();
    } catch (e) {
      setMsg({ kind: 'err', text: `Save failed: ${e}` });
    } finally {
      setBusy(false);
    }
  }

  function updateSectionField(sectionId: number, field: 'heading' | 'body_md', value: string) {
    setSectionTranslations(prev => ({
      ...prev,
      [sectionId]: {
        heading: field === 'heading' ? value : (prev[sectionId]?.heading ?? ''),
        body_md: field === 'body_md' ? value : (prev[sectionId]?.body_md ?? ''),
      },
    }));
  }

  return (
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(0,0,0,0.4)', zIndex: 9999, 
      display: 'flex', justifyContent: 'flex-end' 
    }}>
      <div style={{ 
        width: '90%', maxWidth: 1400, background: '#FFFFFF', 
        boxShadow: '-2px 0 10px rgba(0,0,0,0.2)', 
        display: 'flex', flexDirection: 'column', height: '100%' 
      }}>
        {/* Header */}
        <div style={{ 
          padding: '16px 20px', borderBottom: `2px solid ${HAIR}`, 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: BG 
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: INK }}>
              Translate: {page.title ?? page.slug} → {locale.toUpperCase()}
            </h3>
            <div style={{ fontSize: 12.5, color: INK_M, marginTop: 4 }}>
              {sections.length} sections
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <label style={{ fontSize: 13, color: INK_M, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input 
                type="checkbox" 
                checked={status === 'published'} 
                onChange={(e) => setStatus(e.target.checked ? 'published' : 'draft')}
                style={{ width: 16, height: 16 }}
              />
              Published
            </label>
            <button 
              onClick={saveAll} 
              disabled={busy}
              style={{ ...btnStyle, background: GREEN, color: '#FFFFFF', borderColor: GREEN }}
            >
              {busy ? 'Saving…' : 'Save All'}
            </button>
            <button onClick={onClose} style={btnStyle}>Close</button>
          </div>
        </div>

        {msg && (
          <div style={{ 
            padding: 10, margin: 20, marginBottom: 0, fontSize: 13, borderRadius: 4, 
            background: msg.kind === 'ok' ? '#E8F5E9' : '#FFEBEE', 
            color: msg.kind === 'ok' ? GREEN : '#B8542A' 
          }}>
            {msg.text}
          </div>
        )}

        {/* Main content: nav + editor */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left nav */}
          <div style={{ 
            width: 220, borderRight: `1px solid ${HAIR}`, 
            overflowY: 'auto', background: BG 
          }}>
            <div 
              onClick={() => setActiveNav('page')}
              style={{ 
                padding: '12px 16px', fontSize: 13, cursor: 'pointer',
                background: activeNav === 'page' ? '#FFFFFF' : 'transparent',
                borderLeft: activeNav === 'page' ? `3px solid ${GREEN}` : '3px solid transparent',
                fontWeight: activeNav === 'page' ? 600 : 400,
                color: activeNav === 'page' ? INK : INK_M,
              }}
            >
              📄 Page Meta
            </div>
            {sections.map((sec, idx) => {
              const hasTranslation = sectionTranslations[sec.id]?.heading || sectionTranslations[sec.id]?.body_md;
              return (
                <div 
                  key={sec.id}
                  onClick={() => setActiveNav(sec.id)}
                  style={{ 
                    padding: '12px 16px', fontSize: 13, cursor: 'pointer',
                    background: activeNav === sec.id ? '#FFFFFF' : 'transparent',
                    borderLeft: activeNav === sec.id ? `3px solid ${GREEN}` : '3px solid transparent',
                    fontWeight: activeNav === sec.id ? 600 : 400,
                    color: activeNav === sec.id ? INK : INK_M,
                  }}
                >
                  <div>{idx + 1}. {sec.kind ?? 'section'}</div>
                  {sec.heading && (
                    <div style={{ fontSize: 11, color: INK_F, marginTop: 2 }}>
                      {sec.heading.slice(0, 30)}
                    </div>
                  )}
                  {hasTranslation && (
                    <div style={{ fontSize: 11, color: GREEN, marginTop: 2 }}>✓ translated</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right editor */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {activeNav === 'page' && (
              <div>
                <h4 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 600, color: INK }}>
                  Page-level Fields
                </h4>
                
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 6 }}>
                        EN Title
                      </label>
                      <input 
                        type="text" 
                        value={page.title ?? ''} 
                        disabled
                        style={{ ...inputStyle, background: BG, color: INK_M }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 6 }}>
                        {locale.toUpperCase()} Title
                      </label>
                      <input 
                        type="text" 
                        value={pageTitle} 
                        onChange={(e) => setPageTitle(e.target.value)}
                        placeholder="Translated page title"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 6 }}>
                        EN Meta Title
                      </label>
                      <input 
                        type="text" 
                        value={String((page.meta as any)?.title ?? '')} 
                        disabled
                        style={{ ...inputStyle, background: BG, color: INK_M }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 6 }}>
                        {locale.toUpperCase()} Meta Title
                      </label>
                      <input 
                        type="text" 
                        value={pageMetaTitle} 
                        onChange={(e) => setPageMetaTitle(e.target.value)}
                        placeholder="Translated meta title (SEO)"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 6 }}>
                        EN Meta Description
                      </label>
                      <textarea 
                        value={String((page.meta as any)?.description ?? '')} 
                        disabled
                        style={{ ...taStyle, background: BG, color: INK_M }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 6 }}>
                        {locale.toUpperCase()} Meta Description
                      </label>
                      <textarea 
                        value={pageMetaDesc} 
                        onChange={(e) => setPageMetaDesc(e.target.value)}
                        placeholder="Translated meta description (SEO)"
                        style={taStyle}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ 
                  padding: 12, background: '#FFF9E6', borderRadius: 4, 
                  border: `1px solid ${AMBER}`, fontSize: 12.5, color: INK_M 
                }}>
                  <strong>AI Prefill (v1 placeholder):</strong> Not yet wired. Manual translation only.
                  <button 
                    disabled
                    title="AI translation coming in future release"
                    style={{ 
                      ...btnStyle, marginLeft: 12, fontSize: 11.5, 
                      padding: '4px 10px', opacity: 0.5, cursor: 'not-allowed' 
                    }}
                  >
                    ✨ AI Translate
                  </button>
                </div>
              </div>
            )}

            {typeof activeNav === 'number' && sections.find(s => s.id === activeNav) && (
              <div>
                {(() => {
                  const sec = sections.find(s => s.id === activeNav)!;
                  const trans = sectionTranslations[sec.id] ?? { heading: '', body_md: '' };
                  return (
                    <>
                      <h4 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 600, color: INK }}>
                        Section: {sec.kind} (#{sec.sort_order})
                      </h4>

                      {sec.heading && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 6 }}>
                                EN Heading
                              </label>
                              <input 
                                type="text" 
                                value={sec.heading} 
                                disabled
                                style={{ ...inputStyle, background: BG, color: INK_M }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 6 }}>
                                {locale.toUpperCase()} Heading
                              </label>
                              <input 
                                type="text" 
                                value={trans.heading} 
                                onChange={(e) => updateSectionField(sec.id, 'heading', e.target.value)}
                                placeholder="Translated heading"
                                style={inputStyle}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {sec.body_md && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 6 }}>
                                EN Body (Markdown)
                              </label>
                              <textarea 
                                value={sec.body_md} 
                                disabled
                                style={{ ...taStyle, minHeight: 200, background: BG, color: INK_M }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 6 }}>
                                {locale.toUpperCase()} Body (Markdown)
                              </label>
                              <textarea 
                                value={trans.body_md} 
                                onChange={(e) => updateSectionField(sec.id, 'body_md', e.target.value)}
                                placeholder="Translated body markdown"
                                style={{ ...taStyle, minHeight: 200 }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div style={{ 
                        padding: 12, background: '#FFF9E6', borderRadius: 4, 
                        border: `1px solid ${AMBER}`, fontSize: 12.5, color: INK_M 
                      }}>
                        <strong>AI Prefill (v1 placeholder):</strong> Not yet wired.
                        <button 
                          disabled
                          title="AI translation coming in future release"
                          style={{ 
                            ...btnStyle, marginLeft: 12, fontSize: 11.5, 
                            padding: '4px 10px', opacity: 0.5, cursor: 'not-allowed' 
                          }}
                        >
                          ✨ AI Translate This Section
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
