// app/revenue/agents/page.tsx
// Revenue · Agents — placeholder shell for Deploy 2 (read-only) and P2+ (interactive).
// New tab: 9 detection agents + 6 specialists, 9-layer guardrails, audit log, kill switch.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';

export const dynamic = 'force-dynamic';

export default function AgentsPage() {
  return (
    <>
      <PanelHero
        eyebrow="Agents · guardrails"
        title="Revenue"
        emphasis="agent layer"
        sub="9 detection agents · 6 specialists · 9 guardrail layers · audit log"
        kpis={
          <>
            <KpiCard label="Detection agents" value={9} hint="Tactical, Pace, Parity, …" />
            <KpiCard label="Specialist agents" value={6} hint="Campaign, Email, Social, …" />
            <KpiCard label="Guardrail layers" value={9} hint="rate, blackout, budget, …" />
            <KpiCard label="Operating mode" value="Observe" hint="kill switch armed" />
          </>
        }
      />

      <Card
        title="Detection agents"
        emphasis="9 agents"
        sub="Status · schedule · prompt version · cost / month — read-only in Deploy 2"
      >
        <div className="stub">
          <h3>Coming in Deploy 2 (read-only) · interactive in P2</h3>
          <p>
            Tactical (every 15 min), Pace (every 5 min), Parity (hourly), Plan Cleanup (daily),
            Forecast (paused, needs 90d history), Cancel Risk (every 2h), CompSet Scanner,
            Discovery, Composer. All on claude-sonnet-4-7 · temp 0.2 · structured output schema.
          </p>
          <div className="stub-list">
            9 agent chips · status pills · prompt version table · monthly cost
          </div>
        </div>
      </Card>

      <Card
        title="Guardrails"
        emphasis="9 layers"
        sub="Editable rule controls · audit log · master kill switch · 4-mode operating strip"
      >
        <div className="stub">
          <h3>Coming in Deploy 2 (read-only) · interactive in P2</h3>
          <p>
            Rate limits · blackout dates · budget caps · approval delay · 2-person rule · audit
            log + 90d retention · version history per guardrail · weekly governance email.
          </p>
          <div className="stub-list">
            Layers 1-9 · CSV export · master kill switch · operating modes Observe/Review/Auto
          </div>
        </div>
      </Card>

      <Card
        title="Prompt library"
        emphasis="DB-stored, versioned"
        sub="Edit per-agent prompt · A/B testing · knowledge file refs · never hardcoded"
      >
        <div className="stub">
          <h3>Coming in Deploy 2 (read-only) · interactive in P2</h3>
          <p>
            Per-agent system prompt + user prompt template + JSON output schema + variables +
            knowledge_refs + input_sources + tools_enabled + guardrails. Confidence min 0.6,
            mandate check, max 5 proposals per run, PII redaction.
          </p>
          <div className="stub-list">
            9 agents · version history · last edit · A/B status · in-UI prompt editor
          </div>
        </div>
      </Card>
    </>
  );
}
