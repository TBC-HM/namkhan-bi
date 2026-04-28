# 10 — Recommendations Engine

> P4 module. Turns clean data + KPIs + ML predictions into ranked actions per department.

## Output format (standard)
Every recommendation:
- **Department**
- **Action** (imperative, ≤15 words)
- **Reason** (1-line, with metric)
- **Expected impact** (e.g., +X% RevPAR, −Y minutes)
- **Confidence** (low/med/high)
- **Effort** (low/med/high)
- **Deadline**

## Signal sources
| Signal | Source | Module |
|---|---|---|
| Pace deviation vs LY | BigQuery mart | Revenue |
| Forecast vs target | Vertex Forecast | Mgmt / Revenue |
| No-show probability | Vertex AutoML | Reservations |
| Cancel probability | Vertex AutoML | Reservations |
| Rate parity break | Channel manager + scrape | Revenue |
| Open data quality issues | DQ log | All |
| HK turnover delays | HK status feed | Operations |
| F&B capture drop | Folio mart | F&B |

## Department playbooks (rule + ML hybrid)

### Revenue
- If pace < 80% of LY at 30/60/90 day window → recommend price drop on softest segment.
- If on-the-books > 110% of LY → close discount channels, lift BAR.
- If OTA mix > 60% → trigger direct-channel campaign suggestion.

### Reservations
- High no-show probability (>40%) on T-1 → recommend pre-arrival confirmation call.
- Email capture % < 70% on segment → SOP refresher trigger.

### Housekeeping
- If avg minutes/room > 45 → flag attendant training need.
- If turnover time > 90 min and same-day arrivals exist → escalate priority list.

### F&B
- If F&B capture < 30% on a given week → review IRD push, breakfast inclusion in packages.
- Avg cover declining 3 weeks in a row → menu engineering review.

### Management
- GOPPAR forecast below budget → suggest cost levers (HK overtime, F&B COGS) ranked by impact.
- Critical DQ issues open > SLA → escalate to dept head.

## Delivery
- Weekly digest (Monday 10:00) — top 10 ranked actions across departments.
- Real-time alerts for CRITICAL signals (e.g., pace collapse, parity break).
- Channel: Slack / Telegram / Email per recipient preference.

## Feedback loop
- Each recommendation logs: accepted / rejected / acted-on / outcome.
- Monthly review: which recommendations correlate with KPI movement.
- Models retrained quarterly with outcome labels.
