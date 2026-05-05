# Access policy — who sees what

This file is **descriptive of what RLS already enforces** AND injected into agent
prompts so the data agent self-filters before showing answers.

## Role × Sensitivity matrix

| Role | public | internal | confidential | restricted | Notes |
|---|---|---|---|---|---|
| **owner** | ✓ | ✓ | ✓ | ✓ | Full access. PBS. |
| **gm** | ✓ | ✓ | ✓ | — | All except owner-only docs (M&A, exec comp). |
| **hod** | ✓ | ✓ | ✓ (own dept only) | — | F&B HOD doesn't see HR payslips. |
| **finance** | ✓ | ✓ | ✓ (financial/legal/insurance) | — | Books + contracts + audits. No HR. |
| **hr** | ✓ | ✓ | ✓ (hr_doc only) | — | Payslips, contracts, IDs — no finance/legal. |
| **auditor** | ✓ | ✓ | ✓ (read-only) | — | External audits / SLH inspection. Read-only enforced by RLS. |
| **staff** | ✓ | ✓ | own only | — | Their own employment docs only. SOPs visible. |
| **anon** | ✓ | — | — | — | Password-gated portal — anon shouldn't see anything sensitive. |

## Schema-level access

| Schema | owner/gm | hod | finance | hr | auditor | staff |
|---|---|---|---|---|---|---|
| `docs.*` | ✓ | role-filtered | ✓ for fin/legal | ✓ for hr | ✓ read | own |
| `gl.*` | ✓ | summary only | ✓ | — | ✓ read | — |
| `kpi.*` | ✓ | own dept | ✓ | — | ✓ | — |
| `inv.*` | ✓ | own dept | ✓ | — | ✓ | — |
| `proc.*` | ✓ | own dept | ✓ | — | ✓ | — |
| `marketing.*` | ✓ | marketing only | ✓ | — | ✓ | — |
| `guest.*` | ✓ | front-office only | — | — | ✓ | — |
| `frontoffice.*` | ✓ | front-office only | — | — | ✓ | — |
| `governance.*` | ✓ | — | — | — | ✓ read | — |
| `auth.*`, `vault.*`, `cron.*`, `_archive.*` | ✓ | — | — | — | — | — |

## How to use this in an agent prompt

When constructing a SQL query, the agent should:
1. Detect the question scope (financial / HR / guest / SOP / etc.)
2. Cross-reference with the calling user's role (passed via JWT claim)
3. If the role wouldn't see the answer, return: "Restricted by role policy" + suggest who to ask

Example:
- Staff user asks: "what's our F&B revenue last month"
- Allowed schemas for staff: docs.* (own), KPIs not allowed
- Agent answer: "This is a finance metric. Ask GM or finance lead — staff role can't query gl.*"

## Hard enforcement

RLS policies in Postgres enforce the above. The agent prompt is **defense in depth** — even if the prompt slips, RLS blocks the query at row level. Never rely on prompt-only enforcement for confidential/restricted data.

## Open questions for Spain rollout

- Do we need a `concierge` role? Probably yes — for guest-facing queries.
- `housekeeping` should be like `staff` but with HK SOPs visible.
- Multi-property: `property_id` filter must be in every query for tenants who manage > 1 hotel.
