'use client';
// PBS 2026-09-15 · QA approvals workbench.
// Coverage suggestions are shown ONLY for atoms a document can actually discharge (procedure, rule).
// Evidence and observation atoms are listed separately and cannot be confirmed here — an SOP does not
// close them, and pretending otherwise is how a standard starts lying about itself.
import { useCallback, useEffect, useState } from 'react';

type Coverage = {
  atom_id: string; sop_code: string; confidence: number | null; dept_code: string | null;
  discharge_mode: string | null; atom_title: string | null; requirement_text: string | null;
  sop_title: string | null; closable: boolean; caution: string | null;
};
type Proposal = {
  id: number; dept_code: string | null; title: string | null; purpose_short: string | null;
  priority: number | null; status: string; linked_sop_code: string | null;
  has_sop: boolean; age_days: number; tags: string[] | null;
};

const btn: React.CSSProperties = {
  fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
  border: '1px solid var(--hair, #E6DFCC)', background: 'var(--paper, #FFFFFF)', color: 'var(--ink, #1B1B1B)',
};
const btnPrimary: React.CSSProperties = {
  ...btn, background: 'var(--forest, #084838)', color: '#FFFFFF', borderColor: 'var(--forest, #084838)',
};
const card: React.CSSProperties = {
  borderTop: '1px solid var(--hair, #E6DFCC)', padding: '10px 0', fontSize: 12.5, color: 'var(--ink, #1B1B1B)',
};
const mute: React.CSSProperties = { opacity: 0.65 };
const pill: React.CSSProperties = {
  fontSize: 10.5, padding: '1px 6px', borderRadius: 4, border: '1px solid var(--hair, #E6DFCC)',
  color: 'var(--ink-mute, #5A5A5A)', textTransform: 'uppercase', letterSpacing: '0.04em',
};

export default function ApprovalsClient({ propertyId }: { propertyId: number }) {
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shownCov, setShownCov] = useState(15);
  const [shownProp, setShownProp] = useState(15);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/quality/approvals?pid=${propertyId}`, { cache: 'no-store' });
        const json = await res.json();
        if (!alive) return;
        if (!json.ok) setError(json.error ?? 'could not load the approvals queues');
        else {
          setCoverage((json.coverage ?? []) as Coverage[]);
          setProposals((json.proposals ?? []) as Proposal[]);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'could not load the approvals queues');
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [propertyId]);

  const decideCoverage = useCallback(async (row: Coverage, verdict: 'confirm' | 'reject') => {
    const key = row.atom_id + row.sop_code;
    setBusy(key); setError(null);
    try {
      const res = await fetch('/api/quality/approvals', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pid: propertyId, atom_id: row.atom_id, sop_code: row.sop_code, verdict }),
      });
      const json = await res.json();
      if (json.ok) setCoverage((prev) => prev.filter((r) => r.atom_id + r.sop_code !== key));
      else setError(json.error ?? 'decision failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'decision failed');
    } finally { setBusy(null); }
  }, [propertyId]);

  const decideProposal = useCallback(async (row: Proposal, verdict: 'archive' | 'reprioritise', priority?: number) => {
    const key = 'p' + row.id;
    setBusy(key); setError(null);
    try {
      const res = await fetch('/api/quality/approvals', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pid: propertyId, id: row.id, verdict, priority }),
      });
      const json = await res.json();
      if (json.ok) {
        if (verdict === 'archive') setProposals((prev) => prev.filter((r) => r.id !== row.id));
        else setProposals((prev) => prev.map((r) => (r.id === row.id ? { ...r, priority: priority ?? r.priority } : r)));
      } else setError(json.error ?? 'decision failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'decision failed');
    } finally { setBusy(null); }
  }, [propertyId]);

  if (loading) return <div style={{ ...mute, fontSize: 12.5 }}>Loading the approval queues&hellip;</div>;

  const closable = coverage.filter((c) => c.closable);
  const notClosable = coverage.filter((c) => !c.closable);
  const unwritten = proposals.filter((p) => !p.has_sop);

  return (
    <div>
      {error ? <div style={{ fontSize: 12, marginBottom: 8 }}>{error}</div> : null}

      <div style={{ fontSize: 12.5, marginBottom: 10 }}>
        <strong>{closable.length}</strong> coverage suggestions a document can actually close ·{' '}
        <strong>{unwritten.length}</strong> approved SOPs not yet written
        <span style={mute}> · {notClosable.length} suggestions listed below cannot be closed by an SOP</span>
      </div>

      {/* Coverage suggestions — closable */}
      <h3 style={{ fontSize: 13.5, margin: '14px 0 2px' }}>Coverage suggestions</h3>
      <div style={{ ...mute, fontSize: 11.5, marginBottom: 4 }}>
        An embedding proposed that this SOP already covers this requirement. Read the SOP before confirming —
        measured precision on the highest-confidence ones was 1 in 2, and confidence does not separate right from wrong.
      </div>
      {closable.slice(0, shownCov).map((row) => {
        const key = row.atom_id + row.sop_code;
        return (
          <div key={key} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 260, flex: '1 1 380px' }}>
                <div style={{ fontWeight: 600 }}>{row.atom_title ?? '(untitled requirement)'}</div>
                {row.requirement_text && row.requirement_text !== row.atom_title ? (
                  <div style={{ ...mute, marginTop: 2 }}>{row.requirement_text.slice(0, 260)}</div>
                ) : null}
                <div style={{ marginTop: 4 }}>
                  <span style={pill}>{row.dept_code ?? 'unassigned'}</span>{' '}
                  <span style={pill}>{row.discharge_mode}</span>{' '}
                  {typeof row.confidence === 'number' ? <span style={pill}>{Math.round(row.confidence * 100)}%</span> : null}
                </div>
              </div>
              <div style={{ minWidth: 230 }}>
                <div style={{ fontSize: 11.5, ...mute }}>Proposed SOP</div>
                <div>{row.sop_title ?? row.sop_code}</div>
                <div style={{ ...mute, fontSize: 11 }}>{row.sop_code}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button style={btnPrimary} disabled={busy === key} onClick={() => decideCoverage(row, 'confirm')}>
                    {busy === key ? '…' : 'Confirm'}
                  </button>
                  <button style={btn} disabled={busy === key} onClick={() => decideCoverage(row, 'reject')}>
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {shownCov < closable.length ? (
        <button style={{ ...btn, marginTop: 10 }} onClick={() => setShownCov((n) => n + 15)}>
          Show {Math.min(15, closable.length - shownCov)} more
        </button>
      ) : null}

      {/* SOP proposals */}
      <h3 style={{ fontSize: 13.5, margin: '22px 0 2px' }}>Approved SOPs not yet written</h3>
      <div style={{ ...mute, fontSize: 11.5, marginBottom: 4 }}>
        Approved means someone said yes. It does not mean it exists. Sorted by priority, then age.
      </div>
      {unwritten.slice(0, shownProp).map((row) => {
        const key = 'p' + row.id;
        return (
          <div key={key} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 260, flex: '1 1 380px' }}>
                <div style={{ fontWeight: 600 }}>{row.title ?? '(untitled)'}</div>
                {row.purpose_short ? <div style={{ ...mute, marginTop: 2 }}>{row.purpose_short.slice(0, 260)}</div> : null}
                <div style={{ marginTop: 4 }}>
                  <span style={pill}>{row.dept_code ?? 'unassigned'}</span>{' '}
                  <span style={pill}>P{row.priority ?? '?'}</span>{' '}
                  <span style={pill}>{row.age_days}d open</span>
                </div>
              </div>
              <div style={{ minWidth: 230, display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <button style={btnPrimary} disabled={busy === key || row.priority === 1}
                        onClick={() => decideProposal(row, 'reprioritise', 1)}>
                  {busy === key ? '…' : 'Make P1'}
                </button>
                <button style={btn} disabled={busy === key} onClick={() => decideProposal(row, 'reprioritise', 3)}>
                  Drop to P3
                </button>
                <button style={btn} disabled={busy === key} onClick={() => decideProposal(row, 'archive')}>
                  Archive
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {shownProp < unwritten.length ? (
        <button style={{ ...btn, marginTop: 10 }} onClick={() => setShownProp((n) => n + 15)}>
          Show {Math.min(15, unwritten.length - shownProp)} more
        </button>
      ) : null}

      {/* Not closable by a document */}
      {notClosable.length > 0 ? (
        <details style={{ marginTop: 22 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13.5 }}>
            {notClosable.length} suggestions an SOP cannot close
          </summary>
          <div style={{ ...mute, fontSize: 11.5, margin: '4px 0 8px' }}>
            Evidence requirements need a record; observation requirements are scored by audit. Listed so you can see
            them, deliberately not confirmable here.
          </div>
          {notClosable.slice(0, 40).map((row) => (
            <div key={row.atom_id + row.sop_code} style={card}>
              <div style={{ fontWeight: 600 }}>{row.atom_title ?? '(untitled requirement)'}</div>
              <div style={mute}>
                <span style={pill}>{row.discharge_mode}</span> {row.caution}
              </div>
            </div>
          ))}
        </details>
      ) : null}
    </div>
  );
}
