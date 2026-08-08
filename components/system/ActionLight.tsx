'use client';
// components/system/ActionLight.tsx
// action-light-surface-v1 — Reads public.v_action_light + v_decision_sweep.
// Single coloured light: green=all clear, red=broken, amber=decisions pending.
// Collapsed when green, expanded when red/amber. Polls every 60s.

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TOKENS, SERIF, MONO } from '@/components/cockpit/tokens';

const RED = '#f85149';
const AMBER = '#d29922';
const GREEN = '#3fb950';

interface ActionLightRow {
  light: 'red' | 'amber' | 'green';
  headline: string;
  decisions: number;
  red_blockers: number;
  amber_blockers: number;
  oldest_decision_hours: number | null;
  top_reason?: string | null;
}

interface DecisionRow {
  headline: string;
  severity: 'red' | 'amber';
  source: string;
  age_hours: number | null;
  deep_link: string;
  kind: string;
  ref: string;
  detail?: string | null;
}

const card: React.CSSProperties = {
  background: TOKENS.bgRaised,
  border: `1px solid ${TOKENS.border}`,
  borderRadius: 2,
  padding: '14px 16px',
  marginBottom: 20,
};

const cell: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: `1px solid ${TOKENS.border}`,
  fontSize: 12.5,
};

const hdr: React.CSSProperties = {
  ...cell,
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 11,
  color: TOKENS.inkSoft,
  background: '#FAFAF7',
  whiteSpace: 'nowrap',
};

export default function ActionLight() {
  const [light, setLight] = useState<ActionLightRow | null>(null);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const sb = createClient();
      const [lightRes, decisionsRes] = await Promise.all([
        sb.from('v_action_light').select('*').single(),
        sb.from('v_decision_sweep').select('*'),
      ]);

      if (lightRes.error) throw lightRes.error;
      if (decisionsRes.error) throw decisionsRes.error;

      const lightData = lightRes.data as ActionLightRow;
      const decisionsData = (decisionsRes.data ?? []) as DecisionRow[];

      setLight(lightData);
      setDecisions(decisionsData);
      setExpanded(lightData.light !== 'green');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load action light');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // poll every 60s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={card}>
        <p style={{ margin: 0, fontSize: 12.5, color: TOKENS.inkSoft }}>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={card}>
        <p style={{ margin: 0, fontSize: 12.5, color: RED }}>{error}</p>
      </div>
    );
  }

  if (!light) return null;

  const lightColor = light.light === 'red' ? RED : light.light === 'amber' ? AMBER : GREEN;
  const totalBlockers = light.red_blockers + light.amber_blockers;
  const oldestHours = light.oldest_decision_hours ?? 0;

  return (
    <div style={card}>
      {/* Header row with light chip, headline, and counts */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Light chip */}
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: lightColor,
            flexShrink: 0,
          }}
        />

        {/* Headline */}
        <h2
          style={{
            fontFamily: SERIF,
            fontSize: 17,
            margin: 0,
            color: TOKENS.ink,
            fontWeight: 500,
            flex: 1,
          }}
        >
          {light.headline}
        </h2>

        {/* Counts */}
        <span style={{ fontSize: 12, color: TOKENS.inkSoft, whiteSpace: 'nowrap' }}>
          {light.decisions} decisions · {totalBlockers} broken · oldest {Math.round(oldestHours)}h
        </span>

        {/* Expand/collapse indicator */}
        <span style={{ fontSize: 11, color: TOKENS.inkSoft }}>
          {expanded ? '▼' : '▶'}
        </span>
      </div>

      {/* Expanded details table */}
      {expanded && decisions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ ...hdr, width: 20 }}></th>
                <th style={{ ...hdr, textAlign: 'left' }}>Issue</th>
                <th style={{ ...hdr, textAlign: 'left' }}>Source</th>
                <th style={{ ...hdr, textAlign: 'right', width: 80 }}>Age</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d, i) => {
                const sevColor = d.severity === 'red' ? RED : AMBER;
                const ageDisplay = d.age_hours === null ? 'now' : `${Math.round(d.age_hours)}h`;

                return (
                  <tr key={i} style={{ cursor: 'pointer' }}>
                    <td style={cell}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: sevColor,
                        }}
                      />
                    </td>
                    <td style={cell}>
                      <a
                        href={d.deep_link}
                        style={{
                          color: TOKENS.ink,
                          textDecoration: 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {d.headline}
                      </a>
                    </td>
                    <td style={{ ...cell, fontFamily: MONO, fontSize: 11, color: TOKENS.inkSoft }}>
                      {d.source}
                    </td>
                    <td style={{ ...cell, textAlign: 'right', fontFamily: MONO, fontSize: 11 }}>
                      {ageDisplay}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Green state message */}
      {expanded && decisions.length === 0 && light.light === 'green' && (
        <p style={{ margin: '12px 0 0', fontSize: 12.5, color: GREEN }}>
          All systems reporting. No decisions pending, no blockers.
        </p>
      )}
    </div>
  );
}
