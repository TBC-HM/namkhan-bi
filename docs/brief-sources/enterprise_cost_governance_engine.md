# Enterprise Cost Governance Engine

**Module ID:** `cost-governance-engine`  
**Status:** Proposed architecture for evaluation and implementation  
**Platform:** Multi-tenant Supabase + Vercel + multi-model AI application  
**Primary users:** Owners, finance, product, engineering, operations, client administrators, auditors and tenant stakeholders

## 1. Executive purpose

The Cost Governance Engine provides a complete, auditable view of what the platform costs to build, operate and use. It captures cost from the individual AI call or background task through to tenant, client, module, project, environment and consolidated enterprise reporting.

The engine must distinguish at least four economically different cost classes:

1. **Platform operating cost** — infrastructure, shared software, AI usage, support and recurring platform operations.
2. **Platform development cost** — product engineering, architecture, module development, testing and technical debt.
3. **Tenant operating cost** — recurring costs generated while serving a specific tenant or property.
4. **Special client-request cost** — custom work, exceptional reports, bespoke integrations, client-specific workflows and billable change requests.

The objective is not merely cost reporting. The engine must support cost allocation, budgeting, anomaly detection, chargeback, pricing, margin analysis, governance and defensible audit trails.

## 2. Core design principles

- Every material cost must have an immutable source event.
- Raw cost events are never overwritten; corrections are additive adjustments.
- Costs are classified independently from how they are billed.
- Shared costs are allocated through versioned policies, never hidden formulas.
- AI costs are calculated from provider usage records and recorded price versions.
- Every output must drill down to the underlying task, run, usage event or supplier charge.
- Tenant isolation must be enforced with Supabase Row Level Security.
- Financial reporting must remain reproducible for a closed period.
- Estimates and actual costs must be visibly separated.
- Currency, tax, credits, discounts and provider rebates must be stored explicitly.
- The cost engine is the source of truth for cost, but not necessarily for general ledger accounting.

## 3. Scope

### Included

- AI model usage by provider, model, task and tenant
- Token, image, audio, tool and storage consumption
- Supabase, Vercel and other infrastructure expenses
- Third-party SaaS subscriptions
- Human work estimates and approved time records
- Development projects and capitalizable build work
- Operational tasks and scheduled loops
- Client-specific requests and change orders
- Shared-cost allocation
- Budgets, forecasts and variance
- Internal chargeback and external billable amounts
- Unit economics and tenant profitability
- Cost anomalies, budget thresholds and approval workflows
- Data lineage, audit history and period close

### Excluded unless explicitly integrated

- Payroll processing
- Statutory tax calculation
- Revenue recognition
- Full accounts payable workflow
- Final general-ledger posting

## 4. Cost taxonomy

Every cost event receives a structured classification.

### Cost nature

- `ai_inference`
- `cloud_compute`
- `database`
- `storage`
- `bandwidth`
- `third_party_api`
- `software_subscription`
- `human_labor`
- `contractor`
- `support`
- `implementation`
- `professional_services`
- `other`

### Work class

- `platform_operations`
- `platform_build`
- `tenant_operations`
- `client_special_request`
- `sales_presales`
- `research_experiment`
- `incident_remediation`
- `compliance_security`

### Economic treatment

- `opex`
- `capex_candidate`
- `pass_through`
- `billable_service`
- `non_billable_service`
- `shared_overhead`

### Attribution level

- direct to tenant
- direct to client request
- direct to module
- direct to project
- shared by tenant
- shared by usage
- enterprise overhead
- unallocated exception

## 5. Conceptual architecture

```text
Provider invoices / usage APIs / task runtime / time records / manual journals
                                |
                                v
                       Cost Event Ingestion
                                |
                                v
                 Normalization and Price Resolution
                                |
                                v
                    Immutable Cost Event Ledger
                                |
             +------------------+------------------+
             |                  |                  |
             v                  v                  v
       Classification      Allocation Engine   Billing Rules
             |                  |                  |
             +------------------+------------------+
                                |
                                v
                    Cost Facts and Aggregations
                                |
             +------------------+------------------+
             |                  |                  |
             v                  v                  v
        Governance         Unit Economics      Reports / API
```

## 6. Main components

### 6.1 Cost Event Ingestion

Ingests provider usage, cloud invoices, SaaS charges, runtime telemetry, task metadata, approved time records and manual adjustments. Each event requires an idempotency key to prevent duplicates.

### 6.2 Price Book and Rate Resolver

Stores effective-dated provider prices, committed-use discounts, free tiers, negotiated rates, exchange rates and internal labor rates. The price version used must be attached to every calculated cost.

### 6.3 Immutable Cost Ledger

Stores original cost events. Posted events are not edited. Corrections are represented by reversal and replacement events. This enables auditability and reproducibility.

### 6.4 Classification Engine

Uses task metadata, module ownership, project tags, client-request identifiers and controlled rules to classify costs. Low-confidence classifications are routed to an exception queue.

### 6.5 Allocation Engine

Allocates shared cost using effective-dated policies such as:

- direct measured usage
- active tenant count
- task count
- AI token share
- database storage share
- revenue share
- equal allocation
- fixed contractual percentage
- hybrid weighted rule

Allocation policies must be versioned, approved and reproducible.

### 6.6 Budget and Forecast Engine

Supports annual budget, rolling forecast, monthly caps, tenant budgets, project budgets, module budgets and provider commitments. It compares actual, committed and forecast cost.

### 6.7 Chargeback and Billing Engine

Separates economic cost from chargeback or billing. A cost of $10 may be absorbed, passed through at $10, marked up, included in subscription, or billed under a fixed fee. Billing rules require their own versioning and approval.

### 6.8 Cost Observatory

Provides dashboards, drill-down, alerts, margin views, model comparisons, cost-per-task metrics and tenant unit economics.

### 6.9 Governance and Period Close

Freezes approved reporting periods, stores reconciliations, tracks exceptions and preserves the exact allocation and price-book versions used.

## 7. Task and AI run model

Every platform action should create or attach to a `task_run`.

A task run must identify:

- tenant and workspace
- client and property where relevant
- requesting user or system loop
- originating module and feature
- task type and work class
- project, build initiative or client-request identifier
- environment
- parent task and workflow
- start, completion and status
- billable status
- expected cost and actual cost
- output artifact or result reference

Every AI invocation should create an `ai_usage_event` containing:

- provider and model
- request type
- input, cached-input and output units
- images, audio, embeddings or tool units
- request duration
- retry and failure information
- provider request identifier
- price-book version
- calculated provider cost
- task run reference

## 8. Separation of operational, build and special-request costs

### Operational task

A recurring or routine action required to serve the platform or tenant. Examples: scheduled forecast generation, report refresh, monitoring, data sync or normal support.

### Build task

Work that creates or materially improves platform capability. Examples: new module, data model redesign, security architecture, workflow engine or significant integration.

### Special client request

A tenant-specific request outside normal contracted operation. It must carry:

- request owner
- tenant/client
- written scope
- estimate
- approval status
- billable rule
- agreed price or rate card
- change-order history
- delivered artifact
- acceptance status

The classification cannot depend only on a free-text task description. It should use an explicit `work_class` and, for client-specific work, a required `client_request_id`.

## 9. Multi-tenant security

- All tenant-owned rows include `tenant_id`.
- RLS is mandatory on operational and reporting tables.
- Platform administrators receive controlled cross-tenant access.
- Client users may only access approved tenant reports and their own cost details.
- Sensitive supplier pricing and internal labor rates require separate permissions.
- Aggregated benchmarks must suppress tenant-identifiable data.
- Service-role ingestion paths must be isolated and logged.

## 10. State-of-the-art AI cost controls

- Effective-dated provider price books
- Cached-token and batch-price treatment
- Model fallback and retry attribution
- Cost estimates before expensive task execution
- Per-task and per-tenant cost caps
- Budget-aware model routing
- Cost-to-quality comparisons by model
- Failed-run and retry waste analysis
- Agent-loop amplification detection
- Duplicate-task detection
- Tool-call and external API cost capture
- Shadow-cost recording for free credits and trial allowances
- Provider invoice reconciliation
- Carbon or energy proxy fields as optional future extensions

## 11. Dashboards

### Executive Cost Dashboard

- Total actual cost
- Forecast end-of-month cost
- Budget variance
- Cost by work class
- Cost by tenant
- Cost by module
- AI versus infrastructure versus human cost
- unallocated cost percentage
- cost anomalies
- gross margin where revenue is available

### Tenant Unit Economics

- cost per tenant
- cost per active user
- cost per task
- AI cost per successful output
- storage and compute cost
- support and special-request cost
- allocated shared overhead
- contracted revenue
- contribution margin

### Build Portfolio

- spend by initiative
- budget versus actual
- capitalizable candidate spend
- developer/contractor cost
- AI-assisted build cost
- milestone cost
- remaining estimate

### Operational Cost

- scheduled loop cost
- task family cost
- module cost
- provider and model cost
- retry/failure cost
- cost per completed task
- cost trend and anomaly

### Client Requests

- approved estimate
- incurred cost
- billable amount
- margin
- status
- change orders
- unbilled completed work

## 12. Alerts and governance controls

Examples:

- tenant exceeds 80%, 100% or 120% of monthly budget
- task exceeds estimated cost by a configured threshold
- loop cost rises materially versus trailing baseline
- provider price changes without approved price-book update
- unallocated cost exceeds threshold
- client-request work starts without approval
- retry cost or failed-run cost spikes
- build project crosses budget or capitalization threshold
- chargeback differs from approved billing rule
- closed-period source data changes

## 13. Required reports

- Monthly enterprise cost statement
- Tenant cost statement
- Module cost report
- AI provider reconciliation
- Infrastructure reconciliation
- Budget versus actual
- Forecast at completion for build projects
- Special client-request profitability
- Unallocated and exception report
- Cost allocation statement
- Unit economics and margin report
- Period-close certification

## 14. Data model summary

Principal entities:

- tenants and workspaces
- clients and properties
- users and roles
- modules and features
- projects and client requests
- task runs and workflows
- AI usage events
- infrastructure usage events
- supplier invoices and line items
- price books and rates
- cost events
- classification rules
- allocation policies and runs
- allocated cost facts
- budgets and forecasts
- billing rules and chargeback facts
- period closes
- alerts, approvals and audit events

The accompanying SQL file provides a production-oriented baseline schema.

## 15. Recommended API surface

- `POST /cost-events/ingest`
- `POST /task-runs`
- `POST /ai-usage-events`
- `POST /allocation-runs`
- `POST /period-close`
- `GET /costs/summary`
- `GET /costs/drilldown`
- `GET /tenants/{id}/unit-economics`
- `GET /projects/{id}/cost-status`
- `GET /client-requests/{id}/profitability`
- `GET /budgets/variance`
- `GET /reconciliations/provider`

All ingestion endpoints require idempotency and signed service authentication.

## 16. Module documents recommended for implementation

```text
COST_ENGINE_MODULE.md
COST_TAXONOMY.md
TASK_ATTRIBUTION_STANDARD.md
AI_USAGE_ACCOUNTING.md
PRICE_BOOK_STANDARD.md
COST_EVENT_LEDGER.md
CLASSIFICATION_ENGINE.md
ALLOCATION_ENGINE.md
BUDGET_AND_FORECAST.md
CHARGEBACK_AND_BILLING.md
TENANT_UNIT_ECONOMICS.md
CLIENT_REQUEST_COSTING.md
BUILD_COST_GOVERNANCE.md
COST_ANOMALY_DETECTION.md
PERIOD_CLOSE_AND_RECONCILIATION.md
ACCESS_CONTROL_AND_RLS.md
DASHBOARD_AND_REPORTING_STANDARD.md
API_AND_EVENT_CONTRACTS.md
AUDIT_AND_PROVENANCE.md
COST_ENGINE_EVALUATION.md
CHANGELOG.md
```

## 17. Evaluation instructions for the development agent

The agent should compare the standing architecture with this specification rather than overwrite it blindly.

It must:

1. Map existing tables, events, tasks, tenant identifiers and billing structures to the proposed model.
2. Identify reusable components and avoid duplicate ledgers.
3. Test whether current task metadata can reliably distinguish operations, build and special client requests.
4. Verify whether AI usage is captured at provider-request level.
5. Verify historical reproducibility of provider pricing.
6. Review RLS and cross-tenant administration.
7. Identify missing audit and period-close controls.
8. Propose a migration plan with backward compatibility.
9. Separate mandatory foundation work from optional advanced analytics.
10. Produce acceptance tests and reconciliation examples before implementation.

## 18. Minimum viable release

### Phase 1 — Trusted ledger

- task-run identity
- AI usage ingestion
- infrastructure and manual cost ingestion
- price-book resolution
- immutable cost event ledger
- tenant/module/project attribution
- basic dashboard
- RLS and audit log

### Phase 2 — Governance

- allocations
- budgets and thresholds
- client-request costing
- build portfolio
- provider reconciliation
- period close

### Phase 3 — Optimization

- model cost-to-quality analysis
- predictive cost forecast
- anomaly detection
- automated chargeback
- margin and pricing recommendations
- multi-currency consolidation

## 19. Acceptance criteria

The module is not complete until:

- every displayed amount drills to source events
- every source event has an idempotency key
- every calculated AI cost records a price version
- every shared allocation records a policy version
- tenant data is isolated through tested RLS
- closed-period reports can be reproduced
- operational, build and special-request costs are separately reportable
- budget and chargeback logic are independent
- provider invoices reconcile to ledger within defined tolerance
- unallocated cost is visible and governed
- corrections preserve history

## 20. Architectural decision

The Cost Governance Engine should be implemented as a shared platform service consumed by every module and workflow. Individual modules may display cost, but they should not maintain independent cost calculations or shadow ledgers.
