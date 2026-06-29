// app/operations/staff/_components/LifecycleTabContent.tsx
//
// PBS 2026-05-15: HR Lifecycle parent page. Three sub-tabs via ?view=
// (onboarding / offboarding / warnings). Top KPI band includes a clickable
// "Total Seniority Due" tile → ?drilldown=seniority expands a panel below
// the band with the per-employee indemnización breakdown.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';

import Link from 'next/link';
import StaffTabStrip from './StaffTabStrip';
import OnboardingTabContent from './OnboardingTabContent';
import OffboardingWizardTab from './OffboardingWizardTab';
import WarningsTab from './WarningsTab';
import SeniorityDrilldownTable from './SeniorityDrilldownTable';
import { computeSeniorityForProperty, fmtMoneyEur } from '@/lib/hr/seniority';
import { seniorityHistogramSvg, deptAvgSeniorityBarSvg, deptExposureOrHeadcountBarSvg } from '@/lib/hrCharts';

interface Props {
  propertyId: number;
  propertyLabel?: string;
  searchParams?: { view?: string; drilldown?: string };
  subPagesOverride?: { label: string; href: string }[];
}

type View = 'onboarding' | 'offboarding' | 'warnings';

export default async function LifecycleTabContent({ propertyId, propertyLabel, searchParams, subPagesOverride }: Props) {
  const view: View =
    searchParams?.view === 'warnings'   ? 'warnings'   :
    searchParams?.view === 'onboarding' ? 'onboarding' :
                                           'offboarding';
  const drilldown = searchParams?.drilldown === 'seniority';

  const bundle = await computeSeniorityForProperty(propertyId);
  const isDonna = bundle.isDonna;

  const base = propertyId === 260955 ? '/finance/hr/lifecycle' : `/h/${propertyId}/finance/hr/lifecycle`;
  const eyebrow = propertyLabel ? `HR · Lifecycle · ${propertyLabel}` : 'HR · Lifecycle';

  return (
    <DashboardPage
      title={`Lifecycle · ${propertyLabel ?? 'Property'}`}
      subtitle={eyebrow}
      tabs={(subPagesOverride ?? []).map(s => ({ key: s.href, label: s.label, href: s.href, active: s.label === 'HR' || s.href.endsWith('/finance/hr') || s.href.endsWith('/operations/staff') }))}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <StaffTabStrip propertyId={propertyId} />

      {/* PBS 2026-06-29: seniority band + charts are Donna-only (Lao law n/a) */}
      {isDonna && (<>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, margin: '14px 0 8px' }}>
        <KpiTile label="Active staff" value={bundle.totals.active} hint="Excludes terminated" />
        <KpiTile
          label="Total seniority due"
          value={isDonna ? fmtMoneyEur(bundle.totals.totalUnfair) : 'n/a'}
          hint={isDonna
            ? `Σ indemnización · unfair-dismissal cap (33d/yr · max 24 mo). Salary coverage: ${bundle.totals.withSalary}/${bundle.totals.active} employees. Click for per-employee breakdown.`
            : 'Lao law (Labour Code 2014) has no statutory seniority entitlement comparable to Spain.'}
          tone="warn"
          href={isDonna ? `${base}?view=${view}&drilldown=seniority` : undefined}
          live={drilldown}
        />
        <KpiTile label="Avg aging"      value={`${bundle.totals.avgYears.toFixed(1)} yr`}  hint="Mean seniority across all active staff" />
        <KpiTile label="Departments"    value={bundle.byDepartment.length}                 hint="Distinct departments with active staff" />
        <KpiTile label="Top 5 combined" value={`${bundle.totals.top5Years.toFixed(1)} yr`} hint="Longest-serving 5 staff combined" />
      </div>

      {/* 3 side-by-side SVG charts · seniority distribution · avg aging per dept · exposure per dept (Donna) / headcount per dept (Namkhan) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 12,
        margin: '0 0 8px',
      }}>
        <ChartPanel
          title="Seniority distribution"
          subtitle={`Active staff binned by tenure · ${bundle.totals.active} total`}
          svgMarkup={seniorityHistogramSvg(bundle.buckets)}
        />
        <ChartPanel
          title="Avg aging by department"
          subtitle={`Top 8 by avg years · ${bundle.byDepartment.length} depts active`}
          svgMarkup={deptAvgSeniorityBarSvg(bundle.byDepartment)}
        />
        <ChartPanel
          title={isDonna ? 'Indemnización exposure by dept' : 'Headcount by department'}
          subtitle={isDonna ? '33d/yr cap-24mo · top 8 by exposure' : 'Top 8 by headcount · Lao law n/a for exposure'}
          svgMarkup={deptExposureOrHeadcountBarSvg(bundle.byDepartment, isDonna)}
        />
      </div>
      </>)}

      {drilldown && (
        <Container
          title="Per-employee seniority breakdown"
          subtitle={`${bundle.rows.length} active · sorted by seniority desc`}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 14px 0' }}>
            <Link href={`${base}?view=${view}`} style={{
              padding: '4px 10px', fontFamily: 'var(--mono)', fontSize: 11,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--ink-mute)', border: '1px solid var(--paper-deep)',
              borderRadius: 4, textDecoration: 'none',
            }}>Close ✕</Link>
          </div>
          <SeniorityDrilldownTable rows={bundle.rows} isDonna={isDonna} />
        </Container>
      )}

      <nav style={{
        display: 'flex', gap: 2, marginTop: 14, marginBottom: 6,
        borderBottom: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
      }}>
        {(['onboarding', 'offboarding', 'warnings'] as View[]).map((slug) => {
          const active = slug === view;
          const label = slug === 'onboarding' ? 'Onboarding' : slug === 'offboarding' ? 'Offboarding' : 'Warnings';
          return (
            <Link key={slug} href={`${base}?view=${slug}`} style={{
              padding: '8px 16px',
              fontFamily: 'var(--mono)', fontSize: 11,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: active ? 'var(--ink)' : 'var(--ink-mute)',
              background: active ? 'var(--paper-warm)' : 'transparent',
              borderTop:    active ? '1px solid var(--kpi-frame)' : '1px solid transparent',
              borderLeft:   active ? '1px solid var(--kpi-frame)' : '1px solid transparent',
              borderRight:  active ? '1px solid var(--kpi-frame)' : '1px solid transparent',
              borderBottom: active ? '1px solid var(--paper-warm)' : 'none',
              marginBottom: -1, borderRadius: '4px 4px 0 0',
              textDecoration: 'none', fontWeight: active ? 600 : 400,
            }}>{label}</Link>
          );
        })}
      </nav>

      <div style={{ marginTop: 6 }}>
        {view === 'onboarding' && (
          <OnboardingTabContent propertyId={propertyId} propertyLabel={propertyLabel} embedded />
        )}
        {view === 'offboarding' && (
          <OffboardingWizardTab propertyId={propertyId} bundle={bundle} />
        )}
        {view === 'warnings' && (
          <WarningsTab propertyId={propertyId} bundle={bundle} />
        )}
      </div>
      </div>
    </DashboardPage>
  );
}

function KpiTile({
  label, value, hint, tone, href, live,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'warn';
  href?: string;
  live?: boolean;
}) {
  const accent = tone === 'warn' ? 'var(--st-warn, #C28F2C)' : 'var(--brass)';
  const inner = (
    <div title={hint} style={{
      padding: 12,
      background: live ? 'var(--paper-warm)' : 'var(--paper)',
      border: '1px solid var(--paper-deep)',
      borderLeft: `3px solid ${accent}`,
      borderRadius: 6,
      cursor: href ? 'pointer' : 'default',
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
        color: 'var(--ink-mute)',
      }}>
        {label}{href && <span style={{ marginLeft: 6, color: 'var(--brass)' }}>→</span>}
      </div>
      <div style={{
        marginTop: 4, fontSize: 'var(--t-lg)', fontWeight: 600,
        color: 'var(--ink)', fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link> : inner;
}

function ChartPanel({ title, subtitle, svgMarkup }: { title: string; subtitle: string; svgMarkup: string }) {
  const dataUrl = svgMarkup
    ? `data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup)}`
    : '';
  return (
    <div style={{
      background: 'var(--paper)',
      border: '1px solid var(--paper-deep)',
      borderLeft: '3px solid var(--brass)',
      borderRadius: 6,
      padding: 12,
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
        color: 'var(--ink-mute)',
      }}>{subtitle}</div>
      <div style={{
        marginTop: 2, fontSize: 'var(--t-sm)', fontWeight: 600,
        color: 'var(--ink)',
      }}>{title}</div>
      <div style={{ marginTop: 8 }}>
        {dataUrl ? (
          <img src={dataUrl} alt={title} style={{ width: '100%', height: 'auto', display: 'block' }} />
        ) : (
          <div style={{ padding: 14, color: 'var(--ink-mute)', fontStyle: 'italic', fontSize: 11 }}>No data yet.</div>
        )}
      </div>
    </div>
  );
}
