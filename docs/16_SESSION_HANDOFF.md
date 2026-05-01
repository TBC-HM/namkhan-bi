# 16 · Session Handoff — Backlog (F1–F11 / E1–E8 / D1–D5)

**Status:** ⚠ STUB — full content not yet imported into the repo as of 2026-05-01.

The handover doc `COWORK_HANDOFF_2026-05-01.md` (root of repo) refers to F1–F11, E1–E8, and D1–D5 items as living in this file. The source material currently lives in **Claude project knowledge** and was not exported to the repo when the colon-named arch file was dropped at the root. This stub exists so that:

1. Cross-references from `15_SUPABASE_ARCHITECTURE.md` and the README do not 404.
2. The GitHub Issue automation in `COWORK_HANDOVER` §4.8 has a target file for issue bodies.

## What this file should contain (when populated)

### Critical (F-series — frontend / platform work owned in-repo)

| ID | Title | Owner | Source label |
|---|---|---|---|
| F1 | Edge Function `agent-runner` | backend | `backend` `priority:high` |
| F2 | v9 frontend → Vercel/Next.js routes | frontend | `frontend` `priority:high` |
| F3 | Proposal approval queue UI | frontend | `frontend` `priority:high` |
| F4 | Per-page RLS tightening | data | `data-quality` `priority:med` |
| F5 | Custom SMTP (Resend / Postmark) | auth | `auth` `priority:med` |
| F6 | Owner 2FA (TOTP) | auth | `auth` `priority:med` |
| F7 | Service-role key lockdown before production | security | `security` `priority:high` |
| F8 | Enable Supabase Auth providers | auth | `auth` `priority:med` |
| F9 | Site URL + redirect whitelist | auth | `auth` `priority:med` |
| F10 | Per-bucket retention policy | compliance | `compliance` `priority:low` |
| F11 | Backup snapshot before next migration | ops | `ops` `priority:low` |

### External (E-series — depends on third-party access)

| ID | Title | Source label |
|---|---|---|
| E1 | Bank integration | `integration` `blocked` |
| E2 | QuickBooks integration | `integration` `blocked` |
| E3 | Poster (POS) integration | `integration` `blocked` |
| E4 | DocuSign integration | `integration` `blocked` |
| E5 | Reviews integration (TripAdvisor / Booking / Google) | `integration` `blocked` |
| E6 | Gmail integration | `integration` `blocked` |
| E7 | Compliance PDFs upload with `valid_until` | `compliance` `blocked` |
| E8 | Anthropic API key in Supabase Vault | `secrets` `priority:high` |

### Defer (D-series — flagged, not yet scoped)

| ID | Title |
|---|---|
| D1 | (TBD — pull from project knowledge) |
| D2 | (TBD — pull from project knowledge) |
| D3 | (TBD — pull from project knowledge) |
| D4 | (TBD — pull from project knowledge) |
| D5 | (TBD — pull from project knowledge) |

## How to populate this file

1. Open the Claude project knowledge entry titled `16_SESSION_HANDOFF.md`.
2. Copy the full content (Critical / Important / External / Defer sections) **verbatim** into this file, replacing the stub.
3. Keep the table headers in §4.8 of `COWORK_HANDOFF_2026-05-01.md` — they map labels onto issue creation.

## Why this is a stub

The handover doc named this file as a deliverable and assumed its content was already in `/docs/`. It is not. Rather than fabricate content (per handover §11 — "surface, not silently resolve"), this stub flags the gap and links forward to the canonical source. The repo owner must paste in the real text before `16_SESSION_HANDOFF.md` is referenced from any GitHub Issue body.

---

*Last updated: 2026-05-01 · Status: stub awaiting content import*
