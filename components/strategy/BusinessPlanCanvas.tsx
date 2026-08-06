'use client';

// components/strategy/BusinessPlanCanvas.tsx
// Brief: strategy_module-owner-findings-v1
// Business Plan Canvas: living TBC business plan with version history + thread linkage

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface BusinessPlanSection {
  id: string;
  property_id: number;
  section_key: string;
  section_title: string;
  content: string | null;
  version: number;
  updated_at: string;
  updated_by: string | null;
  linked_thread_ids: string[] | null;
}

interface StrategyThread {
  id: string;
  title: string;
  status: string;
}

const DEFAULT_SECTIONS = [
  { key: 'value_proposition', title: 'Value Proposition', placeholder: 'What value does TBC/BZC deliver? Who is the customer? What problem do we solve?' },
  { key: 'market_analysis', title: 'Market Analysis', placeholder: 'Target market size, trends, competitive landscape, positioning...' },
  { key: 'revenue_model', title: 'Revenue Model', placeholder: 'How do we make money? Pricing strategy, revenue streams, growth levers...' },
  { key: 'cost_structure', title: 'Cost Structure', placeholder: 'Key costs, cost drivers, economies of scale, unit economics...' },
  { key: 'strategic_initiatives', title: 'Strategic Initiatives', placeholder: 'Key initiatives, priorities, roadmap, resource allocation...' },
  { key: 'kpis_metrics', title: 'KPIs & Metrics', placeholder: 'Success metrics, targets, tracking methodology...' },
];

export default function BusinessPlanCanvas({ propertyId }: { propertyId: number }) {
  const [sections, setSections] = useState<BusinessPlanSection[]>([]);
  const [threads, setThreads] = useState<StrategyThread[]>([]);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editBy, setEditBy] = useState('');
  const [selectedThreads, setSelectedThreads] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'history'>('edit');
  const [err, setErr] = useState<string | null>(null);
  
  const supabase = createClient();

  const loadSections = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from('v_business_plan_sections')
        .select('*')
        .eq('property_id', propertyId)
        .order('section_key', { ascending: true });
      
      if (error) throw error;
      setSections(data || []);
    } catch (e) {
      setErr(String(e));
    }
    setLoading(false);
  }, [propertyId, supabase]);

  const loadThreads = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('v_strategy_threads')
        .select('id, title, status')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setThreads(data || []);
    } catch (e) {
      console.error('Failed to load threads:', e);
    }
  }, [propertyId, supabase]);

  useEffect(() => {
    void loadSections();
    void loadThreads();
  }, [loadSections, loadThreads]);

  const handleStartEdit = (sectionKey: string) => {
    const existing = sections.find(s => s.section_key === sectionKey);
    setEditingSection(sectionKey);
    setEditContent(existing?.content || '');
    setEditBy(existing?.updated_by || '');
    setSelectedThreads(existing?.linked_thread_ids || []);
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditContent('');
    setEditBy('');
    setSelectedThreads([]);
  };

  const handleSave = async () => {
    if (!editingSection) return;
    
    setSaving(true);
    setErr(null);
    try {
      const { error } = await supabase.rpc('fn_business_plan_section_upsert', {
        p_property_id: propertyId,
        p_section_key: editingSection,
        p_section_title: DEFAULT_SECTIONS.find(s => s.key === editingSection)?.title || editingSection,
        p_content: editContent.trim() || null,
        p_updated_by: editBy.trim() || null,
        p_linked_thread_ids: selectedThreads.length > 0 ? selectedThreads : null,
      });
      
      if (error) throw error;
      
      await loadSections();
      handleCancelEdit();
    } catch (e) {
      setErr(String(e));
    }
    setSaving(false);
  };

  const toggleThreadLink = (threadId: string) => {
    setSelectedThreads(prev => 
      prev.includes(threadId) 
        ? prev.filter(id => id !== threadId)
        : [...prev, threadId]
    );
  };

  const getSectionData = (key: string): BusinessPlanSection | null => {
    return sections.find(s => s.section_key === key) || null;
  };

  const getSectionConfig = (key: string) => {
    return DEFAULT_SECTIONS.find(s => s.key === key) || { key, title: key, placeholder: '' };
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: 700, 
            color: 'var(--ink)', 
          }}>
            TBC Business Plan Canvas
          </h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setViewMode('edit')}
              style={{
                padding: '0.5rem 1rem',
                background: viewMode === 'edit' ? 'var(--primary)' : '#F5F5F5',
                color: viewMode === 'edit' ? '#fff' : '#666',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Edit Mode
            </button>
            <button
              onClick={() => setViewMode('history')}
              style={{
                padding: '0.5rem 1rem',
                background: viewMode === 'history' ? 'var(--primary)' : '#F5F5F5',
                color: viewMode === 'history' ? '#fff' : '#666',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Version History
            </button>
          </div>
        </div>
        <p style={{ color: '#666', fontSize: '0.95rem' }}>
          Living strategic document. Link sections to strategy threads for evidence trail. Versions tracked automatically.
        </p>
      </div>

      {err && (
        <div style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          background: '#FEE',
          border: '1px solid #D32F2F',
          borderRadius: '6px',
          color: '#D32F2F',
          fontSize: '0.9rem'
        }}>
          {err}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
          Loading business plan sections...
        </div>
      ) : viewMode === 'edit' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {DEFAULT_SECTIONS.map(sectionConfig => {
            const sectionData = getSectionData(sectionConfig.key);
            const isEditing = editingSection === sectionConfig.key;

            return (
              <div
                key={sectionConfig.key}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--hairline)',
                  borderRadius: '8px',
                  padding: '1.5rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--ink)' }}>
                    {sectionConfig.title}
                  </h3>
                  {!isEditing && (
                    <button
                      onClick={() => handleStartEdit(sectionConfig.key)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        background: '#F5F5F5',
                        color: '#333',
                        border: '1px solid var(--hairline)',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>
                        Content
                      </label>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder={sectionConfig.placeholder}
                        rows={8}
                        style={{
                          width: '100%',
                          padding: '0.8rem',
                          border: '1px solid var(--hairline)',
                          borderRadius: '4px',
                          fontSize: '0.95rem',
                          lineHeight: 1.6,
                          resize: 'vertical',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>
                        Link to Strategy Threads (optional)
                      </label>
                      <div style={{ 
                        maxHeight: '150px', 
                        overflowY: 'auto', 
                        border: '1px solid var(--hairline)', 
                        borderRadius: '4px', 
                        padding: '0.5rem',
                        background: '#FAFAFA'
                      }}>
                        {threads.length === 0 ? (
                          <div style={{ padding: '1rem', textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>
                            No strategy threads available
                          </div>
                        ) : (
                          threads.map(t => (
                            <label 
                              key={t.id}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.5rem', 
                                padding: '0.4rem',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedThreads.includes(t.id)}
                                onChange={() => toggleThreadLink(t.id)}
                                style={{ cursor: 'pointer' }}
                              />
                              <span style={{ color: 'var(--ink)' }}>
                                {t.title} <span style={{ color: '#999', fontSize: '0.8rem' }}>({t.status})</span>
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>
                        Updated By
                      </label>
                      <input
                        type="text"
                        value={editBy}
                        onChange={(e) => setEditBy(e.target.value)}
                        placeholder="Your name"
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          border: '1px solid var(--hairline)',
                          borderRadius: '4px',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.8rem' }}>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                          padding: '0.6rem 1.2rem',
                          background: saving ? '#CCC' : 'var(--primary)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          cursor: saving ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {saving ? 'Saving...' : '✓ Save'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        style={{
                          padding: '0.6rem 1.2rem',
                          background: '#F5F5F5',
                          color: '#333',
                          border: '1px solid var(--hairline)',
                          borderRadius: '6px',
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          cursor: saving ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {sectionData?.content ? (
                      <div style={{ 
                        fontSize: '0.95rem', 
                        color: 'var(--ink)', 
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                        marginBottom: '1rem'
                      }}>
                        {sectionData.content}
                      </div>
                    ) : (
                      <div style={{ 
                        padding: '2rem', 
                        textAlign: 'center', 
                        color: '#999', 
                        fontSize: '0.9rem',
                        fontStyle: 'italic',
                        background: '#FAFAFA',
                        borderRadius: '4px'
                      }}>
                        {sectionConfig.placeholder}
                      </div>
                    )}

                    {sectionData && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '1rem', 
                        paddingTop: '0.8rem',
                        borderTop: '1px solid #EEE',
                        fontSize: '0.85rem',
                        color: '#666'
                      }}>
                        <span>
                          <strong>Version:</strong> {sectionData.version}
                        </span>
                        {sectionData.updated_by && (
                          <span>
                            <strong>Updated by:</strong> {sectionData.updated_by}
                          </span>
                        )}
                        <span>
                          <strong>Last updated:</strong> {new Date(sectionData.updated_at).toLocaleString()}
                        </span>
                        {sectionData.linked_thread_ids && sectionData.linked_thread_ids.length > 0 && (
                          <span>
                            <strong>Linked threads:</strong> {sectionData.linked_thread_ids.length}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--hairline)',
          borderRadius: '8px',
          padding: '2rem'
        }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--ink)' }}>
            Version History
          </h3>
          <div style={{ 
            padding: '2rem', 
            textAlign: 'center', 
            color: '#999',
            fontSize: '0.95rem',
            fontStyle: 'italic'
          }}>
            Version history with diff view coming soon. Current versions shown in edit mode metadata.
          </div>
        </div>
      )}
    </div>
  );
}
