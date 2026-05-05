# ADR 0001: Cockpit Architecture (4 Arms + Orchestrator)

**Status**: Accepted
**Date**: 2026-05-05
**Decided by**: PBS

## Context

PBS spends ~12 hrs/day on hospitality tech ops. Upwork dev has been unreliable: missed updates, design churn, mistakes. Need an autonomous IT setup that:
- Keeps sites secure, healthy, audited, documented
- Handles small dev tasks via email-driven workflow
- Surfaces only S1 incidents and approval gates to PBS
- Targets 1 hr/day human time within 4-6 months

## Decision

Build a 4-arm cockpit with a Claude-powered orchestrator:

1. **Health Arm** — uptime, security, performance (Make.com + Vercel + Supabase native)
2. **Dev Arm** — email-driven feature work via Claude Code Agent Teams
3. **Control Arm** — automated tests + Claude Code Review on every PR
4. **Design Arm** — design tokens enforced, brand rules locked
5. **Research Arm** — investigation requests, Supabase + web data access

Plus:
- **Documentation Arm** — auto-updates docs on PR merge
- **Shared brain**: `CLAUDE.md` + `/cockpit/` markdown + Supabase live state

## Considered alternatives

| Option | Why rejected |
|---|---|
| Hire full-time dev | Cost, doesn't fix process |
| Stay with Upwork freelancer | Already failing |
| Build with Notion as cockpit | PBS doesn't use Notion |
| Use Telegram for alerts | PBS prefers email |
| Custom orchestrator (no Claude Code Agent Teams) | Reinvents native feature |

## Consequences

- Front-loaded build: 14 hrs/day for 4 weeks before time savings
- Requires Claude Max plan (~$100-200/mo)
- Requires Make.com Pro
- Vercel + Supabase already on Pro — sufficient
- Hard dependency on Claude Code Agent Teams (experimental Feb 2026)

## Hard rules embedded in this decision

- No direct push to `main`
- Auth/payment/booking-write code never auto-merged
- Cloudbeds is sole revenue source — never bypass
- USALI compliance for all financial output
- SLH branding on Namkhan, black + dark green for Donna presentations

## Review

Quarterly. First review: 2026-08-05.

## Related

- See `cockpit/architecture/stack.md`
- See `cockpit/standards/hotel-rules.md`
- See `cockpit/constraints.md`
