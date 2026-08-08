'use client';
// components/system/ActionLight.tsx
// action-light-surface-v1 — single light: green/amber/red. Renders v_action_light
// and v_decision_sweep. Zero writes. Owner glances → knows if blocked.

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TOKENS, SERIF, MONO } from '@/components/cockpit/tokens';

// ── colours (per spec) ─────────────────────────────────────────────────────
const RED = '#f85149';
const AMBER = '#d29922';
const GREEN = '#3fb950';

// ── data shapes (match public.v_action_light, public.v_decision_sweep) ────
interface LightRow {
  light: 'red' | 'amber' | 'green';
  headline: string;
  decisions: number;
  top_reason: string | null;
  red_blockers: number;
  amber_blockers: number;
  oldest_decision_hours: number | null;
}

interface DecisionRow {
  ref: string;
  kind: 'blocker' | 'decision';
  headline: string;
  source: string;
  severity: 'red' | 'amber' | 'yellow';
  age_hours: number | null;
  deep_link: string;
  detail: string | null;
  options: string[];
}

// ── component ──────────────────────────────────────────────────────────────
export function ActionLight() {
  const [light, setLight] = useState<LightRow | null>(null);
  const [rows, setRows] = useState<DecisionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function load() {
    try {
      const sb = createClient();
      const [lightRes, sweepRes] = await Promise.all([
        sb.from('v_action_light').select('*').single(),
        sb.from('v_decision_sweep').select('*').order('severity', { ascending: false }),
      ]);
      if (lightRes.error) throw lightRes.error;
      if (sweepRes.error) throw sweepRes.error;
      const lightData = lightRes.data as LightRow;
      const sweepData = (sweepRes.data ?? []) as DecisionRow[];
      setLight(lightData);
      setRows(sweepData);
      // expand if red or amber, collapse if green
      setExpanded(lightData.light === 'red' || lightData.light === 'amber');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <section style={{ ...card, marginBottom: 20 }}>
        <p style={{ fontSize: 12.5, color: RED, margin: 0 }}>
          Action light failed to load: {error}
        </p>
      </section>
    );
  }

  if (!light) {
    return (
      <section style={{ ...card, marginBottom: 20 }}>
        <p style={{ fontSize: 12.5, color: TOKENS.inkSoft, margin: 0 }}>Loading…</p>
      </section>
    );
  }

  const chipColor = light.light === 'red' ? RED : light.light === 'amber' ? AMBER : GREEN;
  const totalBlockers = light.red_blockers + light.amber_blockers;
  const oldestStr = light.oldest_decision_hours !== null
    ? `${Math.round(light.oldest_decision_hours)}h`
    : rows.length > 0 && rows[0].age_hours !== null
    ? `${Math.round(rows[0].age_hours)}h`
    : 'now';

  return (
    <section style={{ ...card, marginBottom: 20 }}>
      {/* header chip + headline + counts */}
      <header
        style={{
          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
          marginBottom: expanded ? 14 : 0,
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div
          style={{
            width: 16, height: 16, borderRadius: '50%', background: chipColor,
            boxShadow: `0 0 8px ${chipColor}`,
          }}
        />
        <h2
          style={{
            fontFamily: SERIF, fontSize: 17, fontWeight: 500, margin: 0, color: TOKENS.ink,
          }}
        >
          {light.headline}
        </h2>
        <span style={{ fontSize: 11.5, color: TOKENS.inkSoft, fontFamily: MONO }}>
          {light.decisions} decision{light.decisions === 1 ? '' : 's'} ·{' '}
          {totalBlockers} broken ·{' '}
          oldest {oldestStr}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 18, color: TOKENS.inkSoft }}>
          {expanded ? '−' : '+'}
        </span>
      </header>

      {/* table of rows when expanded */}
      {expanded && rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={hdr} />
              <th style={hdr}>Item</th>
              <th style={hdr}>Source</th>
              <th style={hdr}>Age</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dotColor = r.severity === 'red' ? RED : r.severity === 'amber' ? AMBER : TOKENS.inkSoft;
              const ageStr = r.age_hours !== null ? `${Math.round(r.age_hours)}h` : 'now';
              return (
                <tr key={r.ref} style={{ cursor: 'pointer' }} onClick={() => window.location.href = r.deep_link}>
                  <td style={{ ...cellStyle, width: 20, textAlign: 'center' }}>
                    <div
                      style={{
                        width: 8, height: 8, borderRadius: '50%', background: dotColor,
                        display: 'inline-block',
                      }}
                    />
                  </td>
                  <td style={cellStyle}>
                    <span style={{ fontWeight: 500 }}>{r.headline}</span>
                    {r.detail && (
                      <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginTop: 2, maxWidth: 600 }}>
                        {r.detail.length > 200 ? r.detail.slice(0, 200) + '…' : r.detail}
                      </div>
                    )}
                  </td>
                  <td style={cellStyle}>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.inkSoft }}>
                      {r.source}
                    </span>
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontFamily: MONO, fontSize: 11 }}>
                    {ageStr}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* empty state when no rows */}
      {expanded && rows.length === 0 && (
        <p style={{ fontSize: 12.5, color: TOKENS.inkSoft, margin: 0 }}>
          No blockers or decisions open.
        </p>
      )}
    </section>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`,
  borderRadius: 2, padding: '14px 16px',
};

const hdr: React.CSSProperties = {
  padding: '6px 10px', fontSize: 11, fontWeight: 600, color: TOKENS.inkSoft,
  background: '#FAFAF7', textAlign: 'left', whiteSpace: 'nowrap',
  borderBottom: `1px solid ${TOKENS.border}`,
};

const cellStyle: React.CSSProperties = {
  padding: '8px 10px', borderBottom: `1px solid ${TOKENS.border}`, fontSize: 12.5,
  verticalAlign: 'top',
};
