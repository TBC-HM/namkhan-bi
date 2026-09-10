# The Namkhan Standard — design

**Date:** 2026-09-10 · **Status:** awaiting PBS review · **Budget:** ADR-313 (USD 250/month)
**Module:** `ops_sop_qa_module` · **Property:** Namkhan 260955 (Donna 1000001 by extension)

---

## 1. Problem

Namkhan is measured against five external standards and has no map between them:

| Source | Atoms (est.) | In brain | doc_id |
|---|---|---|---|
| SLH Mystery Inspection 2026 | 368 questions, 36 scored sections | 25 chunks | `a1c2e6d0…00aa` |
| SLH Mystery Inspection 2025 | comparison baseline | 111 chunks | `0fed077c…` |
| ASEAN Green Hotel Standard | ~96 criteria | 188 chunks | `654ac145…` |
| Travelife Certification v1.0 | ~200 requirements | 117 chunks | `66bf6a86…` |
| GSTC Industry Criteria | ~40 criteria | 31 chunks | `0d2182ca…` |
| SLH Minimum Standards Chart | ~30 | 14 chunks | `ae55777a…` |

≈700 raw atoms. After merge, an estimated 250–350 real requirements and 120–160 SOPs,
because one good SOP closes several requirements at once. **That ratio is the point of
merging** — it is the difference between 700 disconnected obligations and a standard a
head of department can actually work through.

Current coverage: 72 SOP docs of which only 51 have an active body, 1 scored, 0 in Lao,
0 of 36 required visual packs, 0 recorded internal audits before this session.

**Not in the register:** the Lao 5-star official standard. Namkhan is certified against
it. Out of scope here by PBS decision, but it is a real hole.

## 2. Decisions taken (PBS, 2026-09-10)

| # | Decision | Consequence |
|---|---|---|
| 1 | **Shared standard, per-tenant SOPs** | Requirement atoms are tenant-neutral; SOPs, translations and coverage carry `property_id`. Donna inherits all 368 SLH questions the day she joins, with zero coverage and her own SOPs. |
| 2 | **Merge into one Namkhan Standard, keep source refs** | One requirement per real-world obligation, each citing which standards it satisfies. Reportable in each audit's own language; one SOP can close four audits. |
| 3 | **English SOP + Lao translation + visual pack spec** | ~3 artifacts per SOP. Closes red actions #4 (0% Lao) and the 36 missing visual packs. The only version housekeeping and grounds staff can execute. |
| 4 | **Dedicated pg_cron autorun** | Copies the proven `qa-dash-refresh-15min` pattern. Cannot stall the main build loop; the build loop cannot stall it. |
| 5 | **Failure-first slice 1** | Prove stages 4–7 on a batch small enough to read entirely before committing to 150 SOPs. |
| 6 | **USD 250/month cap** (ADR-313) | Enforced before each model call. Halt + owner signal on cap. No degrade, no retry, no borrowing forward. |

## 3. Data model

```
standards.sources        one row per standard document -> dms doc_id.        TENANT-NEUTRAL
standards.requirements   the raw atoms. source_id, section, subsection,
                         question_no, text, weight, dept_code, category.     TENANT-NEUTRAL
standards.atoms          the merged Namkhan Standard, one row per
                         real-world requirement.                             TENANT-NEUTRAL
standards.atom_sources   atoms <-> requirements, many-to-many, preserves
                         the citation for per-audit reporting.               TENANT-NEUTRAL
standards.sop_coverage   atom x property_id x sop_code.                      PER TENANT
standards.autorun_slices slice_key, stage, dept, status, attempts,
                         cost_usd, started_at, finished_at.                  PER TENANT
knowledge.sop_content    + property_id                                       PER TENANT
```

`knowledge.sop_proposals.property_id` already exists — added 2026-09-10 to close a
cross-tenant leak (see §7).

**Why the split:** the standard is shared, the compliance is per-property. This is the
one structural decision that is expensive to reverse, which is why it was settled first.

## 4. Pipeline — eight stages, each a resumable slice

| # | Stage | Output |
|---|---|---|
| 0 | INGEST | Standards PDFs -> `dms.documents` + brain chunks. Re-OCR the 3 failed ASEAN Spa copies; embed ASEAN MICE (text present, 0 chunks). |
| 1 | ATOMISE | per source x section -> `standards.requirements` |
| 2 | MERGE | per department -> `standards.atoms` + `atom_sources` |
| 3 | GAP | map the 53 active SOPs onto atoms -> coverage report |
| 4 | AUTHOR | English SOP per uncovered atom cluster -> `sop_proposals` |
| 5 | TRANSLATE | Lao body |
| 6 | VISUAL | visual pack spec (shot list) for the 36 visual-required SOPs |
| 7 | VERIFY | score the SOP back against its source questions -> `sop_meta.qa_score` |

Stage 3 pays for itself immediately: it surfaces atom clusters with zero covering SOP.

**Stages 0–3 are low-risk** — extraction and mapping either parse or they do not.
**Stages 4–7 are the unproven ones**, where an autorun can quietly produce 150
plausible-looking useless SOPs. Slice 1 exists to find that out cheaply.

## 5. Autorun mechanics

```
pg_cron  ->  fn_standards_autorun_tick()
               check month-to-date spend against the ADR-313 cap; halt if reached
               pick the next pending slice (stage order, then dept order)
               -> pg_net POST /api/standards/slice {slice_key}
                    route reads ANTHROPIC_API_KEY via fn_get_secret (never env-first)
                    does the work, writes results, meters cost to ai_token_meter,
                    marks the slice done | failed
               halt on: cap reached, 3 consecutive failures, fn_automation_enabled() false
```

Idempotent per `slice_key`; a re-run of a completed slice is a no-op. Progress renders on
the Quality dashboard. Every generated SOP lands as a **proposal**, never as an active
SOP — acceptance stays human.

## 6. Slice 1 — failure-first

Driven by the 2026 inspection, now in the register with 8 audit records and 30 findings:

| Dept | Score | Root cause |
|---|---|---|
| grounds | **79.3%** — only sub-80 section | pool debris; furniture quality; pool deck unattended for the whole stay |
| gm | 91.7% | no SLH pins, no SLH Directory, no management contact with the guest in two days |
| roots_service | 93.6% | In-Room-Dining **delivery 59.9%** — five misses on one tray; no proactive refills anywhere |
| housekeeping | 93.9% | turndown (see below); no laundry bag; no fire/safety info in room |
| kitchen | 98.5% | no chef table visit |

**Turndown is a policy regression, not a capability gap.** The 2025 inspection scored
turndown 4/4 with a signature amenity — a hand-woven tea filter and a handwritten note.
The 2025 inspector was told turndown runs 3x/week (Tue/Thu/Sat), asked for it, and got an
excellent service. The 2026 inspector did not ask and scored 0/14. The SOP author must
encode the 2025 execution, not invent one; the frequency question is an owner decision
(labour cost) and is **not** delegated to the autorun.

Six of the slice-1 misses are zero-cost behaviour fixes: refills, pins, directory, order
read-back, tray completeness, chef visit.

## 7. Already applied (2026-09-10, outside this pipeline)

- `knowledge.sop_proposals` + `property_id`, backfilled from `property_scope`; `v_qa_dash_sop`
  rebuilt with a real tenant filter. Namkhan was reporting 589 open proposals when 465 were
  hers — Donna's 124 were counted in. R1/L7 leak, closed.
- Donna added to `ops.qa_dash_source_map`; her payload had been frozen since 2026-09-08.
- Four action-rule CTAs repointed away from routes that 404'd; `href()` no longer
  tenant-prefixes `/holding/*` (commit `828f40a8`).
- Finding #61 resolved, PBS-confirmed; carry-overs filed as #680 (QA scoring coverage) and
  #681 (PM task -> SOP links) against the correct module.

## 8. Out of scope

- **Lao 5-star** — not in the register.
- **Training courses** — the university has 0 learners. Courses read the same atoms, later.
- **Auto-publish** — proposals only.
- **Donna's SOPs** — the model supports her; generating them is a separate run.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Autorun produces plausible but useless SOPs | Slice 1 is small enough to read in full; stage 7 self-verification is itself unproven and is checked by hand first |
| Merge step collapses two genuinely different requirements | `atom_sources` preserves every citation, so a bad merge is reversible without re-ingesting |
| Lao translation quality unverifiable by the author | Needs a named human reviewer before any Lao SOP goes active — **open, see §10** |
| Cap reached mid-corpus | Halt + owner signal; failure-first ordering means the highest-value SOPs are already written |
| Brain chunker races a multi-call text load | Set `extraction_status` last, or repair with `fn_brain_write_chunks` |

## 10. Open questions for PBS

1. **Who reviews the Lao translations?** No Lao speaker is wired into the acceptance path.
   Without one, stage 5 produces text nobody can validate.
2. **Turndown frequency** — daily, or keep 3x/week and make it explicit at check-in?
   Blocks the single highest-value SOP in slice 1.
3. **Pool deck ownership** — which department and which shift? Blocks the grounds SOPs.
