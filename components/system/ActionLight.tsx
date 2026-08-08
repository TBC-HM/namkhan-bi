'use client';
// components/system/ActionLight.tsx
// action-light-surface-v1 — Single coloured light for PBS decision/blocker status
// Reads public.v_action_light (one row) + public.v_decision_sweep (many rows)
// Green = nothing needs you. Red = something is broken. Click to expand details.
// Polls every 60s. Collapsed when green, expanded when red/amber.

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const RED = '#f85149';
const AMBER = '#d29922';
const GREEN = '#3fb950';

interface ActionLightData {
  light: 'red' | 'amber' | 'green';
  headline: string;
  decisions: number;
  red_blockers: number;
  amber_blockers: number;
  oldest_decision_hours: number | null;
}

interface DecisionRow {
  ref: string;
  kind: string;
  detail: string;
  source: string;
  options: string[];
  headline: string;
  severity: 'red' | 'amber' | 'green';
  age_hours: number | null;
  deep_link: string;
}

export function ActionLight() {
  const [lightData, setLightData] = useState<ActionLightData | null>(null);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function load() {
    try {
      const [lightRes, decisionsRes] = await Promise.all([
        supabase.from('v_action_light').select('*').single(),
        supabase.from('v_decision_sweep').select('*').order('severity', { ascending: true }).order('age_hours', { ascending: false, nullsFirst: false }),
      ]);

      if (lightRes.error) throw lightRes.error;
      if (decisionsRes.error) throw decisionsRes.error;

      const light = lightRes.data as ActionLightData;
      const rows = (decisionsRes.data ?? []) as DecisionRow[];

      setLightData(light);
      setDecisions(rows);
      setError(null);

      // Auto-expand if red or amber
      if (light.light === 'red' || light.light === 'amber') {
        setExpanded(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div style={{
        background: '#FFF9F5', border: '1px solid #D4D4D0',
        borderRadius: 2, padding: '14px 16px', marginBottom: 20,
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#52433D' }}>Action light load error: {error}</p>
      </div>
    );
  }

  if (!lightData) {
    return (
      <div style={{
        background: '#FFF9F5', border: '1px solid #D4D4D0',
        borderRadius: 2, padding: '14px 16px', marginBottom: 20,
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#8C8781' }}>Loading action status…</p>
      </div>
    );
  }

  const lightColor = lightData.light === 'red' ? RED : lightData.light === 'amber' ? AMBER : GREEN;
  const totalBlockers = lightData.red_blockers + lightData.amber_blockers;
  const oldestStr = lightData.oldest_decision_hours !== null
    ? `${Math.round(lightData.oldest_decision_hours)}h`
    : decisions.length > 0 && decisions.some(d => d.age_hours !== null)
      ? `${Math.round(Math.max(...decisions.filter(d => d.age_hours !== null).map(d => d.age_hours!)))}h`
      : 'now';

  return (
    <section style={{
      background: '#FFF9F5', border: '1px solid #D4D4D0',
      borderRadius: 2, padding: '14px 16px', marginBottom: 20,
    }}>
      {/* Header with light chip */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        }}
      >
        <div style={{
          width: 12, height: 12, borderRadius: '50%', background: lightColor,
          boxShadow: `0 0 8px ${lightColor}`,
        }} />
        <div style={{ flex: 1 }}>
          <h2 style={{
            margin: 0, fontSize: 15, fontWeight: 600, color: '#52433D',
            fontFamily: 'ui-serif, Georgia, serif',
          }}>
            {lightData.headline}
          </h2>
          <p style={{
            margin: '4px 0 0 0', fontSize: 11.5, color: '#8C8781',
          }}>
            {lightData.decisions} decision{lightData.decisions !== 1 ? 's' : ''} · {totalBlockers} broken · oldest {oldestStr}
          </p>
        </div>
        <button
          type="button"
          style={{
            fontSize: 11, padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
            border: '1px solid #D4D4D0', background: '#FEFDFB', color: '#52433D',
          }}
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {/* Details table */}
      {expanded && decisions.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{
                  textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #D4D4D0',
                  fontSize: 11, fontWeight: 600, color: '#8C8781', background: '#FAFAF7',
                }}>Status</th>
                <th style={{
                  textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #D4D4D0',
                  fontSize: 11, fontWeight: 600, color: '#8C8781', background: '#FAFAF7',
                }}>What</th>
                <th style={{
                  textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #D4D4D0',
                  fontSize: 11, fontWeight: 600, color: '#8C8781', background: '#FAFAF7',
                }}>Source</th>
                <th style={{
                  textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #D4D4D0',
                  fontSize: 11, fontWeight: 600, color: '#8C8781', background: '#FAFAF7',
                }}>Age</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((row, i) => {
                const rowColor = row.severity === 'red' ? RED : row.severity === 'amber' ? AMBER : '#8C8781';
                const ageStr = row.age_hours !== null ? `${Math.round(row.age_hours)}h` : 'now';
                return (
                  <tr key={row.ref + i} style={{ cursor: 'pointer' }} onClick={() => window.location.href = row.deep_link}>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #D4D4D0' }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', background: rowColor,
                      }} />
                    </td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #D4D4D0', color: '#52433D' }}>
                      {row.headline}
                    </td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #D4D4D0', color: '#8C8781', fontSize: 11 }}>
                      {row.source}
                    </td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #D4D4D0', color: '#8C8781', fontSize: 11 }}>
                      {ageStr}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {expanded && decisions.length === 0 && (
        <p style={{ marginTop: 14, fontSize: 12, color: '#8C8781' }}>
          All systems reporting. Nothing needs you right now.
        </p>
      )}
    </section>
  );
}
