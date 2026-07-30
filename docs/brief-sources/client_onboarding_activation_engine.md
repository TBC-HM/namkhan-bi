# Client Onboarding & Activation Engine

## 1. Purpose

The Client Onboarding & Activation Engine converts a signed customer into a secure, configured, billable, and actively used tenant inside a multi-tenant AI platform running on Supabase and Vercel.

It manages the full transition from commercial agreement to live operation while preserving:

- Tenant isolation
- Contractual entitlements
- Cost and revenue attribution
- Data security
- Auditability
- Implementation accountability
- Measurable time-to-value
- Repeatable onboarding quality

The engine must support self-service, assisted, enterprise, partner-led, white-label, and custom implementation models.

---

## 2. Core Outcome

A customer is not onboarded because an account exists.

A customer is onboarded only when:

```text
Contract accepted
→ Tenant created
→ Users invited
→ Security configured
→ Entitlements applied
→ Data connected
→ Required modules configured
→ Initial use case completed
→ Acceptance recorded
→ Billing activated
→ Customer health monitoring started
```

The primary objective is:

```text
Shortest reliable path from signed agreement to measurable customer value
```

---

## 3. Platform Position

```text
CRM / Sales
    ↓
Commercial Contract
    ↓
Client Onboarding & Activation Engine
    ↓
Tenant Provisioning
    ↓
Data & Integration Setup
    ↓
Module Configuration
    ↓
Training & Adoption
    ↓
Acceptance & Go-Live
    ↓
Billing / Revenue Engine
    ↓
Customer Success & Expansion
```

The onboarding engine is a shared platform service.

It is not owned by one individual business module.

---

## 4. Supported Onboarding Models

### 4.1 Self-Service

Suitable for:

- Free plans
- Trials
- Low-complexity subscriptions
- Individual users
- Small teams

Characteristics:

- Automated tenant creation
- Guided setup wizard
- Standard module presets
- No manual implementation project
- Automated activation criteria
- Automated billing conversion

### 4.2 Assisted Onboarding

Suitable for:

- Professional plans
- Multi-user teams
- Moderate data migration
- Several modules
- Standard integrations

Characteristics:

- Implementation owner assigned
- Structured kickoff
- Connection checklist
- Configuration review
- Live training
- Formal go-live

### 4.3 Enterprise Onboarding

Suitable for:

- Complex groups
- Multiple business units
- Multiple properties
- SSO
- Security review
- Custom integrations
- Negotiated SLAs
- Sensitive environments

Characteristics:

- Implementation project
- Milestones and dependencies
- Security and legal workstream
- Sandbox or staging tenant
- Data validation
- Acceptance testing
- Formal sign-off
- Executive governance

### 4.4 Partner-Led Onboarding

Suitable for:

- Resellers
- Implementation partners
- Consultants
- Regional operators
- Franchise or group rollouts

Characteristics:

- Partner portal
- Delegated setup rights
- Certified onboarding playbooks
- Partner margin attribution
- Quality controls
- Customer acceptance visible to the platform operator

### 4.5 White-Label / OEM Onboarding

Suitable for:

- Embedded platforms
- Branded partner instances
- Reseller environments
- Enterprise distribution agreements

Characteristics:

- Custom branding
- Domain configuration
- Customer hierarchy
- Delegated administration
- Contractual feature restrictions
- Revenue-share and support responsibility mapping

---

## 5. Onboarding Lifecycle

### Stage 1 — Commercial Handoff

The engine receives:

- Customer identity
- Legal entity
- Contract reference
- Selected plan
- Modules
- Packages
- Seats
- Usage limits
- Pricing
- Discounts
- Implementation scope
- Support tier
- Renewal date
- Billing terms
- Data residency requirements
- Custom commitments
- Expected go-live date

The onboarding record must reference the commercial source of truth.

No onboarding configuration should silently contradict the signed contract.

### Stage 2 — Qualification and Complexity Scoring

The engine calculates onboarding complexity based on:

- Number of users
- Number of tenants or properties
- Number of modules
- Number of integrations
- Migration volume
- Custom workflow requirements
- Security requirements
- SSO
- Data quality
- Localization
- Training needs
- Implementation deadline
- Customer maturity

Example:

```text
Low complexity
→ Self-service workflow

Medium complexity
→ Assisted implementation

High complexity
→ Enterprise implementation project
```

### Stage 3 — Tenant Provisioning

The engine creates:

- Tenant record
- Tenant identifier
- Workspace structure
- Default roles
- Tenant administrator
- Environment configuration
- Region or data residency settings
- Feature flags
- Limits
- Billing customer reference
- Default cost center
- Audit context

Tenant provisioning must be idempotent.

A repeated provisioning request must not create duplicate tenants.

### Stage 4 — Identity and Access

The engine manages:

- Administrator invitation
- User invitations
- Role assignment
- Permission groups
- SSO configuration
- MFA requirements
- Domain verification
- Service accounts
- Partner access
- Temporary implementation access
- Access expiry

Suggested role hierarchy:

```text
Platform Operator
Tenant Owner
Tenant Administrator
Department Manager
Analyst
Contributor
Viewer
External Partner
Implementation Partner
Auditor
```

### Stage 5 — Entitlements and Commercial Configuration

The engine applies:

- Plan
- Modules
- Packages
- Add-ons
- Seats
- Usage allowances
- Free credits
- Trial period
- Model access
- Storage allowance
- Task limits
- Automation limits
- Support tier
- SLA
- Overage rules
- Custom contract exceptions

Entitlements must be versioned and effective dated.

### Stage 6 — Data and Integration Setup

The engine guides connection of:

- Supabase data sources
- PMS
- POS
- CRM
- Accounting systems
- Payment providers
- Google Drive
- Google Sheets
- Email
- Calendar
- Analytics
- APIs
- Webhooks
- File uploads
- SFTP
- Data warehouse
- Custom databases

Every integration must record:

- Owner
- Authentication method
- Credential location
- Scope
- Last sync
- Sync status
- Data freshness
- Validation status
- Failure state
- Retry status

### Stage 7 — Data Mapping and Validation

The engine maps customer data to platform entities.

Example:

```text
Customer property
→ Platform property

Customer room type
→ Platform room type

Customer market segment
→ Normalized segment

Customer revenue account
→ Platform revenue category

Customer user
→ Tenant role
```

Validation checks should include:

- Required fields
- Duplicates
- Invalid values
- Missing history
- Date continuity
- Currency consistency
- Timezone consistency
- Unsupported categories
- Orphan records
- Privacy restrictions

No module should be activated on unreliable data without a visible warning.

### Stage 8 — Module Configuration

Each selected module receives a module-specific onboarding checklist.

#### Forecasting Module

- Historical data connected
- Forecast horizon selected
- Baseline assumptions approved
- Market segments mapped
- Rate corridors configured
- Scenario rules approved

#### Content Engine

- Brand documents loaded
- Tone of voice approved
- Media library connected
- Channels selected
- Approval workflow configured

#### Cost Engine

- Cost centers configured
- Providers connected
- Price books loaded
- Allocation rules approved
- Budget thresholds configured

#### Revenue Engine

- Plans and contracts loaded
- Billing provider connected
- Usage meters configured
- Margin floors set
- Revenue recognition rules selected

### Stage 9 — Initial Use-Case Activation

The engine should require the customer to complete one meaningful use case.

Examples:

- Generate first forecast
- Publish first report
- Complete first cost allocation
- Create first campaign
- Generate first spreadsheet
- Invite first team
- Connect first live system

This is the activation event.

Account creation alone is not activation.

### Stage 10 — Training and Enablement

Training should be role-based.

```text
Tenant Owner
→ Governance, billing, security, adoption

Administrator
→ Users, roles, configuration, integrations

Manager
→ Dashboards, approvals, workflows

Analyst
→ Modules, reports, exports, AI prompts

Viewer
→ Navigation, reports, alerts
```

Training assets can include:

- Guided walkthroughs
- Checklists
- Short videos
- Live sessions
- Sample data
- Sandbox exercises
- Certification tests
- Operating manuals
- Contextual help

### Stage 11 — Acceptance Testing

Acceptance should verify:

- Tenant security
- User access
- Entitlements
- Integrations
- Data accuracy
- Module outputs
- Alerts
- Billing setup
- Custom requirements
- Performance
- Support readiness

Possible statuses:

```text
Not Started
In Progress
Blocked
Ready for Review
Accepted with Exceptions
Accepted
Rejected
```

### Stage 12 — Go-Live

Go-live requires:

- Required checklist complete
- Critical issues closed
- Acceptance recorded
- Production environment active
- Billing start confirmed
- Support owner assigned
- Health monitoring enabled
- Customer success plan created

### Stage 13 — Hypercare

For a defined period after go-live:

- Monitor integrations
- Monitor failed tasks
- Monitor AI usage
- Monitor customer activity
- Track support tickets
- Track unresolved data issues
- Track cost anomalies
- Track adoption
- Track customer satisfaction

### Stage 14 — Transition to Customer Success

The onboarding engine transfers ownership with:

- Configuration summary
- Open issues
- Agreed objectives
- Adoption baseline
- Cost baseline
- Revenue profile
- Renewal date
- Expansion opportunities
- Risk score
- Executive sponsor
- Success plan

---

## 6. Core Components

### Intake Engine

Collects:

- Commercial data
- Customer information
- Onboarding scope
- Technical requirements
- Security requirements
- Integration requirements
- Project dates
- Success criteria

### Onboarding Plan Generator

Creates:

- Phases
- Tasks
- Owners
- Dependencies
- Deadlines
- Approval gates
- Risk controls

### Tenant Provisioning Service

Responsibilities:

- Idempotent provisioning
- Environment settings
- Feature flags
- Entitlements
- Default roles
- Audit context

### Integration Orchestrator

Coordinates:

- Connectors
- Credentials
- Syncs
- Mapping
- Validation

### Checklist and Workflow Engine

Supports:

- Reusable templates
- Conditional tasks
- Dependencies
- Mandatory and optional steps
- Escalations
- Approvals
- Evidence attachments
- Due dates
- SLA timers

### Activation Engine

Determines whether the customer has reached meaningful value.

Activation rules should differ by product.

### Training Engine

Assigns learning paths by role, product, and onboarding model.

### Acceptance Engine

Stores:

- Tests
- Results
- Exceptions
- Sign-off
- Approver
- Date
- Evidence

### Customer Health Engine

Begins monitoring after provisioning and continues through customer success.

### Onboarding Agent

The onboarding agent should:

- Explain next steps
- Detect blockers
- Request missing information
- Summarize progress
- Prepare meetings
- Generate configuration suggestions
- Create task lists
- Produce customer-facing updates
- Escalate risks

It should not independently override:

- Contract terms
- Security policy
- Billing rules
- Legal requirements
- Approved entitlements

---

## 7. Agent and Loop Design

### Daily Onboarding Control Loop

```text
Review all active onboardings
→ Detect overdue tasks
→ Detect blocked dependencies
→ Detect missing customer inputs
→ Detect failed integrations
→ Calculate completion percentage
→ Generate actions
→ Notify responsible owner
```

### Customer Reminder Loop

Runs only when:

- Customer-owned task is overdue
- Required input is missing
- Training is incomplete
- Approval is pending
- Connection has failed

### Integration Health Loop

```text
Check sync status
→ Compare expected freshness
→ Retry safe failures
→ Classify root cause
→ Escalate unresolved failures
```

### Activation Loop

```text
Observe customer behavior
→ Compare with activation criteria
→ Recommend next best action
→ Mark activated when criteria are met
```

### Cost and Scope Control Loop

Connects to the Cost Engine.

Tracks:

- Implementation hours
- AI usage
- Infrastructure cost
- Partner cost
- Customer-request work
- Change requests
- Budget consumption
- Margin against implementation fee

### Revenue Activation Loop

Connects to the Revenue Engine.

Verifies:

- Billing customer exists
- Contract items are active
- Free or trial terms are correct
- Billing start date is correct
- Implementation fee is invoiced
- Recurring revenue begins
- Usage meters are active

---

## 8. Onboarding Types and Economics

| Onboarding Type | Commercial Treatment | Cost Treatment |
|---|---|---|
| Free plan | No invoice, shadow revenue | Acquisition cost |
| Free trial | Deferred conversion opportunity | Sales or acquisition cost |
| Self-service paid | Subscription revenue | Standard onboarding cost |
| Assisted onboarding | Subscription plus optional setup fee | Direct implementation cost |
| Enterprise implementation | Subscription plus implementation fee | Project cost |
| Custom development | Professional services or platform investment | Client-specific or platform build |
| Partner-led | Revenue share or partner fee | Partner delivery cost |
| White-label | License plus setup plus support | Dedicated implementation cost |

---

## 9. Free Plan Onboarding

Recommended path:

```text
Email verification
→ Tenant creation
→ Use-case selection
→ Limited module activation
→ Sample data or first connection
→ First successful output
→ Upgrade trigger
```

Controls:

- Limited users
- Limited storage
- Limited AI models
- Limited automation
- Capped usage
- No custom integrations
- No premium support
- Inactivity expiry
- Abuse detection
- Upgrade prompts
- Cost ceiling

Measure:

- Signup-to-activation rate
- Activation-to-paid conversion
- Cost per activated free tenant
- Cost per converted tenant
- Time to first value
- Free-plan support cost
- Free-plan AI consumption

---

## 10. Enterprise Governance Gates

### Gate 1 — Commercial Readiness

- Contract signed
- Pricing approved
- Scope approved
- Billing terms confirmed

### Gate 2 — Security Readiness

- DPA completed
- SSO agreed
- Access model approved
- Data residency confirmed
- Security questionnaire complete

### Gate 3 — Technical Readiness

- Integrations available
- Credentials provided
- Data mapping approved
- Environment created

### Gate 4 — Business Readiness

- Module owners appointed
- Training completed
- Workflows approved
- Success criteria agreed

### Gate 5 — Go-Live Readiness

- Acceptance passed
- Billing active
- Critical issues closed
- Support ownership transferred

---

## 11. Data Model

Recommended primary entities:

```text
organizations
tenants
tenant_environments
customer_contracts
onboarding_cases
onboarding_templates
onboarding_phases
onboarding_tasks
onboarding_dependencies
onboarding_checklists
onboarding_evidence
onboarding_risks
onboarding_issues
onboarding_approvals
onboarding_milestones
onboarding_contacts
tenant_users
tenant_roles
tenant_entitlements
tenant_feature_flags
integration_connections
integration_sync_runs
data_mapping_sets
data_validation_results
training_paths
training_assignments
training_completions
acceptance_tests
acceptance_results
activation_events
go_live_events
hypercare_cases
customer_health_snapshots
change_requests
implementation_time_entries
implementation_cost_events
billing_activation_events
audit_events
```

---

## 12. Core Supabase Tables

### onboarding_cases

```sql
create table onboarding_cases (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    contract_id uuid,
    onboarding_type text not null,
    complexity_score numeric,
    status text not null default 'not_started',
    implementation_owner_id uuid,
    customer_owner_id uuid,
    planned_start_at timestamptz,
    target_go_live_at timestamptz,
    actual_go_live_at timestamptz,
    activation_at timestamptz,
    billing_start_at timestamptz,
    completion_percent numeric default 0,
    risk_level text default 'low',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
```

### onboarding_tasks

```sql
create table onboarding_tasks (
    id uuid primary key default gen_random_uuid(),
    onboarding_case_id uuid not null references onboarding_cases(id),
    phase_code text not null,
    task_code text not null,
    title text not null,
    owner_type text not null,
    owner_id uuid,
    status text not null default 'not_started',
    required boolean not null default true,
    due_at timestamptz,
    completed_at timestamptz,
    blocked_reason text,
    evidence_required boolean default false,
    created_at timestamptz not null default now()
);
```

### tenant_entitlements

```sql
create table tenant_entitlements (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    product_code text not null,
    entitlement_code text not null,
    quantity numeric,
    effective_from timestamptz not null,
    effective_to timestamptz,
    source_contract_id uuid,
    status text not null default 'active',
    created_at timestamptz not null default now()
);
```

### activation_events

```sql
create table activation_events (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    onboarding_case_id uuid,
    event_type text not null,
    module_code text,
    event_payload jsonb,
    occurred_at timestamptz not null default now()
);
```

---

## 13. Required Dashboards

### Executive Dashboard

- Customers in onboarding
- Average time to go-live
- Average time to activation
- Onboarding completion rate
- Delayed onboardings
- Implementation gross margin
- Free-to-paid conversion
- Churn during onboarding
- Customer satisfaction
- Revenue waiting for activation

### Implementation Dashboard

- Active projects
- Milestone status
- Overdue tasks
- Customer blockers
- Integration failures
- Open risks
- Scope changes
- Owner workload

### Customer Dashboard

- Completed steps
- Remaining steps
- Next actions
- Required approvals
- Training progress
- Target go-live
- Support contact

### Product Dashboard

- Activation by module
- Time to first value
- Onboarding failure points
- Most difficult integrations
- Feature adoption
- Module attachment

### Finance Dashboard

- Implementation fees
- Implementation cost
- Implementation margin
- Unbilled work
- Change requests
- Delayed recurring revenue
- Free-plan acquisition cost

---

## 14. Core KPIs

### Speed

- Time from contract to tenant creation
- Time from tenant creation to first login
- Time to first integration
- Time to first successful task
- Time to activation
- Time to go-live

### Quality

- Acceptance pass rate
- Data validation pass rate
- Integration success rate
- First-time-right configuration rate
- Reopened issue rate

### Economics

- Onboarding cost per tenant
- Onboarding revenue
- Implementation gross margin
- Free onboarding cost
- Cost of custom work
- Revenue delayed by onboarding

### Adoption

- Invited-user activation rate
- Training completion rate
- First-week active usage
- Module adoption
- Automation adoption
- 30-day retention

### Customer Experience

- Onboarding satisfaction
- Customer task delay
- Support volume
- Escalation count
- Expectation mismatch rate

---

## 15. AI Use in Onboarding

AI should assist with:

- Implementation-plan generation
- Checklist generation
- Document extraction
- Data mapping suggestions
- Issue classification
- Customer communication drafts
- Meeting summaries
- Training recommendations
- Risk detection
- Next-best-action recommendations
- Configuration validation
- Knowledge retrieval

AI should not autonomously:

- Accept legal terms
- Approve pricing
- Change contracts
- Grant privileged access
- Approve security exceptions
- Activate billing without controls
- Sign customer acceptance

---

## 16. Recommended MVP

### Phase 1

- Onboarding cases
- Templates
- Phases
- Tasks
- Customer portal
- Tenant provisioning
- User invitations
- Entitlements
- Progress dashboard
- Go-live checklist
- Audit log

### Phase 2

- Integrations
- Data mapping
- Validation
- Training
- Acceptance testing
- Billing activation
- Cost tracking

### Phase 3

- AI onboarding agent
- Dynamic planning
- Activation scoring
- Health scoring
- Partner-led onboarding
- Enterprise gates
- Predictive risk alerts

### Phase 4

- Benchmark-based onboarding optimization
- Automatic next-best actions
- Conversion experiments
- Self-service personalization
- Portfolio-level onboarding intelligence

---

## 17. Success Definition

The engine succeeds when it can answer, at any time:

```text
Who is being onboarded?
What did they buy?
What remains incomplete?
Who owns each action?
What is blocked?
What did onboarding cost?
When does billing start?
Has the customer achieved value?
Is the customer ready for customer success?
```

---

## 18. Final Architecture Principle

The onboarding engine should not be a long form.

It should be an executable lifecycle:

```text
Contract
→ Configuration
→ Provisioning
→ Connection
→ Validation
→ Activation
→ Acceptance
→ Billing
→ Adoption
→ Expansion
```

It is the controlled bridge between sales, product, finance, technology, implementation, customer success, and the customer.
