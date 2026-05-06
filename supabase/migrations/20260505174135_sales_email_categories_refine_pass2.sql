-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505174135
-- Name:    sales_email_categories_refine_pass2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


insert into sales.email_category_rules (category_key, match_field, match_op, pattern, priority, notes) values
  -- Reviews — Google Business Profile reviews are reviews
  ('reviews','from_email','ilike','businessprofile-noreply@google.com', 15, 'Google Business Profile review notifications'),
  ('reviews','subject','ilike','% left a review for %',                 16, 'Google Maps review subject pattern'),

  -- Reports — Google operational notifications + DHL shipping + general workspace alerts
  ('reports','from_email','ilike','drive-shares-dm-noreply@google.com', 20, 'Drive shares'),
  ('reports','from_email','ilike','google-workspace-alerts-noreply@google.com', 21, 'Workspace security alerts'),
  ('reports','from_email','ilike','meetings-noreply@google.com',        22, 'Calendar/Meet invites'),
  ('reports','from_email','ilike','payments-noreply@google.com',        23, 'Google Ads / Workspace billing'),
  ('reports','from_email','ilike','%-noreply@google.com',               24, 'Catch-all for *.google.com noreply senders'),
  ('reports','from_domain','endswith','dhl.com',                        55, 'Shipping notifications'),
  ('reports','from_domain','endswith','fedex.com',                      55, ''),
  ('reports','from_domain','endswith','ups.com',                        55, ''),

  -- Promo — Facebook friend pings + cold sales outreach
  ('promo','from_domain','endswith','facebookmail.com',                 89, 'Facebook social pings'),
  ('promo','from_domain','endswith','go.canarytechnologies.com',        90, 'Cold sales outreach'),
  ('promo','from_domain','endswith','experiencetravelgroup.com',        91, 'B2B newsletter')
on conflict do nothing;
