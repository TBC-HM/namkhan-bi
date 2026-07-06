// app/marketing/digital/page.tsx
// PBS 2026-07-06 evening: landing stub — full page comes in a follow-up push.
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';

export default function DigitalPage() {
  const cfg = DEPT_CFG.marketing;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/digital',
  }));
  return (
    <DashboardPage title="Marketing · Digital" subtitle="Digital surfaces — website, GBP, mobile, integrations." tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={stub}>
          <div style={stubTitle}>Digital</div>
          <div>Digital surfaces — website, GBP, mobile, integrations.</div>
          <div style={stubHint}>Landing placeholder — content flows in from the next push.</div>
        </div>
      </div>
    </DashboardPage>
  );
}

const stub: React.CSSProperties = { padding: '32px 20px', background: '#FAFAF7', border: '1px dashed #E6DFCC', borderRadius: 6, textAlign: 'center', color: '#5A5A5A', fontSize: 12, lineHeight: 1.6 };
const stubTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#1B1B1B', marginBottom: 4 };
const stubHint: React.CSSProperties = { marginTop: 12, fontSize: 11, fontStyle: 'italic' };
