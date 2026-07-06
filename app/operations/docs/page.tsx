// app/operations/docs/page.tsx
// PBS 2026-07-07 evening: Docs stub for Operations. Coming-soon shell —
// intent is to consolidate menus / PAR levels / vendor sheets / training decks
// into one place, mirroring /marketing/docs.
import Link from 'next/link';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';

export default function OperationsDocsPage() {
  const cfg = DEPT_CFG.operations;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/operations/docs',
  }));

  return (
    <DashboardPage title="Operations · Docs" subtitle="library — coming soon" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Ops library" subtitle="menus · PAR levels · vendor sheets · training" density="compact">
          <div style={{ fontSize: 12, color: '#3A3A3A', lineHeight: 1.6, padding: '4px 2px' }}>
            <p style={{ margin: '0 0 8px' }}>
              This will become the single shelf for every non-QA document the ops team uses day-to-day —
              F&amp;B menus, spa treatment lists, transport rate cards, inventory PAR levels, supplier
              product sheets, staff onboarding decks.
            </p>
            <p style={{ margin: '0 0 8px' }}>
              For now, related documents live scattered across the app. Jump to any of these:
            </p>
            <ul style={{ margin: '0 0 8px 18px', padding: 0, fontSize: 12, lineHeight: 1.7 }}>
              <li><Link href="/marketing/docs" style={lnk}>Marketing docs</Link> — brand + collateral</li>
              <li><Link href="/operations/sops" style={lnk}>Ops SOPs</Link> — standard operating procedures</li>
              <li><Link href="/finance/supplier-mapping" style={lnk}>Supplier mapping</Link> — vendor × USALI</li>
              <li><Link href="/operations/suppliers" style={lnk}>Supplier list</Link> — active vendor master</li>
            </ul>
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}

const lnk: React.CSSProperties = { color: '#1F3A2E', textDecoration: 'underline', fontWeight: 600 };
