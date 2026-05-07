// app/revenue/page.tsx
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface TacticalAlert {
  id: string;
  title: string;
  severity: string;
  created_at: string;
}

interface PlRow {
  month: string;
  total_revenue: number | null;
  rooms_revenue: number | null;
}

const REVENUE_SECTIONS = [
  {
    href: '/revenue/compset',
    label: 'Comp Set',
    description: 'Rate benchmarking vs competing properties',
    icon: '📊',
  },
  {
    href: '/revenue/parity',
    label: 'Parity',
    description: 'Channel rate parity monitoring & alerts',
    icon: '⚖️',
  },
  {
    href: '/revenue/channels',
    label: 'Channels',
    description: 'OTA & direct channel breakdown, Booking.com analytics',
    icon: '📡',
  },
  {
    href: '/revenue/pace',
    label: 'Pace',
    description: 'Pick-up pace vs same time last year',
    icon: '📈',
  },
];

export default async function RevenuePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Pull latest P&L row for headline KPIs
  const { data: plData } = await supabase
    .from('v_pl_monthly_usali')
    .select('month, total_revenue, rooms_revenue')
    .order('month', { ascending: false })
    .limit(1);

  const latest: PlRow | null = plData?.[0] ?? null;

  // Pull top tactical alerts for revenue context
  const { data: alertData } = await supabase
    .from('v_tactical_alerts_top')
    .select('id, title, severity, created_at')
    .limit(4);

  const alerts: TacticalAlert[] = alertData ?? [];

  const fmtUSD = (v: number | null | undefined) =>
    v == null ? '—' : `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <main style={{ padding: '0 0 48px' }}>
      <PageHeader pillar="Revenue" tab="Overview" title="Revenue" />

      {/* ── Headline KPIs ── */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          padding: '24px 24px 0',
        }}
      >
        <KpiBox
          label="Total Revenue (latest month)"
          value={fmtUSD(latest?.total_revenue)}
          sub={latest?.month ?? '—'}
        />
        <KpiBox
          label="Rooms Revenue"
          value={fmtUSD(latest?.rooms_revenue)}
          sub={latest?.month ?? '—'}
        />
      </section>

      {/* ── Sub-section nav cards ── */}
      <section style={{ padding: '32px 24px 0' }}>
        <h2
          style={{
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 'var(--t-xl)',
            fontWeight: 600,
            marginBottom: 16,
            color: 'var(--color-text)',
          }}
        >
          Revenue sections
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {REVENUE_SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              style={{
                display: 'block',
                padding: '20px 20px 18px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                textDecoration: 'none',
                color: 'var(--color-text)',
                transition: 'box-shadow 0.15s ease',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
              <div
                style={{
                  fontFamily: 'var(--serif)',
                  fontStyle: 'italic',
                  fontSize: 'var(--t-xl)',
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 'var(--t-sm)',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.5,
                }}
              >
                {s.description}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Tactical alerts ── */}
      {alerts.length > 0 && (
        <section style={{ padding: '32px 24px 0' }}>
          <h2
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 'var(--t-xl)',
              fontWeight: 600,
              marginBottom: 16,
              color: 'var(--color-text)',
            }}
          >
            Active alerts
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 'var(--t-xs)',
                    letterSpacing: 'var(--ls-extra)',
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background:
                      a.severity === 'critical'
                        ? 'var(--color-bad)'
                        : a.severity === 'high'
                        ? 'var(--color-warn)'
                        : 'var(--color-neutral)',
                    color: 'var(--color-text-on-accent)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.severity ?? '—'}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--sans)',
                    fontSize: 'var(--t-md)',
                    flex: 1,
                  }}
                >
                  {a.title ?? '—'}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 'var(--t-xs)',
                    color: 'var(--color-text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.created_at ? a.created_at.slice(0, 10) : '—'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
