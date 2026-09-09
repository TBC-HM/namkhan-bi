-- ITEM 3 (option A) · Align the advertised ladder to the one the code applies.
-- media-qa-score tierFromScores() uses 90/80/70/60/40 (== media.qc_score_bands).
-- marketing.media_tier_thresholds advertised 75/75/70/50/25 and is the text shown
-- to the model in the guardrails block. The model was told one ladder, the code
-- applied another. Blast radius verified as text-only: the table's other two
-- readers (marketing.classify_pre_gemini, marketing.fn_flag_below_threshold) are
-- orphans — no function, trigger or cron calls either.
-- Nothing re-tiers: auto_tier only applies where primary_tier IS NULL.

UPDATE marketing.media_tier_thresholds t
   SET min_quality_index = v.q, updated_at = now()
  FROM (VALUES ('tier_website_hero',90), ('tier_ota_profile',80),
               ('tier_social_pool',70),  ('tier_internal',60),
               ('tier_archive',40)) AS v(tier,q)
 WHERE t.tier::text = v.tier;

-- ITEM 4 · Activate Iris v3 (Namkhan).
-- v3 was written 2026-08-23 alongside Iride v1-v5 and the v10 edge deploy; the
-- activation flip was missed, so all three Namkhan versions sit active=false and
-- media-qa-score falls back to a one-line generic system prompt for Namkhan.
-- Safe under uq_cockpit_agent_prompts_role_active (partial unique WHERE active):
-- no row is currently active for this role, so there is nothing to deactivate.

UPDATE cockpit.cap_prompts
   SET active = true, updated_at = now()
 WHERE role = 'mkt_qa_photo' AND version = 3;
