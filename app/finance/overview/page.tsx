// app/finance/overview/page.tsx
// PBS 2026-07-07: dedicated Finance Overview landing. The HoD chat cockpit
// stays at /finance; Overview is the dept-wide summary with entry cards
// linking to the major finance groups (Finance / Transactions / HR / Budget
// / Working capital / Reports).
import Link from 'next/link';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';

export default function FinanceOverviewPage() {
  const cfg = DEPT_CFG.finance;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/finance/overview',
  }));

  return (
    <DashboardPage title="Finance · Overview" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
        <Container title="Finance" subtitle="P&L · Ledger · Account mapping" density="compact">
          <div style={desc}>
            USALI P&L snapshot, general ledger by account, and the mapping table that
            keeps every GL account tied to the right USALI line.
            <div style={{ marginTop: 8 }}>
              <Link href="/finance/pnl" style={btn}>Open Finance →</Link>
            </div>
          </div>
        </Container>

        <Container title="Transactions" subtitle="folio + POS reconciliation" density="compact">
          <div style={desc}>
            Folio-level transactions, POS · PMS reconciliation, and POS · Poster feed.
            Everything that flows before it lands in the ledger.
            <div style={{ marginTop: 8 }}>
              <Link href="/finance/transactions" style={btn}>Open Transactions →</Link>
            </div>
          </div>
        </Container>

        <Container title="HR" subtitle="people · payroll · roster" density="compact">
          <div style={desc}>
            Staff roster, headcount, payroll cost centres. Moved from Operations so
            people-cost sits where it belongs — with the books.
            <div style={{ marginTop: 8 }}>
              <Link href="/finance/hr" style={btn}>Open HR →</Link>
            </div>
          </div>
        </Container>

        <Container title="Budget" subtitle="annual plan · vs actual" density="compact">
          <div style={desc}>
            Current budget lines with month-by-month tracking against actuals from
            the ledger.
            <div style={{ marginTop: 8 }}>
              <Link href="/finance/budget" style={btn}>Open Budget →</Link>
            </div>
          </div>
        </Container>

        <Container title="Working capital" subtitle="Cashflow · Variance · AP / AR" density="compact">
          <div style={desc}>
            Cash on hand, variance vs budget, and open AP / AR positions — the
            three tabs that keep short-term liquidity honest.
            <div style={{ marginTop: 8 }}>
              <Link href="/finance/cashflow" style={btn}>Open Working capital →</Link>
            </div>
          </div>
        </Container>

        <Container title="Reports" subtitle="printable finance packs" density="compact">
          <div style={desc}>
            Saved report templates and the report builder — printable P&L, ledger
            exports, cash summaries.
            <div style={{ marginTop: 8 }}>
              <Link href="/h/260955/reports?dept=finance" style={btn}>Open Reports →</Link>
            </div>
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}

const desc: React.CSSProperties = { fontSize: 12, color: '#3A3A3A', lineHeight: 1.55, padding: '4px 2px' };
const btn: React.CSSProperties = { display: 'inline-block', padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#FFFFFF', color: '#1F3A2E', border: '1px solid #1F3A2E', borderRadius: 3, textDecoration: 'none' };
