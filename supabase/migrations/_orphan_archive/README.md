# Orphan migration archive — moved 2026-05-06

These 38 `.sql` files were on disk in `supabase/migrations/` but **never applied to production**. Verified against `supabase_migrations.schema_migrations` (all 38 versions absent from the DB tracking table) and against the live schema (`ops.room_status`, the table the first orphan creates, does not exist in prod).

They were planned but never run, possibly drafted by an earlier session. Moving them out of the active migrations folder unblocks `supabase db pull` and the promotion pipeline.

## What's in here

| Pattern | Count | Likely intent |
|---|---|---|
| `2026043012000XXX_*.sql` | 16 | Operations module schemas (room_status, hk_assignments, vendors, maintenance_tickets, assets, etc.) |
| `20260502230XXX_*.sql` | 12 | Sales / B2B / inquiries planned schema |
| `20260503090XXX_*.sql`, `20260503180001_*.sql`, `20260503190000_*.sql`, `20260503190100_*.sql` | 9 | Marketing library + DMC contracts planned schema |
| `20260505000001_*.sql` | 1 | Standalone planned migration |

## Recovery path

If you decide any of these schemas IS still wanted:

1. Read the `.sql` file
2. Rename with a fresh timestamp (`date +%Y%m%d%H%M%S`)
3. Move back into `supabase/migrations/`
4. Run `npx supabase db push --linked` to apply
5. Verify the table/object actually got created

## Why archived not deleted

Per repo policy (no hard deletes for governance content), keeping them as historical drafts. Future Architect / api_specialist may want to mine them when designing related features.

## Source of truth

Production schema is canonical. Anything not in `supabase_migrations.schema_migrations` was never deployed — these files are drafts only.
