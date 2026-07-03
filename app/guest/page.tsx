// app/guest/page.tsx
// PBS 2026-07-03: Guest HoD swapped from legacy DeptEntry (chat hero + 3
// containers on dark chrome) to a lean paper-white DashboardPage. No chat
// composer — the Guest area doesn't need a dedicated chat page per PBS.
// Everything else the operator needs is behind the sub-page strip.

import Link from 'next/link';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default function GuestPage() {
  const cfg = DEPT_CFG.guest;
  const tabs: DashboardTab[] = cfg.subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/guest',
  }));

  const attn = cfg.defaultAttn ?? [];
  const docs = cfg.defaultDocs ?? [];
  const chips = cfg.quickChips ?? [];

  const severityTone: Record<string, string> = {
    high:   '#B03826',
    medium: '#8B5A1C',
    low:    '#1F5C2C',
  };

  return (
    <DashboardPage
      title={`Guest · ${cfg.hodName}`}
      subtitle={cfg.hodTagline}
      tabs={tabs}
    >
      {/* Quick chips — the interactive pages the operator reaches for */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {chips.map((c) => (
          <Link key={c.href} href={c.href} style={chipStyle}>{c.label}</Link>
        ))}
      </div>

      {/* Attention · Docs · quick summary in a 3-col grid */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <Container title={`Attention · ${attn.length}`} subtitle="reputation · journey · loyalty flags" density="compact">
          {attn.length === 0 ? (
            <div style={emptyStyle}>Nothing flagged.</div>
          ) : (
            <ul style={ulReset}>
              {attn.map((a) => (
                <li key={a.id} style={rowStyle}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: severityTone[a.severity] ?? '#8A8A8A', marginRight: 8, marginTop: 5 }} />
                  <span style={{ color: '#1B1B1B', fontSize: 12 }}>{a.label}</span>
                </li>
              ))}
            </ul>
          )}
        </Container>

        <Container title={`My docs · ${docs.length}`} subtitle="playbooks · templates · maps" density="compact">
          {docs.length === 0 ? (
            <div style={emptyStyle}>No docs pinned.</div>
          ) : (
            <ul style={ulReset}>
              {docs.map((d) => (
                <li key={d.id} style={rowStyle}>
                  <a href={d.href} style={{ color: '#1B1B1B', textDecoration: 'underline', textDecorationColor: '#C79A6B', fontSize: 12 }}>{d.label}</a>
                </li>
              ))}
            </ul>
          )}
        </Container>

        <Container title="Where to next" subtitle="jump into a live tool" density="compact">
          <ul style={ulReset}>
            <li style={rowStyle}><a href="/guest/directory"  style={linkStyle}>Guest directory</a> — search + open profile</li>
            <li style={rowStyle}><a href="/guest/reputation" style={linkStyle}>Reputation</a> — reviews + reply queue</li>
            <li style={rowStyle}><a href="/guest/journey"    style={linkStyle}>Journey</a> — pre-arrival → post-stay stages</li>
            <li style={rowStyle}><a href="/guest/loyalty"    style={linkStyle}>Loyalty</a> — tier ladder</li>
            <li style={rowStyle}><a href="/guest/findings"   style={linkStyle}>Findings</a> — patterns + anomalies</li>
          </ul>
        </Container>
      </div>
    </DashboardPage>
  );
}

const chipStyle: React.CSSProperties = {
  padding: '5px 12px',
  background: '#FFFFFF',
  color: '#1B1B1B',
  border: '1px solid #E6DFCC',
  borderRadius: 99,
  fontSize: 11,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};
const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 6,
  padding: '4px 0',
  fontSize: 12,
  color: '#1B1B1B',
  lineHeight: 1.5,
};
const linkStyle: React.CSSProperties = {
  color: '#1F3A2E',
  textDecoration: 'underline',
  textDecorationColor: '#C79A6B',
  marginRight: 4,
};
const emptyStyle: React.CSSProperties = {
  padding: '10px 8px',
  fontSize: 12,
  color: '#5A5A5A',
  fontStyle: 'italic',
};
const ulReset: React.CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};
