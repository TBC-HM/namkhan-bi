# 09 — Vertex Architecture

> GCP-native architecture. Vertex used surgically for ML; the bulk runs on cheaper GCP primitives.

## High-level flow
```
Cloudbeds API ──┬── Webhooks ──► Cloud Run (ingest) ──► Pub/Sub ──► Dataflow ──► BigQuery (raw)
                │
                └── Polling (Cloud Scheduler + Cloud Run) ──► GCS (raw JSON) ──► BigQuery (raw)

BigQuery (raw) ──► dbt / Dataform ──► BigQuery (staging) ──► BigQuery (marts: rooms, fb, hk, dq)

BigQuery (marts) ──┬── Looker Studio (dashboards 1–6)
                   ├── Vertex AI Forecast (occupancy / revenue)
                   ├── Vertex AI AutoML Tables (no-show / cancel risk)
                   └── Cloud Run (rule engine, alerts) ──► Slack / Telegram / Email
```

## Components

| Layer | Service | Purpose |
|---|---|---|
| Ingest | Cloud Run + Cloud Scheduler | Polled pulls + webhook receiver |
| Queue | Pub/Sub | Decouple ingest from transform |
| Transform | Dataflow / dbt-on-BigQuery | ETL, USALI mapping, KPI calc |
| Storage | GCS (raw) + BigQuery (modeled) | Lake + warehouse |
| ML | Vertex AI Forecast, AutoML, Workbench | Forecasting + classification |
| Serving | Looker Studio + Cloud Run (custom UI) | Dashboards |
| Alerts | Cloud Run + Make.com | Slack, Telegram, Email |
| Secrets | Secret Manager | API tokens, OAuth |
| Auth | IAM + Identity-Aware Proxy | Dashboard access |

## ML use cases (Vertex)
1. **Occupancy & revenue forecast** — Vertex AI Forecast (BQML alternative for cost).
2. **No-show / cancellation prediction** — AutoML Tables on reservation features.
3. **Rate recommendation** — custom model on Workbench, fed by pace + competitor (Phase 4).
4. **Anomaly detection** — BQML for KPI deviation alerting (cheap, no Vertex needed).

## Cost controls
- BigQuery on-demand → switch to flat-rate slot only above 1TB/mo scan.
- GCS lifecycle rules: raw JSON → coldline after 90 days, archive after 1y.
- Vertex models: schedule training, not always-on endpoints.
- Cloud Run min-instances = 0 outside webhook receiver.
- Budget alerts at 50/80/100% of monthly cap (initial cap: USD 200/mo).

## Security
- All API keys/tokens in Secret Manager.
- Service accounts least-privilege.
- BigQuery dataset-level IAM per department.
- VPC-SC if multi-property scaling.

## Gaps to confirm in Phase 0
- Cloudbeds OAuth app registration (production).
- GCP project structure: 1 project (single-property) vs folder-per-env.
- Backup/restore policy for BQ marts.
