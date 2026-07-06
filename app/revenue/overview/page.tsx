// app/revenue/overview/page.tsx
// PBS 2026-07-07 evening: dedicated Revenue Overview landing. The HoD chat
// cockpit stays at /revenue; Overview is the dept-wide summary with
// Pulse + Calendar sub-tabs rendered by DashboardPage.
import Link from 'next/link';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';

export default function RevenueOverviewPage() {
  const cfg = DEPT_CFG.revenue;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/revenue/overview',
  }));

  return (
    <DashboardPage title="Revenue · Overview" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
        <Container title="Pulse" subtitle="right-now revenue health" density="compact">
          <div style={desc}>
            Live occupancy · ADR · RevPAR · pickup vs LY · yield alerts.
            <div style={{ marginTop: 8 }}>
              <Link href="/revenue/pulse" style={btn}>Open Pulse →</Link>
            </div>
          </div>
        </Container>

        <Container title="Calendar" subtitle="forward rate + density grid" density="compact">
          <div style={desc}>
            BAR ladder · density overlay · country holidays · rate + inventory levers.
            <div style={{ marginTop: 8 }}>
              <Link href="/revenue/pricing" style={btn}>Open Calendar →</Link>
            </div>
          </div>
        </Container>

        <Container title="Demand & Pace" subtitle="how the year is shaping up" density="compact">
          <div style={desc}>
            OTB vs STLY · lead time · cancellations · pace by check-in month.
            <div style={{ marginTop: 8 }}>
              <Link href="/revenue/demand" style={btn}>Open Demand & Pace →</Link>
            </div>
          </div>
        </Container>

        <Container title="Performance" subtitle="mix breakdown by segment" density="compact">
          <div style={desc}>
            Rooms · channels · rate plans · markets — where the revenue actually comes from.
            <div style={{ marginTop: 8 }}>
              <Link href="/revenue/rooms" style={btn}>Open Performance →</Link>
            </div>
          </div>
        </Container>

        <Container title="Market & Control" subtitle="external + leakage lens" density="compact">
          <div style={desc}>
            Comp set · leakage · parity — what the competition is doing and where OTAs are draining margin.
            <div style={{ marginTop: 8 }}>
              <Link href="/revenue/compset" style={btn}>Open Market & Control →</Link>
            </div>
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}

const desc: React.CSSProperties = { fontSize: 12, color: '#3A3A3A', lineHeight: 1.55, padding: '4px 2px' };
const btn: React.CSSProperties = { display: 'inline-block', padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#FFFFFF', color: '#1F3A2E', border: '1px solid #1F3A2E', borderRadius: 3, textDecoration: 'none' };
