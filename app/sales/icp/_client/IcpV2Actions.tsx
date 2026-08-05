'use client';
import { useState } from 'react';

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const OK = '#0E7A4B';
const FOREST = '#084838'; const AMBER = '#B48A3A'; const RED = '#B03826';

// ── Criteria Editor ──────────────────────────────────────────────────────────
export function IcpCriteriaEditor({ 
  icpKey, 
  icpName, 
  currentCriteria 
}: { 
  icpKey: string; 
  icpName: string; 
  currentCriteria: any;
}) {
  const [editing, setEditing] = useState(false);
  const [criteria, setCriteria] = useState(JSON.stringify(currentCriteria, null, 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    try {
      const parsed = JSON.parse(criteria);
      const res = await fetch('/api/sales/icp/criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icp_key: icpKey, criteria: parsed }),
      });
      const j = await res.json();
      if (j.ok) {
        window.location.reload();
      } else {
        setError(j.error || 'Save failed');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  }

  if (!editing) {
    return (
      <button 
        onClick={() => setEditing(true)}
        style={{ fontSize: 10, padding: '4px 10px', border: `1px solid ${HAIR}`, borderRadius: 3, background: WHITE, cursor: 'pointer', color: FOREST, fontWeight: 600 }}
      >
        ✏️ Edit Criteria
      </button>
    );
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: WHITE, borderRadius: 8, maxWidth: 600, width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', background: FOREST, color: WHITE, borderRadius: '8px 8px 0 0' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Edit Criteria · {icpName}</div>
          <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2 }}>
            Matcher will reclassify bookings on save (criteria-driven, A2).
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <textarea 
            value={criteria}
            onChange={e => setCriteria(e.target.value)}
            style={{ width: '100%', minHeight: 200, fontFamily: 'monospace', fontSize: 11, padding: 10, border: `1px solid ${HAIR}`, borderRadius: 4 }}
          />
          {error && <div style={{ marginTop: 8, fontSize: 11, color: RED }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button 
              onClick={save}
              disabled={saving}
              style={{ flex: 1, fontSize: 12, padding: '8px 16px', background: FOREST, color: WHITE, border: 'none', borderRadius: 4, cursor: saving ? 'default' : 'pointer', fontWeight: 600 }}
            >
              {saving ? 'Saving…' : '✓ Save & Reclassify'}
            </button>
            <button 
              onClick={() => setEditing(false)}
              style={{ fontSize: 12, padding: '8px 16px', background: CREAM, color: INK, border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Target Editor ────────────────────────────────────────────────────────────
export function IcpTargetEditor({ 
  icpKey, 
  icpName, 
  currentTarget, 
  basis 
}: { 
  icpKey: string; 
  icpName: string; 
  currentTarget: number | null; 
  basis: string;
}) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(currentTarget?.toString() || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    const val = parseFloat(target);
    if (isNaN(val) || val < 0 || val > 100) {
      setError('Target must be 0–100');
      setSaving(false);
      return;
    }
    const res = await fetch('/api/sales/icp/target', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icp_key: icpKey, target_share_pct: val }),
    });
    const j = await res.json();
    if (j.ok) {
      window.location.reload();
    } else {
      setError(j.error || 'Save failed');
    }
    setSaving(false);
  }

  if (!editing) {
    return (
      <button 
        onClick={() => setEditing(true)}
        style={{ fontSize: 10, padding: '4px 10px', border: `1px solid ${HAIR}`, borderRadius: 3, background: WHITE, cursor: 'pointer', color: AMBER, fontWeight: 600 }}
      >
        🎯 Set Target
      </button>
    );
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: WHITE, borderRadius: 8, maxWidth: 400, width: '100%' }}>
        <div style={{ padding: '16px 20px', background: AMBER, color: WHITE, borderRadius: '8px 8px 0 0' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Set Target · {icpName}</div>
          <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2 }}>
            Target share of total {basis} (0–100%). Gap badges will recompute.
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <label style={{ fontSize: 11, color: INK_M, display: 'block', marginBottom: 6 }}>
            Target {basis} share %
          </label>
          <input 
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={target}
            onChange={e => setTarget(e.target.value)}
            style={{ width: '100%', fontSize: 14, padding: '8px 12px', border: `1px solid ${HAIR}`, borderRadius: 4 }}
          />
          {error && <div style={{ marginTop: 8, fontSize: 11, color: RED }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button 
              onClick={save}
              disabled={saving}
              style={{ flex: 1, fontSize: 12, padding: '8px 16px', background: AMBER, color: WHITE, border: 'none', borderRadius: 4, cursor: saving ? 'default' : 'pointer', fontWeight: 600 }}
            >
              {saving ? 'Saving…' : '✓ Save Target'}
            </button>
            <button 
              onClick={() => setEditing(false)}
              style={{ fontSize: 12, padding: '8px 16px', background: CREAM, color: INK, border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Unclassified Drill ───────────────────────────────────────────────────────
export function UnclassifiedDrill({ count }: { count: number }) {
  const [drilling, setDrilling] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function drill() {
    setDrilling(true);
    setLoading(true);
    const res = await fetch('/api/sales/icp/unclassified');
    const j = await res.json();
    if (j.ok && Array.isArray(j.bookings)) {
      setBookings(j.bookings);
    }
    setLoading(false);
  }

  if (!drilling) {
    return (
      <button 
        onClick={drill}
        style={{ fontSize: 10, padding: '6px 12px', border: `1px solid ${AMBER}`, borderRadius: 3, background: WHITE, cursor: 'pointer', color: AMBER, fontWeight: 600 }}
      >
        🔍 Drill to {count} rows
      </button>
    );
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: WHITE, borderRadius: 8, maxWidth: 900, width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', background: AMBER, color: WHITE, borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Unclassified Bookings · Last 89d</div>
            <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2 }}>
              {count} revenue-bearing stays with no ICP match
            </div>
          </div>
          <button 
            onClick={() => setDrilling(false)}
            style={{ fontSize: 18, background: 'none', border: 'none', color: WHITE, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: 20 }}>
          {loading && <div style={{ fontSize: 12, color: INK_M }}>Loading…</div>}
          {!loading && bookings.length === 0 && (
            <div style={{ fontSize: 12, color: INK_M }}>No unclassified bookings.</div>
          )}
          {!loading && bookings.length > 0 && (
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: CREAM, borderBottom: `2px solid ${HAIR}` }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>Res ID</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>Country</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>Channel</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>Nights</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>ADR</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>Pax</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>Revenue</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>Check-in</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.slice(0, 100).map((b, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${HAIR}` }}>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 9 }}>{b.reservation_id}</td>
                      <td style={{ padding: '6px 8px' }}>{b.country || '—'}</td>
                      <td style={{ padding: '6px 8px' }}>{b.channel_group}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{b.nights}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>${b.adr?.toFixed(0)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{b.pax}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>${b.total_amount?.toFixed(0)}</td>
                      <td style={{ padding: '6px 8px' }}>{b.check_in_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bookings.length > 100 && (
                <div style={{ marginTop: 12, fontSize: 10, color: INK_M, fontStyle: 'italic' }}>
                  Showing first 100 of {bookings.length} rows
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Propose from Unclassified ────────────────────────────────────────────────
export function ProposeFromUnclassified() {
  const [proposing, setProposing] = useState(false);

  async function propose() {
    setProposing(true);
    // This just triggers the weekly job manually (or creates a draft proposal)
    // For now, we'll just show a message that it's in the proposals panel
    alert('Unclassified cluster analysis is in the Research Loop Panel below. The weekly job drafts proposals automatically.');
    setProposing(false);
  }

  return (
    <button 
      onClick={propose}
      disabled={proposing}
      style={{ fontSize: 10, padding: '6px 12px', border: 'none', borderRadius: 3, background: FOREST, cursor: proposing ? 'default' : 'pointer', color: WHITE, fontWeight: 600 }}
    >
      {proposing ? 'Processing…' : '✨ Propose New ICP'}
    </button>
  );
}

// ── Proposals Panel ──────────────────────────────────────────────────────────
export function ProposalsPanel({ proposals }: { proposals: Array<{
  id: number; rank: number; proposal_type: string; icp_key: string;
  proposal: string; evidence: any;
}> }) {
  const [deciding, setDeciding] = useState<Record<number, boolean>>({});
  const [decided, setDecided] = useState<Record<number, string>>({});

  async function decide(id: number, status: 'approved' | 'rejected') {
    setDeciding(d => ({ ...d, [id]: true }));
    const res = await fetch('/api/sales/icp/proposal/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const j = await res.json();
    if (j.ok) {
      setDecided(d => ({ ...d, [id]: status }));
      // Reload after 1s to show updated state
      setTimeout(() => window.location.reload(), 1000);
    }
    setDeciding(d => ({ ...d, [id]: false }));
  }

  const typeColors: Record<string, string> = {
    new_icp: FOREST,
    grow: OK,
    investigate: AMBER,
    retire: RED,
  };

  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ background: FOREST, padding: '12px 16px', color: WHITE }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Research Loop · PBS-Gated Proposals</div>
        <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2 }}>
          Weekly cron computes gaps + drafts ranked proposals with evidence. Nothing auto-applies — PBS approval required.
        </div>
      </div>
      <div style={{ padding: 16 }}>
        {proposals.length === 0 && (
          <div style={{ fontSize: 11, color: INK_M, fontStyle: 'italic' }}>
            No draft proposals. Weekly job runs Mondays 02:30 UTC.
          </div>
        )}
        {proposals.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {proposals.map(p => {
              const typeColor = typeColors[p.proposal_type] || INK_M;
              const dec = decided[p.id];
              return (
                <div key={p.id} style={{ border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ background: typeColor, padding: '8px 12px', color: WHITE, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(255,255,255,.2)', borderRadius: 2, marginRight: 8 }}>
                        RANK {p.rank}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{p.proposal_type.replace('_', ' ').toUpperCase()}</span>
                    </div>
                    <span style={{ fontSize: 10, opacity: 0.9 }}>{p.icp_key}</span>
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: INK, lineHeight: 1.6, marginBottom: 10 }}>
                      {p.proposal}
                    </div>
                    <details style={{ fontSize: 10, color: INK_M, marginBottom: 10 }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Evidence</summary>
                      <pre style={{ background: CREAM, padding: 8, borderRadius: 3, marginTop: 6, fontSize: 9, overflow: 'auto' }}>
                        {JSON.stringify(p.evidence, null, 2)}
                      </pre>
                    </details>
                    {dec ? (
                      <div style={{ fontSize: 11, fontWeight: 600, color: dec === 'approved' ? OK : RED }}>
                        {dec === 'approved' ? '✓ Approved' : '✕ Rejected'}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button 
                          onClick={() => decide(p.id, 'approved')}
                          disabled={deciding[p.id]}
                          style={{ flex: 1, fontSize: 11, padding: '6px 12px', background: OK, color: WHITE, border: 'none', borderRadius: 3, cursor: deciding[p.id] ? 'default' : 'pointer', fontWeight: 600 }}
                        >
                          {deciding[p.id] ? 'Processing…' : '✓ Approve'}
                        </button>
                        <button 
                          onClick={() => decide(p.id, 'rejected')}
                          disabled={deciding[p.id]}
                          style={{ flex: 1, fontSize: 11, padding: '6px 12px', background: RED, color: WHITE, border: 'none', borderRadius: 3, cursor: deciding[p.id] ? 'default' : 'pointer', fontWeight: 600 }}
                        >
                          {deciding[p.id] ? 'Processing…' : '✕ Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
