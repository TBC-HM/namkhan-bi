# Media QA v2 — 2026-07-14

## SQL migrations
- `media.media_assets` + `is_hotel_property`, `category`, `sub_category`, `seo_title_text`, `seo_target_filename`
- `public.v_marketing_media_page` extended (property_id + gps_lat/lng + 5 new cols) via drop-cascade + recreate
- `marketing.fn_qa_stats(period,tier)` + `public.fn_qa_stats` wrapper
- `marketing.fn_flag_below_threshold(tier,create_subticket)` + `public.fn_flag_below_threshold` wrapper
- `public.fn_media_asset_qa_score_v2(...)` — sibling of v1 that also writes hotel-property + category + SEO fields and hard-routes non-hotel to `status='qc_failed'`
- `cockpit_agent_prompts` — Iris + Íride v2 activated, v1 archived

## Edge fn
- `media-qa-score` v6 — loads active persona from cockpit_agent_prompts, adds 5th classify+SEO prompt, calls fn_media_asset_qa_score_v2

## API routes
- `POST /api/marketing/media/qa-score` — score_asset skill
- `POST /api/marketing/media/qa-score-batch` — score_batch skill
- `POST /api/marketing/media/guardrails/lint` — enforce_guardrails skill
- `POST /api/marketing/media/asset-qa-save` — manual slider save
- `GET  /api/marketing/media/qa-stats?period=30d&tier=…` — query_qa_stats skill
- `GET  /api/marketing/media/download-webp?asset_id=…&channel=web_hero` — WebP + EXIF GPS

## UI
- `AssetEditDrawer` — 3 sliders + Composite live + Save Scores + Rescore with Iris

## Notes
- quality_index generated column already at (0.4, 0.3, 0.3) — task 3.1 no-op
- Non-hotel routing = `status='qc_failed'` (bridge view drops it), not quality_index override
- WebP GPS: sharp `.withExif()` best-effort; `X-Namkhan-GPS` response header exposes state
