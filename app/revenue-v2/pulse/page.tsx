/**
 * /revenue-v2/pulse — Daily Flash KPIs
 *
 * Canonical wiring (KB #321):
 *   TODAY:  public.mv_kpi_today   → top KpiBox row
 *   TREND:  public.mv_kpi_daily   → 30-row history table
 *   PACE:   public.v_pace_curve   → referenced but not yet rendered (TODO sub-ticket)
 *
 * No mock data. No hardcoded numbers. Empty state = em-dash per design system.
 * Window / compare / segment filters: ?window=X&compare=Y&segment=Z (URL params).
 */

import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { KpiBox } from '@/components/kpi/KpiBox'
import { PulseTrendTable } from './PulseTrendTable'
import type { SearchParams } from '@/types/next'
import { EMPTY } from '@/lib/format'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KpiToday {
  night_date: string | null
  occupancy_pct: number | null
  adr: number | null
  revpar: number | null
  rooms_sold: number | null
  rooms_revenue: number | null
  // STLY deltas — present in mv_kpi_today if the MV is joined to prior year
  occ_delta_stly_pp: number | null
  adr_delta_stly_pct: number | null
  revpar_delta_stly_pct: number | null
}

export interface KpiDailyRow {
  night_date: string
  occupancy_pct: number | null
  adr: number | null
  revpar: number | null
  rooms_sold: number | null
  rooms_revenue: number | null
}

// ─── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchToday(): Promise<KpiToday | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('mv_kpi_today')
    .select(
      'night_date, occupancy_pct, adr, revpar, rooms_sold, rooms_revenue, occ_delta_stly_pp, adr_delta_stly_pct, revpar_delta_stly_pct'
    )
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[pulse] mv_kpi_today fetch error:', error.message)
    return null
  }
  return data
}

async function fetchTrend(windowDays = 30): Promise<KpiDailyRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('mv_kpi_daily')
    .select('night_date, occupancy_pct, adr, revpar, rooms_sold, rooms_revenue')
    .order('night_date', { ascending: false })
    .limit(windowDays)

  if (error) {
    console.error('[pulse] mv_kpi_daily fetch error:', error.message)
    return []
  }
  return (data ?? []) as KpiDailyRow[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  searchParams?: SearchParams
}

export default async function PulsePage({ searchParams }: Props) {
  // Window param: today (default) | 7d | 30d | 90d | ytd
  const window = (searchParams?.window as string) ?? 'today'
  const windowDays = window === '7d' ? 7 : window === '90d' ? 90 : window === 'ytd' ? 365 : 30

  const [today, trend] = await Promise.all([fetchToday(), fetchTrend(windowDays)])

  return (
    <main style={{ padding: '0 var(--space-6) var(--space-10)' }}>
      <PageHeader
        pillar="Revenue"
        tab="Pulse"
        title={
          <>
            Daily flash —{' '}
            <em style={{ color: 'var(--brass)' }}>
              {today?.night_date ?? 'live'}
            </em>
          </>
        }
        lede="Today's occupancy, ADR, and RevPAR at a glance."
      />

      {/* ── Window selector ─────────────────────────────────────────────────── */}
      <PulseWindowBar active={window} />

      {/* ── Today KPI row ───────────────────────────────────────────────────── */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-8)',
        }}
      >
        <KpiBox
          value={today?.occupancy_pct ?? null}
          unit="pct"
          label="Occupancy"
          delta={
            today?.occ_delta_stly_pp != null
              ? { value: today.occ_delta_stly_pp, unit: 'pp', period: 'STLY' }
              : undefined
          }
          tooltip="Occupancy % · mv_kpi_today · rooms_sold ÷ saleable"
          state={today == null ? 'data-needed' : 'live'}
        />
        <KpiBox
          value={today?.adr ?? null}
          unit="usd"
          label="ADR"
          delta={
            today?.adr_delta_stly_pct != null
              ? { value: today.adr_delta_stly_pct, unit: 'pct', period: 'STLY' }
              : undefined
          }
          tooltip="Average Daily Rate · mv_kpi_today · rooms_revenue ÷ rooms_sold"
          state={today == null ? 'data-needed' : 'live'}
        />
        <KpiBox
          value={today?.revpar ?? null}
          unit="usd"
          label="RevPAR"
          delta={
            today?.revpar_delta_stly_pct != null
              ? { value: today.revpar_delta_stly_pct, unit: 'pct', period: 'STLY' }
              : undefined
          }
          tooltip="Revenue Per Available Room · mv_kpi_today · rooms_revenue ÷ saleable"
          state={today == null ? 'data-needed' : 'live'}
        />
        <KpiBox
          value={today?.rooms_sold ?? null}
          unit="nights"
          label="Rooms Sold"
          tooltip="Rooms sold today · mv_kpi_today"
          state={today == null ? 'data-needed' : 'live'}
        />
        <KpiBox
          value={today?.rooms_revenue ?? null}
          unit="usd"
          label="Room Revenue"
          tooltip="Total room revenue · mv_kpi_today"
          state={today == null ? 'data-needed' : 'live'}
        />
      </section>

      {/* ── Trend table ─────────────────────────────────────────────────────── */}
      <section>
        <h2
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--brass)',
            marginBottom: 'var(--space-3)',
          }}
        >
          {windowDays}-Day Trend — mv_kpi_daily
        </h2>
        <PulseTrendTable rows={trend} />
      </section>
    </main>
  )
}

// ─── Window tab bar (server-safe, no client state) ────────────────────────────

const WINDOWS = [
  { label: 'Today', value: 'today' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
  { label: 'YTD', value: 'ytd' },
] as const

function PulseWindowBar({ active }: { active: string }) {
  return (
    <nav
      aria-label="Time window"
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-6)',
        flexWrap: 'wrap',
      }}
    >
      {WINDOWS.map(({ label, value }) => {
        const isActive = active === value
        return (
          <a
            key={value}
            href={`?window=${value}`}
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '999px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              background: isActive ? 'var(--moss)' : 'var(--paper-deep)',
              color: isActive ? '#fff' : 'var(--ink-muted)',
              border: `1px solid ${isActive ? 'var(--moss)' : 'var(--border)'}`,
              transition: 'background 120ms, color 120ms',
            }}
          >
            {label}
          </a>
        )
      })}
    </nav>
  )
}
