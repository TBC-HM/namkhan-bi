'use client';
// app/mail/rules/_client/RulesClient.tsx
// PBS 2026-07-15 · Item 7 — list + toggle + delete user routing rules.
import { useCallback, useEffect, useState } from 'react';

interface Rule {
  id: number;
  match_type: 'from_email' | 'from_domain' | 'subject_contains' | 'list_id';
  match_value: string;
  route_to: 'newsletter' | 'spam' | 'cloudbeds' | 'lighthouse' | 'answer_expected' | 'important' | 'custom' | 'hide';
  custom_folder: string | null;
  active: boolean;
  created_at: string;
}

const T = {
  WHITE: '#FFFFFF', HAIR: '#E6DFCC', INK: '#1B1B1B', INK_M: '#5A5A5A',
  RAIL_BG: '#FAFAF7', FOREST: '#084838', RED: '#B04A2F', CREAM: '#F5F0E1',
};

export default function RulesClient() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/mail/routing-rules', { cache: 'no-store' });
      const j = await r.json() as { ok: boolean; rules?: Rule[]; error?: string };
      if (j.ok && j.rules) setRules(j.rules);
      else setError(j.error || 'load_failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load_failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = useCallback(async (id: number, active: boolean) => {
    await fetch('/api/mail/routing-rules?id=' + id, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    void load();
  }, [load]);

  const remove = useCallback(async (id: number) => {
    if (!confirm('Delete this routing rule?')) return;
    await fetch('/api/mail/routing-rules?id=' + id, { method: 'DELETE' });
    void load();
  }, [load]);

  return (
    <div style={{ minHeight: '100vh', background: T.WHITE, color: T.INK, padding: 24, fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>Mail routing rules</div>
            <div style={{ fontSize: 12, color: T.INK_M, marginTop: 4 }}>
              Automatic sender routing for the Direct / Newsletters / Spam / Cloudbeds / Lighthouse folders.
              Rules created here also hide senders from Direct.
            </div>
          </div>
          <a href="/mail" style={{ fontSize: 12, color: T.FOREST, textDecoration: 'none' }}>← Back to mail</a>
        </div>

        {loading ? (
          <div style={{ padding: 20, color: T.INK_M }}>Loading…</div>
        ) : error ? (
          <div style={{ padding: 12, background: T.CREAM, border: '1px solid ' + T.HAIR, borderRadius: 4, color: T.RED, fontSize: 12 }}>Error: {error}</div>
        ) : rules.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.INK_M, background: T.RAIL_BG, border: '1px solid ' + T.HAIR, borderRadius: 6 }}>
            No routing rules yet. Use the ⋯ menu on any thread on /mail to create one from a sender.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.RAIL_BG }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid ' + T.HAIR, fontSize: 11, textTransform: 'uppercase', color: T.INK_M, letterSpacing: '.06em' }}>Match</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid ' + T.HAIR, fontSize: 11, textTransform: 'uppercase', color: T.INK_M, letterSpacing: '.06em' }}>Value</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid ' + T.HAIR, fontSize: 11, textTransform: 'uppercase', color: T.INK_M, letterSpacing: '.06em' }}>Route to</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid ' + T.HAIR, fontSize: 11, textTransform: 'uppercase', color: T.INK_M, letterSpacing: '.06em' }}>Active</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid ' + T.HAIR, fontSize: 11, textTransform: 'uppercase', color: T.INK_M, letterSpacing: '.06em' }}></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid ' + T.HAIR }}>
                  <td style={{ padding: '8px 10px', color: T.INK_M }}>{r.match_type}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 500 }}>{r.match_value}</td>
                  <td style={{ padding: '8px 10px' }}>{r.route_to}{r.custom_folder ? ' · ' + r.custom_folder : ''}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <label style={{ cursor: 'pointer', fontSize: 12 }}>
                      <input type="checkbox" checked={r.active} onChange={(e) => void toggle(r.id, e.target.checked)} style={{ marginRight: 4 }} />
                      {r.active ? 'On' : 'Off'}
                    </label>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    <button type="button" onClick={() => void remove(r.id)} style={{ background: T.WHITE, color: T.RED, border: '1px solid ' + T.HAIR, borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
