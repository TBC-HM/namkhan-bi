// app/finance/agents/page.tsx
// Finance · Agents — pillar agent governance hub.

import AgentsHub from '@/components/agents/AgentsHub';
import type { AgentChipDef } from '@/components/ops/AgentStrip';

const varianceHunter: AgentChipDef = {
  name: 'Variance Hunter',
  cadence: 'daily 03:00',
  status: 'idle',
  description: 'Decomposes USALI department variances vs. budget + LY into volume / rate / mix drivers; flags lines > 5% off plan.',
  guardrails: ['Read-only', 'Confidence floor 80%', 'Min impact $500'],
};

const cashflowForecaster: AgentChipDef = {
  name: 'Cashflow Forecaster',
  cadence: 'daily 06:00',
  status: 'idle',
  description: '13-week rolling cashflow projection from OTB pace, AR aging, AP schedule, and seasonal patterns; flags liquidity gaps.',
  guardrails: ['Recommend only · no payment scheduling', 'Confidence interval published'],
};

const arAgingChaser: AgentChipDef = {
  name: 'AR Aging Chaser',
  cadence: 'weekly · Tue 09:00',
  status: 'idle',
  description: 'Drafts dunning emails for AR > 30/60/90d; routes by customer tier; escalates to credit hold + GM at 90d.',
  guardrails: ['Approval-required send', 'No credit-hold without GM', 'No legal language without finance lead'],
};

const apDuplicateDetector: AgentChipDef = {
  name: 'AP Duplicate Detector',
  cadence: 'on invoice ingest',
  status: 'idle',
  description: 'Cross-references new vendor invoices against PO + prior payments by amount + date + reference; blocks duplicates.',
  guardrails: ['Block + alert · no auto-pay', '3-way match enforced'],
};

const budgetPaceAgent: AgentChipDef = {
  name: 'Budget Pace',
  cadence: 'daily',
  status: 'idle',
  description: 'Tracks revenue, COGS, payroll, and variable costs vs. month-pace; projects EOM landing with confidence band.',
  guardrails: ['Recommend only', 'Pace model retrained monthly'],
};

const fxExposureAgent: AgentChipDef = {
  name: 'FX Exposure',
  cadence: 'daily 02:00',
  status: 'idle',
  description: 'Tracks USD/LAK/THB/EUR exposure across receivables, payables, and forward bookings; flags unhedged positions > $50k.',
  guardrails: ['Recommend only · no auto-hedge', 'Owner approval required for any FX action'],
};

const expenseAnomaly: AgentChipDef = {
  name: 'Expense Anomaly',
  cadence: 'daily',
  status: 'idle',
  description: 'Detects outlier expense lines (vendor / category / amount / per-occupied-room) vs. 90d trailing baseline.',
  guardrails: ['Confidence floor 75%', 'Min variance $300', 'Alert only · no journal mutation'],
};

const monthEndCloseRunner: AgentChipDef = {
  name: 'Month-End Close Runner',
  cadence: 'monthly · WD-3 to WD+2',
  status: 'idle',
  description: 'Sequences close tasks (accruals · prepaid · depreciation · revenue rec · variance commentary), tracks owner + status, flags overdue.',
  guardrails: ['No journal posting · GL-read only', 'Owner check-in mandatory'],
};

export const dynamic = 'force-dynamic';

export default function FinanceAgentsPage() {
  return (
    <AgentsHub
      pillarKey="finance"
      pillarLabel="Finance"
      intro="USALI ledger agents across variance, cashflow, AR/AP, FX, anomaly detection, and close. Idle until finance.* schemas + GL connector ship."
      agents={[
        varianceHunter,
        cashflowForecaster,
        arAgingChaser,
        apDuplicateDetector,
        budgetPaceAgent,
        fxExposureAgent,
        expenseAnomaly,
        monthEndCloseRunner,
      ]}
      brandRules={[
        'No journal entry posting · all agents are GL-read only',
        'No payment scheduling · cashflow recommendations only',
        'No FX hedge execution · owner-approved only',
        'Two-person rule on AR write-offs > $1,000',
      ]}
    />
  );
}
