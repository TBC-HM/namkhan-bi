# Department QA & Self-Audit — design

**Date:** 2026-09-14 · **Property:** The Namkhan (260955) · **Owner:** PBS
**Status:** design approved in chat; spec awaiting PBS review

---

## 1. The problem

The Standard now holds **2,164 obligations** from 8 authorities. It is one flat list,
measured against one question — *"is there an SOP?"* — and read on one page.

Three things follow, all observed on live data 2026-09-14:

**Nobody can use one list.** A Boat crew member carries 4 obligations; a Housekeeping
attendant carries 355. The two biggest departments by headcount have no SOPs at all:

| Department | Staff | Obligations | SOPs |
|---|---|---|---|
| General Management | 0 | 456 | 1 |
| Housekeeping | 11 | 355 | 16 |
| Maintenance | 5 | 333 | 3 |
| HR | 0 | 235 | 2 |
| Admin & General | 8 | 191 | **0** |
| Restaurant Kitchen | 10 | 149 | 2 |
| Roots Service | 6 | 148 | 5 |
| Purchasing | 0 | 126 | 2 |
| Front Office | 8 | 114 | 4 |
| Farm, Garden & Building | **13** | 66 | **0** |
| Spa | 3 | 44 | 2 |
| Security | 2 | 30 | 2 |
| Finance · Sales · Activities · Boat | 5 | 42 | 2 |

There is no per-department QA surface today. The "Departments" tab in the Operations
strip points at `/operations/rooms`, which is an operational grouping, not a QA view.

**"Is there an SOP?" is the wrong question for most obligations.** Reported coverage is
12% (263 of 2,164), and that number is not a performance measure — it is a category
error. The Standard contains at least four kinds of thing:

| Mode | What actually closes it | Example |
|---|---|---|
| `procedure` | an SOP someone follows | "AC filter clean (per room)" |
| `rule` | a standing constraint, trained not written | "Shall not misuse the certification logo" |
| `evidence` | proof held on file | "SLH logo was displayed on the hotel's own website" |
| `observation` | an inspector's verdict on an outcome | "You felt safe and secure at all times" |

Demanding an SOP for *"you felt safe"* cannot succeed. Splitting the modes turns one
misleading number into four honest ones.

**The audit loop does not turn.** `knowledge.qa_audits` holds 8 rows, all one visit
(SLH, 2026-08-19, 94.4% weighted). PM completion is 0.0% of 62. Certifications held: 0
against 76.5 FTE required. 30 findings open, 0 ever closed. Nothing recurring runs.

## 2. Decisions taken (PBS, 2026-09-14)

| Question | Decision |
|---|---|
| What is a self-audit made of? | **Rehearsals of the real standards** — drawn from the 2,164 obligations, so a self-audit score predicts the real inspection |
| How is one run? | **Phone, tap-through web page** — one question per screen, not telephony |
| What makes the cycle turn? | **Reuse `ops.task_catalog`** — the generator that already produces 632 PM instances |
| How deep do SLH analytics go? | **Section-level now**, re-ingest per-question later when PBS supplies the PDFs |
| Who classifies discharge mode? | **Auto-seed deterministically, HoD edits in place** |

Standing requirement from PBS: **every list is editable in place.** Seeded values are a
starting point, never canon.

## 3. Scope

### Part A — Discharge mode

Add `discharge_mode` to `standards.atoms`, one of `procedure` / `rule` / `evidence` /
`observation`, plus `mode_source` (`seeded` | `edited`) so a HoD's correction is never
overwritten by a re-seed.

Seeding is deterministic — no AI spend, instant, reversible:

- authority `SLH` + source is a mystery inspection + past-tense wording → `observation`
- authority `Sustainability`, `GSTC`, `Travelife`, `ASEAN` where the requirement asks
  for a document, policy, register or certificate → `evidence`
- category `brand`, and `commercial` obligations phrased as prohibitions → `rule`
- category `service`, `cleanliness`, `service_operations`, authority `PM` → `procedure`
- anything unmatched → `procedure` (the mode that asks the most; safest default)

Expected accuracy ~85-90%. The remainder is corrected by HoDs on their own page.

Coverage is then reported per mode, and each mode reads a **different existing store**:

| Mode | "Covered" means | Read from | State today |
|---|---|---|---|
| `procedure` | an active SOP names it | `standards.sop_coverage` | works — 263 covered |
| `evidence` | proof on file and in date | `ops.sustainability_evidence` (83 rows) | partial — covers sustainability only |
| `rule` | named in a current training record | **nothing exists** | see below |
| `observation` | never "covered" — scored by audit | `knowledge.qa_audits` | works — 8 sections |

**`rule` coverage cannot be computed at build time.** There is no training store: 0
training records, and no training UI anywhere on the platform. Until one exists, `rule`
obligations render as a read-only trained list with **no coverage claim at all** — not a
0%, which would read as failure, and not a 100%, which would be a lie. Building the
training store is explicitly out of scope here and should be its own brief.

### Part B — Department QA page

`/h/[property_id]/operations/quality/[dept]` — one per department, the single door for
HoD and staff. Five blocks:

1. **Who we are** — people, HoD, skills, certifications held vs required
2. **What we must do** — obligations grouped by discharge mode, never one flat list.
   Procedures show their SOP or an *Activate* CTA; evidence shows what is held and what
   is missing; rules read as a short trained list; observations link to the audit that
   judges them
3. **How we scored** — this department's SLH section, self-audit history, guest rating
4. **What's open** — findings, overdue reviews, past-due tasks
5. **Run an audit** — CTA into the phone walk-through

Every row is editable in place by the HoD: set mode, re-word into staff language,
assign an owner, attach or write the SOP, mark evidence held.

The existing `/operations/standard` page becomes the cross-department roll-up; the
department page is where work happens.

### Part C — Self-audit engine

Four new tables in `ops`:

- `audit_templates` — code, name, property, department, source authority, cadence, active
- `audit_template_questions` — ordered; each points at a `standards.atoms` row, with
  `prompt_override` (staff wording) and `weight`
- `audit_runs` — one per performance: template, task instance, who, started, completed, score
- `audit_answers` — one per question: `yes` / `no` / `na`, note, optional photo

Cycle: each template gets an `ops.task_catalog` row with its interval; the existing
generator creates due instances. Starting an audit from a due instance links the run;
completing the run closes the instance. Due dates, past-due and assignment come free.

Run surface: `/h/[property_id]/operations/audits/run/[run_id]`, mobile-first. One
question per screen, large Yes / No / N-A, optional note and photo, progress bar, each
answer saved as it is tapped. A **No** writes a `knowledge.qa_findings` row against the
department, reusing the CAPA loop that exists.

Audit answers write a **last-verified date** onto the obligation — the thing an
inspector asks for and that no page currently holds.

**First build is three templates, not ten**, so PBS can run one on a phone and reject
the shape before nine more are made.

### Part D — SLH analytics

On the department page (its own section) and rolled up on the Standard page: the 8
sections weighted to 94.4%, the pool-deck outlier at 79.3% against the SLH 80% fail
line, top misses, each section drilling into the obligations and SOPs behind it.

Year-over-year and question-level drill-down are **designed for but not built** — they
require data that does not exist yet (see Risks).

## 4. Out of scope

- Telephony / voice agent (explicitly rejected in favour of the phone web page)
- Lao translation of SOPs and obligations (see Risks)
- Re-ingesting SLH per-question scores (blocked on PBS supplying the PDFs)
- The other 7 audit templates beyond the first 3
- Changes to `/operations/sops` viewer/editor routes

## 5. Risks and honest limits

**Lao is missing.** 0 of 78 SOPs are in Lao, at a property in Luang Prabang. A surface
"easy for staff to navigate" is not achievable in English alone for the 13 grounds staff
or the housekeeping team. Schema supports it — `sop_content.language`,
`requirements` are per-row — but the content does not exist. This is a translation
programme, not a UI change, and the page will be HoD-usable before it is staff-usable.

**SLH question-level data was never stored.** `qa_audits.raw` is `{}` on all 8 rows;
only section totals and a prose `top_miss` were kept. The 338 SLH 2026 questions are in
`standards.requirements` but their per-question scores are not anywhere. Question-level
analytics is impossible until the report is re-ingested.

**The 2025 SLH report is absent.** It exists only as an empty `standards.sources` row —
0 requirements, 0 audit rows. Year-over-year is impossible until it is loaded.

**Seeded classification will be wrong somewhere.** ~10-15% by design. Mitigated by
`mode_source` so HoD corrections survive re-seeding, and by defaulting unmatched rows to
`procedure`, the mode that asks the most rather than the least.

**Departments with zero staff carry obligations.** GM (456), HR (235), Purchasing (126),
Finance (16), Sales & Marketing (12) have no one in the staff register. Those pages will
render with an empty "who we are" block. That is truthful — those obligations sit with
PBS and management — but it should not read as an error.

## 6. Build order

Each slice ships and is verifiable on its own.

1. **Discharge mode** — column, seeder, per-mode coverage in `fn_standards_payload`.
   Verifiable: three honest coverage numbers plus one explicit "not measurable yet"
   replace one misleading number. `rule` shows no percentage until a training store exists.
2. **Department QA page, read-only** — the five blocks, no editing.
   Verifiable: open Housekeeping, see 355 obligations grouped by mode, 11 staff, 93.9%.
3. **Edit in place** — mode, wording, owner, evidence-held.
   Verifiable: a HoD correction persists and survives a re-seed.
4. **Audit engine** — tables, 3 seeded templates, `task_catalog` wiring.
   Verifiable: an audit becomes due and appears on the department page.
5. **Phone run surface** — walk-through, answers, findings on No, last-verified write.
   Verifiable: PBS runs one on a phone end to end.
6. **SLH analytics section** — section scores, outlier, drill-through.
   Verifiable: the 94.4% and its 8 sections read correctly against the source report.

## 7. Governance

- New tables → `ops` schema, Supabase MCP `apply_migration`, discover-before-create (L3)
- Every new `public.v_*` / `fn_*` bridge: `REVOKE ALL FROM anon`, GRANT
  `authenticated, service_role` (ADR-277 / L5)
- Every API route touching these: `requirePropertyAccess()`, no `property_id` default (L22)
- `/h/[property_id]/...` canonical URLs (L6)
- Nav changes to `lib/nav-subgroups.ts` are a protected path — needs its own
  `governance.protected_path_decisions` row, decided by PBS, per change
