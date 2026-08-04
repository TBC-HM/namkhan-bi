// lib/dept-cfg/index.ts
// 2026-05-08 — every dept entry page reads its config from here. PBS
// design directive: each dept has the same entry layout as /revenue,
// adapted with its own data, HoD voice, sub-pages, defaults.

import type { DeptCfg } from './types';

// ─── Revenue ─────────────────────────────────────────────────────────────
// PBS 2026-05-09 #report-builder repair: hrefBase now points at the
// printable render route (`/revenue/reports/render?type=...`) instead of the
// source/source-page URL. Pressing a saved report opens a print-ready doc,
// not the live dashboard. Source pages remain reachable via the dept strip.
const REVENUE_REPORT_TYPES: NonNullable<DeptCfg['reportTypes']> = [