-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505171407
-- Name:    sales_email_categories_dynamic
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


create table if not exists sales.email_categories (
  key text primary key,
  label text not null,
  display_order int not null default 100,
  active boolean not null default true,
  description text,
  default_category boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists sales.email_category_rules (
  id uuid primary key default gen_random_uuid(),
  category_key text not null references sales.email_categories(key) on delete cascade,
  match_field text not null check (match_field in ('from_email','from_domain','subject','body','intended_mailbox')),
  match_op text not null default 'ilike' check (match_op in ('ilike','endswith','equals','regex')),
  pattern text not null,
  priority int not null default 100,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists email_category_rules_priority_idx on sales.email_category_rules (priority, category_key) where active;

-- Seed default categories (operator can edit / disable / reorder later)
insert into sales.email_categories (key, label, display_order, default_category, description) values
  ('people',   '✉ People',   10, true,  'Real human-to-human mail. Default fallback when no rule matches.'),
  ('ota',      'OTA',        20, false, 'Booking.com / Expedia / Agoda / Trip / Airbnb transactional.'),
  ('reviews',  '★ Reviews',  30, false, 'Review platform notifications + OTA review subjects.'),
  ('reports',  'Reports',    40, false, 'Cloudbeds / MyLighthouse / Intuit / SiteMinder automated reports & invoices.'),
  ('promo',    'Promo',      50, false, 'Marketing newsletters, vendor pushes, sales outreach.'),
  ('internal', 'Internal',   60, false, 'Mail between @thenamkhan.com / @thedonnaportals.com mailboxes.')
on conflict (key) do update set
  label = excluded.label,
  display_order = excluded.display_order,
  default_category = excluded.default_category,
  description = excluded.description,
  updated_at = now();

-- Seed default rules. priority lower = applied first. Operator can edit later.
insert into sales.email_category_rules (category_key, match_field, match_op, pattern, priority, notes) values
  -- internal
  ('internal','from_domain','endswith','thenamkhan.com',     10, 'Internal Namkhan mail'),
  ('internal','from_domain','endswith','thedonnaportals.com',11, 'Internal Donna Portals mail'),

  -- reviews (run before ota so OTA-review subjects bucket as reviews)
  ('reviews','from_domain','ilike','%reviewpro%',           20, ''),
  ('reviews','from_domain','ilike','%trustyou%',            21, ''),
  ('reviews','from_domain','ilike','%revinate%',            22, ''),
  ('reviews','subject',     'ilike','%new review%',         23, ''),
  ('reviews','subject',     'ilike','%guest review%',       24, ''),
  ('reviews','subject',     'ilike','%rate your stay%',     25, ''),
  ('reviews','subject',     'ilike','%review from%',        26, ''),

  -- ota
  ('ota','from_domain','endswith','booking.com',  30, ''),
  ('ota','from_domain','endswith','expedia.com',  31, ''),
  ('ota','from_domain','endswith','agoda.com',    32, ''),
  ('ota','from_domain','endswith','trip.com',     33, ''),
  ('ota','from_domain','endswith','airbnb.com',   34, ''),
  ('ota','from_domain','endswith','vrbo.com',     35, ''),
  ('ota','from_domain','endswith','tripadvisor.com', 36, ''),

  -- reports
  ('reports','from_domain','endswith','cloudbeds.com',         40, 'Cloudbeds noreply ledgers'),
  ('reports','from_domain','endswith','mylighthouse.com',      41, 'Lighthouse rate shopper'),
  ('reports','from_domain','ilike','%notification.intuit%',    42, 'QuickBooks'),
  ('reports','from_domain','endswith','intuit.com',            43, ''),
  ('reports','from_domain','endswith','siteminder.com',        44, ''),
  ('reports','subject','ilike','%daily ledger%',               45, ''),
  ('reports','subject','ilike','%inhouse daily%',              46, ''),
  ('reports','subject','ilike','%pre deposit%',                47, ''),
  ('reports','subject','ilike','%rateshopping%',               48, ''),
  ('reports','subject','ilike','%performance report%',         49, ''),
  ('reports','subject','ilike','%export transdata%',           50, ''),
  ('reports','subject','ilike','%invoice%',                    51, ''),

  -- promo  (catches all marketing subdomains + known promo senders)
  ('promo','from_domain','ilike','newsletter.%',     60, ''),
  ('promo','from_domain','ilike','mail.%',           61, 'mail.* subdomains are usually promo'),
  ('promo','from_domain','ilike','info.%',           62, ''),
  ('promo','from_domain','ilike','engage.%',         63, ''),
  ('promo','from_domain','ilike','email.%',          64, ''),
  ('promo','from_domain','ilike','mp%.tripadvisor.com', 65, ''),
  ('promo','from_domain','endswith','upwork.com',    66, ''),
  ('promo','from_domain','endswith','apollo.io',     67, ''),
  ('promo','from_domain','endswith','canva.com',     68, ''),
  ('promo','from_domain','ilike','%bitly%',          69, ''),
  ('promo','from_domain','ilike','%tourradar%',      70, ''),
  ('promo','from_domain','ilike','%bookretreats%',   71, ''),
  ('promo','from_domain','ilike','%cantonfair%',     72, ''),
  ('promo','from_domain','ilike','%substack%',       73, ''),
  ('promo','from_domain','endswith','viator.com',    74, ''),
  ('promo','from_email','ilike','%mailer-daemon%',   75, ''),
  ('promo','from_email','ilike','noreply@%',         76, 'generic noreply senders fall here unless caught earlier')
on conflict do nothing;

grant select on sales.email_categories to service_role, authenticated, anon;
grant select on sales.email_category_rules to service_role, authenticated, anon;
grant all on sales.email_categories to service_role;
grant all on sales.email_category_rules to service_role;
