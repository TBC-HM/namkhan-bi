// app/operations/overview/page.tsx
// PBS 2026-07-07 evening: dedicated Operations Overview landing. The HoD chat
// cockpit stays at /operations; Overview is the dept-wide summary with
// Departments / QA / Docs / Suppliers sub-tabs rendered by DashboardPage.
// Mirrors the /revenue/overview shape (same 6-card grid pattern).
import Link from 'next/link';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';

export default function OperationsOverviewPage() {
  const cfg = DEPT_CFG.operations;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/operations/overview',
  }));

  return (
    <DashboardPage title="Operations · Overview" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
        <Container title="Departments" subtitle="7 revenue-producing depts" density="compact">
          <div style={desc}>
            Rooms · F&B · Spa · Activities · Retail · Transport · Other — daily covers, occupancy, avg ticket.
            <div style={{ marginTop: 8 }}>
              <Link href="/operations/rooms" style={btn}>Open Departments →</Link>
            </div>
          </div>
        </Container>

        <Container title="QA" subtitle="SOPs + quality audits" density="compact">
          <div style={desc}>
            Standard operating procedures, audit trails, compliance checklists.
            <div style={{ marginTop: 8 }}>
              <Link href="/operations/sops" style={btn}>Open QA →</Link>
            </div>
          </div>
        </Container>

        <Container title="Docs" subtitle="ops library" density="compact">
          <div style={desc}>
            Menus · PAR levels · vendor sheets · training decks — one shelf for the whole ops team.
            <div style={{ marginTop: 8 }}>
              <Link href="/operations/docs" style={btn}>Open Docs →</Link>
            </div>
          </div>
        </Container>

        <Container title="Suppliers" subtitle="vendor master" density="compact">
          <div style={desc}>
            Active suppliers · spend · category · payment terms — pulled from gl.vendors + finance overview.
            <div style={{ marginTop: 8 }}>
              <Link href="/operations/suppliers" style={btn}>Open Suppliers →</Link>
            </div>
          </div>
        </Container>

        <Container title="Rooms today" subtitle="live occupancy anchor" density="compact">
          <div style={desc}>
            Direct shortcut to the Rooms dept view — the anchor for daily ops.
            <div style={{ marginTop: 8 }}>
              <Link href="/operations/rooms" style={btn}>Open Rooms →</Link>
            </div>
          </div>
        </Container>

        <Container title="Reports" subtitle="printable exports" density="compact">
          <div style={desc}>
            Cross-dept ops reports — covers, revenue, capture rate, waste.
            <div style={{ marginTop: 8 }}>
              <Link href="/h/260955/reports?dept=operations" style={btn}>Open Reports →</Link>
            </div>
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}

const desc: React.CSSProperties = { fontSize: 12, color: '#3A3A3A', lineHeight: 1.55, padding: '4px 2px' };
const btn: React.CSSProperties = { display: 'inline-block', padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#FFFFFF', color: '#1F3A2E', border: '1px solid #1F3A2E', borderRadius: 3, textDecoration: 'none' };
