-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503171125
-- Name:    marketing_calendar_views
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- VIEW: upcoming events for marketing planning
-- "What's 30-90 days out that needs campaign work?"
-- ============================================================
CREATE OR REPLACE VIEW marketing.upcoming_events AS
SELECT 
  e.event_id,
  e.display_name,
  e.type_code,
  t.display_name AS type_display,
  t.category,
  e.date_start,
  e.date_end,
  e.buildup_start,
  (e.date_start - CURRENT_DATE) AS days_until_event,
  (e.buildup_start - CURRENT_DATE) AS days_until_buildup,
  CASE 
    WHEN CURRENT_DATE >= e.date_start AND CURRENT_DATE <= e.date_end THEN 'live'
    WHEN CURRENT_DATE >= e.buildup_start THEN 'buildup_active'
    WHEN (e.buildup_start - CURRENT_DATE) <= 30 THEN 'buildup_imminent'
    WHEN (e.buildup_start - CURRENT_DATE) <= 90 THEN 'on_horizon'
    ELSE 'far_future'
  END AS status,
  COALESCE(e.demand_score_override, t.default_demand_score) AS demand_score,
  e.source_markets,
  e.applies_to_marketing,
  e.applies_to_content,
  e.applies_to_fnb,
  e.applies_to_retreat,
  e.marketing_brief,
  e.hashtags,
  -- Has a campaign been scheduled?
  EXISTS (
    SELECT 1 FROM marketing.campaigns c
    WHERE c.scheduled_at::date BETWEEN e.buildup_start AND e.date_end
  ) AS has_campaign_scheduled
FROM marketing.calendar_events e
JOIN marketing.calendar_event_types t ON t.type_code = e.type_code
WHERE e.date_end >= CURRENT_DATE
ORDER BY e.date_start;

COMMENT ON VIEW marketing.upcoming_events IS 'Marketing planning view. Shows events with status flags for campaign scheduling. Used by marketing tab in namkhan-bi and by content GPTs.';

-- ============================================================
-- VIEW: events needing campaign attention right now
-- ============================================================
CREATE OR REPLACE VIEW marketing.events_needing_attention AS
SELECT *
FROM marketing.upcoming_events
WHERE status IN ('buildup_imminent', 'buildup_active')
  AND applies_to_marketing = true
  AND has_campaign_scheduled = false
ORDER BY days_until_event;

COMMENT ON VIEW marketing.events_needing_attention IS 'Events in buildup window with no campaign scheduled. Drives marketing dashboard alerts.';

-- ============================================================
-- VIEW: content drop schedule (for Grace YouTube etc)
-- ============================================================
CREATE OR REPLACE VIEW marketing.content_drop_schedule AS
SELECT 
  e.event_id,
  e.display_name,
  e.date_start AS event_date,
  e.date_start - INTERVAL '7 days' AS suggested_video_drop,
  e.buildup_start AS suggested_teaser_start,
  e.type_code,
  e.marketing_brief,
  e.hashtags
FROM marketing.calendar_events e
WHERE e.applies_to_content = true
  AND e.date_end >= CURRENT_DATE
ORDER BY e.date_start;

COMMENT ON VIEW marketing.content_drop_schedule IS 'Suggested video/content drop dates for Namkhan content GPTs (Grace, Script Builder).';

-- ============================================================
-- VIEW: aggregate calendar for dashboards
-- ============================================================
CREATE OR REPLACE VIEW marketing.calendar_overview AS
SELECT 
  e.date_start,
  e.date_end,
  e.display_name,
  t.category,
  t.display_name AS event_type,
  COALESCE(e.demand_score_override, t.default_demand_score) AS demand_score,
  e.source_markets,
  -- Use case flags as a comma list for compact display
  ARRAY_TO_STRING(
    ARRAY_REMOVE(ARRAY[
      CASE WHEN e.applies_to_rate_shop THEN 'rate' END,
      CASE WHEN e.applies_to_marketing THEN 'mkt' END,
      CASE WHEN e.applies_to_content THEN 'content' END,
      CASE WHEN e.applies_to_fnb THEN 'fnb' END,
      CASE WHEN e.applies_to_retreat THEN 'retreat' END
    ], NULL),
    ', '
  ) AS use_cases
FROM marketing.calendar_events e
JOIN marketing.calendar_event_types t ON t.type_code = e.type_code
ORDER BY e.date_start;
