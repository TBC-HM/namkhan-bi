-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503171009
-- Name:    seed_calendar_events_2026_2028
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Property ID 260955 = The Namkhan
-- buildup_start auto-computed by trigger from type's marketing_lead_days_min

INSERT INTO marketing.calendar_events 
(property_id, type_code, date_start, date_end, display_name, source_markets, applies_to_fnb, applies_to_retreat, marketing_brief, hashtags) VALUES

-- =================== CHRISTMAS / NYE ===================
(260955, 'xmas_nye', '2026-12-22', '2027-01-04', 'Christmas & NYE 2026/27',
  ARRAY['EU','GB','US','AU','SG','HK'], true, true,
  'Highest-demand window. Premium gala dinner Dec 24+25, NYE party Dec 31. Full marketing campaign starts October 1. Comp shopping starts October.',
  ARRAY['#namkhan','#luangprabang','#christmasinlaos','#newyearescape']),

(260955, 'xmas_nye', '2027-12-22', '2028-01-04', 'Christmas & NYE 2027/28',
  ARRAY['EU','GB','US','AU','SG','HK'], true, true, NULL, ARRAY['#namkhan','#luangprabang']),

-- =================== CHINESE NEW YEAR ===================
(260955, 'chinese_ny', '2026-02-15', '2026-02-21', 'Chinese New Year 2026',
  ARRAY['CN','SG','MY','TW','HK','TH'], true, false, NULL, ARRAY['#cny2026','#namkhan']),
(260955, 'chinese_ny', '2027-02-04', '2027-02-10', 'Chinese New Year 2027',
  ARRAY['CN','SG','MY','TW','HK','TH'], true, false, NULL, ARRAY['#cny2027']),
(260955, 'chinese_ny', '2028-01-24', '2028-01-30', 'Chinese New Year 2028',
  ARRAY['CN','SG','MY','TW','HK','TH'], true, false, NULL, ARRAY['#cny2028']),

-- =================== PI MAI / SONGKRAN ===================
(260955, 'pi_mai', '2026-04-11', '2026-04-17', 'Pi Mai 2026',
  ARRAY['LA','TH','EU','US','AU','GB'], true, true,
  'Peak event of year for LP. Cultural immersion content + premium pricing. Buildup from Feb.',
  ARRAY['#pimai','#laonewyear','#namkhan']),
(260955, 'pi_mai', '2027-04-11', '2027-04-17', 'Pi Mai 2027',
  ARRAY['LA','TH','EU','US','AU','GB'], true, true, NULL, ARRAY['#pimai','#laonewyear']),
(260955, 'pi_mai', '2028-04-11', '2028-04-17', 'Pi Mai 2028',
  ARRAY['LA','TH','EU','US','AU','GB'], true, true, NULL, ARRAY['#pimai','#laonewyear']),

(260955, 'songkran_th', '2026-04-13', '2026-04-15', 'Songkran 2026', ARRAY['TH'], false, false, NULL, ARRAY['#songkran']),
(260955, 'songkran_th', '2027-04-13', '2027-04-15', 'Songkran 2027', ARRAY['TH'], false, false, NULL, ARRAY['#songkran']),
(260955, 'songkran_th', '2028-04-13', '2028-04-15', 'Songkran 2028', ARRAY['TH'], false, false, NULL, ARRAY['#songkran']),

-- =================== JAPANESE GOLDEN WEEK ===================
(260955, 'golden_week_jp', '2026-04-29', '2026-05-05', 'Golden Week 2026', ARRAY['JP'], false, false, NULL, ARRAY['#goldenweek']),
(260955, 'golden_week_jp', '2027-04-29', '2027-05-05', 'Golden Week 2027', ARRAY['JP'], false, false, NULL, ARRAY['#goldenweek']),
(260955, 'golden_week_jp', '2028-04-29', '2028-05-05', 'Golden Week 2028', ARRAY['JP'], false, false, NULL, ARRAY['#goldenweek']),

-- =================== EASTER ===================
(260955, 'easter', '2026-04-03', '2026-04-06', 'Easter 2026', ARRAY['EU','GB','AU','US'], false, false, NULL, ARRAY['#easter']),
(260955, 'easter', '2027-03-26', '2027-03-29', 'Easter 2027', ARRAY['EU','GB','AU','US'], false, false, NULL, ARRAY['#easter']),
(260955, 'easter', '2028-04-14', '2028-04-17', 'Easter 2028', ARRAY['EU','GB','AU','US'], false, false, NULL, ARRAY['#easter']),

-- =================== BUDDHIST FESTIVALS ===================
(260955, 'boun_ok_phansa', '2026-10-26', '2026-10-27', 'Boun Ok Phansa 2026', ARRAY['LA','TH'], true, true,
  'Lantern festival - signature LP cultural event. Photo/video content opportunity.',
  ARRAY['#bounokphansa','#luangprabang']),
(260955, 'boun_ok_phansa', '2027-10-15', '2027-10-16', 'Boun Ok Phansa 2027', ARRAY['LA','TH'], true, true, NULL, ARRAY['#bounokphansa']),
(260955, 'boun_ok_phansa', '2028-11-02', '2028-11-03', 'Boun Ok Phansa 2028', ARRAY['LA','TH'], true, true, NULL, ARRAY['#bounokphansa']),

(260955, 'that_luang', '2026-11-23', '2026-11-25', 'That Luang Festival 2026', ARRAY['LA','TH'], false, false, NULL, ARRAY['#thatluang']),
(260955, 'that_luang', '2027-11-12', '2027-11-14', 'That Luang Festival 2027', ARRAY['LA','TH'], false, false, NULL, ARRAY['#thatluang']),
(260955, 'that_luang', '2028-10-31', '2028-11-02', 'That Luang Festival 2028', ARRAY['LA','TH'], false, false, NULL, ARRAY['#thatluang']),

(260955, 'vesak', '2026-05-22', '2026-05-22', 'Vesak 2026', ARRAY['TH','LK','MM','SG'], false, false, NULL, ARRAY['#vesak']),
(260955, 'vesak', '2027-05-11', '2027-05-11', 'Vesak 2027', ARRAY['TH','LK','MM','SG'], false, false, NULL, ARRAY['#vesak']),
(260955, 'vesak', '2028-05-29', '2028-05-29', 'Vesak 2028', ARRAY['TH','LK','MM','SG'], false, false, NULL, ARRAY['#vesak']),

-- =================== THAI LONG WEEKENDS (DRIVE MARKET) ===================
-- 2026
(260955, 'thai_long_weekends', '2026-01-01', '2026-01-04', 'TH NY Long Weekend 2026', ARRAY['TH'], false, false, NULL, NULL),
(260955, 'thai_long_weekends', '2026-04-04', '2026-04-08', 'TH Chakri Long Weekend 2026', ARRAY['TH'], false, false, NULL, NULL),
(260955, 'thai_long_weekends', '2026-05-01', '2026-05-04', 'TH Labor Day Weekend 2026', ARRAY['TH'], false, false, NULL, NULL),
(260955, 'thai_long_weekends', '2026-07-25', '2026-07-29', 'TH Asanha Bucha Weekend 2026', ARRAY['TH'], false, false, NULL, NULL),
(260955, 'thai_long_weekends', '2026-08-12', '2026-08-16', 'TH Mothers Day Weekend 2026', ARRAY['TH'], false, false, NULL, NULL),
(260955, 'thai_long_weekends', '2026-12-05', '2026-12-08', 'TH Fathers Day Weekend 2026', ARRAY['TH'], false, false, NULL, NULL),
(260955, 'thai_long_weekends', '2026-12-10', '2026-12-13', 'TH Constitution Day Weekend 2026', ARRAY['TH'], false, false, NULL, NULL),
-- 2027
(260955, 'thai_long_weekends', '2027-01-01', '2027-01-03', 'TH NY Long Weekend 2027', ARRAY['TH'], false, false, NULL, NULL),
(260955, 'thai_long_weekends', '2027-04-04', '2027-04-06', 'TH Chakri Long Weekend 2027', ARRAY['TH'], false, false, NULL, NULL),
(260955, 'thai_long_weekends', '2027-05-01', '2027-05-03', 'TH Labor Day Weekend 2027', ARRAY['TH'], false, false, NULL, NULL),
(260955, 'thai_long_weekends', '2027-08-12', '2027-08-15', 'TH Mothers Day Weekend 2027', ARRAY['TH'], false, false, NULL, NULL),
(260955, 'thai_long_weekends', '2027-12-05', '2027-12-07', 'TH Fathers Day Weekend 2027', ARRAY['TH'], false, false, NULL, NULL),
(260955, 'thai_long_weekends', '2027-12-10', '2027-12-12', 'TH Constitution Day Weekend 2027', ARRAY['TH'], false, false, NULL, NULL),
-- 2028
(260955, 'thai_long_weekends', '2028-01-01', '2028-01-03', 'TH NY Long Weekend 2028', ARRAY['TH'], false, false, NULL, NULL),
(260955, 'thai_long_weekends', '2028-04-04', '2028-04-06', 'TH Chakri Long Weekend 2028', ARRAY['TH'], false, false, NULL, NULL),
(260955, 'thai_long_weekends', '2028-05-01', '2028-05-03', 'TH Labor Day Weekend 2028', ARRAY['TH'], false, false, NULL, NULL),

-- =================== UNESCO ANNIVERSARY ===================
(260955, 'unesco_anniversary', '2026-12-02', '2026-12-02', 'LP UNESCO Anniversary 2026', ARRAY['EU','UNESCO_audience'], false, false, NULL, NULL),
(260955, 'unesco_anniversary', '2027-12-02', '2027-12-02', 'LP UNESCO Anniversary 2027', ARRAY['EU','UNESCO_audience'], false, false, NULL, NULL),
(260955, 'unesco_anniversary', '2028-12-02', '2028-12-02', 'LP UNESCO Anniversary 2028', ARRAY['EU','UNESCO_audience'], false, false, NULL, NULL);

-- =================== FULL MOONS (ALL) ===================
INSERT INTO marketing.calendar_events 
(property_id, type_code, date_start, date_end, display_name, source_markets, applies_to_retreat, marketing_brief)
SELECT 260955, 'full_moon', d, d, 'Full Moon ' || to_char(d, 'Mon DD YYYY'),
  ARRAY['EU','US','GB','AU','TH'], true,
  'Tied to Full Moon Meditation series. Grace narration drop 7 days prior.'
FROM (VALUES
  ('2026-05-01'::date),('2026-05-31'::date),('2026-06-29'::date),('2026-07-29'::date),
  ('2026-08-28'::date),('2026-09-26'::date),('2026-10-26'::date),('2026-11-24'::date),('2026-12-24'::date),
  ('2027-01-22'::date),('2027-02-20'::date),('2027-03-22'::date),('2027-04-20'::date),('2027-05-20'::date),
  ('2027-06-19'::date),('2027-07-18'::date),('2027-08-17'::date),('2027-09-15'::date),
  ('2027-10-15'::date),('2027-11-14'::date),('2027-12-13'::date),
  ('2028-01-12'::date),('2028-02-10'::date),('2028-03-11'::date),('2028-04-09'::date),
  ('2028-05-08'::date),('2028-06-07'::date),('2028-07-06'::date),('2028-08-05'::date),
  ('2028-09-03'::date),('2028-10-03'::date),('2028-11-02'::date),('2028-12-01'::date),('2028-12-30'::date)
) AS dates(d);

-- =================== SUMMER PEAK BLOCKS ===================
INSERT INTO marketing.calendar_events 
(property_id, type_code, date_start, date_end, display_name, source_markets, applies_to_marketing) VALUES
(260955, 'summer_peak_west', '2026-07-01', '2026-08-31', 'Western Summer 2026', ARRAY['EU','GB','US','AU'], true),
(260955, 'summer_peak_west', '2027-07-01', '2027-08-31', 'Western Summer 2027', ARRAY['EU','GB','US','AU'], true),
(260955, 'summer_peak_west', '2028-07-01', '2028-08-31', 'Western Summer 2028', ARRAY['EU','GB','US','AU'], true);
