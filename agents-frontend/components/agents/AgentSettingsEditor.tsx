'use client';

// components/agents/AgentSettingsEditor.tsx
// Editable settings panel for an agent. Currently UI-only — saves to local state with toast.
// When backend exists, wire `handleSave` to persist via API.

import { useState } from 'react';
import type { AgentDefinition } from '@/lib/agents';

const MODEL_OPTIONS = [
  { value: 'claude-opus-4-7',    label: 'Claude Opus 4.7 (smartest, most expensive)' },
  { value: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6 (balanced)' },
  { value: 'claude-haiku-4-5',   label: 'Claude Haiku 4.5 (fastest, cheapest)' },
  { value: 'gemini-2.5-pro',     label: 'Gemini 2.5 Pro (good for analytics)' },
  { value: 'gemini-2.5-flash',   label: 'Gemini 2.5 Flash (fast, cheap)' },
  { value: 'gpt-5',              label: 'GPT-5 (alternative)' },
];

export default function AgentSettingsEditor({ agent }: { agent: AgentDefinition }) {
  const [prompt, setPrompt] = useState(agent.defaultPrompt);
  const [model, setModel] = useState(agent.model);
  const [trigger, setTrigger] = useState(agent.trigger);
  const [schedule, setSchedule] = useState(agent.schedule ?? '');
  const [status, setStatus] = useState(agent.status);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty =
    prompt !== agent.defaultPrompt ||
    model !== agent.model ||
    trigger !== agent.trigger ||
    schedule !== (agent.schedule ?? '') ||
    status !== agent.status;

  function handleSave() {
    // Placeholder: would POST to /api/agents/{id} when backend exists
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 3000);
  }

  function handleReset() {
    setPrompt(agent.defaultPrompt);
    setModel(agent.model);
    setTrigger(agent.trigger);
    setSchedule(agent.schedule ?? '');
    setStatus(agent.status);
  }

  return (
    <div className="agent-settings-grid">
      {/* LEFT: prompt editor */}
      <div className="agent-settings-main">
        <div className="agent-form-section">
          <div className="agent-form-section-title">System Prompt</div>
          <div className="agent-field-hint" style={{ marginBottom: 8 }}>
            Use {`{variable}`} placeholders to reference inputs at run time.
            Available: {agent.inputs.map(i => `{${i.key}}`).join(', ') || 'none'}
          </div>
          <textarea
            className="agent-field-textarea agent-prompt-editor"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={14}
          />
          <div className="agent-prompt-stats muted">
            {prompt.length} chars · ~{Math.ceil(prompt.length / 4)} tokens
          </div>
        </div>
      </div>

      {/* RIGHT: settings panel */}
      <div className="agent-settings-side">
        <div className="agent-form-section">
          <div className="agent-form-section-title">Model</div>
          <select className="period-select" style={{ width: '100%' }} value={model} onChange={e => setModel(e.target.value)}>
            {MODEL_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="agent-form-section">
          <div className="agent-form-section-title">Trigger</div>
          <select className="period-select" style={{ width: '100%', marginBottom: 12 }} value={trigger} onChange={e => setTrigger(e.target.value as any)}>
            <option value="manual">Manual only</option>
            <option value="scheduled">Scheduled (cron)</option>
            <option value="event">Event-driven</option>
          </select>
          {trigger === 'scheduled' && (
            <>
              <label className="agent-field-label">Schedule (cron)</label>
              <input
                className="agent-field-input"
                value={schedule}
                placeholder="0 7 * * MON"
                onChange={e => setSchedule(e.target.value)}
              />
              <div className="agent-field-hint">Examples: <code>0 7 * * MON</code> (every Mon 7am), <code>*/15 * * * *</code> (every 15min)</div>
            </>
          )}
        </div>

        <div className="agent-form-section">
          <div className="agent-form-section-title">Status</div>
          <select className="period-select" style={{ width: '100%' }} value={status} onChange={e => setStatus(e.target.value as any)}>
            <option value="draft">Draft (not running)</option>
            <option value="live">Live</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        <div className="agent-form-section">
          <div className="agent-form-section-title">Outputs Routing</div>
          <div className="agent-field-hint" style={{ marginBottom: 8 }}>Where should output go after each run?</div>
          <label className="agent-checkbox-row">
            <input type="checkbox" defaultChecked /> Save to History
          </label>
          <label className="agent-checkbox-row">
            <input type="checkbox" /> Email pb@thenamkhan.com
          </label>
          <label className="agent-checkbox-row">
            <input type="checkbox" /> Post to Slack #ops
          </label>
          <label className="agent-checkbox-row">
            <input type="checkbox" /> Telegram alert
          </label>
        </div>

        <div className="agent-fire-row">
          <button className="agent-btn agent-btn-fire" onClick={handleSave} disabled={!dirty}>
            {savedAt ? '✓ Saved' : 'Save changes'}
          </button>
          <button className="agent-btn" onClick={handleReset} disabled={!dirty}>
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
