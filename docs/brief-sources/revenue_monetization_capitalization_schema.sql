-- Revenue, Monetization & Capitalization Engine
-- Supabase/PostgreSQL baseline schema
-- Review with accounting, tax, legal and security advisers before production use.

create extension if not exists pgcrypto;

create type public.product_kind as enum ('plan','module','package','addon','service','credit_pack','usage_product','implementation','support');
create type public.charge_type as enum ('recurring','one_time','metered','minimum_commitment','credit','service','revenue_share');
create type public.billing_interval as enum ('day','week','month','quarter','year','contract','none');
create type public.price_model as enum ('flat','per_unit','graduated','volume','stairstep','package','cost_plus','custom');
create type public.contract_status as enum ('draft','pending_approval','active','suspended','expired','terminated');
create type public.subscription_status as enum ('trialing','active','past_due','paused','cancelled','expired');
create type public.usage_status as enum ('received','validated','rated','rejected','reversed');
create type public.invoice_line_status as enum ('draft','approved','exported','invoiced','credited','void');
create type public.revenue_state as enum ('unbilled','billed','deferred','recognized','reversed','written_off');
create type public.credit_kind as enum ('purchased','promotional','committed_spend','service_recovery','partner_funded','manual');
create type public.capital_status as enum ('proposed','assessment','approved','rejected','work_in_progress','in_service','impaired','retired');

create table public.commercial_products (
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique,
  name text not null,
  description text,
  product_kind public.product_kind not null,
  owner_module_id uuid,
  tax_code text,
  saleable boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table public.product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commercial_products(id),
  version text not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  configuration jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  approved_by uuid,
  approved_at timestamptz,
  unique(product_id, version)
);

create table public.usage_meters (
  id uuid primary key default gen_random_uuid(),
  meter_code text not null unique,
  name text not null,
  unit text not null,
  aggregation_method text not null check (aggregation_method in ('sum','count','max','last','unique')),
  event_name text not null,
  billable_success_only boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.price_books (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  currency char(3) not null default 'USD',
  region text,
  segment text,
  partner_id uuid,
  effective_from timestamptz not null,
  effective_to timestamptz,
  status text not null default 'draft',
  approved_by uuid,
  approved_at timestamptz
);

create table public.prices (
  id uuid primary key default gen_random_uuid(),
  price_book_id uuid not null references public.price_books(id),
  product_version_id uuid not null references public.product_versions(id),
  charge_type public.charge_type not null,
  price_model public.price_model not null,
  billing_interval public.billing_interval not null default 'none',
  meter_id uuid references public.usage_meters(id),
  unit_amount numeric(20,8),
  included_quantity numeric(20,8) not null default 0,
  minimum_amount numeric(20,8),
  maximum_amount numeric(20,8),
  markup_percent numeric(12,6),
  tier_definition jsonb not null default '[]'::jsonb,
  rounding_rule jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null,
  effective_to timestamptz,
  active boolean not null default true
);

create table public.entitlement_definitions (
  id uuid primary key default gen_random_uuid(),
  entitlement_code text not null unique,
  name text not null,
  value_type text not null check (value_type in ('boolean','integer','decimal','string','json')),
  description text,
  runtime_enforced boolean not null default true
);

create table public.product_entitlements (
  id uuid primary key default gen_random_uuid(),
  product_version_id uuid not null references public.product_versions(id),
  entitlement_id uuid not null references public.entitlement_definitions(id),
  entitlement_value jsonb not null,
  unique(product_version_id, entitlement_id)
);

create table public.customer_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  contract_number text not null,
  status public.contract_status not null default 'draft',
  currency char(3) not null default 'USD',
  starts_at timestamptz not null,
  ends_at timestamptz,
  auto_renew boolean not null default false,
  payment_terms_days integer not null default 0,
  minimum_commitment numeric(20,2),
  committed_spend numeric(20,2),
  price_book_id uuid references public.price_books(id),
  external_customer_id text,
  metadata jsonb not null default '{}'::jsonb,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(tenant_id, contract_number)
);

create table public.contract_components (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.customer_contracts(id),
  product_version_id uuid not null references public.product_versions(id),
  price_id uuid references public.prices(id),
  quantity numeric(20,8) not null default 1,
  custom_unit_amount numeric(20,8),
  discount_percent numeric(12,6) not null default 0,
  discount_amount numeric(20,8) not null default 0,
  minimum_amount numeric(20,8),
  maximum_amount numeric(20,8),
  starts_at timestamptz not null,
  ends_at timestamptz,
  configuration jsonb not null default '{}'::jsonb,
  approved_by uuid,
  approved_at timestamptz
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  contract_id uuid references public.customer_contracts(id),
  status public.subscription_status not null,
  starts_at timestamptz not null,
  trial_ends_at timestamptz,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at timestamptz,
  external_subscription_id text,
  created_at timestamptz not null default now()
);

create table public.subscription_items (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id),
  contract_component_id uuid not null references public.contract_components(id),
  quantity numeric(20,8) not null default 1,
  status text not null default 'active',
  external_subscription_item_id text
);

create table public.tenant_entitlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  subscription_item_id uuid references public.subscription_items(id),
  entitlement_id uuid not null references public.entitlement_definitions(id),
  entitlement_value jsonb not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  source text not null,
  unique(tenant_id, entitlement_id, effective_from)
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  tenant_id uuid not null,
  user_id uuid,
  task_run_id uuid,
  module_id uuid,
  contract_id uuid references public.customer_contracts(id),
  meter_id uuid not null references public.usage_meters(id),
  occurred_at timestamptz not null,
  quantity numeric(20,8) not null,
  dimensions jsonb not null default '{}'::jsonb,
  status public.usage_status not null default 'received',
  reversal_of uuid references public.usage_events(id),
  received_at timestamptz not null default now()
);

create index usage_events_tenant_time_idx on public.usage_events(tenant_id, occurred_at);
create index usage_events_meter_time_idx on public.usage_events(meter_id, occurred_at);

create table public.rated_usage (
  id uuid primary key default gen_random_uuid(),
  usage_event_id uuid not null references public.usage_events(id),
  tenant_id uuid not null,
  contract_component_id uuid references public.contract_components(id),
  price_id uuid references public.prices(id),
  rating_version text not null,
  gross_amount numeric(20,8) not null,
  included_amount numeric(20,8) not null default 0,
  credit_amount numeric(20,8) not null default 0,
  discount_amount numeric(20,8) not null default 0,
  net_billable_amount numeric(20,8) not null,
  currency char(3) not null,
  calculation_trace jsonb not null,
  rated_at timestamptz not null default now(),
  unique(usage_event_id, rating_version)
);

create table public.credit_wallets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  contract_id uuid references public.customer_contracts(id),
  currency char(3) not null default 'USD',
  balance numeric(20,8) not null default 0,
  allow_negative boolean not null default false,
  auto_recharge_configuration jsonb not null default '{}'::jsonb,
  unique(tenant_id, contract_id, currency)
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.credit_wallets(id),
  credit_kind public.credit_kind not null,
  amount numeric(20,8) not null,
  occurred_at timestamptz not null default now(),
  expires_at timestamptz,
  reference_type text,
  reference_id uuid,
  description text,
  created_by uuid
);

create table public.billing_runs (
  id uuid primary key default gen_random_uuid(),
  billing_period_start timestamptz not null,
  billing_period_end timestamptz not null,
  status text not null default 'draft',
  started_at timestamptz,
  completed_at timestamptz,
  initiated_by uuid,
  summary jsonb not null default '{}'::jsonb
);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  contract_id uuid references public.customer_contracts(id),
  billing_run_id uuid references public.billing_runs(id),
  subscription_item_id uuid references public.subscription_items(id),
  rated_usage_id uuid references public.rated_usage(id),
  service_period_start timestamptz not null,
  service_period_end timestamptz not null,
  description text not null,
  quantity numeric(20,8) not null default 1,
  unit_amount numeric(20,8) not null,
  net_amount numeric(20,8) not null,
  tax_amount numeric(20,8) not null default 0,
  currency char(3) not null,
  status public.invoice_line_status not null default 'draft',
  external_invoice_id text,
  external_invoice_line_id text,
  created_at timestamptz not null default now()
);

create table public.revenue_schedules (
  id uuid primary key default gen_random_uuid(),
  invoice_line_id uuid not null references public.invoice_lines(id),
  recognition_method text not null check (recognition_method in ('point_in_time','ratable','usage','milestone','custom')),
  starts_at date not null,
  ends_at date not null,
  total_amount numeric(20,8) not null,
  currency char(3) not null,
  accounting_policy_version text not null,
  schedule jsonb not null
);

create table public.revenue_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  revenue_schedule_id uuid references public.revenue_schedules(id),
  invoice_line_id uuid references public.invoice_lines(id),
  posting_date date not null,
  amount numeric(20,8) not null,
  currency char(3) not null,
  state public.revenue_state not null,
  reversal_of uuid references public.revenue_entries(id),
  posted_at timestamptz not null default now(),
  posted_by uuid
);

create table public.deal_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  contract_id uuid references public.customer_contracts(id),
  request_type text not null,
  requested_terms jsonb not null,
  calculated_margin numeric(12,6),
  approval_status text not null default 'pending',
  requested_by uuid,
  requested_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  decision_notes text
);

create table public.capital_projects (
  id uuid primary key default gen_random_uuid(),
  project_code text not null unique,
  name text not null,
  module_id uuid,
  status public.capital_status not null default 'proposed',
  research_phase_end date,
  development_phase_start date,
  in_service_date date,
  owner_id uuid,
  expected_useful_life_months integer,
  accounting_policy_version text,
  created_at timestamptz not null default now()
);

create table public.capitalization_assessments (
  id uuid primary key default gen_random_uuid(),
  capital_project_id uuid not null references public.capital_projects(id),
  assessment_date date not null,
  technical_feasibility boolean,
  intention_to_complete boolean,
  ability_to_use_or_sell boolean,
  probable_future_benefit boolean,
  resources_available boolean,
  reliably_measurable boolean,
  conclusion text not null check (conclusion in ('expense','capitalize_candidate','capitalize','defer_decision')),
  evidence jsonb not null default '{}'::jsonb,
  prepared_by uuid,
  approved_by uuid,
  approved_at timestamptz
);

create table public.capital_assets (
  id uuid primary key default gen_random_uuid(),
  capital_project_id uuid not null references public.capital_projects(id),
  asset_code text not null unique,
  asset_name text not null,
  in_service_date date not null,
  original_cost numeric(20,2) not null,
  useful_life_months integer not null,
  amortization_method text not null default 'straight_line',
  accumulated_amortization numeric(20,2) not null default 0,
  accumulated_impairment numeric(20,2) not null default 0,
  carrying_amount numeric(20,2) generated always as (original_cost - accumulated_amortization - accumulated_impairment) stored,
  status public.capital_status not null default 'in_service'
);

create table public.capital_asset_cost_links (
  id uuid primary key default gen_random_uuid(),
  capital_asset_id uuid references public.capital_assets(id),
  capital_project_id uuid not null references public.capital_projects(id),
  cost_event_id uuid not null,
  qualifying_amount numeric(20,2) not null,
  classification text not null,
  approved_by uuid,
  approved_at timestamptz,
  unique(capital_project_id, cost_event_id)
);

create table public.amortization_entries (
  id uuid primary key default gen_random_uuid(),
  capital_asset_id uuid not null references public.capital_assets(id),
  posting_date date not null,
  amount numeric(20,2) not null,
  reversal_of uuid references public.amortization_entries(id),
  posted_at timestamptz not null default now(),
  unique(capital_asset_id, posting_date, reversal_of)
);

create table public.commercial_audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  actor_id uuid,
  occurred_at timestamptz not null default now(),
  request_id text
);

-- Example RLS pattern. Replace membership function with the platform's authoritative model.
alter table public.customer_contracts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.tenant_entitlements enable row level security;
alter table public.usage_events enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.revenue_entries enable row level security;

-- create policy tenant_read_customer_contracts on public.customer_contracts
-- for select using (public.is_tenant_member(tenant_id, auth.uid()));

-- Service-role-only writes are recommended for usage rating, invoice generation,
-- revenue posting, credit consumption, and capital asset posting.
