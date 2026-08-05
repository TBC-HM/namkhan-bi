'use client';

// components/strategy/StrategyWorkbench.tsx
// Brief: strategy_module-owner-findings-v1
// Strategy Workbench: research threads with hypothesis → validate → decide flow

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface StrategyThread {
  id: string;
  property_id: number;
  title: string;
  hypothesis: string | null;
  status: string;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
}

interface Evidence {
  id: string;
  thread_id: string;
  evidence_type: string;
  title: string;
  content: string | null;
  source_url: string | null;
  created_at: string;
  created_by: string | null;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: '#8A8A8A' },
  { value: 'validated', label: 'Validated', color: '#2E7D32' },
  { value: 'approved', label: 'Approved', color: '#1976D2' },
  { value: 'executing', label: 'Executing', color: '#F57C00' },
  { value: 'executed', label: 'Executed', color: '#388E3C' },
  { value: 'parked', label: 'Parked', color: '#616161' },
  { value: 'rejected', label: 'Rejected', color: '#D32F2F' },
];

export default function StrategyWorkbench({ propertyId }: { propertyId: number }) {
  const [threads, setThreads] = useState<StrategyThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<StrategyThread | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [addingEvidence, setAddingEvidence] = useState(false);
  
  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newHypothesis, setNewHypothesis] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceContent, setEvidenceContent] = useState('');
  const [evidenceType, setEvidenceType] = useState('note');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  
  const [err, setErr] = useState<string | null>(null);
  const supabase = createClient();

  const loadThreads = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from('v_strategy_threads')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setThreads(data || []);
    } catch (e) {
      setErr(String(e));
    }
    setLoading(false);
  }, [propertyId, supabase]);

  const loadEvidence = useCallback(async (threadId: string) => {
    try {
      const { data, error } = await supabase
        .from('v_strategy_evidence')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setEvidence(data || []);
    } catch (e) {
      setErr(String(e));
    }
  }, [supabase]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (selectedThread) {
      void loadEvidence(selectedThread.id);
    } else {
      setEvidence([]);
    }
  }, [selectedThread, loadEvidence]);

  async function createThread() {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    setErr(null);
    
    try {
      const { data, error } = await supabase.rpc('fn_strategy_thread_upsert', {
        p_id: null,
        p_property_id: propertyId,
        p_title: newTitle.trim(),
        p_hypothesis: newHypothesis.trim() || null,
        p_status: 'draft',
        p_owner_name: newOwner.trim() || null,
        p_tags: []
      });
      
      if (error) throw error;
      
      setNewTitle('');
      setNewHypothesis('');
      setNewOwner('');
      await loadThreads();
    } catch (e) {
      setErr(String(e));
    }
    setCreating(false);
  }

  async function updateThreadStatus(threadId: string, newStatus: string) {
    try {
      const thread = threads.find(t => t.id === threadId);
      if (!thread) return;
      
      const { error } = await supabase.rpc('fn_strategy_thread_upsert', {
        p_id: threadId,
        p_property_id: propertyId,
        p_title: thread.title,
        p_hypothesis: thread.hypothesis,
        p_status: newStatus,
        p_owner_name: thread.owner_name,
        p_tags: thread.tags
      });
      
      if (error) throw error;
      await loadThreads();
      
      if (selectedThread?.id === threadId) {
        setSelectedThread({ ...thread, status: newStatus });
      }
    } catch (e) {
      setErr(String(e));
    }
  }

  async function addEvidence() {
    if (!selectedThread || !evidenceTitle.trim() || addingEvidence) return;
    setAddingEvidence(true);
    setErr(null);
    
    try {
      const { error } = await supabase.rpc('fn_strategy_evidence_insert', {
        p_thread_id: selectedThread.id,
        p_evidence_type: evidenceType,
        p_title: evidenceTitle.trim(),
        p_content: evidenceContent.trim() || null,
        p_source_url: evidenceUrl.trim() || null,
        p_document_id: null,
        p_created_by: null
      });
      
      if (error) throw error;
      
      setEvidenceTitle('');
      setEvidenceContent('');
      setEvidenceUrl('');
      await loadEvidence(selectedThread.id);
    } catch (e) {
      setErr(String(e));
    }
    setAddingEvidence(false);
  }

  const statusColor = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status)?.color || '#8A8A8A';
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px 64px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>
          Strategy Workbench
        </h1>
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 4 }}>
          Research threads with hypothesis → validate → decide → track flow
        </div>
      </div>

      {err && (
        <div style={{ 
          color: 'var(--terracotta, #B8542A)', 
          fontSize: 13, 
          marginBottom: 16,
          padding: 12,
          background: '#FFF3E0',
          borderRadius: 6
        }}>
          {err}
        </div>
      )}

      {/* Create new thread */}
      <div style={{ 
        border: '1px solid var(--hairline)', 
        borderRadius: 10, 
        padding: 20,
        background: 'var(--card, #fff)',
        marginBottom: 24
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--ink)', marginBottom: 16 }}>
          Create Research Thread
        </h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--ink-mute)', display: 'block', marginBottom: 6 }}>
              Title *
            </label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., Investigate AI concierge ROI"
              style={{ 
                border: '1px solid var(--hairline)', 
                borderRadius: 6, 
                padding: '8px 12px', 
                fontSize: 14,
                width: '100%'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--ink-mute)', display: 'block', marginBottom: 6 }}>
              Hypothesis
            </label>
            <textarea
              value={newHypothesis}
              onChange={(e) => setNewHypothesis(e.target.value)}
              placeholder="What do you believe will happen?"
              rows={3}
              style={{ 
                border: '1px solid var(--hairline)', 
                borderRadius: 6, 
                padding: '8px 12px', 
                fontSize: 14,
                width: '100%',
                resize: 'vertical'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--ink-mute)', display: 'block', marginBottom: 6 }}>
              Owner
            </label>
            <input
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
              placeholder="Your name"
              style={{ 
                border: '1px solid var(--hairline)', 
                borderRadius: 6, 
                padding: '8px 12px', 
                fontSize: 14,
                width: '100%'
              }}
            />
          </div>
          <div>
            <button
              onClick={() => void createThread()}
              disabled={creating || !newTitle.trim()}
              style={{ 
                background: 'var(--primary)', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 6, 
                padding: '10px 18px', 
                fontSize: 14, 
                cursor: 'pointer',
                opacity: creating || !newTitle.trim() ? 0.5 : 1
              }}
            >
              {creating ? 'Creating…' : '+ Create Thread'}
            </button>
          </div>
        </div>
      </div>

      {/* Main layout: threads list + detail panel */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedThread ? '1fr 2fr' : '1fr', gap: 20 }}>
        {/* Threads list */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0', color: 'var(--ink)' }}>
            Research Threads ({threads.length})
          </h2>
          
          {loading && (
            <div style={{ color: 'var(--ink-mute)', fontSize: 13 }}>Loading threads…</div>
          )}
          
          {!loading && threads.length === 0 && (
            <div style={{ color: 'var(--ink-mute)', fontSize: 14 }}>
              No research threads yet. Create one above to get started.
            </div>
          )}
          
          <div style={{ display: 'grid', gap: 10 }}>
            {threads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => setSelectedThread(thread)}
                style={{ 
                  border: selectedThread?.id === thread.id 
                    ? '2px solid var(--primary)' 
                    : '1px solid var(--hairline)', 
                  borderRadius: 8, 
                  padding: 14,
                  background: 'var(--card, #fff)',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', flex: 1 }}>
                    {thread.title}
                  </div>
                  <span style={{ 
                    fontSize: 10, 
                    letterSpacing: '0.08em', 
                    textTransform: 'uppercase', 
                    color: statusColor(thread.status),
                    border: `1px solid ${statusColor(thread.status)}`,
                    borderRadius: 999, 
                    padding: '2px 8px',
                    whiteSpace: 'nowrap'
                  }}>
                    {thread.status}
                  </span>
                </div>
                {thread.hypothesis && (
                  <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 6, lineHeight: 1.5 }}>
                    {thread.hypothesis.slice(0, 120)}{thread.hypothesis.length > 120 ? '…' : ''}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--ink-faint, #8A8A8A)', marginTop: 8 }}>
                  {thread.owner_name && `${thread.owner_name} · `}
                  {new Date(thread.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thread detail panel */}
        {selectedThread && (
          <div>
            <div style={{ 
              border: '1px solid var(--hairline)', 
              borderRadius: 10, 
              padding: 20,
              background: 'var(--card, #fff)',
              marginBottom: 20
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--ink)', flex: 1 }}>
                  {selectedThread.title}
                </h2>
                <button
                  onClick={() => setSelectedThread(null)}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: 'var(--ink-mute)', 
                    fontSize: 20,
                    cursor: 'pointer',
                    padding: '0 8px'
                  }}
                >
                  ×
                </button>
              </div>

              {selectedThread.hypothesis && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginBottom: 6, fontWeight: 600 }}>
                    HYPOTHESIS
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>
                    {selectedThread.hypothesis}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginBottom: 8, fontWeight: 600 }}>
                  STATUS WORKFLOW
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => void updateThreadStatus(selectedThread.id, opt.value)}
                      style={{ 
                        background: selectedThread.status === opt.value ? opt.color : 'transparent',
                        color: selectedThread.status === opt.value ? '#fff' : opt.color,
                        border: `1px solid ${opt.color}`,
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontWeight: selectedThread.status === opt.value ? 600 : 400
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--ink-faint, #8A8A8A)' }}>
                {selectedThread.owner_name && `Owner: ${selectedThread.owner_name} · `}
                Created {new Date(selectedThread.created_at).toLocaleDateString()} ·
                Updated {new Date(selectedThread.updated_at).toLocaleDateString()}
              </div>
            </div>

            {/* Evidence section */}
            <div style={{ 
              border: '1px solid var(--hairline)', 
              borderRadius: 10, 
              padding: 20,
              background: 'var(--card, #fff)'
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0', color: 'var(--ink)' }}>
                Evidence ({evidence.length})
              </h3>

              {/* Add evidence form */}
              <div style={{ 
                background: 'var(--paper-deep, #F5F0E1)', 
                borderRadius: 8, 
                padding: 16,
                marginBottom: 16
              }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div>
                    <input
                      value={evidenceTitle}
                      onChange={(e) => setEvidenceTitle(e.target.value)}
                      placeholder="Evidence title *"
                      style={{ 
                        border: '1px solid var(--hairline)', 
                        borderRadius: 6, 
                        padding: '8px 12px', 
                        fontSize: 13,
                        width: '100%',
                        background: '#fff'
                      }}
                    />
                  </div>
                  <div>
                    <select
                      value={evidenceType}
                      onChange={(e) => setEvidenceType(e.target.value)}
                      style={{ 
                        border: '1px solid var(--hairline)', 
                        borderRadius: 6, 
                        padding: '8px 12px', 
                        fontSize: 13,
                        width: '100%',
                        background: '#fff'
                      }}
                    >
                      <option value="note">Note</option>
                      <option value="url">URL</option>
                      <option value="document">Document</option>
                      <option value="metric">Metric</option>
                    </select>
                  </div>
                  {evidenceType === 'url' && (
                    <div>
                      <input
                        value={evidenceUrl}
                        onChange={(e) => setEvidenceUrl(e.target.value)}
                        placeholder="https://..."
                        style={{ 
                          border: '1px solid var(--hairline)', 
                          borderRadius: 6, 
                          padding: '8px 12px', 
                          fontSize: 13,
                          width: '100%',
                          background: '#fff'
                        }}
                      />
                    </div>
                  )}
                  <div>
                    <textarea
                      value={evidenceContent}
                      onChange={(e) => setEvidenceContent(e.target.value)}
                      placeholder="Details, notes, or observations..."
                      rows={2}
                      style={{ 
                        border: '1px solid var(--hairline)', 
                        borderRadius: 6, 
                        padding: '8px 12px', 
                        fontSize: 13,
                        width: '100%',
                        resize: 'vertical',
                        background: '#fff'
                      }}
                    />
                  </div>
                  <div>
                    <button
                      onClick={() => void addEvidence()}
                      disabled={addingEvidence || !evidenceTitle.trim()}
                      style={{ 
                        background: 'var(--primary)', 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: 6, 
                        padding: '8px 14px', 
                        fontSize: 13, 
                        cursor: 'pointer',
                        opacity: addingEvidence || !evidenceTitle.trim() ? 0.5 : 1
                      }}
                    >
                      {addingEvidence ? 'Adding…' : '+ Add Evidence'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Evidence list */}
              <div style={{ display: 'grid', gap: 10 }}>
                {evidence.length === 0 && (
                  <div style={{ color: 'var(--ink-mute)', fontSize: 13 }}>
                    No evidence yet. Add research findings, metrics, or notes above.
                  </div>
                )}
                {evidence.map((ev) => (
                  <div
                    key={ev.id}
                    style={{ 
                      border: '1px solid var(--hairline)', 
                      borderRadius: 6, 
                      padding: 12,
                      background: '#fff'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', flex: 1 }}>
                        {ev.title}
                      </div>
                      <span style={{ 
                        fontSize: 10, 
                        letterSpacing: '0.08em', 
                        textTransform: 'uppercase', 
                        color: 'var(--ink-mute)',
                        border: '1px solid var(--hairline)',
                        borderRadius: 999, 
                        padding: '2px 6px'
                      }}>
                        {ev.evidence_type}
                      </span>
                    </div>
                    {ev.content && (
                      <div style={{ fontSize: 12, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.5 }}>
                        {ev.content}
                      </div>
                    )}
                    {ev.source_url && (
                      <div style={{ fontSize: 11, marginBottom: 6 }}>
                        <a 
                          href={ev.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: 'var(--primary)', textDecoration: 'none' }}
                        >
                          {ev.source_url}
                        </a>
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--ink-faint, #8A8A8A)' }}>
                      {ev.created_by && `${ev.created_by} · `}
                      {new Date(ev.created_at).toLocaleDateString()} {new Date(ev.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
