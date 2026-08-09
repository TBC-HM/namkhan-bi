# Complete Application Navigation — Full Sitemap
*v5 · 2026-08-09 · L6 layer reality + legacy wrapper map + settings canon*

---

## §0 Navigation Architecture

The app has two user contexts:

| Context | URL pattern | Who uses it |
|---------|------------|-------------|
| **Holding** | `/holding/*` and `/revenue/*`, `/marketing/*` etc. (no pid) | PBS / senior leadership |
| **Property** | `/h/[pid]/*` | Property managers (pid=260955 Namkhan, pid=1000001 Donna) |

Top-level holding nav: `BC | CEO | Legal | Finance | IT`

Property switcher in header → switches between `/h/260955/*` and `/h/1000001/*`

---

## §1 Holding Area `/holding/*`

| URL | Purpose |
|-----|---------|
| `/holding` | Redirect → `/holding/ceo` |
| `/holding/ceo` | CEO dashboard |
| `/holding/legal` | Legal documentation |
| `/holding/legal-lao` | Lao-law legal docs |
| `/holding/finance` | Holding finance |
| `/holding/finance/clients` | Client invoicing |
| `/holding/finance/invoices` | Invoice management |
| `/holding/finance/costs` | Platform costs (supersedes legacy IT cost page) |
| `/holding/strategy` | Strategic planning |
| `/holding/it` | IT HoD landing (Module Documentation) |
| `/holding/it/brain` | Legacy redirect → `/h/[pid]/settings/brain` |
| `/holding/it/module/[docType]` | Doc viewer for any documentation.documents row |
| `/holding/it2` | **IT Cockpit v2** — see §2 for full detail |
| `/holding/properties` | Property portfolio (Namkhan + Donna) |
| `/holding/users` | User management links |
| `/holding/bugs` | Bug tracking dashboard |
| `/holding/settings` | Holding settings |

---

## §2 IT Cockpit `/holding/it2/*` — L6 Layer Reality

**Top-level nav:** Action Center | Knowledge | Agents | Build | System

**Architecture:** 6-layer cockpit schema (`cockpit.*`) with legacy backward-compat views (`public.cockpit_*`).

### §2.1 Action Center `/holding/it2`

**Home landing.** Shows current attention, active bugs, live system status.

| URL | Purpose |
|-----|---------|
| `/holding/it2` | Action Center home |
| `/holding/it2/fleet/bugs` | Bugs panel (sub-tab) |
| `/holding/it2/system/live` | Live status (sub-tab) |

### §2.2 Knowledge `/holding/it2/knowledge/*`

Documentation, goals, schemas, university content.

| URL | Purpose | Layer |
|-----|---------|-------|
| `/holding/it2/knowledge/docs` | Documentation catalog | `kn_*` |
| `/holding/it2/knowledge/goals` | System goals & objectives | `kn_*` |
| `/holding/it2/fleet/skills` | Agent skills catalog | `cap_skills` |
| `/holding/it2/fleet/memory` | Agent memory store | `kn_agent_memory` |
| `/holding/it2/knowledge/design` | Design system & patterns | `kn_*` |
| `/holding/it2/knowledge/university` | Training materials | `kn_*` |
| `/holding/it2/knowledge/data` | Data dictionary & schemas | `kn_*` |

### §2.3 Agents `/holding/it2/fleet/*`

112-agent fleet management.

| URL | Purpose | Layer |
|-----|---------|-------|
| `/holding/it2/fleet/team` | Agent team roster (Agents & pillars / Org chart toggle) | `id_agents`, `id_agent_instances` |
| `/holding/it2/fleet/loops` | Loops & Chains (multi-agent workflows) | `exec_*` |
| `/holding/it2/fleet/cron` | Cron job schedule | `exec_*` |
| `/holding/it2/fleet/grants` | Agent permission grants | `gov_acl` |

### §2.4 Build `/holding/it2/modules/*`

Module development pipeline.

| URL | Purpose | Layer |
|-----|---------|-------|
| `/holding/it2/modules/status` | Module status board | `exec_projects` |
| `/holding/it2/modules/specs` | Module specs catalog | `kn_*` |
| `/holding/it2/modules/queue` | Module queue (ETAs) | `exec_*` |
| `/holding/it2/modules/intake` | + Intake (L1 platform build) | `intake_items` |
| `/holding/it2/modules/module` | + Module (L2 tenant intake) | `intake_items` |

**Note:** Briefs page demoted from owner nav (module-surface-consolidation-v1). Reachable via System → Health link card.

### §2.5 System `/holding/it2/system/*`

Platform ops, deploys, health.

| URL | Purpose | Layer |
|-----|---------|-------|
| `/holding/it2/system/deploys` | Deploy history & pipeline | `exec_*` |
| `/holding/it2/system/checks` | System health checks | `aud_*` |
| `/holding/it2/system/health` | Overall system health dashboard | `aud_*` |
| `/holding/it2/system/activity` | Activity log (all cockpit actions) | `aud_audit_log`, `aud_change_log` |
| `/holding/finance/costs` | Platform cost tracking (finance-owned) | `costs.*` |
| `/holding/it2/system/recovery` | Disaster recovery & backups | `backup_log` |
| `/holding/it2/system/automation` | ⏻ Automation (global stop) | `gov_*` |

---

## §2.6 IT Cockpit — L6 Layer Schema Map

The **cockpit schema** uses a 6-layer architecture:

| Layer prefix | Purpose | Example tables |
|-------------|---------|----------------|
| `id_*` | **Identity** — who/what exists | `id_agents`, `id_agent_instances`, `id_agent_trust` |
| `cap_*` | **Capability** — skills & prompts | `cap_skills`, `cap_prompts`, `cap_agent_skills`, `cap_skill_calls` |
| `kn_*` | **Knowledge** — docs, memory, facts | `kn_agent_memory`, (docs in `documentation.*`) |
| `gov_*` | **Governance** — rules & guardrails | `gov_acl`, `gov_guardrails`, `gov_agent_budgets` |
| `exec_*` | **Execution** — work & outcomes | `exec_bugs`, `exec_tickets`, `exec_plans`, `exec_projects`, `exec_notifications` |
| `aud_*` | **Audit** — logs & snapshots | `aud_audit_log`, `aud_change_log`, `aud_kpi_snapshots` |

**Legacy wrapper pattern:** For backward compatibility, the `public` schema exposes views like `public.cockpit_bugs` → `cockpit.exec_bugs`, `public.cockpit_agent_memory` → `cockpit.kn_agent_memory`, etc. Old queries still work; new code should reference `cockpit.*` directly.

**Why the wrappers exist:** Pre-L6 refactor, all cockpit tables lived in `public.cockpit_*`. The 6-layer restructure (ADR-xxx, 2026-08-xx) moved them to `cockpit.{layer}_*` for clarity. The wrapper views prevent breaking old SQL queries, API endpoints, and agent prompts during the transition.

---

## §3 Revenue `/revenue/*` and `/h/[pid]/revenue/*`

Revenue HoD landing + 25 sub-pages. Both holding (`/revenue/*`) and property (`/h/[pid]/revenue/*`) versions exist.

| URL suffix | Purpose |
|-----------|---------|
| _(root)_ | HoD landing (KPI tiles + daily briefing + conclusions) |
| `/briefing` | Morning executive briefing — guardrail conclusions |
| `/pulse` | Real-time KPI pulse (OCC / ADR / RevPAR live) |
| `/pickup` | Pickup matrix by stay-month vs OTA |
| `/pickup-day` | Pickup matrix by stay-day vs OTA |
| `/pace` | Pace tracking (booking curve vs SDLY) |
| `/demand` | Forward demand analytics |
| `/markets` | Market segment heatmaps (nationality / room type) |
| `/compset` | Competitive set analysis |
| `/compset/[hotelId]` | Per-competitor deep scrape landing |
| `/parity` | OTA rate parity checks |
| `/channels` | Channel mix overview |
| `/channels/[source]` | Per-channel deep landing (DMC panel + trail tiles + bookings) |
| `/channels/[source]/promotions` | Channel promotions |
| `/channels/booking-com` | Booking.com dedicated page |
| `/channels/expedia` | Expedia dedicated page |
| `/rateplans` | Rate plan management |
| `/pricing` | Rate pricing (tabs: Calendar, Holidays, OTB Density, Restrictions) |
| `/inventory` | Room inventory |
| `/rooms` | Room type analytics |
| `/promotions` | Promotional analytics |
| `/forecasts` | Demand forecasting |
| `/cancellations` | Cancellation analytics |
| `/reports` | Report generation hub |
| `/reports/render` | Print-ready report renderer |
| `/reports/scheduled` | Scheduled reports manager |
| `/reports/scheduled/daily/preview` | Daily report preview |
| `/reports/scheduled/weekly/preview` | Weekly report preview |
| `/reports/scheduled/monthly/preview` | Monthly report preview |
| `/leakage` | Revenue leakage tracking |
| `/engine` | Revenue engine / algorithm view |
| `/lighthouse/overview` | Lighthouse rate shop overview |
| `/lighthouse/rates` | Lighthouse rates |
| `/lighthouse/vs-yesterday` | Lighthouse vs Yesterday |
| `/legacy`, `/legacy2` | Archived legacy views |

---

## §4 Marketing `/marketing/*` and `/h/[pid]/marketing/*`

| URL suffix | Purpose |
|-----------|---------|
| _(root)_ | HoD landing (KPI tiles + marketing overview) |
| `/overview` | Marketing overview with real KPIs |
| `/campaigns` | Campaign management |
| `/campaigns/[id]` | Individual campaign |
| `/campaigns/new` | New campaign creation |
| `/funnels` | Marketing funnels |
| `/prospects` | Prospects engine |
| `/prospects/sequences` | Email sequences |
| `/docs` | Marketing docs |
| `/reputation` | Reputation management |
| `/seo` | SEO dashboard |
| `/website` | Website module (website-module-v1 P3, 2026-07-30) |
| `/agents` | Marketing agents |
| `/media` | **Media Module** — full photo/video library (legacy, see Guest) |
| `/digital` | Digital marketing hub |
| `/compiler` | Content compiler ⚠️ legacy design |

---

## §5 Guest (Contacts) `/guest/*` and `/h/[pid]/guest/*`

| URL suffix | Purpose |
|-----------|---------|
| _(root)_ | Contacts HoD landing |
| `/directory` | Guest directory |
| `/newsletters` | Newsletter management |
| `/journey` | Guest journey |
| `/loyalty` | Loyalty program |
| `/reputation` | Reputation tracking |
| `/prospects` | Prospect tracking |
| `/segments` | Guest segments |
| `/media` | Media library (photo/video) |

---

## §6 Finance `/finance/*` and `/h/[pid]/finance/*`

| URL suffix | Purpose |
|-----------|---------|
| _(root)_ | HoD landing |
| `/pnl` | P&L statement (tabs: month, YTD) |
| `/banks` | Bank accounts & cash flow |
| `/budget` | Budget vs Actual |
| `/transactions` | Transactions explorer |
| `/costs` | Platform costs (replaces legacy IT cost page) |
| `/studio` | Spreadsheet Studio |
| `/hr` | HR hub |
| `/hr/payroll` | Payroll register |
| `/legal` | Legal hub |
| `/legal/docs` | Legal documents |
| `/legal/cases` | Legal cases |

---

## §7 Sales `/departments/sales/*` and `/h/[pid]/sales/*`

**Note:** Sales uses `/departments/sales/*` pattern (not `/sales/*`).

| URL suffix | Purpose |
|-----------|---------|
| _(root)_ | HoD landing — Create New · Pipeline · Accounts |
| `/b2b` | B2B partners |
| `/inquiries` | Inquiry tracking |
| `/contracts` | Contract management |
| `/pipeline` | Deal pipeline |
| `/accounts` | Account management |
| `/packages` | Package management |
| `/leads` | Lead management |
| `/mails` | Shared mailbox (book@, gm@, reservations@) |
| `/icp` | Ideal customer profiles |
| `/proposals` | Sales proposals |

---

## §8 Operations `/operations/*` and `/h/[pid]/operations/*`

**Note:** Operations uses `/departments` for HoD landing, `/operations/*` for sub-pages.

| URL suffix | Purpose |
|-----------|---------|
| `/departments` | Operations HoD landing |
| `/operations/restaurant` | Restaurant operations |
| `/operations/spa` | Spa services |
| `/operations/activities` | Activities tracking |
| `/operations/retail` | Retail operations |
| `/operations/transport` | Transport/transfers |
| `/operations/other` | Other services |
| `/inventory/*` | **Inventory Module** — see below |

### Operations — Inventory Module

| URL | Purpose |
|-----|---------|
| `/inventory` | Inventory home |
| `/inventory/items` | Catalog items |
| `/inventory/items/[id]` | Item detail |
| `/inventory/stock` | Stock levels |
| `/inventory/movements` | Stock movements |
| `/inventory/counts` | Count entry |
| `/inventory/low-stock` | Low stock alerts |
| `/inventory/purchase-requests` | PR management |
| `/inventory/purchase-orders` | PO management |
| `/inventory/suppliers` | Supplier directory |
| `/inventory/category-map` | Category mapping |
| `/inventory/catalog-cleanup` | Data cleanup |

---

## §9 Settings `/settings/*`

**Top-level tabs:** Snapshot | Property | Listings

### §9.1 Settings — Snapshot `/settings`

Property health dashboard. Shows:
- Profile completeness (% non-placeholder fields)
- Active users count
- Data quality (DQ) open issues
- Room types count
- Editable sections count

**Source:** `marketing.property_profile`, `room_types`, `app_users`, `dq_known_issues`, `marketing.v_settings_sections`

### §9.2 Settings — Property `/settings/property/*`

**Property configuration editor.** 17 editable sections:

| Section code | Display name | Description |
|-------------|--------------|-------------|
| `property_identity` | Property Identity | Legal name, taglines, descriptions, USPs |
| `location_climate` | Location & Climate | GPS, address, distances, climate, shuttle |
| `contacts` | Contacts | Phone, email, WhatsApp, billing — by purpose |
| `social` | Social Media | Instagram, FB, TikTok, OTAs, etc. |
| `rooms` | Room Content | Owner-curated descriptions, sizes, amenities |
| `booking_policies` | Booking Policies | Confirmation, payment, cancellation, group terms |
| `certifications` | Certifications | SLH, ASEAN Green, Plastic-Free, Hilton Honors |
| `facilities` | Facilities | Pools, restaurants, spa, sports |
| `activities` | Activities Catalog | Yoga, cooking, kayaking, etc. |
| `meeting_rooms` | Meeting Rooms | S/M/L/XL configs |
| `meeting_packages` | Meeting Packages | Room rental + Smart + Hybrid + Add-ons |
| `retreats` | Retreat Programs | Harmony, Detox, Serene Couples + tiered pricing |
| `retreat_pricing` | Retreat Pricing Matrix | Tier × Season × Audience pricing grid |
| `seasons` | Seasons | High / Green date blocks |
| `brand` | Brand Identity | Palette, typography, logo variants |
| `social_rules` | Social · Channel Guardrails | Per-channel output rules |
| `social_programs` | Social · Content Programs | Per-channel weekly content categories |

**Routes:**
- `/settings/property` — Section picker
- `/settings/property/[section]` — Individual section editor
- `/settings/property/brief` — AI agent factsheet (auto-generated markdown, read-only)
- `/settings/property/audience` — Audience settings (editorial goals, voice, cadence, email chrome)

### §9.3 Settings — Listings `/settings/marketing/listings`

Master external-listing URL/handle table. Maps property presence across OTAs, social platforms, etc.

---

## §10 Other Utility Routes

| URL | Purpose |
|-----|---------|
| `/docs` | Documentation viewer (renders `documentation.documents`) |
| `/docs/[slug]` | Individual doc by slug |
| `/agents` | Agent console |
| `/chat` | AI chat interface |
| `/notifications` | Notification center |
| `/profile` | User profile |

---

## Appendix A: Route Verification Checklist

✅ All IT2 routes verified against `app/holding/it2/_lib/groups.ts`  
✅ Revenue routes verified against `app/_components/hod_subpages_catalog.ts`  
✅ Marketing routes verified against `app/_components/hod_subpages_catalog.ts`  
✅ Finance routes verified against `app/_components/hod_subpages_catalog.ts`  
✅ Settings sections verified against `marketing.v_settings_sections`  
✅ Settings tabs verified against `app/settings/_subpages.ts`  
✅ L6 layer prefixes verified against `cockpit` schema (id_, cap_, kn_, gov_, exec_, aud_)  
✅ Legacy wrapper pattern documented (public.cockpit_* → cockpit.*)  

---

## Appendix B: Layer Prefix Quick Reference

When reading SQL or agent prompts, map old `public.cockpit_*` names to new `cockpit.{layer}_*`:

| Old (legacy wrapper) | New (L6 layer) | Layer |
|---------------------|----------------|-------|
| `public.cockpit_bugs` | `cockpit.exec_bugs` | Execution |
| `public.cockpit_agent_memory` | `cockpit.kn_agent_memory` | Knowledge |
| `public.cockpit_agent_acl` | `cockpit.gov_acl` | Governance |
| `public.cockpit_agent_identity` | `cockpit.id_agents` | Identity |
| `public.cockpit_agent_prompts` | `cockpit.cap_prompts` | Capability |
| `public.cockpit_audit_log` | `cockpit.aud_audit_log` | Audit |
| `public.cockpit_change_log` | `cockpit.aud_change_log` | Audit |
| `public.cockpit_kpi_snapshots` | `cockpit.aud_kpi_snapshots` | Audit |
| `public.cockpit_guardrails` | `cockpit.gov_guardrails` | Governance |
| `public.cockpit_tickets` | `cockpit.exec_tickets` | Execution |
| `public.cockpit_plans` | `cockpit.exec_plans` | Execution |
| `public.cockpit_proposals` | `cockpit.exec_proposals` | Execution |
| `public.cockpit_decisions` | `cockpit.exec_decisions` | Execution |
| `public.cockpit_incidents` | `cockpit.exec_incidents` | Execution |
| `public.cockpit_notifications` | `cockpit.exec_notifications` | Execution |

**New code should reference `cockpit.*` directly.** The `public.cockpit_*` views exist only for backward compatibility during the L6 transition.

---

*End of sitemap · v5 · 2026-08-09 · 16,600 chars · L6 layer reality established*