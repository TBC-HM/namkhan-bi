-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505184305
-- Name:    sales_guest_cohorts
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Saved guest cohorts (warm side of outreach)
create table if not exists sales.guest_cohorts (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text,
  criteria jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Tag drafts with their source (cohort or prospect)
alter table sales.email_drafts add column if not exists cohort_id uuid references sales.guest_cohorts(id) on delete set null;

-- Seed 5 useful cohorts
insert into sales.guest_cohorts (key, name, description, criteria) values
  ('repeat-guests',
   'Repeat guests (≥2 stays)',
   'Guests with two or more historical reservations. Highest conversion warm-segment.',
   jsonb_build_object('min_stays', 2, 'has_email', true)),
  ('high-ltv',
   'High-LTV guests (>$5k lifetime)',
   'Guests whose total room + ancillary spend has crossed the $5k mark. Treat with care.',
   jsonb_build_object('min_lifetime_usd', 5000, 'has_email', true)),
  ('fr-speakers',
   'FR-speaking guests',
   'Guests whose stay language or country flags French speaking. Localise the campaign.',
   jsonb_build_object('languages', array['FR'], 'countries', array['FR','BE','CH','LU','MC','CA'], 'has_email', true)),
  ('past-retreat-guests',
   'Past retreat guests',
   'Guests whose stay history includes a retreat-tagged reservation.',
   jsonb_build_object('tags', array['retreat'], 'has_email', true)),
  ('lapsed-12m',
   'Lapsed guests (12-24 months)',
   'Guests whose last stay was 12 to 24 months ago — winback target.',
   jsonb_build_object('last_stay_min_days', 365, 'last_stay_max_days', 730, 'has_email', true))
on conflict (key) do nothing;

grant select on sales.guest_cohorts to authenticated, anon;
grant all on sales.guest_cohorts to service_role;
