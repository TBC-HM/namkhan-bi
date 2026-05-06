-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505184212
-- Name:    sales_leads_engine_schema
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ICP (Ideal Customer Profile) segments — the targeting definitions
create table if not exists sales.icp_segments (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text,
  criteria jsonb not null default '{}'::jsonb,    -- {industry, country, role_keywords, company_size, ...}
  daily_quota int not null default 5,
  source text not null default 'manual' check (source in ('manual','apollo','linkedin','csv')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Prospects — the actual targets
create table if not exists sales.prospects (
  id uuid primary key default gen_random_uuid(),
  property_id int8 not null,
  name text,
  company text,
  role text,
  country text,
  email text,
  linkedin_url text,
  website text,
  source text not null default 'manual' check (source in ('manual','apollo','linkedin','csv','referral')),
  source_ref text,                          -- Apollo person id / LinkedIn url etc
  icp_segment_id uuid references sales.icp_segments(id) on delete set null,
  score int default 50,                      -- 0-100 fit score
  status text not null default 'new' check (status in ('new','enriched','drafted','sent','replied','bounced','suppressed','converted','dismissed')),
  owner text,                                -- which operator picked this up
  enrichment_data jsonb default '{}'::jsonb, -- raw payload from Apollo / scraper
  context_summary text,                      -- AI summary of why this prospect, what hook
  last_outreach_draft_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  contacted_at timestamptz,
  replied_at timestamptz
);
create index if not exists prospects_status_idx on sales.prospects (property_id, status, created_at desc);
create index if not exists prospects_email_idx on sales.prospects (lower(email)) where email is not null;

-- Suppressions — bounces, unsubscribes, manual block
create table if not exists sales.suppressions (
  email text primary key,
  reason text not null check (reason in ('bounce','unsubscribe','complaint','manual','not_interested')),
  source_prospect_id uuid references sales.prospects(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

-- Outreach drafts column extension on email_drafts to tag intent
alter table sales.email_drafts add column if not exists intent text default 'reply' check (intent in ('reply','compose','outreach'));
alter table sales.email_drafts add column if not exists prospect_id uuid references sales.prospects(id) on delete set null;
create index if not exists email_drafts_intent_idx on sales.email_drafts (property_id, intent, status, created_at desc);

-- Seed two starter ICPs so operator sees the shape
insert into sales.icp_segments (key, name, description, criteria, daily_quota, source) values
  ('dmc-asia',
   'Asia-based DMCs',
   'Destination management companies based in Thailand, Vietnam, Cambodia, Indonesia, Malaysia, Philippines that send leisure and wellness travellers to Laos.',
   jsonb_build_object('countries', array['TH','VN','KH','ID','MY','PH'], 'role_keywords', array['DMC','destination management','tour operator','inbound'], 'min_company_size', 5),
   5, 'manual'),
  ('retreat-organisers',
   'Retreat organisers EU + AU',
   'Yoga, wellness, meditation, leadership retreat organisers running 3-7 day programmes in Asia. Europe and Australia based.',
   jsonb_build_object('countries', array['DE','FR','GB','ES','IT','NL','BE','CH','AT','AU'], 'role_keywords', array['retreat leader','yoga teacher','wellness facilitator','meditation teacher'], 'industries', array['health, wellness and fitness','hospitality']),
   3, 'manual')
on conflict (key) do nothing;

grant all on sales.icp_segments, sales.prospects, sales.suppressions to service_role;
grant select on sales.icp_segments, sales.prospects, sales.suppressions to authenticated, anon;
