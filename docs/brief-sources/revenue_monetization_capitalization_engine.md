# Revenue, Monetization & Capitalization Engine

**Status:** Proposed enterprise architecture  
**Platform:** Multi-tenant Supabase + Vercel + multi-model AI platform  
**Purpose:** Commercial mirror of the Enterprise Cost Governance Engine  
**Scope:** Free plans, subscriptions, memberships, modules, packages, seats, usage billing, credits, markups, minimum commitments, enterprise contracts, services, marketplaces, revenue recognition, unit economics, and platform-building CAPEX governance.

---

## 1. Executive purpose

The Cost Governance Engine establishes what the platform consumes and what each tenant, module, task, model call, infrastructure resource, employee activity, project, and client request costs.

The Revenue, Monetization & Capitalization Engine establishes:

- what the customer is entitled to use;
- how the customer is priced;
- how included allowances and overages work;
- what revenue is contracted, billed, collected, deferred, or recognized;
- what gross margin and contribution margin each tenant, plan, module, package, task, and contract generates;
- how free-plan economics are controlled;
- how platform-development expenditure is separated from operating expense and, where accounting policy permits, evaluated for capitalization;
- how price changes, discounts, credits, commissions, taxes, and contract amendments are governed;
- how the platform can support present and future AI-company business models without rebuilding billing logic.

This engine is not merely invoicing. It is the platform's commercial operating system.

---

## 2. Core accounting and commercial separation

The architecture must keep the following concepts distinct:

1. **Cost event** — economic consumption recorded by the Cost Engine.
2. **Usage event** — measurable customer or platform activity.
3. **Entitlement consumption** — usage measured against a plan allowance or contractual right.
4. **List price** — published or standard price before adjustments.
5. **Contract price** — customer-specific agreed price.
6. **Billable amount** — amount eligible for invoicing after allowances, tiers, credits, discounts, floors, caps, and adjustments.
7. **Invoice amount** — legally billed amount.
8. **Cash collected** — payment received, net of refunds and payment failures.
9. **Recognized revenue** — revenue recognized according to the applicable accounting policy and performance obligation.
10. **Deferred revenue / contract liability** — cash or invoice value not yet recognized.
11. **Gross margin** — recognized revenue less directly attributable service-delivery costs.
12. **Contribution margin** — gross margin less allocated tenant support, success, payment, and other variable commercial costs.
13. **Platform OPEX** — expenditure supporting current operations.
14. **Platform build expense** — development expenditure expensed under accounting policy.
15. **Capitalized development asset** — qualifying expenditure recorded as an asset under an approved policy, with amortization and impairment controls.

No dashboard or API may use the generic word `revenue` without an explicit revenue state.

---

## 3. Supported monetization models

The engine should support composition rather than force every customer into one pricing method.

### 3.1 Free and freemium

- permanent free plan;
- time-limited free trial;
- free usage credits;
- free modules with paid advanced modules;
- free seats with usage limits;
- free community plan restricted by company size or non-commercial use;
- sponsored or partner-funded access;
- invite-only beta access;
- free plan with lower service level, retention, model choice, concurrency, storage, export, and support entitlements.

Free is a commercial product, not a missing price. Every free tenant must have:

- an internal shadow price;
- a cost ceiling;
- allowed models and tools;
- usage limits;
- abuse and automation limits;
- conversion objective;
- cohort and acquisition source;
- upgrade triggers;
- expiry or review logic where applicable.

### 3.2 Subscription and membership

- monthly or annual subscription;
- per-tenant platform fee;
- per-workspace fee;
- per-property or per-location fee;
- named-seat pricing;
- active-seat pricing;
- role-based seat pricing;
- concurrent-user pricing;
- membership with included services, credits, or modules;
- multi-year enterprise commitments;
- minimum annual commitment billed monthly, quarterly, or annually.

### 3.3 Module and feature monetization

- module included in plan;
- module add-on subscription;
- one-time module activation fee;
- per-module seat fee;
- per-module usage price;
- feature flag or premium entitlement;
- bundled module package;
- customer-specific module bundle;
- module trial;
- module maturity pricing, including beta, general availability, and enterprise editions.

### 3.4 Usage-based and outcome-linked pricing

- input tokens;
- output tokens;
- cached tokens;
- model calls;
- agent runs;
- successful task runs;
- workflow steps;
- tool calls;
- documents generated;
- pages processed;
- images, video, audio, or minutes processed;
- database, storage, bandwidth, compute, and search usage;
- records, contacts, properties, rooms, campaigns, or other domain units;
- API calls;
- premium model surcharge;
- real-time or priority-processing surcharge;
- success fee or outcome fee where legally and operationally appropriate.

Usage pricing should support:

- flat per-unit rates;
- graduated tiers;
- volume tiers;
- package allowances;
- prepaid credits;
- drawdown wallets;
- minimum charges;
- maximum caps;
- burst pricing;
- regional pricing;
- customer-specific price books;
- model-specific price books;
- time-of-day or priority classes when justified;
- minimum gross-margin floors.

### 3.5 Hybrid pricing

The expected default for an AI platform is a hybrid contract:

> Base membership or platform fee + included entitlements + metered overage + optional module add-ons + services.

This makes revenue more predictable while preserving a relationship between consumption and economic cost.

### 3.6 Services and implementation

- onboarding fee;
- data migration;
- integration project;
- custom module build;
- special client request;
- consulting;
- training;
- premium support;
- managed service;
- implementation retainers;
- statement-of-work milestones;
- time-and-materials;
- fixed-price deliverables;
- success fees;
- reimbursable expenses.

Special requests must link to the Cost Engine's project and task IDs so the platform can show quoted margin, estimated margin, actual margin, change-order impact, and warranty or rework cost.

### 3.7 Partner, reseller, and marketplace models

- referral commission;
- reseller discount;
- revenue share;
- white-label licensing;
- OEM or embedded platform licensing;
- marketplace seller commission;
- partner-funded credits;
- affiliate payouts;
- co-selling fees;
- customer-of-customer billing;
- platform take rate.

### 3.8 Enterprise commercial terms

- committed spend;
- prepaid annual credits;
- ramp contracts;
- price protection;
- renewal uplifts;
- multi-entity master agreements;
- parent-child tenant billing;
- consolidated invoices;
- purchase orders;
- invoice payment terms;
- service-level credits;
- negotiated caps and floors;
- custom data retention and support tiers;
- private deployment or dedicated environment fees;
- bring-your-own-model or bring-your-own-key pricing;
- pass-through cost, cost-plus, or platform-margin treatment.

---

## 4. Commercial product model

The engine should use composable commercial objects.

```text
Product Catalogue
    ├── Plans
    ├── Modules
    ├── Add-ons
    ├── Usage Meters
    ├── Credit Packs
    ├── Service Products
    └── Enterprise Contract Components

Price Books
    ├── List Prices
    ├── Currency / Region Prices
    ├── Segment Prices
    ├── Partner Prices
    └── Customer Contract Prices

Entitlements
    ├── Access Rights
    ├── Included Quantities
    ├── Model / Tool Access
    ├── Limits and Quotas
    └── Service Levels
```

A **plan** is not a hard-coded application enum. It is a versioned bundle of price components and entitlements.

---

## 5. Core engines

### 5.1 Product Catalogue Engine

Maintains versioned products, modules, packages, add-ons, services, meters, currencies, tax categories, and saleability status.

### 5.2 Pricing and Contract Engine

Resolves the applicable price using:

1. customer contract override;
2. negotiated segment or partner price book;
3. regional or currency price book;
4. standard list price.

It applies:

- recurring charges;
- tiers;
- minimums;
- caps;
- markups;
- discounts;
- credits;
- committed-spend drawdown;
- proration;
- renewals;
- contract amendments;
- rounding rules;
- effective dates.

### 5.3 Entitlement Engine

Determines whether a tenant, user, role, module, API key, or agent may consume a capability and under what limits.

Entitlements must be checked before task execution, not only after billing.

### 5.4 Metering and Rating Engine

- ingests immutable usage events;
- validates tenant and contract attribution;
- deduplicates through idempotency keys;
- converts raw events into billable measures;
- applies price-book versions effective at event time;
- creates rated usage lines;
- preserves full replayability.

### 5.5 Credits and Wallet Engine

Supports:

- promotional credits;
- purchased credits;
- committed-spend balances;
- partner credits;
- service-recovery credits;
- expiration;
- consumption priority;
- non-cash versus cash-backed credits;
- non-refundable balances;
- negative balance policy;
- top-up and auto-recharge.

### 5.6 Billing and Invoice Engine

Generates customer billing lines and synchronizes them to the selected billing provider or ERP.

The internal ledger remains authoritative for:

- commercial calculation;
- audit trail;
- margin analysis;
- dispute reconstruction.

The external billing provider may remain authoritative for payment status, payment method, and legally issued invoice identifiers.

### 5.7 Revenue Recognition Engine

Separates billing from recognition and supports:

- point-in-time services;
- ratable subscription recognition;
- usage-based recognition;
- prepaid credit recognition as consumed;
- multi-element arrangements;
- discounts allocated across components according to policy;
- deferred revenue schedules;
- contract modifications;
- refunds, cancellations, and credit notes.

Accounting treatment must be configured and approved by qualified accountants for the relevant jurisdiction and reporting framework.

### 5.8 Margin and Unit Economics Engine

Combines the Revenue Engine with the Cost Engine to calculate:

- gross margin by tenant;
- margin by plan;
- margin by module;
- margin by task type;
- margin by model and provider;
- margin by client request;
- margin by partner;
- cost to serve;
- customer contribution;
- free-plan burn;
- payback period;
- customer acquisition economics when marketing data is available;
- expansion and contraction effects;
- revenue leakage.

### 5.9 Deal Desk and Approval Engine

Governs non-standard contracts and pricing.

Approval triggers may include:

- discount above threshold;
- margin below threshold;
- unlimited usage;
- custom SLA;
- free period beyond policy;
- non-standard liability or data terms;
- custom development;
- negative cash flow during onboarding;
- price lock exceeding policy;
- reseller or revenue-share agreement;
- customer-specific model cost exposure.

### 5.10 Revenue Assurance Engine

Detects:

- usage not rated;
- rated usage not invoiced;
- active entitlement without active contract;
- invoice line without supporting contract component;
- expired discounts still applied;
- missing renewal uplift;
- incorrect tax or currency;
- contract minimum not reached;
- credits applied incorrectly;
- payment failure;
- margin below floor;
- free-plan abuse;
- orphaned tenants and shadow accounts.

---

## 6. Free-plan architecture

A free plan should be controlled through six independent levers:

1. **Capability** — which modules, models, tools, integrations, exports, and automation features are available.
2. **Quantity** — monthly credits, tasks, records, seats, storage, and concurrency.
3. **Quality** — model tier, latency, priority, context length, and output resolution.
4. **Retention** — history, data, files, logs, and generated artifacts.
5. **Service** — community, standard, premium, or dedicated support.
6. **Commercial rights** — personal, internal business, agency, resale, white-label, or production use.

The free-plan dashboard should report:

- active free tenants;
- cost per active free tenant;
- cost per activated tenant;
- conversion rate;
- 30/60/90-day retention;
- free-to-paid payback;
- abuse rate;
- cost by acquisition channel;
- high-intent accounts;
- free users exceeding shadow-price thresholds;
- paid-feature demand signals.

Free-plan usage should be rated at an internal shadow price even when the invoice amount is zero.

---

## 7. Margin governance

The platform operator must be able to define margin policy at multiple levels:

- enterprise minimum gross margin;
- plan target margin;
- module target margin;
- provider/model surcharge;
- customer-specific margin floor;
- partner and reseller margin;
- special-request margin;
- free-plan cost ceiling;
- implementation margin;
- support margin;
- regional margin.

Recommended price resolution:

```text
Underlying attributable cost
+ required service margin
+ risk premium
+ support / success allocation
+ payment and partner costs
+ strategic adjustment
= floor price

List price
- approved discounts
+ overages / surcharges
- credits
= contract billable price
```

The engine should support both:

- **cost-plus controls**, ensuring economic safety; and
- **value-based pricing**, allowing price above cost where customer value supports it.

Do not expose the internal cost formula or provider prices to customers unless contractually required.

---

## 8. Customer-facing commercial mirror

Each customer should receive a controlled billing and value portal containing:

### Subscription and membership

- current plan;
- renewal date;
- billing frequency;
- included modules;
- seats and roles;
- commitments;
- cancellation and renewal terms.

### Usage and allowances

- usage by meter;
- included allowance;
- consumed allowance;
- remaining balance;
- projected month-end usage;
- overage price;
- spend alerts;
- caps and auto-recharge.

### Modules and packages

- active modules;
- available upgrades;
- package entitlements;
- activation dates;
- module-specific usage;
- module-specific value or output measures where appropriate.

### Invoices and payments

- invoices;
- credit notes;
- payments;
- failed payments;
- taxes;
- billing contacts;
- payment methods;
- purchase orders.

### Transparency without exposing IP

Customers may see:

- units consumed;
- contractual rate;
- allowance and overage calculation;
- invoice reconciliation;
- service availability and performance.

Customers should not see:

- proprietary orchestration logic;
- internal prompt architecture;
- provider-specific confidential pricing;
- internal allocation policy;
- other tenants' benchmarks;
- platform development costs;
- hidden risk or strategic pricing coefficients.

---

## 9. Platform-building CAPEX and product investment

### 9.1 Management view

Independently of statutory accounting, the platform should maintain an internal product-investment ledger separating:

- research and exploration;
- platform architecture;
- reusable core development;
- module development;
- customer-specific implementation;
- maintenance and bug fixes;
- infrastructure operations;
- security and compliance;
- technical debt reduction;
- documentation and testing;
- data acquisition and model evaluation.

### 9.2 Accounting view

The system should allow each development cost event to be classified as:

- operating expense;
- capitalizable candidate;
- capitalized asset;
- customer-recoverable implementation cost;
- reimbursable expense;
- work in progress;
- rejected capitalization candidate.

Capitalization must require an approved accounting policy, evidence, project phase, responsible owner, technical feasibility assessment, intended use, expected future benefit, reliable measurement, and approval.

### 9.3 Capital asset subledger

For approved capitalized platform development, store:

- asset or component ID;
- product/module/project;
- capitalization start date;
- in-service date;
- accumulated qualifying cost;
- useful life;
- amortization method;
- residual value if any;
- accumulated amortization;
- impairment indicators and tests;
- retirement or replacement date;
- linkage to source labor, contractor, AI, infrastructure, and other cost events;
- release and version supported by the asset.

### 9.4 Economic recovery view

The management engine should calculate:

- total invested build cost by platform and module;
- recurring revenue attributable to the module;
- module gross profit;
- contribution after support;
- cumulative recovery of build investment;
- months to recovery;
- return on invested product development;
- replacement and maintenance burden;
- customer concentration supporting the asset;
- stranded or obsolete module investment.

Do not arbitrarily allocate historic platform build CAPEX into customer invoices. Use it to inform target pricing, portfolio return, and investment decisions. Customer prices should follow contract, market, value, and margin policy.

---

## 10. Required data architecture

Core entities:

- `commercial_products`
- `product_versions`
- `plans`
- `plan_versions`
- `packages`
- `package_components`
- `price_books`
- `prices`
- `usage_meters`
- `entitlement_definitions`
- `plan_entitlements`
- `customer_contracts`
- `contract_components`
- `subscriptions`
- `subscription_items`
- `tenant_entitlements`
- `usage_events`
- `rated_usage`
- `credit_wallets`
- `credit_ledger`
- `billing_accounts`
- `billing_runs`
- `invoice_lines`
- `revenue_schedules`
- `revenue_entries`
- `discounts`
- `promotions`
- `deal_approvals`
- `partner_agreements`
- `revenue_shares`
- `capital_projects`
- `capitalization_assessments`
- `capital_assets`
- `capital_asset_cost_links`
- `amortization_entries`
- `commercial_audit_log`

Every commercial object must be tenant-safe, effective-dated, versioned, auditable, and currency-aware.

---

## 11. System workflow

```text
Customer / Sales / Self-Service Action
    ↓
Product and Contract Resolution
    ↓
Entitlement Provisioning
    ↓
Task Execution and Usage Metering
    ↓
Cost Event + Usage Event
    ↓
Rating and Allowance Consumption
    ↓
Credits, Discounts, Floors and Caps
    ↓
Billing Line Generation
    ↓
Invoice / Payment Provider
    ↓
Revenue Recognition Schedule
    ↓
Cost-to-Revenue Matching
    ↓
Margin, Unit Economics and Revenue Assurance
```

---

## 12. Dashboards

### Executive monetization

- ARR / MRR;
- contracted recurring revenue;
- billed revenue;
- recognized revenue;
- collected cash;
- deferred revenue;
- gross margin;
- contribution margin;
- free-plan cost;
- net revenue retention;
- expansion, contraction, churn;
- revenue concentration;
- platform build investment and recovery.

### Customer economics

- revenue, cost, and margin by tenant;
- plan and module mix;
- usage trend;
- support burden;
- special-request profitability;
- payment behavior;
- renewal and expansion risk.

### Product and module economics

- active tenants;
- attach rate;
- recurring revenue;
- usage revenue;
- direct cost;
- gross margin;
- development investment;
- maintenance cost;
- recovery period;
- adoption and retention.

### Free-plan economics

- acquisition cohorts;
- active accounts;
- cost burn;
- conversion;
- abuse;
- projected paid value;
- throttling and upgrade candidates.

### Revenue assurance

- unbilled usage;
- unrated events;
- contract leakage;
- discount leakage;
- missing minimums;
- failed payments;
- entitlement mismatches;
- margin breaches.

---

## 13. Governance and controls

- immutable raw usage events;
- immutable posted revenue entries;
- reversal rather than destructive edits;
- idempotent ingestion and billing runs;
- closed accounting periods;
- effective-dated prices and contracts;
- role-based price and discount approvals;
- RLS on every tenant-bearing table;
- service-role isolation for rating and billing jobs;
- secrets outside application tables;
- audit logs for price, entitlement, contract, and invoice changes;
- customer-visible calculation trace without proprietary internals;
- automated reconciliation between usage, rated usage, invoice, payment, and revenue ledgers;
- dual approval for large credits, write-offs, and non-standard contracts.

---

## 14. Recommended service boundaries

- **Catalogue Service** — product and package definitions.
- **Entitlement Service** — runtime capability decisions.
- **Metering Service** — raw usage events.
- **Rating Service** — price calculation.
- **Credit Service** — allowances and wallets.
- **Contract Service** — negotiated commercial terms.
- **Billing Adapter** — Stripe or alternative invoicing/payment platform.
- **Revenue Ledger** — accounting-state record.
- **Margin Service** — joins revenue with cost.
- **Deal Desk Service** — approvals and commercial exceptions.
- **Capital Investment Service** — development investment and asset subledger.
- **Revenue Assurance Loop** — daily reconciliation and leakage detection.

---

## 15. Implementation phases

### Phase 1 — Commercial foundation

- catalogue;
- plans and plan versions;
- modules and packages;
- subscriptions;
- entitlements;
- recurring prices;
- free plan;
- basic usage meters;
- customer billing portal;
- cost-to-tenant margin.

### Phase 2 — Hybrid and enterprise billing

- credits;
- usage rating;
- tiers;
- minimum commitments;
- annual prepay;
- customer price books;
- contract amendments;
- Stripe synchronization;
- invoice reconciliation;
- deal approvals.

### Phase 3 — Revenue accounting and assurance

- deferred revenue;
- recognition schedules;
- contract liabilities;
- revenue assurance;
- period close;
- audit exports;
- multi-currency controls.

### Phase 4 — Product investment and advanced economics

- capital project ledger;
- capitalization workflow;
- asset subledger;
- amortization;
- module investment recovery;
- portfolio pricing optimization;
- churn, expansion, and customer lifetime economics.

---

## 16. Agent evaluation mandate

The development agent should evaluate the current platform and produce a reasoned gap analysis rather than overwrite the standing architecture.

It should determine:

1. Which cost-engine entities can be reused directly.
2. Which current subscription or tenant tables are authoritative.
3. Whether Stripe, another billing platform, or an internal invoice system is already integrated.
4. How tasks, modules, packages, tenants, users, and client requests are currently identified.
5. Whether usage events are sufficiently immutable and granular for billing.
6. How entitlements are currently enforced.
7. Whether plan and module definitions are versioned.
8. Whether prices are embedded in application logic and must be externalized.
9. Whether the free plan can be constrained without code deployment.
10. Whether customer-specific contracts can override list prices safely.
11. How revenue states are currently represented.
12. How customer invoices, payments, taxes, credits, and refunds are synchronized.
13. Whether gross margin can be reconciled from revenue lines to cost events.
14. How development work is classified between operations, product build, and client-specific work.
15. What accounting-policy decisions are still required before implementing revenue recognition or capitalization.

The agent should then produce:

- current-state architecture;
- gap register;
- target architecture;
- migration plan;
- database migration sequence;
- API contracts;
- RLS and permission plan;
- testing and reconciliation plan;
- backward-compatibility plan;
- phased delivery backlog.

---

## 17. External reference patterns

The architecture reflects current commercial patterns in modern cloud and AI platforms: free and paid tiers, recurring platform fees, included credits, on-demand usage, seat charges, metered subscriptions, trials, commitments, and spend controls. Official implementation references should be rechecked before build because provider features and prices change.

- Stripe Billing documentation: https://docs.stripe.com/billing
- Stripe usage-based billing: https://docs.stripe.com/billing/subscriptions/usage-based
- Stripe entitlements: https://docs.stripe.com/billing/entitlements
- OpenAI API pricing: https://openai.com/api/pricing/
- Vercel pricing documentation: https://vercel.com/docs/pricing
- Vercel spend management: https://vercel.com/docs/spend-management

---

## 18. Final architecture principle

> The Cost Engine explains what the platform consumed. The Revenue Engine explains what the customer bought, used, owed, paid, and economically contributed. The Capital Investment layer explains what the operator invested to create reusable future capability.

All three ledgers must reconcile, but none should be merged or substituted for another.
