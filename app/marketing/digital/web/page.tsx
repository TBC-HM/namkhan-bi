// app/marketing/digital/web/page.tsx
// PBS 2026-07-21 · Web stub — placeholder for Bluehost integration + funnel wiring.
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';

const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#5A5A5A';

export default function DigitalWebPage() {
  const cfg = DEPT_CFG.marketing;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/digital',
  }));

  return (
    <DashboardPage title="Marketing · Digital · Web" subtitle="Website surfaces." tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{
          padding: '32px 20px', background: '#FFFFFF', border: `1px dashed ${HAIR}`,
          borderRadius: 6, textAlign: 'center', color: INK_S, fontSize: 12, lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 4 }}>Web</div>
          <div>Coming soon: Bluehost integration + funnel wiring.</div>
        </div>
      </div>
    </DashboardPage>
  );
}
