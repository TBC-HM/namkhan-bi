-- =====================================================================
-- Seed: retreat-compiler init
-- Idempotent — safe to re-run
-- Loads: vendors (7 partners), series (4), USALI (~12), legal placeholders (4),
--        sites (1 root), default season, FX lock, lunar 2026-2030 (~250 events)
-- Catalog (activities, spa, fnb, pricelist) loads from Sheets MCP separately.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. content.series
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 2. content.usali_categories (mirror gl.classes)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 3. content.legal_pages (placeholders — replace with counsel-reviewed copy)
-- ---------------------------------------------------------------------
INSERT INTO content.legal_pages (slug, title, body_md, version, effective_date) VALUES
  ('privacy',       'Privacy Policy',  '> Placeholder — counsel review required before EU traffic.', '0.1', CURRENT_DATE),
  ('terms',         'Terms of Service','> Placeholder — counsel review required.',                    '0.1', CURRENT_DATE),
  ('waiver',        'Liability Waiver','> Placeholder — outdoor activity + cultural-site waivers.',   '0.1', CURRENT_DATE),
  ('accessibility', 'Accessibility',   '> Placeholder — WCAG 2.1 AA target.',                         '0.1', CURRENT_DATE)
ON CONFLICT (slug) DO UPDATE SET version = EXCLUDED.version, updated_at = now();

-- ---------------------------------------------------------------------
-- 4. content.lunar_events (full + new moons 2026-01 → 2030-12, Asia/Vientiane)
-- ---------------------------------------------------------------------
-- Generated from astronomical reference; ~125 full moons + ~125 new moons
INSERT INTO content.lunar_events (event_date, event_type, event_time_local, lunar_phase_pct) VALUES
  -- 2026
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
  -- 2027
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
  ('2027-12-29', 'new_moon', '00:11', 0),
  -- 2028
  ('2028-01-12', 'full_moon', '17:03', 100),  ('2028-01-27', 'new_moon', '14:11', 0),
  ('2028-02-11', 'full_moon', '02:02', 100),  ('2028-02-26', 'new_moon', '02:36', 0),
  ('2028-03-11', 'full_moon', '09:05', 100),  ('2028-03-26', 'new_moon', '11:29', 0),
  ('2028-04-09', 'full_moon', '17:26', 100),  ('2028-04-24', 'new_moon', '20:46', 0),
  ('2028-05-09', 'full_moon', '03:49', 100),  ('2028-05-24', 'new_moon', '02:16', 0),
  ('2028-06-07', 'full_moon', '15:08', 100),  ('2028-06-22', 'new_moon', '09:26', 0),
  ('2028-07-06', 'full_moon', '01:11', 100),  ('2028-07-22', 'new_moon', '03:01', 0),
  ('2028-08-04', 'full_moon', '11:08', 100),  ('2028-08-20', 'new_moon', '17:43', 0),
  ('2028-09-02', 'full_moon', '20:48', 100),  ('2028-09-18', 'new_moon', '13:24', 0),
  ('2028-10-02', 'full_moon', '07:25', 100),  ('2028-10-18', 'new_moon', '09:57', 0),
  ('2028-10-31', 'full_moon', '21:37', 100),  ('2028-11-17', 'new_moon', '00:08', 0),
  ('2028-11-30', 'full_moon', '14:18', 100),  ('2028-12-16', 'new_moon', '08:06', 0),
  ('2028-12-30', 'full_moon', '06:48', 100),
  -- 2029
  ('2029-01-14', 'new_moon', '17:24', 0),     ('2029-01-29', 'full_moon', '04:03', 100),
  ('2029-02-13', 'new_moon', '10:31', 0),     ('2029-02-27', 'full_moon', '17:09', 100),
  ('2029-03-15', 'new_moon', '04:19', 0),     ('2029-03-29', 'full_moon', '02:25', 100),
  ('2029-04-13', 'new_moon', '21:39', 0),     ('2029-04-27', 'full_moon', '08:36', 100),
  ('2029-05-13', 'new_moon', '14:42', 0),     ('2029-05-26', 'full_moon', '17:47', 100),
  ('2029-06-12', 'new_moon', '02:50', 0),     ('2029-06-25', 'full_moon', '09:25', 100),
  ('2029-07-11', 'new_moon', '15:51', 0),     ('2029-07-25', 'full_moon', '01:36', 100),
  ('2029-08-10', 'new_moon', '01:55', 0),     ('2029-08-23', 'full_moon', '20:50', 100),
  ('2029-09-08', 'new_moon', '17:44', 0),     ('2029-09-22', 'full_moon', '15:29', 100),
  ('2029-10-08', 'new_moon', '02:14', 0),     ('2029-10-22', 'full_moon', '06:28', 100),
  ('2029-11-06', 'new_moon', '11:24', 0),     ('2029-11-20', 'full_moon', '20:03', 100),
  ('2029-12-05', 'new_moon', '20:52', 0),     ('2029-12-20', 'full_moon', '08:46', 100),
  -- 2030
  ('2030-01-04', 'new_moon', '09:49', 0),     ('2030-01-18', 'full_moon', '21:09', 100),
  ('2030-02-02', 'new_moon', '23:07', 0),     ('2030-02-17', 'full_moon', '10:21', 100),
  ('2030-03-04', 'new_moon', '13:34', 0),     ('2030-03-18', 'full_moon', '23:55', 100),
  ('2030-04-03', 'new_moon', '05:02', 0),     ('2030-04-17', 'full_moon', '13:21', 100),
  ('2030-05-02', 'new_moon', '21:13', 0),     ('2030-05-16', 'full_moon', '02:59', 100),
  ('2030-06-01', 'new_moon', '13:21', 0),     ('2030-06-14', 'full_moon', '17:41', 100),
  ('2030-07-01', 'new_moon', '04:35', 0),     ('2030-07-14', 'full_moon', '08:11', 100),
  ('2030-07-30', 'new_moon', '17:46', 0),     ('2030-08-12', 'full_moon', '23:19', 100),
  ('2030-08-29', 'new_moon', '04:08', 0),     ('2030-09-11', 'full_moon', '14:23', 100),
  ('2030-09-27', 'new_moon', '12:54', 0),     ('2030-10-11', 'full_moon', '06:48', 100),
  ('2030-10-26', 'new_moon', '20:18', 0),     ('2030-11-09', 'full_moon', '23:45', 100),
  ('2030-11-25', 'new_moon', '06:48', 0),     ('2030-12-09', 'full_moon', '17:39', 100),
  ('2030-12-24', 'new_moon', '17:32', 0)
ON CONFLICT (event_date) DO UPDATE SET event_type = EXCLUDED.event_type;

-- ---------------------------------------------------------------------
-- 5. catalog.vendors (7 partners + 2 internal)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 6. web.sites (root site)
-- ---------------------------------------------------------------------
INSERT INTO web.sites (slug, domain, property_id, site_type, theme_pack, is_active) VALUES
  ('namkhan-root', 'thenamkhan.com', 'namkhan', 'root', 'namkhan', true)
ON CONFLICT (slug) DO UPDATE SET is_active = true;

-- ---------------------------------------------------------------------
-- 7. pricing.seasons (default Namkhan calendar — verify with PBS)
-- ---------------------------------------------------------------------
INSERT INTO pricing.seasons (season_name, property_id, date_from, date_to, rate_multiplier, min_stay) VALUES
  ('High',     'namkhan', '2026-11-01', '2027-02-28', 1.20, 3),
  ('Shoulder', 'namkhan', '2026-03-01', '2026-05-31', 1.00, 2),
  ('Green',    'namkhan', '2026-06-01', '2026-09-30', 0.85, 1),
  ('Festive',  'namkhan', '2026-12-20', '2027-01-05', 1.50, 4)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 8. pricing.fx_locks (initial)
-- ---------------------------------------------------------------------
INSERT INTO pricing.fx_locks (rate, locked_until, source) VALUES
  (20850, now() + interval '7 days', 'manual')
ON CONFLICT DO NOTHING;

COMMIT;

-- =====================================================================
-- End of seed.
-- Catalog seed (activities, spa, fnb, pricelist) requires Sheets MCP +
-- separate import script. See 11-runbooks/sheet-sync.md.
-- =====================================================================
