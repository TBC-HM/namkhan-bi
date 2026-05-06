-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503170513
-- Name:    demand_calendar_events_seed
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- LAO HOLIDAYS (high impact for LP)
-- ============================================================

-- Pi Mai (Lao New Year) — biggest event of the year for LP
-- Apr 13-15 each year, plus shoulder days Apr 11-12 and Apr 16-17
UPDATE revenue.demand_calendar SET
  events = array_append(events, 'pi_mai'),
  event_score = GREATEST(event_score, 100),
  is_lp_peak = true,
  season = 'high',
  source_markets = array_cat(source_markets, ARRAY['LA','TH','EU','US']),
  notes = 'Pi Mai - Lao New Year, peak demand'
WHERE cal_date IN (
  '2026-04-13','2026-04-14','2026-04-15',
  '2027-04-13','2027-04-14','2027-04-15',
  '2028-04-13','2028-04-14','2028-04-15'
);

UPDATE revenue.demand_calendar SET
  events = array_append(events, 'pi_mai_shoulder'),
  event_score = GREATEST(event_score, 75),
  is_lp_peak = true,
  season = 'high'
WHERE cal_date IN (
  '2026-04-11','2026-04-12','2026-04-16','2026-04-17',
  '2027-04-11','2027-04-12','2027-04-16','2027-04-17',
  '2028-04-11','2028-04-12','2028-04-16','2028-04-17'
);

-- Boun Ok Phansa (end of Buddhist Lent, lantern festival in LP) - approximate dates
UPDATE revenue.demand_calendar SET
  events = array_append(events, 'boun_ok_phansa'),
  event_score = GREATEST(event_score, 90),
  is_lp_peak = true
WHERE cal_date IN (
  '2026-10-26','2026-10-27',  -- approx
  '2027-10-15','2027-10-16',
  '2028-11-02','2028-11-03'
);

-- That Luang Festival (November)
UPDATE revenue.demand_calendar SET
  events = array_append(events, 'that_luang'),
  event_score = GREATEST(event_score, 70)
WHERE cal_date IN (
  '2026-11-23','2026-11-24','2026-11-25',
  '2027-11-12','2027-11-13','2027-11-14',
  '2028-10-31','2028-11-01','2028-11-02'
);

-- ============================================================
-- WESTERN HIGH-DEMAND PERIODS
-- ============================================================

-- Christmas/NYE — peak for EU/US/AU markets
UPDATE revenue.demand_calendar SET
  events = array_append(events, 'xmas_nye'),
  event_score = GREATEST(event_score, 100),
  is_lp_peak = true,
  season = 'high',
  source_markets = array_cat(source_markets, ARRAY['EU','US','AU','GB'])
WHERE (cal_date BETWEEN '2026-12-22' AND '2027-01-04')
   OR (cal_date BETWEEN '2027-12-22' AND '2028-01-04')
   OR (cal_date BETWEEN '2028-12-22' AND '2029-01-04')
   OR (cal_date BETWEEN '2026-01-01' AND '2026-01-04');  -- catch early 2026

-- Easter weekends (approximate — major dates)
UPDATE revenue.demand_calendar SET
  events = array_append(events, 'easter'),
  event_score = GREATEST(event_score, 70),
  source_markets = array_cat(source_markets, ARRAY['EU','GB','US'])
WHERE cal_date IN (
  -- 2026: Apr 5
  '2026-04-03','2026-04-04','2026-04-05','2026-04-06',
  -- 2027: Mar 28
  '2027-03-26','2027-03-27','2027-03-28','2027-03-29',
  -- 2028: Apr 16
  '2028-04-14','2028-04-15','2028-04-16','2028-04-17'
);

-- US/EU summer holiday peak (Jul-Aug)
UPDATE revenue.demand_calendar SET
  events = array_append(events, 'summer_peak'),
  event_score = GREATEST(event_score, 60),
  season = 'high',
  source_markets = array_cat(source_markets, ARRAY['EU','US','AU'])
WHERE EXTRACT(MONTH FROM cal_date) IN (7, 8);

-- ============================================================
-- ASIAN MARKETS
-- ============================================================

-- Chinese New Year — major for CN/SG/MY/TH source markets
UPDATE revenue.demand_calendar SET
  events = array_append(events, 'chinese_ny'),
  event_score = GREATEST(event_score, 95),
  is_lp_peak = true,
  source_markets = array_cat(source_markets, ARRAY['CN','SG','MY','TH','HK'])
WHERE cal_date IN (
  -- 2026: Feb 17
  '2026-02-15','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-02-21',
  -- 2027: Feb 6
  '2027-02-04','2027-02-05','2027-02-06','2027-02-07','2027-02-08','2027-02-09','2027-02-10',
  -- 2028: Jan 26
  '2028-01-24','2028-01-25','2028-01-26','2028-01-27','2028-01-28','2028-01-29','2028-01-30'
);

-- Songkran (TH) — coincides with Pi Mai but TH market driver
UPDATE revenue.demand_calendar SET
  events = array_append(events, 'songkran'),
  event_score = GREATEST(event_score, 85),
  source_markets = array_cat(source_markets, ARRAY['TH'])
WHERE EXTRACT(MONTH FROM cal_date) = 4 AND EXTRACT(DAY FROM cal_date) BETWEEN 13 AND 15;

-- Vesak (Buddhist new year - approximate full moon May)
UPDATE revenue.demand_calendar SET
  events = array_append(events, 'vesak'),
  event_score = GREATEST(event_score, 65),
  source_markets = array_cat(source_markets, ARRAY['TH','LK','MM'])
WHERE cal_date IN ('2026-05-22','2027-05-11','2028-05-29');

-- Golden Week JP (Apr 29 - May 5)
UPDATE revenue.demand_calendar SET
  events = array_append(events, 'golden_week_jp'),
  event_score = GREATEST(event_score, 70),
  source_markets = array_cat(source_markets, ARRAY['JP'])
WHERE EXTRACT(MONTH FROM cal_date) IN (4,5) 
  AND ((EXTRACT(MONTH FROM cal_date) = 4 AND EXTRACT(DAY FROM cal_date) >= 29)
    OR (EXTRACT(MONTH FROM cal_date) = 5 AND EXTRACT(DAY FROM cal_date) <= 5));

-- ============================================================
-- LUNAR / NAMKHAN-SPECIFIC (Retreat Life series)
-- Full moons matter for The Namkhan retreat positioning
-- ============================================================
UPDATE revenue.demand_calendar SET
  events = array_append(events, 'full_moon'),
  event_score = GREATEST(event_score, 55),
  is_lunar_significant = true
WHERE cal_date IN (
  -- 2026 full moons
  '2026-01-03','2026-02-01','2026-03-03','2026-04-01','2026-05-01','2026-05-31',
  '2026-06-29','2026-07-29','2026-08-28','2026-09-26','2026-10-26','2026-11-24','2026-12-24',
  -- 2027 full moons
  '2027-01-22','2027-02-20','2027-03-22','2027-04-20','2027-05-20','2027-06-19',
  '2027-07-18','2027-08-17','2027-09-15','2027-10-15','2027-11-14','2027-12-13',
  -- 2028 full moons
  '2028-01-12','2028-02-10','2028-03-11','2028-04-09','2028-05-08','2028-06-07',
  '2028-07-06','2028-08-05','2028-09-03','2028-10-03','2028-11-02','2028-12-01','2028-12-30'
);

-- ============================================================
-- SHOULDER / LOW SEASON TAGS
-- ============================================================
UPDATE revenue.demand_calendar SET season = 'shoulder'
WHERE EXTRACT(MONTH FROM cal_date) IN (3, 4, 9, 10, 11) AND season IS NULL;

UPDATE revenue.demand_calendar SET season = 'high'
WHERE EXTRACT(MONTH FROM cal_date) IN (12, 1, 2) AND season IS NULL;

UPDATE revenue.demand_calendar SET season = 'low'
WHERE EXTRACT(MONTH FROM cal_date) IN (5, 6, 7, 8) AND season IS NULL;

-- Override: but Jul-Aug are summer-peak for EU/US so promote to shoulder
UPDATE revenue.demand_calendar SET season = 'shoulder'
WHERE EXTRACT(MONTH FROM cal_date) IN (7, 8);
