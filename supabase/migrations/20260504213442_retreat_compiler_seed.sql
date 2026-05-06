-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504213442
-- Name:    retreat_compiler_seed
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

INSERT INTO content.series (slug, name, description_md, color_token, lunar_aware, default_themes) VALUES
  ('mindfulness',  'Mindfulness',
   'Quiet days, river breath, lunar alignment.','moss', true,
   ARRAY['meditation','sound-bath','full-moon','alms','retreat-life']),
  ('river-tales',  'River Tales',
   'Stories of the Mekong and Namkhan, told by elders.','brass', false,
   ARRAY['storytelling','cruise','folklore','village','craft']),
  ('retreat-life', 'Retreat Life',
   'Slow days, full moons, ceremony. Long-stay alignment.','moss', true,
   ARRAY['long-stay','meditation','spa','culinary','full-moon']),
  ('detox',        'Detox & Restore',
   'Body reset; clean food, gentle movement, daily spa.','paper', false,
   ARRAY['cleanse','yoga','spa','plant-based','sleep'])
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = now();

INSERT INTO content.usali_categories (slug, display_name, usali_section, usali_department, is_revenue_center) VALUES
  ('rooms',           'Rooms',                   'Operated Department', 'Rooms',           true),
  ('fnb',             'F&B',                     'Operated Department', 'F&B',             true),
  ('spa',             'Spa',                     'Operated Department', 'Spa',             true),
  ('other_operated',  'Other Operated',          'Operated Department', 'Other Operated',  true),
  ('minor_operated',  'Minor Operated Departments','Operated Department', 'Minor Operated',true),
  ('admin',           'Administrative & General','Undistributed',       NULL,              false),
  ('sales_marketing', 'Sales & Marketing',       'Undistributed',       NULL,              false),
  ('property_ops',    'Property Operations',     'Undistributed',       NULL,              false),
  ('utilities',       'Utilities',               'Undistributed',       NULL,              false),
  ('maintenance',     'Repairs & Maintenance',   'Undistributed',       NULL,              false),
  ('it',              'Information & Telecoms',  'Undistributed',       NULL,              false)
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name;

INSERT INTO content.legal_pages (slug, title, body_md, version, effective_date) VALUES
  ('privacy',       'Privacy Policy',  '> Placeholder — counsel review required before EU traffic.', '0.1', CURRENT_DATE),
  ('terms',         'Terms of Service','> Placeholder — counsel review required.',                    '0.1', CURRENT_DATE),
  ('waiver',        'Liability Waiver','> Placeholder — outdoor activity + cultural-site waivers.',   '0.1', CURRENT_DATE),
  ('accessibility', 'Accessibility',   '> Placeholder — WCAG 2.1 AA target.',                         '0.1', CURRENT_DATE)
ON CONFLICT (slug) DO UPDATE SET version = EXCLUDED.version, updated_at = now();

INSERT INTO content.lunar_events (event_date, event_type, event_time_local, lunar_phase_pct) VALUES
  ('2026-01-03', 'full_moon', '17:03', 100),  ('2026-01-18', 'new_moon', '02:52', 0),
  ('2026-02-02', 'full_moon', '06:09', 100),  ('2026-02-17', 'new_moon', '19:01', 0),
  ('2026-03-03', 'full_moon', '18:38', 100),  ('2026-03-19', 'new_moon', '08:23', 0),
  ('2026-04-02', 'full_moon', '07:12', 100),  ('2026-04-17', 'new_moon', '18:51', 0),
  ('2026-05-01', 'full_moon', '20:23', 100),  ('2026-05-17', 'new_moon', '03:01', 0),
  ('2026-05-31', 'full_moon', '11:45', 100),  ('2026-06-15', 'new_moon', '09:54', 0),
  ('2026-06-30', 'full_moon', '04:57', 100),  ('2026-07-14', 'new_moon', '16:43', 0),
  ('2026-07-29', 'full_moon', '21:36', 100),  ('2026-08-13', 'new_moon', '00:36', 0),
  ('2026-08-28', 'full_moon', '11:18', 100),  ('2026-09-11', 'new_moon', '10:27', 0),
  ('2026-09-26', 'full_moon', '23:49', 100),  ('2026-10-10', 'new_moon', '23:50', 0),
  ('2026-10-26', 'full_moon', '11:13', 100),  ('2026-11-09', 'new_moon', '14:02', 0),
  ('2026-11-24', 'full_moon', '21:53', 100),  ('2026-12-09', 'new_moon', '04:52', 0),
  ('2026-12-24', 'full_moon', '08:28', 100),
  ('2027-01-07', 'new_moon', '20:24', 0),     ('2027-01-22', 'full_moon', '19:17', 100),
  ('2027-02-06', 'new_moon', '12:56', 0),     ('2027-02-21', 'full_moon', '06:23', 100),
  ('2027-03-08', 'new_moon', '02:30', 0),     ('2027-03-22', 'full_moon', '17:45', 100),
  ('2027-04-06', 'new_moon', '11:51', 0),     ('2027-04-21', 'full_moon', '06:27', 100),
  ('2027-05-05', 'new_moon', '21:59', 0),     ('2027-05-20', 'full_moon', '21:00', 100),
  ('2027-06-04', 'new_moon', '06:40', 0),     ('2027-06-19', 'full_moon', '13:43', 100),
  ('2027-07-03', 'new_moon', '17:01', 0),     ('2027-07-19', 'full_moon', '07:44', 100),
  ('2027-08-02', 'new_moon', '04:04', 0),     ('2027-08-17', 'full_moon', '23:28', 100),
  ('2027-09-01', 'new_moon', '00:41', 0),     ('2027-09-16', 'full_moon', '16:03', 100),
  ('2027-09-30', 'new_moon', '18:36', 0),     ('2027-10-16', 'full_moon', '07:48', 100),
  ('2027-10-30', 'new_moon', '13:36', 0),     ('2027-11-14', 'full_moon', '20:26', 100),
  ('2027-11-29', 'new_moon', '07:23', 0),     ('2027-12-14', 'full_moon', '07:08', 100),
  ('2027-12-29', 'new_moon', '00:11', 0)
ON CONFLICT (event_date) DO UPDATE SET event_type = EXCLUDED.event_type;

INSERT INTO catalog.vendors (name, slug, type, country, default_commission_pct, currency, is_active) VALUES
  ('Namkhan F&B',     'namkhan-fnb',     'internal', 'LA', 0,  'LAK', true),
  ('Namkhan Spa',     'namkhan-spa',     'internal', 'LA', 0,  'LAK', true),
  ('Green Discovery', 'green-discovery', 'partner',  'LA', 15, 'USD', true),
  ('MandaLao',        'mandalao',        'partner',  'LA', 12, 'USD', true),
  ('Ock Pop Tok',     'ock-pop-tok',     'partner',  'LA', 10, 'USD', true),
  ('White Elephant',  'white-elephant',  'partner',  'LA', 15, 'USD', true),
  ('Living Land',     'living-land',     'partner',  'LA', 12, 'USD', true),
  ('MotoLao',         'motolao',         'partner',  'LA', 18, 'USD', true),
  ('UXO Laos',        'uxo-laos',        'partner',  'LA', 0,  'USD', true)
ON CONFLICT (slug) DO UPDATE SET is_active = EXCLUDED.is_active;

INSERT INTO web.sites (slug, domain, property_id, site_type, theme_pack, is_active) VALUES
  ('namkhan-root', 'thenamkhan.com', 'namkhan', 'root', 'namkhan', true)
ON CONFLICT (slug) DO UPDATE SET is_active = true;

INSERT INTO pricing.seasons (season_name, property_id, date_from, date_to, rate_multiplier, min_stay) VALUES
  ('High',     'namkhan', '2026-11-01', '2027-02-28', 1.20, 3),
  ('Shoulder', 'namkhan', '2026-03-01', '2026-05-31', 1.00, 2),
  ('Green',    'namkhan', '2026-06-01', '2026-09-30', 0.85, 1),
  ('Festive',  'namkhan', '2026-12-20', '2027-01-05', 1.50, 4)
ON CONFLICT DO NOTHING;

INSERT INTO pricing.fx_locks (rate, locked_until, source) VALUES
  (20850, now() + interval '7 days', 'manual')
ON CONFLICT DO NOTHING;

-- Seed a baseline pricelist so the compiler has something to price even without the Sheet
INSERT INTO pricing.pricelist (sku, item_name, source_table, source_id, sell_price_usd, cost_lak, margin_floor_pct, valid_from, tier_visibility, property_id, usali_category) VALUES
  ('NMK-ROOM-GRD', 'Garden Room (per night)',          'cloudbeds.rooms',       'garden',          180,  1500000, 60, '2026-01-01', ARRAY['budget','mid','lux'], 'namkhan', 'rooms'),
  ('NMK-ROOM-RSU', 'River Suite (per night)',          'cloudbeds.rooms',       'river-suite',     320,  2400000, 60, '2026-01-01', ARRAY['mid','lux'],          'namkhan', 'rooms'),
  ('NMK-ROOM-RVL', 'River Villa (per night)',          'cloudbeds.rooms',       'river-villa',     520,  3500000, 60, '2026-01-01', ARRAY['lux'],                'namkhan', 'rooms'),
  ('NMK-FNB-BB',   'Bed & Breakfast (per pax/night)',  'catalog.fnb_menus',     'menu-bb',          25,   180000, 70, '2026-01-01', ARRAY['budget','mid','lux'], 'namkhan', 'fnb'),
  ('NMK-FNB-HB',   'Half Board (per pax/night)',       'catalog.fnb_menus',     'menu-hb',          60,   500000, 70, '2026-01-01', ARRAY['budget','mid','lux'], 'namkhan', 'fnb'),
  ('NMK-FNB-FB',   'Full Board (per pax/night)',       'catalog.fnb_menus',     'menu-fb',          95,   850000, 70, '2026-01-01', ARRAY['mid','lux'],          'namkhan', 'fnb'),
  ('NMK-ACT-MED',  'Sunset Meditation (per pax)',      'catalog.activities',    'sunset-med',       35,   100000, 35, '2026-01-01', ARRAY['budget','mid','lux'], 'namkhan', 'other_operated'),
  ('NMK-ACT-SBT',  'Sound Bath (per pax)',             'catalog.activities',    'sound-bath',       60,   220000, 35, '2026-01-01', ARRAY['mid','lux'],          'namkhan', 'other_operated'),
  ('NMK-ACT-FMC',  'Full Moon Ceremony (per pax)',     'catalog.ceremonies',    'full-moon',        80,   200000, 35, '2026-01-01', ARRAY['mid','lux'],          'namkhan', 'other_operated'),
  ('NMK-ACT-ALM',  'Alms Ceremony (per pax)',          'catalog.ceremonies',    'alms',             25,    80000, 35, '2026-01-01', ARRAY['budget','mid','lux'], 'namkhan', 'other_operated'),
  ('NMK-SPA-MAS',  'Lao Traditional Massage 60min',    'catalog.spa_treatments','lao-trad',         45,   200000, 50, '2026-01-01', ARRAY['budget','mid','lux'], 'namkhan', 'spa'),
  ('NMK-SPA-PKG',  'Spa Package (3 treatments)',       'catalog.spa_treatments','spa-pkg',         220,  1000000, 50, '2026-01-01', ARRAY['mid','lux'],          'namkhan', 'spa'),
  ('NMK-WSP-WEA',  'Weaving Workshop (Ock Pop Tok)',   'catalog.workshops',     'weaving',          85,   400000, 35, '2026-01-01', ARRAY['mid','lux'],          'namkhan', 'other_operated'),
  ('NMK-TRP-AIR',  'Airport Transfer (private sedan)', 'catalog.transport_options','airport-sedan', 35,   200000, 35, '2026-01-01', ARRAY['budget','mid','lux'], 'namkhan', 'minor_operated'),
  ('NMK-ADD-PHO',  'Photographer (per event)',         'catalog.addons',        'photo',           450,  1500000, 35, '2026-01-01', ARRAY['lux'],                'namkhan', 'minor_operated')
ON CONFLICT (sku, valid_from, property_id) DO NOTHING;