// app/revenue/compset/_components/agent/AgentSettingsEditor.tsx
// Stateful editor for an agent's runtime_settings JSON.
// Mandate-locked rules render as a separate read-only section (renders in the
// parent page so this component only owns the editable runtime block + save bar).

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AgentSettingsRow } from '../scoring/types';

interface Props {
  agent: AgentSettingsRow;
}

type RuntimeShape = {
  picker_mode?: string;
  picker_max_dates?: number;
  picker_horizon_days?: number;
  picker_min_score?: number;
  channels_to_scrape?: string[];
  default_geo_markets?: string[];
  default_los_nights?: number;
  cron_enabled?: boolean;
  cron_schedule?: string;
  cron_schedule_human?: string;
  phase?: string;
  [k: string]: unknown;
};

const PICKER_MODES = ['phase_1_validation', 'daily_lean', 'ondemand_deep'] as const;
const CHANNEL_OPTIONS = [
  'booking',
  'agoda',
  'expedia',
  'trip',
  'direct',
  'google',
  'hotels_com',
] as const;

const DEFAULT_RUNTIME: RuntimeShape = {
  picker_mode: 'daily_lean',
  picker_max_dates: 8,
  picker_horizon_days: 120,
  picker_min_score: 40,
  channels_to_scrape: ['booking', 'agoda', 'direct'],
  default_geo_markets: ['US'],
  default_los_nights: 1,
  cron_enabled: false,
  cron_schedule: '0 23 * * *',
  cron_schedule_human: 'Daily at 06:00 ICT',
  phase: 'phase_1_validation',
};

function isDirty(a: RuntimeShape, b: RuntimeShape): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function asNum(v: unknown, fallback: number): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function isValidCron(s: string): boolean {
  return s.trim().split(/\s+/).length === 5;
}

const FIELD_STYLE: React.CSSProperties = {
  padding: '8px 10px',
  background: 'var(--paper)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 4,
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-base)',
  color: 'var(--ink)',
  fontVariantNumeric: 'tabular-nums',
  minWidth: 0,
};

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--ls-extra)',
  color: 'var(--ink-mute)',
  marginBottom: 4,
  display: 'block',
};

export default function AgentSettingsEditor({ agent }: Props) {
  const router = useRouter();
  const initial = useMemo<RuntimeShape>(
    () => ({ ...(agent.runtime_settings ?? {}) } as RuntimeShape),
    [agent.runtime_settings],
  );
  const isEmptyInitial = Object.keys(initial).length === 0;
  const [form, setForm] = useState<RuntimeShape>(initial);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: 'good' | 'bad' | 'info';
    text: string;
  } | null>(null);

  const dirty = isDirty(form, initial);
  const cronVal = asStr(form.cron_schedule, '');
  const cronOk = !asBool(form.cron_enabled) || isValidCron(cronVal);
  const canSave = dirty && cronOk;

  function patch<K extends keyof RuntimeShape>(k: K, v: RuntimeShape[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleChannel(c: string) {
    setForm((f) => {
      const cur = asArr(f.channels_to_scrape);
      return {
        ...f,
        channels_to_scrape: cur.includes(c)
          ? cur.filter((x) => x !== c)
          : [...cur, c],
      };
    });
  }

  function removeMarket(m: string) {
    setForm((f) => ({
      ...f,
      default_geo_markets: asArr(f.default_geo_markets).filter((x) => x !== m),
    }));
  }

  function addMarket(raw: string) {
    const code = raw.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return;
    setForm((f) => {
      const cur = asArr(f.default_geo_markets);
      if (cur.includes(code)) return f;
      return { ...f, default_geo_markets: [...cur, code] };
    });
  }

  function discard() {
    setForm(initial);
    setReason('');
    setMessage(null);
  }

  function initializeDefaults() {
    setForm(DEFAULT_RUNTIME);
  }

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/compset/agent-runtime', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agent_code: agent.code,
          runtime_settings: form,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMessage({
          tone: 'bad',
          text: `Save failed: ${json.error ?? `HTTP ${res.status}`}`,
        });
        return;
      }
      setMessage({ tone: 'good', text: 'Runtime settings saved. Refreshing…' });
      router.refresh();
    } catch (e: any) {
      setMessage({
        tone: 'bad',
        text: `Save failed: ${e?.message ?? 'unknown'}`,
      });
    } finally {
      setBusy(false);
    }
  }

  // Init-defaults banner for empty runtime_settings
  if (isEmptyInitial && !dirty) {
    return (
      <div
        style={{
          background: 'var(--st-warn-bg)',
          border: '1px solid var(--st-warn-bd)',
          borderRadius: 8,
          padding: '22px 24px',
          marginTop: 18,
        }}
      >
        <div
          style={{
            ...LABEL_STYLE,
            color: 'var(--brass)',
            marginBottom: 8,
          }}
        >
          No runtime config yet
        </div>
        <div
          style={{
            color: 'var(--ink-soft)',
            fontSize: 'var(--t-sm)',
            marginBottom: 14,
          }}
        >
          Agent <code style={inlineCodeStyle}>{agent.code}</code> has no
          runtime_settings. Click below to load a sensible default and review
          before saving.
        </div>
        <button type="button" onClick={initializeDefaults} style={btnPrimaryStyle}>
          INITIALIZE DEFAULTS
        </button>
      </div>
    );
  }

  return (
    <>
      {/* RUNTIME SETTINGS — green tinted, editable */}
      <div
        style={{
          background: 'var(--st-good-bg)',
          border: '1px solid var(--st-good-bd)',
          borderLeft: '4px solid var(--moss)',
          borderRadius: 8,
          padding: '22px 24px',
          marginTop: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                ...LABEL_STYLE,
                color: 'var(--moss)',
              }}
            >
              ✓ EDITABLE BY RM
            </div>
            <h2
              style={{
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
                fontSize: 'var(--t-xl)',
                fontWeight: 500,
                margin: 0,
                marginTop: 4,
              }}
            >
              Runtime settings
            </h2>
            <div
              style={{
                color: 'var(--ink-mute)',
                fontSize: 'var(--t-sm)',
                marginTop: 4,
              }}
            >
              Tunable knobs — saved to <code style={inlineCodeStyle}>governance.agents.runtime_settings</code>.
            </div>
          </div>
        </div>

        {/* Mode + numeric knobs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <label style={LABEL_STYLE}>Picker mode</label>
            <select
              value={asStr(form.picker_mode, 'daily_lean')}
              onChange={(e) => patch('picker_mode', e.target.value)}
              style={{ ...FIELD_STYLE, width: '100%' }}
            >
              {PICKER_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={LABEL_STYLE}>Max dates</label>
            <input
              type="number"
              min={1}
              max={20}
              value={asNum(form.picker_max_dates, 8)}
              onChange={(e) =>
                patch('picker_max_dates', Number(e.target.value))
              }
              style={{ ...FIELD_STYLE, width: '100%', textAlign: 'right' }}
            />
          </div>
          <div>
            <label style={LABEL_STYLE}>Horizon (days)</label>
            <input
              type="number"
              min={7}
              max={365}
              value={asNum(form.picker_horizon_days, 120)}
              onChange={(e) =>
                patch('picker_horizon_days', Number(e.target.value))
              }
              style={{ ...FIELD_STYLE, width: '100%', textAlign: 'right' }}
            />
          </div>
          <div>
            <label style={LABEL_STYLE}>Min score floor</label>
            <input
              type="number"
              min={0}
              max={100}
              value={asNum(form.picker_min_score, 40)}
              onChange={(e) =>
                patch('picker_min_score', Number(e.target.value))
              }
              style={{ ...FIELD_STYLE, width: '100%', textAlign: 'right' }}
            />
          </div>
        </div>

        {/* Channels chips */}
        <div style={{ marginBottom: 14 }}>
          <label style={LABEL_STYLE}>Channels to scrape</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CHANNEL_OPTIONS.map((c) => {
              const on = asArr(form.channels_to_scrape).includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleChannel(c)}
                  style={{
                    padding: '4px 10px',
                    fontFamily: 'var(--mono)',
                    fontSize: 'var(--t-xs)',
                    letterSpacing: 'var(--ls-loose)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    borderRadius: 12,
                    cursor: 'pointer',
                    border: `1px solid ${on ? 'var(--moss)' : 'var(--paper-deep)'}`,
                    background: on ? 'var(--moss)' : 'transparent',
                    color: on ? 'var(--paper-warm)' : 'var(--ink-soft)',
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Geo markets */}
        <div style={{ marginBottom: 14 }}>
          <label style={LABEL_STYLE}>Default geo markets</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {asArr(form.default_geo_markets).map((m) => (
              <span
                key={m}
                style={{
                  padding: '4px 8px 4px 10px',
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--t-xs)',
                  letterSpacing: 'var(--ls-loose)',
                  borderRadius: 12,
                  border: '1px solid var(--brass)',
                  background: 'var(--paper-warm)',
                  color: 'var(--brass)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {m}
                <button
                  type="button"
                  onClick={() => removeMarket(m)}
                  aria-label={`Remove ${m}`}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--ink-mute)',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 'var(--t-sm)',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <AddMarketInput onAdd={addMarket} />
          </div>
        </div>

        {/* LOS + cron */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 2fr)',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <label style={LABEL_STYLE}>Default LOS (nights)</label>
            <input
              type="number"
              min={1}
              max={14}
              value={asNum(form.default_los_nights, 1)}
              onChange={(e) =>
                patch('default_los_nights', Number(e.target.value))
              }
              style={{ ...FIELD_STYLE, width: '100%', textAlign: 'right' }}
            />
          </div>
          <div>
            <label style={LABEL_STYLE}>Cron enabled</label>
            <label
              style={{
                display: 'inline-flex',
                gap: 8,
                alignItems: 'center',
                padding: '8px 10px',
                background: 'var(--paper)',
                border: '1px solid var(--paper-deep)',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-base)',
              }}
            >
              <input
                type="checkbox"
                checked={asBool(form.cron_enabled)}
                onChange={(e) => patch('cron_enabled', e.target.checked)}
              />
              {asBool(form.cron_enabled) ? 'on' : 'off'}
            </label>
          </div>
          <div>
            <label style={LABEL_STYLE}>Cron schedule</label>
            <input
              type="text"
              value={cronVal}
              onChange={(e) => patch('cron_schedule', e.target.value)}
              placeholder="0 23 * * *"
              style={{
                ...FIELD_STYLE,
                width: '100%',
                borderColor: cronOk ? 'var(--paper-deep)' : 'var(--st-bad)',
              }}
            />
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                color: cronOk ? 'var(--ink-mute)' : 'var(--st-bad)',
                marginTop: 4,
              }}
            >
              {cronOk
                ? asStr(form.cron_schedule_human, '5-field cron expression')
                : 'Cron expression must have 5 space-separated fields.'}
            </div>
          </div>
        </div>

        {/* Phase (display only) */}
        <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
          <div>
            <label style={LABEL_STYLE}>Phase (read-only)</label>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-sm)',
                color: 'var(--ink-soft)',
              }}
            >
              {asStr(form.phase, '—')}
            </span>
          </div>
        </div>
      </div>

      {/* SAVE BAR */}
      {dirty && (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 5,
            marginTop: 18,
            background: 'var(--paper-warm)',
            border: '1px solid var(--paper-deep)',
            borderRadius: 8,
            padding: '16px 20px',
            boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
          }}
        >
          <label style={LABEL_STYLE}>
            Reason (optional — runtime tweaks aren&apos;t mandate-audited)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Bumped horizon to 180d to cover next quarter."
            style={{
              ...FIELD_STYLE,
              width: '100%',
              fontFamily: 'var(--sans)',
              fontSize: 'var(--t-sm)',
              resize: 'vertical',
            }}
          />
          {message && (
            <div
              style={{
                marginTop: 10,
                fontSize: 'var(--t-sm)',
                color:
                  message.tone === 'bad'
                    ? 'var(--st-bad)'
                    : message.tone === 'good'
                      ? 'var(--moss)'
                      : 'var(--ink-soft)',
              }}
            >
              {message.text}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 12,
            }}
          >
            <button
              type="button"
              onClick={discard}
              disabled={busy}
              style={btnSecondaryStyle}
            >
              DISCARD
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave || busy}
              style={{
                ...btnPrimaryStyle,
                opacity: !canSave || busy ? 0.5 : 1,
                cursor: !canSave || busy ? 'not-allowed' : 'pointer',
              }}
            >
              {busy ? 'SAVING…' : 'SAVE RUNTIME'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function AddMarketInput({ onAdd }: { onAdd: (m: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <input
        type="text"
        maxLength={2}
        value={val}
        onChange={(e) => setVal(e.target.value.toUpperCase())}
        placeholder="XX"
        style={{
          padding: '4px 8px',
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-loose)',
          width: 50,
          textAlign: 'center',
          border: '1px solid var(--paper-deep)',
          borderRadius: 12,
          background: 'var(--paper)',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onAdd(val);
            setVal('');
          }
        }}
      />
      <button
        type="button"
        onClick={() => {
          onAdd(val);
          setVal('');
        }}
        style={{
          padding: '4px 10px',
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-loose)',
          textTransform: 'uppercase',
          fontWeight: 600,
          borderRadius: 12,
          cursor: 'pointer',
          border: '1px solid var(--paper-deep)',
          background: 'transparent',
          color: 'var(--ink-soft)',
        }}
      >
        + ADD
      </button>
    </span>
  );
}

const btnPrimaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  fontWeight: 600,
  borderRadius: 4,
  border: '1px solid var(--moss)',
  background: 'var(--moss)',
  color: 'var(--paper-warm)',
  cursor: 'pointer',
};

const btnSecondaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  fontWeight: 600,
  borderRadius: 4,
  border: '1px solid var(--paper-deep)',
  background: 'transparent',
  color: 'var(--ink-soft)',
  cursor: 'pointer',
};

const inlineCodeStyle: React.CSSProperties = {
  margin: '0 4px',
  padding: '1px 6px',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  background: 'var(--paper)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 3,
};
