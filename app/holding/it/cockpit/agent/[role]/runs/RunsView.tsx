'use client';

// app/holding/it/cockpit/agent/[role]/runs/RunsView.tsx

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TOKENS, SERIF, MONO } from '../../../_components/tokens';

interface Run {
  id: string | number;
  created_at: string;
  agent: string | null;
  action: string | null;
  target: string | null;
  success: boolean | null;
  reasoning: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd_milli: number | null;
  tool_trace: any;
  duration_ms: number | null;
  notes: string | null;
  metadata: any;
  ticket_id: number | null;
}

interface Props {
  role: string;
  agent: any;
  runs: Run[];
}

export function RunsView({ role, agent, runs }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'failed' | 'success'>('all');
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const [feedback, setFeedback] = useState<Record<string, { open: boolean; note: string; saving: boolean; msg: string | null }>>({});

  const filtered = useMemo(() => {
    if (filter === 'all') return runs;
    if (filter === 'failed')  return runs.filter((r) => r.success === false);
    return runs.filter((r) => r.success !== false);
  }, [runs, filter]);

  const stats = useMemo(() => {
    const total = runs.length;
    const failed = runs.filter((r) => r.success === false).length;
    const succ   = runs.filter((r) => r.success !== false).length;
    const tokensIn  = runs.reduce((s, r) => s + (r.input_tokens  ?? 0), 0);
    const tokensOut = runs.reduce((s, r) => s + (r.output_tokens ?? 0), 0);
    const cost      = runs.reduce((s, r) => s + (r.cost_usd_milli ?? 0), 0) / 1000;
    return { total, failed, succ, tokensIn, tokensOut, cost };
  }, [runs]);

  function toggle(id: string | number) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function submitFeedback(runId: string | number, rating: 'good' | 'bad') {
    const fk = String(runId);
    setFeedback((s) => ({ ...s, [fk]: { ...(s[fk] ?? { note: '', open: false }), saving: true, msg: null } }));
    try {
      const note = feedback[fk]?.note ?? '';
      const res = await fetch('/api/holding/it/cockpit/agent-feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role, audit_log_id: runId, rating, note }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setFeedback((s) => ({ ...s, [fk]: {
        open: false, note: '', saving: false,
        msg: rating === 'good'
          ? '✓ marked good'
          : `✗ dismissed · ticket #${j.ticket_id ?? '?'} filed for prompt fix`,
      } }));
      router.refresh();
    } catch (e) {
      setFeedback((s) => ({ ...s, [fk]: { ...(s[fk] ?? { note: '', open: false }), saving: false, msg: `error: ${e instanceof Error ? e.message : e}` } }));
    }
  }

  return (
    <div style={{ color: TOKENS.text }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Link href={`/holding/it/cockpit/agent/${role}`} style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, textDecoration: 'none' }}>
          ← {agent?.display_name ?? role}
        </Link>
        <h1 style={{ fontFamily: SERIF, fontSize: 24, color: TOKENS.ink, margin: 0, fontWeight: 500 }}>
          Runs · {agent?.display_name ?? role}
        </h1>
        <code style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.brass }}>{role}</code>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
        <Stat label="Total runs"  value={stats.total} />
        <Stat label="Successful"  value={stats.succ}   color={TOKENS.forest} />
        <Stat label="Failed"      value={stats.failed} color={stats.failed > 0 ? '#E07856' : TOKENS.text3} />
        <Stat label="Tokens (in)" value={stats.tokensIn.toLocaleString()} />
        <Stat label="Tokens (out)" value={stats.tokensOut.toLocaleString()} />
        <Stat label="Cost (USD)"  value={`$${stats.cost.toFixed(3)}`} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['all','failed','success'] as const).map((k) => {
          const active = filter === k;
          return (
            <button key={k} type="button" onClick={() => setFilter(k)}
              style={{
                padding: '5px 12px', fontFamily: MONO, fontSize: 11,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                background: active ? TOKENS.ink : 'transparent',
                color: active ? TOKENS.bg : TOKENS.text,
                border: `1px solid ${active ? TOKENS.ink : TOKENS.border}`,
                borderRadius: 2, cursor: 'pointer',
              }}>
              {k}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 24, border: `1px dashed ${TOKENS.border}`, color: TOKENS.text3, fontFamily: MONO, fontSize: 12, borderRadius: 2 }}>
          No runs match. The `cockpit_audit_log.agent` column may not exactly match `{role}` —
          check that the agent_role field is being written consistently when this agent runs.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {filtered.map((r) => {
            const ok = r.success !== false;
            const fb = feedback[String(r.id)];
            return (
              <li key={r.id} style={{
                background: TOKENS.bgRaised,
                border: `1px solid ${TOKENS.border}`,
                borderLeft: `3px solid ${ok ? TOKENS.forest : '#E07856'}`,
                borderRadius: 2, marginBottom: 6,
              }}>
                <button type="button" onClick={() => toggle(r.id)}
                  style={{
                    width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                    padding: '10px 14px', cursor: 'pointer', display: 'grid',
                    gridTemplateColumns: '20px 150px 1fr 70px 70px', gap: 10, alignItems: 'baseline',
                  }}>
                  <span style={{ color: ok ? TOKENS.forest : '#E07856', fontWeight: 600, fontSize: 14 }}>
                    {ok ? '●' : '●'}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                  <span style={{ fontFamily: SERIF, fontSize: 13, color: TOKENS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <strong>{r.action ?? '?'}</strong>
                    {r.target ? <span style={{ color: TOKENS.text3 }}>  →  {r.target}</span> : null}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.text3, textAlign: 'right' }}>
                    {(r.input_tokens ?? 0) + (r.output_tokens ?? 0)} tok
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.text3, textAlign: 'right' }}>
                    {r.duration_ms != null ? `${r.duration_ms}ms` : '—'}
                  </span>
                </button>

                {expanded.has(r.id) && (
                  <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${TOKENS.borderSoft}` }}>
                    {!ok && (r.notes || r.reasoning) && (
                      <Box title="Error / reasoning" tone="bad">
                        <pre style={preStyle()}>{r.notes ?? r.reasoning ?? ''}</pre>
                      </Box>
                    )}
                    {ok && r.reasoning && (
                      <Box title="Reasoning">
                        <pre style={preStyle()}>{r.reasoning}</pre>
                      </Box>
                    )}
                    {r.tool_trace && (
                      <Box title="Tool trace">
                        <pre style={preStyle()}>{JSON.stringify(r.tool_trace, null, 2)}</pre>
                      </Box>
                    )}
                    {r.metadata && Object.keys(r.metadata).length > 0 && (
                      <Box title="Metadata">
                        <pre style={preStyle()}>{JSON.stringify(r.metadata, null, 2)}</pre>
                      </Box>
                    )}

                    {/* Feedback row */}
                    <div style={{ marginTop: 12, padding: '10px 12px', background: TOKENS.bgDeep, borderRadius: 2 }}>
                      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: TOKENS.text3, marginBottom: 8 }}>
                        Feedback on this run
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button type="button"
                          disabled={fb?.saving}
                          onClick={() => submitFeedback(r.id, 'good')}
                          style={btn(TOKENS.forest)}>
                          ✓ Confirm good
                        </button>
                        <button type="button"
                          disabled={fb?.saving}
                          onClick={() => setFeedback((s) => ({ ...s, [String(r.id)]: { ...(s[String(r.id)] ?? { note: '', saving: false, msg: null }), open: !(s[String(r.id)]?.open ?? false) } }))}
                          style={btn('#E07856')}>
                          ✗ Dismiss + note
                        </button>
                        {fb?.msg && (
                          <span style={{ fontFamily: MONO, fontSize: 11, color: fb.msg.startsWith('error') ? '#E07856' : TOKENS.forest, marginLeft: 8 }}>
                            {fb.msg}
                          </span>
                        )}
                      </div>
                      {fb?.open && (
                        <div style={{ marginTop: 10 }}>
                          <textarea
                            value={fb.note}
                            onChange={(e) => setFeedback((s) => ({ ...s, [String(r.id)]: { ...(s[String(r.id)] ?? { open: true, saving: false, msg: null }), note: e.target.value } }))}
                            placeholder="What was wrong? (e.g. 'tone too formal', 'missed property scope', 'cited stale doc')"
                            rows={3}
                            style={{
                              width: '100%', padding: 10, borderRadius: 2,
                              border: `1px solid ${TOKENS.border}`,
                              background: TOKENS.bgRaised, color: TOKENS.text,
                              fontFamily: MONO, fontSize: 12, resize: 'vertical',
                            }}
                          />
                          <button type="button"
                            disabled={!fb.note?.trim() || fb.saving}
                            onClick={() => submitFeedback(r.id, 'bad')}
                            style={{ ...btn('#E07856'), marginTop: 8 }}>
                            File prompt-fix ticket
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{
      padding: '10px 12px', background: TOKENS.bgRaised,
      border: `1px solid ${TOKENS.border}`, borderRadius: 2,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: TOKENS.text3 }}>{label}</div>
      <div style={{ fontFamily: SERIF, fontSize: 20, color: color ?? TOKENS.ink, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Box({ title, tone, children }: { title: string; tone?: 'bad'; children: React.ReactNode }) {
  const c = tone === 'bad' ? '#E07856' : TOKENS.text3;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: c, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ background: TOKENS.bgDeep, border: `1px solid ${tone === 'bad' ? '#E07856' : TOKENS.borderSoft}`, borderRadius: 2, padding: 10 }}>
        {children}
      </div>
    </div>
  );
}

function preStyle(): React.CSSProperties {
  return {
    margin: 0, fontFamily: MONO, fontSize: 11, lineHeight: 1.5,
    color: TOKENS.text, whiteSpace: 'pre-wrap', maxHeight: 340, overflow: 'auto',
  };
}

function btn(color: string): React.CSSProperties {
  return {
    padding: '6px 14px', borderRadius: 2,
    background: 'transparent', color,
    border: `1px solid ${color}`,
    fontFamily: SERIF, fontSize: 13, cursor: 'pointer',
  };
}
