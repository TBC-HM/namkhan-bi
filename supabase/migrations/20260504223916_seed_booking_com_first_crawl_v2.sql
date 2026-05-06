-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504223916
-- Name:    seed_booking_com_first_crawl_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

DO $$
DECLARE
  v_crawl_id uuid := gen_random_uuid();
  v_search_score numeric;
  v_search_score_max numeric;
  v_review_score numeric;
  v_area_review numeric;
  v_cancel_pct numeric;
  v_area_cancel numeric;
  v_conversion numeric;
  v_better_than numeric;
BEGIN
  SELECT search_score, search_score_max, review_score, area_avg_review_score,
         cancel_pct, area_avg_cancel_pct, conversion_pct, better_than_pct_in_city
    INTO v_search_score, v_search_score_max, v_review_score, v_area_review,
         v_cancel_pct, v_area_cancel, v_conversion, v_better_than
  FROM revenue.bdc_ranking_snapshot_v2
  ORDER BY snapshot_date DESC LIMIT 1;

  INSERT INTO revenue.profile_crawls (id, ota_source, page_url, crawl_date, status, parser_version, scores, notes)
  VALUES (
    v_crawl_id, 'Booking.com',
    'https://www.booking.com/hotel/la/the-namkhan.html',
    now(), 'parsed', 'v0-seed-from-bdc-ranking',
    jsonb_build_object(
      'search_score', v_search_score, 'search_score_max', v_search_score_max,
      'review_score', v_review_score, 'area_avg_review_score', v_area_review,
      'cancel_pct', v_cancel_pct, 'area_avg_cancel_pct', v_area_cancel,
      'conversion_pct', v_conversion, 'better_than_pct_in_city', v_better_than
    ),
    'First crawl synthesized from existing BDC Ranking PDF (snapshot 2026-05-04). Real Nimble scrape pending.'
  );

  IF v_search_score IS NOT NULL AND v_search_score_max IS NOT NULL AND v_search_score < v_search_score_max * 0.4 THEN
    INSERT INTO revenue.profile_recommendations (crawl_id, ota_source, category, severity, title, evidence, recommendation, expected_impact, metric_to_watch, baseline_value, measure_after) VALUES (
      v_crawl_id, 'Booking.com', 'content_completeness', 'warn',
      format('Search score %s/%s — 84%% of city beat us on completeness', v_search_score::int, v_search_score_max::int),
      format('Score components: profile content (photos, description, amenities), review responses, cancel rate. We are at %s/%s. Score is what BDC uses to rank us in search.', v_search_score::int, v_search_score_max::int),
      'Open BDC Extranet → Performance → Score booster. Work through every checklist item: amenity completeness, photo count + tags, room descriptions in 4+ languages, response rate to reviews. Goal: +50 score points within 60 days.',
      '+ranking position in search · indirectly +conversion',
      'search_score', v_search_score, now() + INTERVAL '14 days'
    );
  END IF;

  IF v_cancel_pct IS NOT NULL AND v_area_cancel IS NOT NULL AND v_cancel_pct - v_area_cancel >= 5 THEN
    INSERT INTO revenue.profile_recommendations (crawl_id, ota_source, category, severity, title, evidence, recommendation, expected_impact, metric_to_watch, baseline_value, measure_after) VALUES (
      v_crawl_id, 'Booking.com', 'policies', 'critical',
      format('Cancel rate %s%% vs area avg %s%% — direct ranking penalty', v_cancel_pct::text, v_area_cancel::text),
      'BDC weights cancel rate as a ranking signal. Properties with cancel above area average get pushed down in search results AND lose visibility in Genius placements.',
      'Tighten the highest-leverage lead-time bucket (use the Lead-time panel on Now tab). Add deposit-on-book for 60+ day bookings. Test non-refundable rate fence on long-lead.',
      '−2pp cancel rate · +1-3 ranking positions',
      'cancel_pct', v_cancel_pct, now() + INTERVAL '14 days'
    );
  END IF;

  IF v_review_score IS NOT NULL AND v_area_review IS NOT NULL AND v_review_score - v_area_review >= 0.5 THEN
    INSERT INTO revenue.profile_recommendations (crawl_id, ota_source, category, severity, title, evidence, recommendation, expected_impact, metric_to_watch, baseline_value) VALUES (
      v_crawl_id, 'Booking.com', 'review_management', 'positive',
      format('Review score %s vs area %s — moat to protect', v_review_score::text, v_area_review::text),
      'Review score is the single strongest pricing lever on BDC. Above 9.0 unlocks visibility boost and ADR justification. Below 9.0 ranking penalty kicks in.',
      'Reply to every review (response rate is a separate ranking signal). Push score badge in property description. Address any single negative review same-day.',
      'maintain ADR premium · prevent score erosion',
      'review_score', v_review_score
    );
  END IF;

  IF v_conversion IS NOT NULL AND v_conversion < 0.30 THEN
    INSERT INTO revenue.profile_recommendations (crawl_id, ota_source, category, severity, title, evidence, recommendation, expected_impact, metric_to_watch, baseline_value, measure_after) VALUES (
      v_crawl_id, 'Booking.com', 'photos', 'warn',
      format('Page-to-book conversion %s%% — visitors arrive but do not commit', v_conversion::text),
      'When visitors reach the property page but do not book, the typical leak is photos, description, price perception, or cancel policy. We need profile-content audit.',
      'Audit photo gallery: count, hero shot quality, room interiors with people, food + experience shots. Re-write description leading with the differentiator (river, glamping, Soho House aesthetic). Test rate fences vs straight BAR.',
      '+0.05-0.10pp conversion · +5-10 bookings/month',
      'conversion_pct', v_conversion, now() + INTERVAL '14 days'
    );
  END IF;

  INSERT INTO revenue.profile_recommendations (crawl_id, ota_source, category, severity, title, evidence, recommendation, expected_impact, metric_to_watch) VALUES (
    v_crawl_id, 'Booking.com', 'content_completeness', 'info',
    'First-pass profile audit pending (Nimble scraper not yet wired)',
    'This crawl was synthesized from the BDC ranking PDF. The next crawl will scrape the live property page (photos count, description length, amenities checklist, response rate, sustainability badge) and generate richer recommendations.',
    'Schedule the Nimble + LLM crawler Edge Function. URL is set on this crawl. Cron weekly.',
    'unblocks profile-content-driven recommendations',
    NULL
  );
END $$;