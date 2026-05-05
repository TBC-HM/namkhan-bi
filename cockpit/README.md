# /cockpit/ — Shared Brain

This folder is the source of truth for all agents and humans working on this codebase. Every agent reads from here. Standards live here. Decisions live here.

## Structure

```
cockpit/
├── README.md                  ← you are here
├── glossary.md                ← what terms mean (Coiler, Namkhan, USALI, etc.)
├── constraints.md             ← what agents cannot do
├── setup-log.md               ← chronological log of cockpit changes
├── standards/
│   ├── code.md                ← coding conventions
│   ├── design-tokens.md       ← colors, fonts, spacing
│   ├── brand-namkhan.md       ← Namkhan brand rules
│   ├── brand-donna.md         ← Donna Portals brand rules
│   ├── usali.md               ← USALI mapping reference
│   ├── security.md            ← what's blocked, RLS rules
│   └── hotel-rules.md         ← occupancy, rate, distribution rules
├── architecture/
│   ├── stack.md               ← Vercel + Supabase + Cloudbeds + ...
│   ├── data-model.md          ← Supabase tables described
│   ├── api-map.md             ← internal + external APIs
│   └── env-vars.md            ← env vars (names only, no values)
├── decisions/
│   ├── 0001-cockpit-architecture.md
│   └── ...                    ← ADRs as decisions are made
└── runbooks/
    ├── site-down.md
    ├── deploy-failed.md
    ├── db-slow.md
    └── ...                    ← incident response procedures
```

## Reading order

Agents read in this priority:
1. `/CLAUDE.md` (root)
2. This README
3. `glossary.md` + `constraints.md` (always)
4. Whatever standards/architecture/runbooks file is relevant to the current task

## Update rules

- **You can append** to glossary, runbooks, decisions without approval
- **You must propose PR** for changes to standards, constraints, architecture
- **Never delete** ADRs in `decisions/` — supersede with a new ADR instead
- All edits commit with descriptive message

## Drift check

The Documentation Arm runs weekly to detect when code changed but docs didn't. If your task touches a file that's documented here, update the doc in the same PR.
