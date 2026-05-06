-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503184308
-- Name:    flag_rules_room_dimension
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Allow 'rooms' as a valid dimension
ALTER TABLE revenue.flag_rules DROP CONSTRAINT IF EXISTS flag_rules_dimension_check;
ALTER TABLE revenue.flag_rules ADD CONSTRAINT flag_rules_dimension_check 
  CHECK (dimension IN ('rate','rate_plan','promo','ranking','reviews','window','los','self','rooms'));

-- Add the 3 room-dimension rules
INSERT INTO revenue.flag_rules (rule_code, display_name, dimension, description, 
  threshold_type, threshold_value, threshold_value_2, baseline_window_days,
  severity_default, escalate_on_event, suggested_action, action_text) VALUES

('room_new_type_appears', 'New room type at competitor', 'rooms',
  'A room name appeared in scrape that has not been seen at this competitor in the last 30 days. May indicate inventory expansion or rebrand.',
  'transition', NULL, NULL, 30,
  'low', false, 'monitor',
  'Update room mapping if relevant. Check if this changes their target-room positioning vs ours.'),

('room_sold_out_streak', 'Comp room sold out 5+ days', 'rooms',
  'Specific room type at competitor shows no availability for 5+ consecutive shop dates. Suggests strong pickup or inventory restriction.',
  'transition', 5, NULL, 14,
  'medium', true, 'investigate',
  'Strong pickup signal. Check our pace on equivalent room. Consider rate increase if our pickup matches.'),

('room_mapping_broken', 'Room mapping appears broken', 'rooms',
  'Mapped competitor room name not seen in last 7 shop dates despite successful scrapes. Mapping likely stale.',
  'transition', 7, NULL, 7,
  'high', false, 'investigate',
  'Fix mapping in /revenue/compset competitor expand view. Without mapping, target-room comparison is invalid.')

ON CONFLICT (rule_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  threshold_value = EXCLUDED.threshold_value,
  severity_default = EXCLUDED.severity_default,
  suggested_action = EXCLUDED.suggested_action,
  action_text = EXCLUDED.action_text,
  updated_at = NOW();
