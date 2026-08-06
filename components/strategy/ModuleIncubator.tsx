'use client';

// components/strategy/ModuleIncubator.tsx
// Brief: strategy_module-owner-findings-v1
// Module Incubator: positive research → new module spec + brief workflow

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ModuleCandidate {
  id: string;
  thread_id: string | null;
  property_id: number;
  candidate_name: string;
  value_proposition: string | null;
  research_summary: string | null;
  proposed_by: string | null;
  proposed_at: string;
  status: string;
  decision_notes: string | null;
  spec_doc_id: string | null;
  brief_slug: string | null;
  decided_at: string | null;
  decided_by: string | null;
}

interface StrategyThread {
  id: string;
  title: string;
  status: string;
}

const STATUS_OPTIONS = [
  { value: 'proposed', label: 'Proposed', color: '#F57C00' },
  { value: 'approved', label: 'Approved', color: '#2E7D32' },
  { value: 'parked', label: 'Parked', color: '#616161' },
  { value: 'rejected', label: 'Rejected', color: '#D32F2F' },
  { value: 'built', label: 'Built', color: '#1976D2' },
];

export default function ModuleIncubator({ propertyId }: { propertyId: number }) {
  const [candidates, setCandidates] = useState<ModuleCandidate[]>([]);
  const [threads, setThreads] = useState<StrategyThread[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ModuleCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Form states
  const [candidateName, setCandidateName] = useState('');
  const [valueProp, setValueProp] = useState('');
  const [researchSummary, setResearchSummary] = useState('');
  const [proposedBy, setProposedBy] = useState('');
  const [linkedThread, setLinkedThread] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionBy, setDecisionBy] = useState('');
  
  const [err, setErr] = useState<string | null>(null);
  const supabase = createClient();

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from('v_module_candidates')
        .select('*')
        .eq('property_id', propertyId)
        .order('proposed_at', { ascending: false });
      
      if (error) throw error;
      setCandidates(data || []);
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
    void loadCandidates();
    void loadThreads();
  }, [loadCandidates, loadThreads]);

  const handleCreate = async () => {
    if (!candidateName.trim()) {
      setErr('Candidate name is required');
      return;
    }
    
    setCreating(true);
    setErr(null);
    try {
      const { data, error } = await supabase.rpc('fn_module_candidate_insert', {
        p_property_id: propertyId,
        p_thread_id: linkedThread || null,
        p_candidate_name: candidateName.trim(),
        p_value_proposition: valueProp.trim() || null,
        p_research_summary: researchSummary.trim() || null,
        p_proposed_by: proposedBy.trim() || null,
      });
      
      if (error) throw error;
      
      // Reset form
      setCandidateName('');
      setValueProp('');
      setResearchSummary('');
      setProposedBy('');
      setLinkedThread(null);
      
      await loadCandidates();
    } catch (e) {
      setErr(String(e));
    }
    setCreating(false);
  };

  const handleUpdateStatus = async (candidateId: string, newStatus: string) => {
    setUpdating(true);
    setErr(null);
    try {
      const { error } = await supabase.rpc('fn_module_candidate_update_status', {
        p_candidate_id: candidateId,
        p_status: newStatus,
        p_decision_notes: decisionNotes.trim() || null,
        p_decided_by: decisionBy.trim() || null,
      });
      
      if (error) throw error;
      
      setDecisionNotes('');
      setDecisionBy('');
      await loadCandidates();
      
      // Refresh selected candidate
      if (selectedCandidate?.id === candidateId) {
        const updated = candidates.find(c => c.id === candidateId);
        if (updated) setSelectedCandidate(updated);
      }
    } catch (e) {
      setErr(String(e));
    }
    setUpdating(false);
  };

  const handleSelectCandidate = (candidate: ModuleCandidate) => {
    setSelectedCandidate(candidate);
    setDecisionNotes(candidate.decision_notes || '');
    setDecisionBy(candidate.decided_by || '');
  };

  const getStatusColor = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status)?.color || '#8A8A8A';
  };

  const getStatusLabel = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: 700, 
          color: 'var(--ink)', 
          marginBottom: '0.5rem' 
        }}>
          Module Incubator
        </h1>
        <p style={{ color: '#666', fontSize: '0.95rem' }}>
          Positive research findings → new module proposals. Approve to auto-generate spec doc + build brief.
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
        {/* LEFT: Candidate List */}
        <div>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--hairline)',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--ink)' }}>
              Propose New Module
            </h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>
                Module Name *
              </label>
              <input
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="e.g., Guest Loyalty Module"
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  border: '1px solid var(--hairline)',
                  borderRadius: '4px',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>
                Value Proposition
              </label>
              <textarea
                value={valueProp}
                onChange={(e) => setValueProp(e.target.value)}
                placeholder="Why this module adds value..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  border: '1px solid var(--hairline)',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>
                Research Summary
              </label>
              <textarea
                value={researchSummary}
                onChange={(e) => setResearchSummary(e.target.value)}
                placeholder="Evidence, findings, validation..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  border: '1px solid var(--hairline)',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>
                Link to Strategy Thread (optional)
              </label>
              <select
                value={linkedThread || ''}
                onChange={(e) => setLinkedThread(e.target.value || null)}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  border: '1px solid var(--hairline)',
                  borderRadius: '4px',
                  fontSize: '0.9rem'
                }}
              >
                <option value="">— No thread link —</option>
                {threads.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.status})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>
                Proposed By
              </label>
              <input
                type="text"
                value={proposedBy}
                onChange={(e) => setProposedBy(e.target.value)}
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

            <button
              onClick={handleCreate}
              disabled={creating || !candidateName.trim()}
              style={{
                width: '100%',
                padding: '0.7rem',
                background: creating ? '#CCC' : 'var(--primary)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: creating ? 'not-allowed' : 'pointer'
              }}
            >
              {creating ? 'Creating...' : 'Propose Module'}
            </button>
          </div>

          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--hairline)',
            borderRadius: '8px',
            padding: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--ink)' }}>
              All Candidates ({candidates.length})
            </h3>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                Loading...
              </div>
            ) : candidates.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
                No module candidates yet. Create one to start.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {candidates.map(c => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCandidate(c)}
                    style={{
                      padding: '0.8rem',
                      border: `1px solid ${selectedCandidate?.id === c.id ? 'var(--primary)' : 'var(--hairline)'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: selectedCandidate?.id === c.id ? '#F0F8FF' : '#fff',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ 
                      fontSize: '0.95rem', 
                      fontWeight: 600, 
                      color: 'var(--ink)',
                      marginBottom: '0.3rem'
                    }}>
                      {c.candidate_name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#fff',
                          background: getStatusColor(c.status)
                        }}
                      >
                        {getStatusLabel(c.status)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#999' }}>
                        {new Date(c.proposed_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Candidate Detail + Decision Panel */}
        <div>
          {!selectedCandidate ? (
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--hairline)',
              borderRadius: '8px',
              padding: '3rem',
              textAlign: 'center',
              color: '#999'
            }}>
              Select a candidate to view details and make decisions.
            </div>
          ) : (
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--hairline)',
              borderRadius: '8px',
              padding: '1.5rem'
            }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)' }}>
                    {selectedCandidate.candidate_name}
                  </h2>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.3rem 0.7rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#fff',
                      background: getStatusColor(selectedCandidate.status)
                    }}
                  >
                    {getStatusLabel(selectedCandidate.status)}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  Proposed by {selectedCandidate.proposed_by || 'Unknown'} on {new Date(selectedCandidate.proposed_at).toLocaleDateString()}
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#555', marginBottom: '0.5rem' }}>
                  Value Proposition
                </h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.6 }}>
                  {selectedCandidate.value_proposition || <em style={{ color: '#999' }}>No value proposition provided</em>}
                </p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#555', marginBottom: '0.5rem' }}>
                  Research Summary
                </h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {selectedCandidate.research_summary || <em style={{ color: '#999' }}>No research summary provided</em>}
                </p>
              </div>

              {selectedCandidate.thread_id && (
                <div style={{ marginBottom: '1.5rem', padding: '0.8rem', background: '#F9F9F9', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>
                    <strong>Linked Thread:</strong> {selectedCandidate.thread_id}
                  </div>
                </div>
              )}

              {selectedCandidate.status === 'proposed' && (
                <>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--hairline)', margin: '1.5rem 0' }} />

                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--ink)' }}>
                    Make Decision
                  </h3>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>
                      Decision Notes
                    </label>
                    <textarea
                      value={decisionNotes}
                      onChange={(e) => setDecisionNotes(e.target.value)}
                      placeholder="Reasoning for this decision..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.6rem',
                        border: '1px solid var(--hairline)',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>
                      Decided By
                    </label>
                    <input
                      type="text"
                      value={decisionBy}
                      onChange={(e) => setDecisionBy(e.target.value)}
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem' }}>
                    <button
                      onClick={() => handleUpdateStatus(selectedCandidate.id, 'approved')}
                      disabled={updating}
                      style={{
                        padding: '0.7rem',
                        background: updating ? '#CCC' : '#2E7D32',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: updating ? 'not-allowed' : 'pointer'
                      }}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedCandidate.id, 'parked')}
                      disabled={updating}
                      style={{
                        padding: '0.7rem',
                        background: updating ? '#CCC' : '#616161',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: updating ? 'not-allowed' : 'pointer'
                      }}
                    >
                      ⏸ Park
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedCandidate.id, 'rejected')}
                      disabled={updating}
                      style={{
                        padding: '0.7rem',
                        background: updating ? '#CCC' : '#D32F2F',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: updating ? 'not-allowed' : 'pointer'
                      }}
                    >
                      ✕ Reject
                    </button>
                  </div>
                </>
              )}

              {selectedCandidate.status !== 'proposed' && selectedCandidate.decision_notes && (
                <>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--hairline)', margin: '1.5rem 0' }} />
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#555', marginBottom: '0.5rem' }}>
                      Decision Notes
                    </h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {selectedCandidate.decision_notes}
                    </p>
                    {selectedCandidate.decided_by && (
                      <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                        Decided by {selectedCandidate.decided_by} on {selectedCandidate.decided_at ? new Date(selectedCandidate.decided_at).toLocaleDateString() : 'Unknown'}
                      </div>
                    )}
                  </div>
                </>
              )}

              {selectedCandidate.status === 'approved' && !selectedCandidate.spec_doc_id && (
                <div style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  background: '#FFF3E0',
                  border: '1px solid #F57C00',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  color: '#E65100'
                }}>
                  <strong>⚠️ Next step:</strong> Auto-generate spec doc + build brief (feature coming soon)
                </div>
              )}

              {selectedCandidate.spec_doc_id && (
                <div style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  background: '#E8F5E9',
                  border: '1px solid #2E7D32',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  color: '#1B5E20'
                }}>
                  <strong>✓ Spec doc created:</strong> {selectedCandidate.spec_doc_id}<br />
                  {selectedCandidate.brief_slug && (
                    <>
                      <strong>Build brief:</strong> {selectedCandidate.brief_slug}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
