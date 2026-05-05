# Glossary

Plain-language definitions of terms used in this project. If a term isn't here, ask before assuming.

> **Scope note:** this repo is **namkhan-bi**. Active brand for all work here is **Namkhan**. Donna Portals entries below are kept as cross-repo reference for PBS's broader portfolio — they are not active in this codebase.

## Brands and properties

| Term | Meaning |
|---|---|
| **Namkhan** / **The Namkhan** | Boutique hotel in Luang Prabang area, Laos. SLH-affiliated. |
| **Donna Portals** | Hospitality portal/booking platform. Beach club concept, premium positioning. |
| **PBS** | Owner/operator. Hospitality data analyst. Spain-based. |
| **PBS Base** | PBS's own portfolio site (pbsbase.com). |

## Products / packages / features (extend as built)

| Term | Meaning |
|---|---|
| **Coiler** | A sales package on Donna Portals (premium beach experience). |
| **Roots** / **The Roots** | Restaurant at The Namkhan. F&B optimization scope. |
| **Beach club** | Donna Portals' premium beach concept with Bali beds, high-end positioning. |

## Hospitality / industry

| Term | Meaning |
|---|---|
| **PMS** | Property Management System. Cloudbeds for Namkhan. |
| **OTA** | Online Travel Agency (Booking.com, Expedia, Agoda, etc.). |
| **ADR** | Average Daily Rate. Revenue per occupied room per night. |
| **RevPAR** | Revenue Per Available Room. ADR × occupancy. |
| **GOPPAR** | Gross Operating Profit Per Available Room. |
| **USALI** | Uniform System of Accounts for the Lodging Industry. Hotel accounting standard. |
| **SLH** | Small Luxury Hotels of the World. Namkhan affiliation. |
| **Distribution control** | Hotel's control over which channels sell and at what price. |
| **Rate erosion** | When prices drop without strategic reason, damaging long-term ADR. |
| **Direct booking** | Guest books directly with hotel (no OTA commission). Primary KPI. |
| **Channel manager** | Software syncing rates/availability across OTAs. |

## Tech / cockpit

| Term | Meaning |
|---|---|
| **Cockpit** | This whole IT department setup — orchestrator + 4 arms + shared brain. |
| **Arm** | A specialist subsystem (Health, Dev, Control, Design, Research). |
| **Orchestrator** | The router that takes intake (email/voice) and routes to the right arm. |
| **Shared brain** | `CLAUDE.md` + `/cockpit/` folder + Supabase live state tables. |
| **Agent Teams** | Claude Code's experimental multi-agent feature with team lead + teammates. |
| **Subagent** | Specialized Claude agent invoked from a parent session. |
| **ADR** | Architecture Decision Record. In `/cockpit/decisions/`. (Note: same acronym as Average Daily Rate — context disambiguates.) |
| **Severity 1-4** | Incident classification. S1 = site down, S4 = info only. |
| **MTTR** | Mean Time To Recovery — how fast incidents are resolved. |

## Currencies / regions

| Term | Meaning |
|---|---|
| **LAK** | Lao Kip — Namkhan base currency. |
| **USD** | Used for reporting and OTA-facing rates at Namkhan. |
| **FX tracking** | Foreign exchange rate tracking — required for LAK/USD reconciliation. |

## Frequently confused terms

| You might mean... | But it's actually... |
|---|---|
| "ADR" in revenue context | Average Daily Rate |
| "ADR" in cockpit context | Architecture Decision Record |
| "Rate" alone | Always specify: room rate, ADR, FX rate, error rate |
| "Booking" alone | Specify: a reservation, the booking engine, the booking flow code |
| "Coiler customer" | Use "Coiler buyer" or "Donna Portals guest" — Coiler is the package, not the customer |

---

**Append-only.** Add new terms as they appear. Don't delete old ones — mark deprecated instead.
