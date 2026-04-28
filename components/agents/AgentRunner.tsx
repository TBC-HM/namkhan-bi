'use client';

// components/agents/AgentRunner.tsx
// Two-pane interactive agent runner.
// Left: input form (auto-generated from agent.inputs definition)
// Right: output panel with simulated streaming for placeholder UX.
// When real backend exists, replace `simulateRun()` with a fetch to your Vertex/Anthropic endpoint.

import { useState, useRef, useEffect } from 'react';
import type { AgentDefinition, AgentInput } from '@/lib/agents';

interface RunState {
  status: 'idle' | 'running' | 'complete' | 'error';
  startedAt?: number;
  durationMs?: number;
  output: string;
  error?: string;
}

const PLACEHOLDER_OUTPUTS: Record<string, string[]> = {
  'pickup-predictor': [
    '## Pickup Forecast — next 90 days\n\n',
    '**Headline:** Pace is **−18 rooms** behind STLY at same point in cycle.\n\n',
    '### Risk windows\n\n',
    '| Window | OTB | STLY | Gap | Action |\n',
    '|---|---|---|---|---|\n',
    '| May 5–12 | 87 rn | 102 rn | −15 | Genius push + TH email blast |\n',
    '| May 19–26 | 64 rn | 91 rn | −27 | BAR drop 8% + flash sale |\n',
    '| Jun 2–9 | 71 rn | 78 rn | −7 | Monitor, no action yet |\n\n',
    '### What I would do\n\n',
    '1. Fire **Booking.com Genius** boost for May 5–26 ($120 estimated cost, ~12 room recovery)\n',
    '2. Email last-12-month TH/US guests with 15% direct rate code\n',
    '3. Watch June pace another 7 days before any rate intervention\n\n',
    '_Confidence: 78% — based on 3 years pace data, similar shoulder-season patterns 2024 + 2025._\n',
  ],
  'pricing-coach': [
    '## BAR adjustment recommendations\n\n',
    'Range: 2026-05-01 to 2026-05-31 · Strategy: Balanced\n\n',
    '| Date | Current BAR | Suggested | Δ | Reason |\n',
    '|---|---|---|---|---|\n',
    '| May 1 (Fri) | $245 | $260 | +6% | Occ 88% on books, 4 days out |\n',
    '| May 2 (Sat) | $245 | $275 | +12% | Compression weekend, comp set $310 avg |\n',
    '| May 5 (Tue) | $245 | $215 | −12% | Pace −15 vs STLY, 28 days out |\n',
    '| May 6 (Wed) | $245 | $215 | −12% | Same as above |\n',
    '| May 12 (Tue) | $245 | $230 | −6% | Mid-week soft, gentle drop |\n\n',
    '_Run with `aggression=aggressive` to see steeper moves._\n',
  ],
  'fb-capture': [
    '## Top 10 F&B conversion targets — In-house\n\n',
    '1. **Wilson party** (US, 2 nights, $0 F&B) — Sunset dinner package $95 pp · likely yes\n',
    '2. **Schmidt couple** (DE, 4 nights, $0 F&B) — Lunch + wine $48 pp · medium likelihood\n',
    '3. **Tanaka family** (JP, 3 nights, $0 F&B) — Breakfast addition $22/day · easy ask\n',
    '4. **Foster honeymoon** (UK, 5 nights, $0 F&B) — Private dining experience $180 · high\n',
    '5. **Larsson group** (SE, 2 nights, $0 F&B) — Set menu dinner $65 pp · yes\n',
    '_...continues for top 10_\n\n',
    '### Why this list\n',
    '- Filtered to guests with stay ≥ 2 nights and zero current F&B spend\n',
    '- Scored by country mix + room category + lead time\n',
    '- Total revenue opportunity: **~$1,820** if 60% conversion\n',
  ],
  'spa-capture': [
    '## Top spa conversion candidates\n\n',
    'Therapist utilization currently **34%** — push hard.\n\n',
    '1. Foster honeymoon — couples massage 90min, slot 4pm tomorrow · $180\n',
    '2. Schmidt couple — wellness ritual 60min · $95\n',
    '3. Wilson party — sunset stretch class · $35 pp\n',
    '_3 more candidates with high propensity scores._\n',
  ],
  'outlook-agent': [
    '# Monday Brief — Owner View\n',
    'Week ending: Apr 27, 2026\n\n',
    '## Last week\n',
    '- Occupancy: **72%** vs **68%** STLY (+4pp) ✓\n',
    '- ADR: **$203** vs **$211** STLY (−$8) ✗\n',
    '- RevPAR: **$146** vs **$143** STLY (+$3)\n',
    '- TRevPAR: **$179** — F&B mix improved 2pp\n\n',
    '## This week pace\n',
    'On the books **84%** for the next 7 days — strong, no actions needed.\n\n',
    '## 30/60/90 outlook\n',
    '- 30d: pace +5% vs STLY ✓\n',
    '- 60d: pace **−12% vs STLY** — risk\n',
    '- 90d: pace +2% vs STLY\n\n',
    '## Top 3 actions\n',
    '1. **60-day pickup risk** — fire Genius push on Booking.com for May 19–Jun 9. Est cost $200, est recovery $4,800.\n',
    '2. **ADR softness** — comp set up 6%, we are flat. Consider $15 BAR raise on weekends through May.\n',
    '3. **F&B capture stuck at 38%** — F&B Capture Agent identified 10 in-house targets worth ~$1,820. Push to F&B manager.\n',
  ],
  'what-if': [
    '## Scenario analysis\n\n',
    'Scenario as written: _{scenario}_\n\n',
    '| Metric | Baseline | Scenario | Δ |\n',
    '|---|---|---|---|\n',
    '| Occupancy | 71% | 78% | +7pp |\n',
    '| ADR | $203 | $182 | −$21 |\n',
    '| RevPAR | $144 | $142 | −$2 |\n',
    '| Total Rev | $108k | $107k | −$1k |\n',
    '| GOPPAR | $68 | $63 | −$5 |\n\n',
    '**Net: scenario reduces GOPPAR by ~$5/room/night despite occupancy gain.**\n\n',
    '### Assumptions\n',
    '- Demand elasticity: −1.4 (typical for this property)\n',
    '- Variable cost per occupied room: $42\n',
    '- F&B capture rate stable at 38%\n\n',
    '### Sensitivity\n',
    '- If elasticity is actually −1.8, GOPPAR drops $9 (worse)\n',
    '- If elasticity is −1.0, GOPPAR drops $2 (better)\n',
  ],
  'review-responder': [
    '## 3 unanswered reviews — drafted responses\n\n',
    '**Review 1** · TripAdvisor · 5.0 · "Anna L."\n',
    '> "Magical stay, the staff at Roots restaurant were incredible..."\n\n',
    'Draft reply:\n',
    '> Anna, thank you — we are so glad Roots gave you a stay to remember. The team will be thrilled to hear this; I will share your kind words with them personally. Please come back and see us, your tent will be waiting.\n',
    '> — Paul, The Namkhan\n\n',
    '_Auto-publish: yes (rating ≥ 4.5)_\n\n---\n\n',
    '**Review 2** · Booking.com · 3.0 · "Markus B."\n',
    '> "Beautiful property but the wifi was spotty in our tent and breakfast was slow..."\n\n',
    'Draft reply (flagged for human review):\n',
    '> Markus, thank you for taking the time to share this. The wifi issue is a fair point — the river bend tents have weaker signal and we are upgrading routers next month. The breakfast pacing on a busy morning is on us; I have spoken to the team. We would love a chance to make it right if you visit again.\n',
    '> — Paul, The Namkhan\n\n',
    '_⚠️ Flagged: rating ≤ 3, recommend human review before sending. Operational follow-up: confirm router upgrade timeline, brief F&B on AM staffing._\n',
  ],
  'dq-auditor': [
    '## Data Quality Exception Report\n\n',
    'Scan complete · 4,749 reservations · 76,001 transactions · 88,863 rate inventory rows\n\n',
    '| Severity | Issue | Count | Suggested Fix |\n',
    '|---|---|---|---|\n',
    '| 🔴 High | Reservations with NULL guest_email | 4,749 | Investigate Cloudbeds API scope |\n',
    '| 🟡 Med | Transactions without USALI category | 412 | Add to category map |\n',
    '| 🟡 Med | Reservations cancelled but with paid_amount > 0 | 8 | Verify refund status |\n',
    '| 🟢 Low | TENT_7_CLOSED retired flag still in active list | 1 | Cosmetic |\n\n',
    '_Run nightly at 04:00 LST. Last 5 days trend: stable._\n',
  ],
  'comp-set-watcher': [
    '## Comp Set rate parity check\n\n',
    'Compared 28 dates × 5 properties on Booking.com\n\n',
    '⚠️ **3 alerts**\n\n',
    '1. May 12 — Our rate $245, comp set median $218 — we are **$27 above market**. Pace soft, consider drop.\n',
    '2. May 18 — Booking.com rate $230 vs our direct $245 — **OTA undercutting us by $15**. Check rate shopper rules.\n',
    '3. May 24 — Comp parity OK, but Mekong Estate dropped to $189 (was $215) — they are softening, watch.\n',
  ],
  'ota-mix-optimizer': [
    '## OTA Mix Analysis — last 90 days\n\n',
    '| Channel | Rev | Comm % | Net Rev | ADR | Repeat % |\n',
    '|---|---|---|---|---|---|\n',
    '| Booking.com | $89k | 17% | $74k | $198 | 4% |\n',
    '| Direct | $51k | 0% | $51k | $215 | 22% |\n',
    '| Expedia | $34k | 18% | $28k | $192 | 2% |\n',
    '| Agoda | $22k | 15% | $19k | $185 | 1% |\n',
    '| Wholesale | $18k | 25% | $14k | $172 | 0% |\n\n',
    '### Imbalances\n',
    '- Direct only 23% of mix — industry benchmark for SLH is 35%+\n',
    '- Wholesale at 9% with worst margin AND zero repeat\n\n',
    '### Actions\n',
    '1. **Direct push:** revive 15% direct-only code, email past Booking.com guests\n',
    '2. **Wholesale review:** 3 of your 7 wholesale partners under-perform — renegotiate or drop\n',
    '3. **Booking.com Genius:** opt-in for compression weekends only\n',
  ],
};

function runStub(agentId: string): string[] {
  return PLACEHOLDER_OUTPUTS[agentId] ?? [
    '## Agent output (placeholder)\n\n',
    'This agent is not yet wired to a real backend.\n\n',
    'When connected to Vertex AI / Anthropic, real output will stream here based on the prompt and inputs you configured.\n\n',
    '**Next step:** wire the model endpoint in `lib/agentRunner.ts`.\n',
  ];
}

export default function AgentRunner({ agent }: { agent: AgentDefinition }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const inp of agent.inputs) {
      init[inp.key] = String(inp.default ?? '');
    }
    return init;
  });
  const [run, setRun] = useState<RunState>({ status: 'idle', output: '' });
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [run.output]);

  function setVal(key: string, v: string) {
    setValues(prev => ({ ...prev, [key]: v }));
  }

  async function handleFire() {
    const start = Date.now();
    setRun({ status: 'running', output: '', startedAt: start });

    const chunks = runStub(agent.id);
    let acc = '';
    for (let i = 0; i < chunks.length; i++) {
      await new Promise(r => setTimeout(r, 180 + Math.random() * 220));
      acc += chunks[i];
      setRun(s => ({ ...s, output: acc }));
    }

    setRun(s => ({ ...s, status: 'complete', durationMs: Date.now() - start }));
  }

  function handleReset() {
    setRun({ status: 'idle', output: '' });
  }

  return (
    <div className="agent-run-grid">
      {/* LEFT: input form */}
      <div className="agent-run-form">
        <div className="agent-form-section">
          <div className="agent-form-section-title">Inputs</div>

          {agent.inputs.length === 0 && (
            <div className="muted" style={{ fontSize: 12 }}>This agent takes no parameters.</div>
          )}

          {agent.inputs.map(inp => (
            <InputField key={inp.key} input={inp} value={values[inp.key]} onChange={v => setVal(inp.key, v)} />
          ))}
        </div>

        <div className="agent-form-section">
          <div className="agent-form-section-title">Model & Routing</div>
          <div className="agent-meta-row">
            <span className="agent-meta-label">Model</span>
            <span className="agent-meta-val mono">{agent.model}</span>
          </div>
          <div className="agent-meta-row">
            <span className="agent-meta-label">Trigger</span>
            <span className="agent-meta-val">{agent.trigger}{agent.schedule ? ` · ${agent.schedule}` : ''}</span>
          </div>
          <div className="agent-meta-row">
            <span className="agent-meta-label">Status</span>
            <span className="agent-meta-val">
              <span className={`badge agent-status-${agent.status}`}>{agent.status}</span>
            </span>
          </div>
        </div>

        <div className="agent-fire-row">
          <button
            className="agent-btn agent-btn-fire"
            onClick={handleFire}
            disabled={run.status === 'running'}
          >
            {run.status === 'running' ? 'Running…' : 'Fire ▶'}
          </button>
          {run.status !== 'idle' && run.status !== 'running' && (
            <button className="agent-btn" onClick={handleReset}>Clear</button>
          )}
        </div>

        {run.status === 'running' && (
          <div className="agent-run-status muted">
            Running on {agent.model}…
          </div>
        )}
        {run.status === 'complete' && run.durationMs && (
          <div className="agent-run-status good">
            Complete · {(run.durationMs / 1000).toFixed(1)}s
          </div>
        )}
      </div>

      {/* RIGHT: output */}
      <div className="agent-run-output-wrap">
        <div className="agent-output-head">
          <div className="agent-output-title">Output</div>
          <div className="agent-output-actions">
            {run.status === 'complete' && (
              <>
                <button className="agent-btn-mini">Save</button>
                <button className="agent-btn-mini">Copy</button>
                <button className="agent-btn-mini">Export</button>
              </>
            )}
          </div>
        </div>
        <div ref={outputRef} className="agent-output-body">
          {run.status === 'idle' && (
            <div className="agent-output-empty">
              <div className="agent-output-empty-icon">▷</div>
              <div className="agent-output-empty-text">
                Configure inputs and fire the agent.<br />
                Output will stream here.
              </div>
            </div>
          )}
          {run.output && (
            <pre className="agent-output-text">{run.output}{run.status === 'running' && <span className="cursor">▌</span>}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

function InputField({ input, value, onChange }: { input: AgentInput; value: string; onChange: (v: string) => void }) {
  const id = `inp-${input.key}`;
  return (
    <div className="agent-field">
      <label htmlFor={id} className="agent-field-label">
        {input.label}
        {input.required && <span className="agent-field-req"> *</span>}
      </label>

      {input.type === 'textarea' ? (
        <textarea
          id={id}
          className="agent-field-textarea"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={input.hint}
          rows={4}
        />
      ) : input.type === 'select' ? (
        <select id={id} className="period-select" value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%' }}>
          {input.options?.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={input.type === 'number' ? 'number' : input.type === 'date' ? 'date' : 'text'}
          className="agent-field-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={input.hint}
        />
      )}

      {input.hint && input.type !== 'textarea' && (
        <div className="agent-field-hint">{input.hint}</div>
      )}
    </div>
  );
}
