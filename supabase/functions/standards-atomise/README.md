# standards-atomise

Extracts normative requirements from a prose standard's brain chunks into
`standards.requirements`. Deployed via MCP; source of record for the deployed body is the
Supabase project (`supabase functions download standards-atomise`).

## Why this exists alongside `app/api/standards/atomise`

The Next route is the production, UI-triggered path. This edge function is the worker path:
it can reach the vault and Anthropic without a browser session, which the route cannot do
from a developer checkout.

**They must not drift, so neither owns the two things that could drift:**

| Thing | Single source of truth |
|---|---|
| The extraction prompt | `public.cockpit_agent_prompts` role `standards_atomiser` (rules/agents.md — prompts live in the DB) |
| Department resolution | `public.fn_standards_dept_for_hint`, an exact port of `lib/standards/deptMap.ts` verified on 24 real cases |

## Behaviour

- Never throws on a bad chunk — one failure must not abandon a 350-chunk run (`degraded_chunks` counts them).
- Idempotent: `fn_standards_load_prose` skips text already loaded for the same source, because
  prose requirements have `question_no NULL` and so are NOT covered by the
  `UNIQUE (source_id, section, question_no)` constraint.
- Paged via `offset`/`limit` so a large source cannot exceed the function timeout.
- Meters spend to `ai_token_meter` via `fn_meter_ai_call` against the ADR-313 cap.

## Result of the 2026-09-10 run

350 chunks across 4 sources, **0 degraded**, 1,219 requirements loaded.
Corpus went from 338 (SLH only) to 1,557 across 5 authorities.
