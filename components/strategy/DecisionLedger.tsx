'use client';

// components/strategy/DecisionLedger.tsx
// Brief: strategy-module-slice-close-out (G3)
// Decision Ledger: record decisions (what/why/who/evidence), add retrospectives, filter by outcome/type.
// Reads public.v_strategy_decisions, writes via fn_strategy_decision_insert / fn_strategy_decision_update.

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface StrategyDecision {
  id: string;
  thread_id: string | null;
  property_id: number;
  title: string;
  decision_type: string | null;
  what_decided: string;
  why_decided: string | null;
  evidence_summary: string | null;
  decided_by: string | null;
  decided_at: string;
  expected_outcome: string | null;
  actual_outcome: string | null;
  retrospective_notes: string | null;
  retrospective_at: string | null;
}

interface ThreadOption {
  id: string;
  title: string;
}

const DECISION_TYPES = [
  { value: 'strategic', label: 'Strategic' },
  { value: 'operational', label: 'Operational' },
  { value: 'financial', label: 'Financial' },
  { value: 'product', label: 'Product' },
];

type OutcomeFilter = 'all' | 'open' | 'reviewed';

const card: React.CSSProperties = {
  background: 'var(--paper, #fff)',
  border: '1px solid var(--hairline)',
  borderRadius: '8px',
  padding: '1rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  border: '1px solid var(--hairline)',
  borderRadius: '6px',
  fontSize: '0.9rem',
  color: 'var(--ink)',
  background: '#fff',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--ink-soft, #5A5A5A)',
  marginBottom: '0.25rem',
};

export default function DecisionLedger({ propertyId }: { propertyId: number }) {
  const [decisions, setDecisions] = useState<StrategyDecision[]>([]);
  const [threads, setThreads] = useState<ThreadOption[]>([]);
  const [selected, setSelected] = useState<StrategyDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Filters
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [whatDecided, setWhatDecided] = useState('');
  const [whyDecided, setWhyDecided] = useState('');
  const [evidenceSummary, setEvidenceSummary] = useState('');
  const [decidedBy, setDecidedBy] = useState('');
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [decisionType, setDecisionType] = useState('strategic');
  const [threadId, setThreadId] = useState<string>('');

  // Retrospective form
  const [actualOutcome, setActualOutcome] = useState('');
  const [retroNotes, setRetroNotes] = useState('');

  const supabase = createClient();

  const loadDecisions = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from('v_strategy_decisions')
        .select('*')
        .eq('property_id', propertyId)
        .order('decided_at', { ascending: false });
      if (error) throw error;
      setDecisions(data || []);
    } catch (e) {
      setErr(String(e));
    }
    setLoading(false);
  }, [propertyId, supabase]);

  const loadThreads = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('v_strategy_threads')
        .select('id, title')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setThreads(data || []);
    } catch {
      // thread linking is optional; ignore load failure
    }
  }, [propertyId, supabase]);

  useEffect(() => {
    void loadDecisions();
    void loadThreads();
  }, [loadDecisions, loadThreads]);

  useEffect(() => {
    setActualOutcome(selected?.actual_outcome || '');
    setRetroNotes(selected?.retrospective_notes || '');
  }, [selected]);

  const createDecision = async () => {
    if (!title.trim() || !whatDecided.trim() || saving) return;
    setSaving(true);
    setErr(null);
    try {
      const { error } = await supabase.rpc('fn_strategy_decision_insert', {
        p_property_id: propertyId,
        p_title: title.trim(),
        p_what_decided: whatDecided.trim(),
        p_thread_id: threadId || null,
        p_decision_type: decisionType,
        p_why_decided: whyDecided.trim() || null,
        p_evidence_summary: evidenceSummary.trim() || null,
        p_decided_by: decidedBy.trim() || null,
        p_expected_outcome: expectedOutcome.trim() || null,
      });
      if (error) throw error;
      setTitle(''); setWhatDecided(''); setWhyDecided(''); setEvidenceSummary('');
      setDecidedBy(''); setExpectedOutcome(''); setThreadId(''); setShowCreate(false);
      await loadDecisions();
    } catch (e) {
      setErr(String(e));
    }
    setSaving(false);
  };

  const saveRetrospective = async () => {
    if (!selected || saving) return;
    if (!actualOutcome.trim() && !retroNotes.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const { error } = await supabase.rpc('fn_strategy_decision_update', {
        p_id: selected.id,
        p_actual_outcome: actualOutcome.trim() || null,
        p_retrospective_notes: retroNotes.trim() || null,
      });
      if (error) throw error;
      await loadDecisions();
      const refreshed = { ...selected, actual_outcome: actualOutcome.trim() || selected.actual_outcome, retrospective_notes: retroNotes.trim() || selected.retrospective_notes, retrospective_at: new Date().toISOString() };
      setSelected(refreshed);
    } catch (e) {
      setErr(String(e));
    }
    setSaving(false);
  };

  const filtered = decisions.filter(d => {
    if (outcomeFilter === 'open' && d.retrospective_at) return false;
    if (outcomeFilter === 'reviewed' && !d.retrospective_at) return false;
    if (typeFilter !== 'all' && d.decision_type !== typeFilter) return false;
    return true;
  });

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '0.3rem 0.75rem',
    borderRadius: '999px',
    border: '1px solid var(--hairline)',
    background: active ? 'var(--primary)' : '#fff',
    color: active ? '#fff' : 'var(--ink-soft, #5A5A5A)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  });

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--ink)' }}>Decision Ledger</h1>
        <button onClick={() => setShowCreate(v => !v)} style={{
          padding: '0.5rem 1rem', background: 'var(--primary)', color: '#fff', border: 'none',
          borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
        }}>
          {showCreate ? 'Cancel' : '+ Record decision'}
        </button>
      </div>
      <p style={{ color: 'var(--ink-soft, #5A5A5A)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
        What was decided, why, by whom — then close the loop with a retrospective.
      </p>

      {err && (
        <div style={{ padding: '1rem', marginBottom: '1.5rem', background: '#FEE', border: '1px solid #D32F2F', borderRadius: '6px', color: '#D32F2F', fontSize: '0.9rem' }}>
          {err}
        </div>
      )}

      {showCreate && (
        <div style={{ ...card, marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Title *</label>
              <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="Short decision headline" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>What was decided *</label>
              <textarea style={{ ...inputStyle, minHeight: '60px' }} value={whatDecided} onChange={e => setWhatDecided(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Why</label>
              <textarea style={{ ...inputStyle, minHeight: '50px' }} value={whyDecided} onChange={e => setWhyDecided(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Evidence (summary / link)</label>
              <textarea style={{ ...inputStyle, minHeight: '50px' }} value={evidenceSummary} onChange={e => setEvidenceSummary(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Decided by</label>
              <input style={inputStyle} value={decidedBy} onChange={e => setDecidedBy(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Expected outcome</label>
              <input style={inputStyle} value={expectedOutcome} onChange={e => setExpectedOutcome(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={decisionType} onChange={e => setDecisionType(e.target.value)}>
                {DECISION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Linked research thread</label>
              <select style={inputStyle} value={threadId} onChange={e => setThreadId(e.target.value)}>
                <option value="">— none —</option>
                {threads.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          </div>
          <button onClick={createDecision} disabled={saving || !title.trim() || !whatDecided.trim()} style={{
            marginTop: '0.75rem', padding: '0.5rem 1.25rem', background: 'var(--primary)', color: '#fff',
            border: 'none', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600,
            cursor: saving ? 'wait' : 'pointer', opacity: saving || !title.trim() || !whatDecided.trim() ? 0.6 : 1,
          }}>
            {saving ? 'Saving…' : 'Save decision'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button style={chip(outcomeFilter === 'all')} onClick={() => setOutcomeFilter('all')}>All</button>
        <button style={chip(outcomeFilter === 'open')} onClick={() => setOutcomeFilter('open')}>Awaiting retro</button>
        <button style={chip(outcomeFilter === 'reviewed')} onClick={() => setOutcomeFilter('reviewed')}>Reviewed</button>
        <span style={{ width: '1px', background: 'var(--hairline)', margin: '0 0.25rem' }} />
        <button style={chip(typeFilter === 'all')} onClick={() => setTypeFilter('all')}>All types</button>
        {DECISION_TYPES.map(t => (
          <button key={t.value} style={chip(typeFilter === t.value)} onClick={() => setTypeFilter(t.value)}>{t.label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading && <div style={{ color: 'var(--ink-soft, #5A5A5A)', fontSize: '0.9rem' }}>Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ ...card, color: 'var(--ink-soft, #5A5A5A)', fontSize: '0.9rem' }}>
              No decisions match this filter. Record the first one.
            </div>
          )}
          {filtered.map(d => (
            <button key={d.id} onClick={() => setSelected(d)} style={{
              ...card, textAlign: 'left', cursor: 'pointer', width: '100%',
              borderColor: selected?.id === d.id ? 'var(--primary)' : 'var(--hairline)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '0.95rem' }}>{d.title}</span>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px',
                  background: d.retrospective_at ? '#2E7D32' : '#8A8A8A', color: '#fff', whiteSpace: 'nowrap', alignSelf: 'flex-start',
                }}>
                  {d.retrospective_at ? 'reviewed' : 'open'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ink-soft, #5A5A5A)' }}>
                {fmtDate(d.decided_at)} · {d.decision_type || 'strategic'}{d.decided_by ? ` · ${d.decided_by}` : ''}
              </div>
            </button>
          ))}
        </div>

        {/* Right: detail + retrospective */}
        <div>
          {!selected ? (
            <div style={{ ...card, color: 'var(--ink-soft, #5A5A5A)', fontSize: '0.9rem' }}>
              Select a decision to see its detail and add a retrospective.
            </div>
          ) : (
            <div style={card}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '0.25rem' }}>{selected.title}</h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--ink-soft, #5A5A5A)', marginBottom: '1rem' }}>
                {fmtDate(selected.decided_at)} · {selected.decision_type || 'strategic'}{selected.decided_by ? ` · decided by ${selected.decided_by}` : ''}
              </div>

              {[
                ['What was decided', selected.what_decided],
                ['Why', selected.why_decided],
                ['Evidence', selected.evidence_summary],
                ['Expected outcome', selected.expected_outcome],
              ].map(([label, value]) => value ? (
                <div key={label as string} style={{ marginBottom: '0.85rem' }}>
                  <div style={labelStyle}>{label}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{value}</div>
                </div>
              ) : null)}

              <div style={{ borderTop: '1px solid var(--hairline)', marginTop: '1rem', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '0.5rem' }}>
                  Retrospective {selected.retrospective_at ? `(last updated ${fmtDate(selected.retrospective_at)})` : ''}
                </div>
                <label style={labelStyle}>Actual outcome</label>
                <textarea style={{ ...inputStyle, minHeight: '50px', marginBottom: '0.6rem' }} value={actualOutcome} onChange={e => setActualOutcome(e.target.value)} />
                <label style={labelStyle}>Retrospective notes — what did we learn?</label>
                <textarea style={{ ...inputStyle, minHeight: '50px', marginBottom: '0.6rem' }} value={retroNotes} onChange={e => setRetroNotes(e.target.value)} />
                <button onClick={saveRetrospective} disabled={saving || (!actualOutcome.trim() && !retroNotes.trim())} style={{
                  padding: '0.5rem 1.25rem', background: 'var(--primary)', color: '#fff', border: 'none',
                  borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600,
                  cursor: saving ? 'wait' : 'pointer',
                  opacity: saving || (!actualOutcome.trim() && !retroNotes.trim()) ? 0.6 : 1,
                }}>
                  {saving ? 'Saving…' : 'Save retrospective'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
