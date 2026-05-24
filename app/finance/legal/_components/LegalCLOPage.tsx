// app/finance/legal/_components/LegalCLOPage.tsx — PBS #205 v2 (2026-05-25)
// Full primitive adoption: DashboardPage + Container per CLO panel.
// Mounted from /finance/legal and /h/[property_id]/finance/legal — same
// chrome both surfaces, subPagesOverride threads through tabs prop.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';

interface Props {
  propertyId: number;
  propertyLabel?: string;
  subPagesOverride?: { label: string; href: string }[];
}

interface CLOPanelDef {
  title: string;
  subtitle: string;
  icon: string;
  hint: string;
}

const PANELS: CLOPanelDef[] = [
  {
    title: 'Contracts',
    subtitle: 'Counterparty · effective · expiry · notice',
    icon: '§',
    hint: 'Sortable register of every signed contract — supplier, employment, lease, NDA, licence — with renewal alerts and clause-level extracts.',
  },
  {
    title: 'Liabilities',
    subtitle: 'Active claims · provisions · exposure',
    icon: '⚖',
    hint: 'Open litigation, disputed invoices, regulatory provisions. Quantified exposure in operating currency, with status (notified / filed / settled).',
  },
  {
    title: 'Dates calendar',
    subtitle: 'Renewals · hearings · filings',
    icon: '⌖',
    hint: 'Time-axis view of every legal deadline: contract renewals, court hearings, regulatory filings, licence expiries. Colour-coded by 30/60/90-day proximity.',
  },
  {
    title: 'Licenses · deadlines',
    subtitle: 'Operating · sectoral · personal',
    icon: '✱',
    hint: 'Operating licence, alcohol licence, music rights (SGAE/AGEDI), data-protection registration, fire-safety renewals — with countdown to expiry.',
  },
  {
    title: 'Lawyer-mail inbox',
    subtitle: 'External counsel · routed mail only',
    icon: '✉',
    hint: 'Filtered cockpit_tickets feed: only mail from / to external counsel + the legal team. Threaded by case. Replies route back through the same address.',
  },
  {
    title: 'Running cases',
    subtitle: 'DCO 1/2025 · open + closed register',
    icon: '⌛',
    hint: 'Active case dossiers (e.g. DCO 1/2025) with status, next action, owner, evidence index, and the A-G case-file output by Carla / Vera / Sherlock.',
  },
];

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

export default function LegalCLOPage({ propertyId, propertyLabel, subPagesOverride }: Props) {
  const title = `Legal · ${propertyLabel ?? 'Property'}`;
  const subtitle = 'Chief Legal Officer · contracts · liabilities · deadlines · cases';

  const tabs = (subPagesOverride ?? []).map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/finance/legal') }));

  return (
    <DashboardPage title={title} subtitle={subtitle} tabs={tabs.length ? tabs : undefined}>
      {/* Intro context */}
      <div style={fullRow}>
        <Container title="Chief Legal Officer view" subtitle={`one screen for ${propertyLabel ?? 'the property'} · contracts · deadlines · cases`} density="compact">
          <div style={{ fontSize: 13, color: 'var(--ink-soft, #5a5a5a)', lineHeight: 1.55 }}>
            Replaces the scattered legal information that today lives in lawyers' inboxes, gestoría folders and personal calendars. Six panels below — all in scaffolding. Wires to <code>dms.documents</code> (contracts, licences), <code>cockpit_tickets</code> (lawyer mail), and a new <code>legal.cases</code> table (running cases) as each panel comes online.
          </div>
        </Container>
      </div>

      {/* 6 CLO panels — each its own grid cell so they auto-fit on wide screens */}
      {PANELS.map((p) => (
        <Container key={p.title} title={p.title} subtitle={p.subtitle} density="compact">
          <div style={{ padding: '4px 0' }}>
            <div style={{ fontSize: 28, color: 'var(--accent, #b8a878)', opacity: 0.6, marginBottom: 8 }}>{p.icon}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft, #5a5a5a)', lineHeight: 1.5, marginBottom: 12 }}>{p.hint}</div>
            <div style={{
              display: 'inline-block',
              padding: '4px 10px',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#C28F2C',
              background: 'rgba(194,143,44,0.12)',
              border: '1px solid rgba(194,143,44,0.35)',
              borderRadius: 4,
              fontWeight: 700,
            }}>
              Coming soon
            </div>
          </div>
        </Container>
      ))}

      {/* Footer note */}
      <div style={fullRow}>
        <Container title="Agent backing" subtitle="legal-team output already lands in Reports inbox" density="compact">
          <div style={{ fontSize: 12, color: 'var(--ink-soft, #5a5a5a)', lineHeight: 1.5 }}>
            Legal-team agents live in Supabase: <code>legal_specialist_donna</code> (Carla), <code>legal_local_donna</code> (Vera), <code>forensic_detective</code> (Sherlock), <code>background_checker_donna</code> (Lince). Their output already files into the Reports inbox via <code>cockpit_tickets · source='agent_delivery'</code> — the panels above will surface it once the CLO data layer is wired.
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
