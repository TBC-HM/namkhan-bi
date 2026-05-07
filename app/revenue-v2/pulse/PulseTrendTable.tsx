'use client'

/**
 * PulseTrendTable — client component
 * Wraps <DataTable> so that render/sortValue fns don't cross the RSC boundary.
 * Rows come from mv_kpi_daily, fetched in the server page.
 */

import { DataTable, type Column } from '@/components/ui/DataTable'
import { EMPTY } from '@/lib/format'
import type { KpiDailyRow } from './page'

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(v: string | null | undefined): string {
  if (!v) return EMPTY
  // ISO → DD MMM YY
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return EMPTY
  return `${v.toFixed(1)}%`
}

function fmtUsd(v: number | null | undefined): string {
  if (v == null) return EMPTY
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtCount(v: number | null | undefined): string {
  if (v == null) return EMPTY
  return v.toLocaleString('en-US')
}

// ─── Column definitions ───────────────────────────────────────────────────────

const columns: Column<KpiDailyRow>[] = [
  {
    key: 'night_date',
    header: 'DATE',
    sortValue: (r) => r.night_date,
    render: (r) => fmtDate(r.night_date),
  },
  {
    key: 'occupancy_pct',
    header: 'OCC %',
    numeric: true,
    sortValue: (r) => r.occupancy_pct ?? -Infinity,
    render: (r) => fmtPct(r.occupancy_pct),
  },
  {
    key: 'adr',
    header: 'ADR (USD)',
    numeric: true,
    sortValue: (r) => r.adr ?? -Infinity,
    render: (r) => fmtUsd(r.adr),
  },
  {
    key: 'revpar',
    header: 'REVPAR (USD)',
    numeric: true,
    sortValue: (r) => r.revpar ?? -Infinity,
    render: (r) => fmtUsd(r.revpar),
  },
  {
    key: 'rooms_sold',
    header: 'ROOMS SOLD',
    numeric: true,
    sortValue: (r) => r.rooms_sold ?? -Infinity,
    render: (r) => fmtCount(r.rooms_sold),
  },
  {
    key: 'rooms_revenue',
    header: 'ROOM REV (USD)',
    numeric: true,
    sortValue: (r) => r.rooms_revenue ?? -Infinity,
    render: (r) => fmtUsd(r.rooms_revenue),
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  rows: KpiDailyRow[]
}

export function PulseTrendTable({ rows }: Props) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.night_date}
      emptyState="No daily KPI data in range — mv_kpi_daily returned 0 rows."
    />
  )
}
