-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260506181217
-- Name:    cockpit_ticket_media_pipeline_marketing
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Cockpit ticket: media (photo/raw/video) pipeline + marketing-department workflow.
-- Source: PBS via Cowork chat 2026-05-06. 48h revisit.
-- Author: PBS via Claude (Cowork) · 2026-05-06.

INSERT INTO public.cockpit_tickets (
  source, arm, intent, status,
  email_subject, parsed_summary, notes
) VALUES (
  'cowork_chat',
  'dev',
  'decide',
  'awaits_user',
  '[cockpit] Media pipeline — photo RAW + video footage handling for marketing dept',
  $SUMMARY$
MEDIA PIPELINE FOR MARKETING DEPT — design + build.

Technical scope (deliverable: a reproducible media handling flow):

1. Storage tier
   - RAW photos (CR3, ARW, NEF, DNG) — large files, infrequent access, archival
   - Edited / web-ready photos (JPG, WebP, AVIF) — fast access, public-readable
   - Video footage (MP4, MOV, raw 4K/8K) — large, expensive egress
   - Recommend: hot tier = Supabase Storage + Cloudflare CDN; cold tier = Backblaze B2 ($0.005/GB/mo) for RAW + masters
   - Decision: per-property bucket (namkhan-media, donna-media) or single bucket with prefix

2. Ingest workflow (Make.com or direct upload)
   - Source → photographer / videographer dropbox / local Lightroom export
   - Trigger: webhook to /api/marketing/media/ingest
   - Auto-tagging: location (Namkhan / Donna), shoot date, photographer, asset type (room / food / experience / drone / event), brand approval status (pending → approved → archived)
   - Auto-thumbnail + sized variants (1024 / 2048 / orig) for web

3. Catalog + database
   - settings.media_assets (id, bucket, path, type, size, taken_at, photographer, tags[], approval_status, used_in[], retention_until)
   - Search + filter via /marketing/library (already exists per KB id 24)
   - Track usage: which OTAs / website pages / social posts use which asset

4. Approval flow
   - Photographer uploads → status=pending
   - Marketing reviews in /marketing/library → approve / reject / request edit
   - Approved assets get signed-URL access for OTAs + website + social

5. Marketing department setup (PREREQUISITE)
   - Today only IT department exists in cockpit_departments
   - Need create_department call: marketing dept with chief + 3-4 worker agents
   - Worker roles: media_lead (raw/edit), copy_lead (captions/blog), social_lead (posts/calendar), seo_lead (site/meta)
   - Standing tasks: weekly content calendar, monthly OTA refresh, quarterly brand audit

Owner action expected:
- IT Manager (Captain Kit) revisit in 48h with phased plan
- Phase 0 = spawn marketing department (depends on PBS approving department spec)
- Phase 1 = Storage tier + ingest webhook + media_assets table
- Phase 2 = /marketing/library upgrades (auto-tag, approval flow, search)
- Phase 3 = Cold-tier RAW archival + retention policy

Open questions:
- Photographer / videographer headcount? (changes ingest UX)
- Existing photo library — where is it now? Drive / external HDD / hotel server?
- Donna scope — same flow or separate buckets per property?
- Budget tolerance — Backblaze ($1-5/mo) vs S3 ($5-15/mo) vs Supabase Storage only ($0.021/GB)?
- Video editing — keep in DaVinci/Premiere local, or build a review pipeline in cockpit?
- Brand-rights metadata — model releases, location releases, music licenses?
$SUMMARY$,
  'Park until 2026-05-08. IT Manager (it_manager) owns the revisit. Linked decisions: requires marketing department spawn (currently only IT exists). Companion ticket #21 (user roles + SSO) — both blocking external collaborators.'
);

-- Confirm
SELECT id, status, email_subject, created_at FROM public.cockpit_tickets WHERE email_subject LIKE '%Media pipeline%' ORDER BY id DESC LIMIT 1;