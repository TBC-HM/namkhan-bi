// app/revenue/compset/_components/scoring/ScoringSettingsEditor.tsx
// Stateful editor for the active compset scoring config.
// Wraps weights, DOW scores, lead-time bands. Validates client-side, posts
// to /api/compset/scoring/draft + /api/compset/scoring/activate.

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DOW_KEYS,
  DOW_LABELS,
  type LeadTimeBand,
  type ScoringConfigRow,
} from './types';

interface Props {
  active: ScoringConfigRow;
}

type Weights = {
  weight_dow: number;
  weight_event: number;
  weight_lead_time: number;
  weight_peak_bonus: number;
};

type FormState = {
  weights: Weights;
  dow_scores: Record<string, number>;
  lead_time_bands: LeadTimeBand[];
};

function toNum(v: number | string | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function buildInitialState(active: ScoringConfigRow): FormState {
  return {
    weights: {
      weight_dow: toNum(active.weight_dow),
      weight_event: toNum(active.weight_event),
      weight_lead_time: toNum(active.weight_lead_time),
      weight_peak_bonus: toNum(active.weight_peak_bonus),
    },
    dow_scores: {
      '0': toNum(active.dow_scores?.['0'], 50),
      '1': toNum(active.dow_scores?.['1'], 50),
      '2': toNum(active.dow_scores?.['2'], 50),
      '3': toNum(active.dow_scores?.['3'], 50),
      '4': toNum(active.dow_scores?.['4'], 50),
      '5': toNum(active.dow_scores?.['5'], 50),
      '6': toNum(active.dow_scores?.['6'], 50),
    },
    lead_time_bands: (active.lead_time_bands ?? []).map((b) => ({
      label: b.label,
      score: toNum(b.score),
      max_days: toNum(b.max_days),
    })),
  };
}

function isDirty(a: FormState, b: FormState): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function validate(form: FormState): string[] {
  const errs: string[] = [];
  const sum =
    form.weights.weight_dow +
    form.weights.weight_event +
    form.weights.weight_lead_time +
    form.weights.weight_peak_bonus;
  if (Math.abs(sum - 1) > 0.011) {
    errs.push(`Weights must sum to 1.00 (currently ${sum.toFixed(2)}).`);
  }
  for (const k of DOW_KEYS) {
    const s = form.dow_scores[k];
    if (s < 0 || s > 100) errs.push(`${DOW_LABELS[k]} score must be 0–100.`);
  }
  if (form.lead_time_bands.length === 0) {
    errs.push('At least one lead-time band is required.');
  }
  for (let i = 0; i < form.lead_time_bands.length; i++) {
    const b = form.lead_time_bands[i];
    if (!b.label.trim()) errs.push(`Band #${i + 1} needs a label.`);
    if (b.score < 0 || b.score > 100)
      errs.push(`Band #${i + 1} score must be 0–100.`);
    if (b.max_days < 1) errs.push(`Band #${i + 1} max_days must be ≥1.`);
    if (i > 0 && b.max_days <= form.lead_time_bands[i - 1].max_days) {
      errs.push(
        `Band #${i + 1} max_days (${b.max_days}) must be > previous band's (${form.lead_time_bands[i - 1].max_days}).`,
      );
    }
  }
  return errs;
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

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontStyle: 'italic',
  fontSize: 'var(--t-xl)',
  fontWeight: 500,
  marginTop: 0,
  marginBottom: 4,
};

const PANEL_STYLE: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  padding: '22px 24px',
  marginTop: 18,
};

export default function ScoringSettingsEditor({ active }: Props) {
  const router = useRouter();
  const initial = useMemo(() => buildInitialState(active), [active]);
  const [form, setForm] = useState<FormState>(initial);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [showActivatePrompt, setShowActivatePrompt] = useState<{
    config_id: string;
  } | null>(null);
  const [message, setMessage] = useState<{
    tone: 'info' | 'good' | 'bad';
    text: string;
  } | null>(null);

  const dirty = isDirty(form, initial);
  const errors = validate(form);
  const canSave = dirty && errors.length === 0 && reason.trim().length >= 10;

  const sumWeights =
    form.weights.weight_dow +
    form.weights.weight_event +
    form.weights.weight_lead_time +
    form.weights.weight_peak_bonus;
  const sumOk = Math.abs(sumWeights - 1) <= 0.011;

  function setWeight(k: keyof Weights, v: number) {
    setForm((f) => ({
      ...f,
      weights: { ...f.weights, [k]: Number.isFinite(v) ? v : 0 },
    }));
  }

  function setDowScore(key: string, v: number) {
    setForm((f) => ({
      ...f,
      dow_scores: { ...f.dow_scores, [key]: Number.isFinite(v) ? v : 0 },
    }));
  }

  function updateBand(idx: number, patch: Partial<LeadTimeBand>) {
    setForm((f) => ({
      ...f,
      lead_time_bands: f.lead_time_bands.map((b, i) =>
        i === idx ? { ...b, ...patch } : b,
      ),
    }));
  }

  function addBand() {
    setForm((f) => {
      const last = f.lead_time_bands[f.lead_time_bands.length - 1];
      const nextMax = last ? Math.max(last.max_days + 1, last.max_days * 2) : 7;
      return {
        ...f,
        lead_time_bands: [
          ...f.lead_time_bands,
          { label: 'new band', score: 50, max_days: nextMax },
        ],
      };
    });
  }

  function removeBand(idx: number) {
    setForm((f) => ({
      ...f,
      lead_time_bands: f.lead_time_bands.filter((_, i) => i !== idx),
    }));
  }

  function discard() {
    setForm(initial);
    setReason('');
    setMessage(null);
  }

  async function saveDraft(): Promise<string | null> {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/compset/scoring/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          weight_dow: form.weights.weight_dow,
          weight_event: form.weights.weight_event,
          weight_lead_time: form.weights.weight_lead_time,
          weight_peak_bonus: form.weights.weight_peak_bonus,
          dow_scores: form.dow_scores,
          lead_time_bands: form.lead_time_bands,
          notes: reason.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMessage({
          tone: 'bad',
          text: `Save failed: ${json.error ?? `HTTP ${res.status}`}`,
        });
        return null;
      }
      setMessage({
        tone: 'good',
        text: `Draft saved — config_id ${json.config_id.slice(0, 8)}`,
      });
      return json.config_id as string;
    } catch (e: any) {
      setMessage({ tone: 'bad', text: `Save failed: ${e?.message ?? 'unknown'}` });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function activateConfig(config_id: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/compset/scoring/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config_id, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMessage({
          tone: 'bad',
          text: `Activate failed: ${json.error ?? `HTTP ${res.status}`}`,
        });
        return;
      }
      setMessage({ tone: 'good', text: 'Activated. Refreshing…' });
      setShowActivatePrompt(null);
      router.refresh();
    } catch (e: any) {
      setMessage({
        tone: 'bad',
        text: `Activate failed: ${e?.message ?? 'unknown'}`,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveClick() {
    if (!canSave) return;
    const id = await saveDraft();
    if (id) setShowActivatePrompt({ config_id: id });
  }

  return (
    <>
      {/* SECTION: Factor weights */}
      <div style={PANEL_STYLE}>
        <h2 style={SECTION_TITLE_STYLE}>Factor weights</h2>
        <div style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
          Each factor's contribution to the date score. Must sum to 1.00.
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr) auto',
            gap: 12,
            marginTop: 16,
            alignItems: 'end',
          }}
        >
          {(
            [
              ['weight_dow', 'Day-of-week'],
              ['weight_event', 'Events'],
              ['weight_lead_time', 'Lead time'],
              ['weight_peak_bonus', 'Peak bonus'],
            ] as const
          ).map(([k, label]) => (
            <div key={k}>
              <label style={LABEL_STYLE}>{label}</label>
              <input
                type="number"
                step={0.05}
                min={0}
                max={1}
                value={form.weights[k]}
                onChange={(e) => setWeight(k, Number(e.target.value))}
                style={{ ...FIELD_STYLE, width: '100%' }}
              />
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
            }}
          >
            <label style={LABEL_STYLE}>Sum</label>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-lg)',
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 600,
                color: sumOk ? 'var(--moss-glow)' : 'var(--st-bad)',
                padding: '6px 10px',
                background: sumOk ? 'var(--st-good-bg)' : 'var(--st-bad-bg)',
                border: `1px solid ${sumOk ? 'var(--st-good-bd)' : 'var(--st-bad-bd)'}`,
                borderRadius: 4,
              }}
            >
              {sumWeights.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION: Day-of-week scores */}
      <div style={PANEL_STYLE}>
        <h2 style={SECTION_TITLE_STYLE}>Day-of-week scores</h2>
        <div style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
          Demand baseline by weekday (0 quiet · 100 peak). Stored as
          dow_scores → keys 0=Sun … 6=Sat.
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 10,
            marginTop: 16,
          }}
        >
          {DOW_KEYS.map((k) => (
            <div key={k}>
              <label style={LABEL_STYLE}>{DOW_LABELS[k]}</label>
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={form.dow_scores[k]}
                onChange={(e) => setDowScore(k, Number(e.target.value))}
                style={{ ...FIELD_STYLE, width: '100%', textAlign: 'right' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* SECTION: Lead-time bands */}
      <div style={PANEL_STYLE}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 style={SECTION_TITLE_STYLE}>Lead-time bands</h2>
            <div style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
              Score by days-out. Must be ascending by max_days.
            </div>
          </div>
          <button
            type="button"
            onClick={addBand}
            style={btnSecondaryStyle}
          >
            + ADD BAND
          </button>
        </div>
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr auto',
              gap: 12,
              ...LABEL_STYLE,
              marginBottom: 6,
            }}
          >
            <span>Label</span>
            <span style={{ textAlign: 'right' }}>Max days</span>
            <span style={{ textAlign: 'right' }}>Score</span>
            <span></span>
          </div>
          {form.lead_time_bands.map((b, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr auto',
                gap: 12,
                marginBottom: 8,
                alignItems: 'center',
              }}
            >
              <input
                type="text"
                value={b.label}
                onChange={(e) => updateBand(i, { label: e.target.value })}
                style={FIELD_STYLE}
              />
              <input
                type="number"
                min={1}
                value={b.max_days}
                onChange={(e) =>
                  updateBand(i, { max_days: Number(e.target.value) })
                }
                style={{ ...FIELD_STYLE, textAlign: 'right' }}
              />
              <input
                type="number"
                min={0}
                max={100}
                value={b.score}
                onChange={(e) => updateBand(i, { score: Number(e.target.value) })}
                style={{ ...FIELD_STYLE, textAlign: 'right' }}
              />
              <button
                type="button"
                onClick={() => removeBand(i)}
                style={{
                  ...btnSecondaryStyle,
                  padding: '6px 10px',
                  color: 'var(--st-bad)',
                }}
                aria-label="Remove band"
              >
                ✕
              </button>
            </div>
          ))}
          {form.lead_time_bands.length === 0 && (
            <div
              style={{
                padding: '20px 16px',
                border: '1px dashed var(--paper-deep)',
                borderRadius: 4,
                textAlign: 'center',
                color: 'var(--ink-mute)',
                fontSize: 'var(--t-sm)',
              }}
            >
              No bands yet — add at least one to score lead-time.
            </div>
          )}
        </div>
      </div>

      {/* Validation panel */}
      {errors.length > 0 && (
        <div
          style={{
            background: 'var(--st-bad-bg)',
            border: '1px solid var(--st-bad-bd)',
            borderRadius: 8,
            padding: '14px 18px',
            marginTop: 18,
          }}
        >
          <div
            style={{
              ...LABEL_STYLE,
              color: 'var(--st-bad)',
              marginBottom: 8,
            }}
          >
            Validation issues
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              color: 'var(--ink-soft)',
              fontSize: 'var(--t-sm)',
            }}
          >
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sticky save bar */}
      {dirty && (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 5,
            marginTop: 24,
            background: 'var(--paper-warm)',
            border: '1px solid var(--paper-deep)',
            borderRadius: 8,
            padding: '16px 20px',
            boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
          }}
        >
          <label style={LABEL_STYLE}>Reason (required, min 10 chars)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Boost weekend weight by 5pp; lead-time band rebalance after STR drift."
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
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 'var(--t-xs)',
                color: 'var(--ink-mute)',
                fontFamily: 'var(--mono)',
                marginRight: 'auto',
              }}
            >
              {reason.trim().length}/10 chars
            </span>
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
              onClick={handleSaveClick}
              disabled={!canSave || busy}
              style={{
                ...btnPrimaryStyle,
                opacity: !canSave || busy ? 0.5 : 1,
                cursor: !canSave || busy ? 'not-allowed' : 'pointer',
              }}
            >
              {busy ? 'SAVING…' : 'SAVE NEW VERSION'}
            </button>
          </div>
        </div>
      )}

      {/* Activate prompt modal */}
      {showActivatePrompt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(28, 24, 21, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => !busy && setShowActivatePrompt(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--paper-warm)',
              border: '1px solid var(--paper-deep)',
              borderRadius: 8,
              padding: '22px 24px',
              maxWidth: 460,
              width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ ...SECTION_TITLE_STYLE, marginBottom: 8 }}>
              Activate now?
            </h3>
            <div
              style={{
                color: 'var(--ink-soft)',
                fontSize: 'var(--t-sm)',
                marginBottom: 14,
              }}
            >
              Draft saved as a new version. Activate now to replace the live
              config and start scoring with new weights immediately.
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setShowActivatePrompt(null)}
                disabled={busy}
                style={btnSecondaryStyle}
              >
                KEEP AS DRAFT
              </button>
              <button
                type="button"
                onClick={() => activateConfig(showActivatePrompt.config_id)}
                disabled={busy}
                style={btnPrimaryStyle}
              >
                {busy ? 'ACTIVATING…' : 'ACTIVATE NOW'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
