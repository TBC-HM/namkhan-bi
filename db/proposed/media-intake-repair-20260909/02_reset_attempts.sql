-- ITEM 1b · Refund the attempts burned by the broken endpoint.
-- RUN ONLY AFTER 01 IS APPLIED AND A RENDER IS CONFIRMED — otherwise these
-- 3,115 assets are simply re-burned within ~8 days.
-- Note: this restamps updated_at on 3,115 rows (trg_media_assets_updated),
-- which destroys the "last touched" forensic signal. Accepted.
-- Trigger safety verified: no trigger on media_assets fires on render_attempts,
-- and media_auto_promote_ready only fires WHEN new.status='ingested' (these are 'ready').

UPDATE media.media_assets
   SET render_attempts = 0
 WHERE COALESCE(render_attempts,0) >= 3
   AND asset_type::text = 'photo';
-- expected: 3115 rows (2560 property 1000001 + 555 property 260955)
