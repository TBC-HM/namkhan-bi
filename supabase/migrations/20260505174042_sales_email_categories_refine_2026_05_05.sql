-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505174042
-- Name:    sales_email_categories_refine_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Add Partners / B2B category — operators, agents, vendors, parity tools, retreat platforms.
-- This is real human work mail that isn't a guest. Sits between People and OTA.
insert into sales.email_categories (key, label, display_order, default_category, description) values
  ('partners', '◆ Partners', 15, false, 'B2B partners, agents, vendors, parity tools, retreat platforms — real work mail, not guests.')
on conflict (key) do update set
  label = excluded.label, display_order = excluded.display_order,
  description = excluded.description, updated_at = now();

-- Sharpen: pull real operational + promo senders out of the People default fallback.
insert into sales.email_category_rules (category_key, match_field, match_op, pattern, priority, notes) values
  -- Reports — Google Workspace operational notifications + Semrush + bank
  ('reports','from_email','ilike','analytics-noreply@google.com',  18, 'Google Analytics admin notifications'),
  ('reports','from_email','ilike','workspace-noreply@google.com',  18, 'Google Workspace admin notifications'),
  ('reports','from_email','ilike','no-reply@accounts.google.com',  19, 'Google security alerts'),
  ('reports','from_domain','endswith','accounts.google.com',       19, 'Google account notifications'),
  ('reports','from_domain','endswith','semrush.com',               52, 'SEO/backlink reports'),
  ('reports','from_domain','endswith','bcelcard.com',              53, 'Bank statements'),
  ('reports','from_email','ilike','%visa@%',                       54, 'Card statements'),

  -- Partners / B2B — real human work mail
  ('partners','from_domain','endswith','retreat.guru',             80, 'Retreat platform support / commissions'),
  ('partners','from_domain','endswith','bookyogaretreats.com',     81, 'Listing platform'),
  ('partners','from_domain','endswith','tripaneer.com',            82, 'Listing platform'),
  ('partners','from_domain','endswith','musicconcierge.co.uk',     83, 'Music partner'),
  ('partners','from_domain','endswith','hy-digital.com',           84, 'Web/dev partner'),
  ('partners','from_domain','endswith','thenetrevenue.com',        85, 'Revenue / accounting partner'),
  ('partners','from_domain','endswith','123compare.me',            86, 'Parity tool'),
  ('partners','from_domain','endswith','mekongtourism-mtco.org',   87, 'Tourism board (newsletter content but partner)'),

  -- Promo — additional newsletter / marketing senders pulled from real corpus
  ('promo','from_domain','endswith','elfsightdigest.com',          78, 'Marketing'),
  ('promo','from_domain','endswith','greenglobe.com',              79, 'Newsletter'),
  ('promo','from_domain','endswith','hello.curiositystream.com',   80, 'Subscription promo'),
  ('promo','from_domain','endswith','iglta.org',                   81, 'Newsletter'),
  ('promo','from_domain','endswith','later.com',                   82, 'SaaS marketing'),
  ('promo','from_domain','endswith','linktr.ee',                   83, 'Marketing'),
  ('promo','from_domain','ilike','%wixemails.com',                 84, 'Wix-sent marketing'),
  ('promo','from_domain','endswith','pictory.ai',                  85, 'SaaS marketing'),
  ('promo','from_domain','endswith','smallpdf.com',                86, 'SaaS marketing'),
  ('promo','from_domain','ilike','support.publer.com',             87, 'SaaS product updates'),
  ('promo','from_domain','endswith','ccsend.com',                  88, 'Constant Contact send infra'),

  -- People — explicit boost so personal mail wins even if other rules might also fit.
  -- Lower priority number = runs first, so put gmail/outlook checks BEFORE generic noreply catch-all.
  ('people','from_domain','endswith','gmail.com',                  90, 'Personal Gmail'),
  ('people','from_domain','endswith','googlemail.com',             91, 'Personal Gmail (de)'),
  ('people','from_domain','endswith','outlook.com',                92, ''),
  ('people','from_domain','endswith','hotmail.com',                93, ''),
  ('people','from_domain','endswith','yahoo.com',                  94, ''),
  ('people','from_domain','endswith','icloud.com',                 95, ''),
  ('people','from_domain','endswith','proton.me',                  96, ''),
  ('people','from_domain','endswith','protonmail.com',             97, '')
on conflict do nothing;

-- Move the existing generic noreply catch-all to a much later priority so it doesn't outrank specific rules
update sales.email_category_rules
   set priority = 200, notes = 'last-resort catch-all (de-prioritised 2026-05-05)'
 where category_key = 'promo'
   and match_field  = 'from_email'
   and match_op     = 'ilike'
   and pattern      = 'noreply@%';
