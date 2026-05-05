# USALI Standards

Uniform System of Accounts for the Lodging Industry. All Namkhan financials follow USALI 11th edition.

## Why this matters

- Owner reporting compatibility
- Industry benchmarking (STR, HotStats)
- USALI is the language hotels speak — anything else creates friction

## Cloudbeds → USALI mapping

The mapping table lives in Supabase: `usali_mapping` (table to be created). Every Cloudbeds revenue/expense category maps to a USALI account.

Until populated, agents must:
- Refer to PBS's existing USALI mapping document
- Never invent a mapping
- Flag any uncategorized line item

## Top-level USALI categories

### Revenue
- Rooms
- Food (F&B subcategory)
- Beverage (F&B subcategory)
- Other Operated Departments (spa, retail, etc.)
- Miscellaneous Income
- Rentals and Other Income

### Departmental Expenses
- Rooms expenses (labor, supplies, comms, reservations)
- F&B expenses (cost of food, cost of beverage, labor, other)
- Other Operated Departments expenses

### Undistributed Operating Expenses
- Administrative & General
- Information & Telecommunications Systems
- Sales & Marketing
- Property Operation & Maintenance
- Utilities

### Non-Operating Income & Expenses
- Income from incidentals
- Property taxes, insurance
- Lease, rent, other (LRO)

## KPIs derived from USALI

| KPI | Formula |
|---|---|
| ADR | Room revenue / rooms sold |
| Occupancy | Rooms sold / rooms available |
| RevPAR | Room revenue / rooms available |
| GOPPAR | Gross Operating Profit / rooms available |
| F&B cost % | Food cost / Food revenue |
| Beverage cost % | Beverage cost / Beverage revenue |
| Labor % | Labor cost / Department revenue |

## Reporting cadence

- **Daily**: occupancy, ADR, RevPAR, top revenue movers
- **Weekly**: rolling 7-day vs prior week, vs same week last year
- **Monthly**: full P&L USALI format
- **Quarterly**: USALI benchmark comparison vs comp set
- **Annually**: full USALI report for owner

## Action

- [ ] PBS to upload existing USALI mapping document → import into Supabase `usali_mapping` table
- [ ] Confirm USALI 11th edition (or whichever edition Namkhan uses)
- [ ] Define comp set for benchmarking

Once populated, this file becomes authoritative for all financial reporting work.
