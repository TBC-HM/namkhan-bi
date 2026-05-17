// app/finance/legal/_components/LegalCLOPage.tsx
//
// PBS 2026-05-16: Chief Legal Officer dashboard. Six panels (all "Coming
// Soon" placeholders for now): Contracts · Liabilities · Calendar of dates
// + deadlines · Licenses · Lawyer-mail Inbox · Running Cases. Renders the
// same on Namkhan and Donna. Mounted from /finance/legal and
// /h/[property_id]/finance/legal.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';

interface Props {
  propertyId: number;
  propertyLabel?: string;
  subPagesOverride?: { label: string; href: string }[];
}

interface CLOPanelDef {
  title: string;
  eyebrow: string;
  icon: string;
  hint: string;
}

const PANELS: CLOPanelDef[] = [
  {
    title: 'Contracts',
    eyebrow: 'Counterparty · effective · expiry · notice',
    icon: '§',
    hint: 'Sortable register of every signed contract — supplier, employment, lease, NDA, licence — with renewal alerts and clause-level extracts.',
  },
  {
    title: 'Liabilities',
    eyebrow: 'Active claims · provisions · exposure',
    icon: '⚖',
    hint: 'Open litigation, disputed invoices, regulatory provisions. Quantified exposure in operating currency, with status (notified / filed / settled).',
  },
  {
    title: 'Dates calendar',
    eyebrow: 'Renewals · hearings · filings',
    icon: '⌖',
    hint: 'Time-axis view of every legal deadline: contract renewals, court hearings, regulatory filings, licence expiries. Colour-coded by 30/60/90-day proximity.',
  },
  {
    title: 'Licenses · deadlines',
    eyebrow: 'Operating · sectoral · personal',
    icon: '✱',
    hint: 'Operating licence, alcohol licence, music rights (SGAE/AGEDI), data-protection registration, fire-safety renewals — with countdown to expiry.',
  },
  {
    title: 'Lawyer-mail inbox',
    eyebrow: 'External counsel · routed mail only',
    icon: '✉',
    hint: 'Filtered cockpit_tickets feed: only mail from / to external counsel + the legal team. Threaded by case. Replies route back through the same address.',
  },
  {
    title: 'Running cases',
    eyebrow: 'DCO 1/2025 · open + closed register',
    icon: '⌛',
    hint: 'Active case dossiers (e.g. DCO 1/2025) with status, next action, owner, evidence index, and the A-G case-file output by Carla / Vera / Sherlock.',
  },
];

export default function LegalCLOPage({ propertyId, propertyLabel, subPagesOverride }: Props) {
  const eyebrow = propertyLabel
    ? `Finance · Legal · ${propertyLabel}`
    : 'Finance · Legal';

  return (
    <Page
      eyebrow={eyebrow}
      title={
        <>
          Legal · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{propertyLabel ?? ''}</em>
        </>
      }
      subPages={subPagesOverride}
    >
      <div style={{
        margin: '8px 0 18px',
        padding: '14px 16px',
        fontSize: 'var(--t-sm)',
        color: 'var(--ink-soft)',
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderLeft: '3px solid var(--brass)',
        borderRadius: 6,
      }}>
        <strong style={{ color: 'var(--brass)' }}>Chief Legal Officer view.</strong>{' '}
        One screen for every contract, liability, deadline and case running across {propertyLabel ?? 'the property'}. Replaces the
        scattered legal information that today lives in lawyers' inboxes, gestoría folders and personal calendars.
        Six panels below — all in scaffolding. Wires to <code>dms.documents</code> (contracts, licences),{' '}
        <code>cockpit_tickets</code> (lawyer mail), and a new <code>legal.cases</code> table (running cases) as each
        panel comes online.
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 14,
      }}>
        {PANELS.map((p) => (
          <Panel key={p.title} title={p.title} eyebrow={p.eyebrow}>
            <div style={{ padding: 14 }}>
              <div style={{
                fontSize: 28,
                color: 'var(--brass)',
                opacity: 0.6,
                marginBottom: 8,
              }}>{p.icon}</div>
              <div style={{
                fontSize: 'var(--t-sm)',
                color: 'var(--ink-soft)',
                lineHeight: 1.5,
                marginBottom: 12,
              }}>{p.hint}</div>
              <div style={{
                display: 'inline-block',
                padding: '4px 10px',
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)',
                textTransform: 'uppercase',
                color: 'var(--st-warn, #C28F2C)',
                background: 'rgba(194,143,44,0.12)',
                border: '1px solid rgba(194,143,44,0.35)',
                borderRadius: 4,
                fontWeight: 700,
              }}>
                Coming soon
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <div style={{
        marginTop: 18,
        padding: '12px 14px',
        fontSize: 'var(--t-xs)',
        color: 'var(--ink-mute)',
        fontStyle: 'italic',
        textAlign: 'center',
      }}>
        Legal-team agents already live in Supabase: <code>legal_specialist_donna</code> (Carla),{' '}
        <code>legal_local_donna</code> (Vera), <code>forensic_detective</code> (Sherlock),{' '}
        <code>background_checker_donna</code> (Lince). Their output already files into the
        Reports inbox under <code>cockpit_tickets · arm=&apos;agent_delivery&apos;</code> —
        the panels above will surface it once the CLO data layer is wired.
      </div>
    </Page>
  );
}
