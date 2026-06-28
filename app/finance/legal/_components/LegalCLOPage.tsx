// app/finance/legal/_components/LegalCLOPage.tsx
// Chief Legal Officer landing page. Mounted at /finance/legal (Namkhan
// default) and /h/[property_id]/finance/legal — shared component, propertyId
// threads through. Six containers in a 3×2 grid:
//   1. Contracts            — counts by status (wired); tiles click into
//                             /register/contracts?status=
//   2. Insurances           — wired, flags past-expiry; tiles click into
//                             /register/insurance?status=
//   3. Dates calendar       — placeholder (not yet wired)
//   4. Licenses · deadlines — wired, expiry breakdown; tiles click into
//                             /register/licenses?status=
//   5. Lawyer-mail inbox    — placeholder
//   6. Running cases        — wired (case_ref list links to /cases/[ref])
// Plus a dynamic legal-team strip at the bottom: clickable chat cards for
// every active legal-department agent.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import LegalQuickActions from './LegalQuickActions';

interface Props {
  propertyId: number;
  propertyLabel?: string;
  subPagesOverride?: { label: string; href: string }[];
}

interface CaseLink {
  case_ref: string;
  title: string | null;
  status: string | null;
  n_docs: number;
}

interface AgentLink {
  role: string;
  display_name: string | null;
  dept: string | null;
  avatar: string | null;
  tagline: string | null;
  scope_label: string | null;
}

interface ContractTallies {
  total: number;
  active: number;
  draft: number;
  other: number;
}

interface InsuranceTallies {
  total: number;
  active: number;
  past_expiry: number;
  next_expiry: string | null;
}

interface LicenseTallies {
  total: number;
  expired: number;
  expiring_90d: number;
  current: number;
  no_expiry: number;
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

const CONTRACT_SUBTYPES = [
  'contract','lease_agreement','loan_agreement','security_agreement',
  'share_pledge','share_transfer','partnership_agreement',
] as const;

// Application title heuristic — peeled off from the License pool so the tile
// shows true issued-licenses count.
const APP_RE = /\bapplication\b|\benquiry letter\b|\brequest letter\b|\bnotice of (company )?dissolution\b|\bliquidator/i;
const isApp = (t: string | null | undefined, f: string | null | undefined) => APP_RE.test(`${t ?? ''} ${f ?? ''}`);

export default async function LegalCLOPage({ propertyId, propertyLabel, subPagesOverride }: Props) {
  const title = `Legal · ${propertyLabel ?? 'Property'}`;
  const subtitle = `Chief Legal Officer view — single screen for ${propertyLabel ?? 'the property'} · contracts · insurance · licenses · cases · counsel`;

  const tabs = (subPagesOverride ?? []).map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/finance/legal'),
  }));

  const supabase = getSupabaseAdmin();

  // ── Running cases ────────────────────────────────────────────────────────
  const { data: caseRows } = await supabase
    .from('v_doc_cases')
    .select('case_ref, title, status, n_docs')
    .eq('property_id', propertyId)
    .order('case_ref');
  const runningCases: CaseLink[] = ((caseRows ?? []) as Partial<CaseLink>[]).map((c) => ({
    case_ref: c.case_ref ?? '',
    title: c.title ?? null,
    status: c.status ?? null,
    n_docs: typeof c.n_docs === 'number' ? c.n_docs : 0,
  })).filter((c) => c.case_ref);

  // ── Contracts ────────────────────────────────────────────────────────────
  const { data: contractRows } = await supabase
    .from('v_doc_register')
    .select('doc_id,status')
    .eq('property_id', propertyId)
    .neq('status', 'archived')
    .eq('doc_type', 'legal')
    .in('doc_subtype', CONTRACT_SUBTYPES as unknown as string[]);
  const contracts: ContractTallies = (contractRows ?? []).reduce<ContractTallies>((acc, r: { status: string }) => {
    acc.total++;
    if (r.status === 'active') acc.active++;
    else if (r.status === 'draft') acc.draft++;
    else acc.other++;
    return acc;
  }, { total: 0, active: 0, draft: 0, other: 0 });

  // ── Insurances ───────────────────────────────────────────────────────────
  const { data: insRows } = await supabase
    .from('v_doc_register')
    .select('doc_id,status,expiry_date')
    .eq('property_id', propertyId)
    .neq('status', 'archived')
    .eq('doc_type', 'insurance');
  const today = new Date().toISOString().slice(0, 10);
  const insRowsArr = (insRows ?? []) as { status: string; expiry_date: string | null }[];
  const insurance: InsuranceTallies = {
    total: insRowsArr.length,
    active: insRowsArr.filter((r) => r.status === 'active').length,
    past_expiry: insRowsArr.filter((r) => r.expiry_date && r.expiry_date < today).length,
    next_expiry: insRowsArr
      .map((r) => r.expiry_date)
      .filter((d): d is string => !!d && d >= today)
      .sort()[0] ?? null,
  };

  // ── Licenses / deadlines ─────────────────────────────────────────────────
  const { data: licRows1 } = await supabase
    .from('v_doc_register')
    .select('doc_id,doc_type,doc_subtype,expiry_date,title,file_name')
    .eq('property_id', propertyId)
    .neq('status', 'archived')
    .eq('doc_type', 'compliance');
  const { data: licRows2 } = await supabase
    .from('v_doc_register')
    .select('doc_id,doc_type,doc_subtype,expiry_date,title,file_name')
    .eq('property_id', propertyId)
    .neq('status', 'archived')
    .eq('doc_type', 'legal')
    .in('doc_subtype', [
      'articles_of_association','shareholder_resolution','power_of_attorney',
      'enterprise_registration','business_registration','land_title_deed','property_deed',
    ]);
  const licPool = [...(licRows1 ?? []), ...(licRows2 ?? [])] as { expiry_date: string | null; title: string | null; file_name: string | null }[];
  const apps = licPool.filter((r) => isApp(r.title, r.file_name));
  const licArr = licPool.filter((r) => !isApp(r.title, r.file_name));
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const licenses: LicenseTallies = {
    total: licArr.length,
    expired: licArr.filter((r) => r.expiry_date && r.expiry_date < today).length,
    expiring_90d: licArr.filter((r) => r.expiry_date && r.expiry_date >= today && r.expiry_date <= in90).length,
    current: licArr.filter((r) => r.expiry_date && r.expiry_date > in90).length,
    no_expiry: licArr.filter((r) => !r.expiry_date).length,
  };
  const applicationsCount = apps.length;
  const applicationsActive = apps.filter((r) => true).length;

  // ── Legal agents ─────────────────────────────────────────────────────────
  // Use the 'all' scope: every legal agent is scoped Holding (John, Carla,
  // Sherlock) or Donna (Vera); calling with p_scope='namkhan' previously
  // returned an empty list. We de-dupe by role since 'all' returns multiple
  // rows per agent (one per scope they're visible from).
  const { data: roster } = await supabase.rpc('cockpit_agent_roster', { p_scope: 'all' });
  const seenRoles = new Set<string>();
  const legalAgents: AgentLink[] = (Array.isArray(roster) ? roster : [])
    .filter((r: { dept?: string; role?: string; status?: string }) =>
      r.status === 'active' && (r.dept === 'legal' || (r.role ?? '').includes('legal'))
    )
    .filter((r: { role?: string }) => {
      const role = r.role ?? '';
      if (!role || seenRoles.has(role)) return false;
      seenRoles.add(role);
      return true;
    })
    .map((r: Partial<AgentLink>) => ({
      role: r.role ?? '',
      display_name: r.display_name ?? null,
      dept: r.dept ?? null,
      avatar: r.avatar ?? null,
      tagline: r.tagline ?? null,
      scope_label: r.scope_label ?? null,
    }))
    .filter((a) => a.role);
  // For the property's primary specialist: John for Namkhan, Carla for Donna.
  const primaryRole = propertyId === 260955 ? 'legal_specialist'
                    : propertyId === 1000001 ? 'legal_specialist_donna'
                    : null;

  // Per-property strip: ONLY the primary specialist (PBS 2026-06-29).
  // Namkhan → John; Donna → Carla. Other legal agents stay in the registry
  // but aren't pinned on this landing page.
  const visibleAgents: AgentLink[] = primaryRole
    ? legalAgents.filter((a) => a.role === primaryRole)
    : legalAgents;

  const reg = (s: 'contracts' | 'insurance' | 'licenses') => `/h/${propertyId}/finance/legal/register/${s}`;

  return (
    <DashboardPage title={title} subtitle={subtitle} tabs={tabs.length ? tabs : undefined}>
      {/* Intro */}
      <div style={fullRow}>
        <Container title="Chief Legal Officer view" subtitle={`one screen for ${propertyLabel ?? 'the property'} · contracts · insurance · licenses · cases · counsel`} density="compact">
          <div style={{ fontSize: 13, color: 'var(--ink-soft, #5a5a5a)', lineHeight: 1.55 }}>
            Everything legally relevant to {propertyLabel ?? 'this property'} in one place: the contract stack, insurance coverage, license / permit renewals, ongoing litigation, and a direct line to {propertyId === 260955 ? 'John (Lao legal counsel)' : propertyId === 1000001 ? 'Carla (holding legal lead) and Vera (Balearic labour-law specialist)' : 'the legal team'}. Each tile below counts what's in <code>dms.documents</code> right now; click a metric to drill into that subset, click into a case to see its dossier, or drop a question into the chat at the bottom.
          </div>
        </Container>
      </div>

      {/* Quick actions — upload + drop-to-translate + drop-to-summarize + chat */}
      <div style={fullRow}>
        <Container title="Quick actions" subtitle="Open the editable Docs register · drop a file to translate or summarize · upload a doc · chat with John" density="compact">
          <div style={{ marginBottom: 10 }}>
            <a href={`/h/${propertyId}/finance/legal/docs`} style={{
              display: 'inline-block', padding: '6px 12px',
              border: '1px solid #1B1B1B', borderRadius: 3,
              background: '#1B1B1B', color: '#FFFFFF', textDecoration: 'none',
              fontSize: 12, fontWeight: 500,
            }}>
              📋 Open Docs register →
            </a>
          </div>
          <LegalQuickActions propertyId={propertyId} />
        </Container>
      </div>

      {/* Daily brief — surfaces the urgent counters in one glance */}
      <div style={fullRow}>
        <Container title="Daily brief · what needs you" subtitle="Auto-rolls up the most urgent counters across every panel below" density="compact">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#1B1B1B' }}>
            {licenses.expired > 0 && (
              <li style={briefRowDanger}>
                <strong style={{ color: '#C62828' }}>🔴 {licenses.expired} license{licenses.expired === 1 ? '' : 's'} expired</strong>
                <a href={`/h/${propertyId}/finance/legal/register/licenses?status=expired`} style={briefLink}>open →</a>
              </li>
            )}
            {licenses.expiring_90d > 0 && (
              <li style={briefRowWarn}>
                <strong style={{ color: '#B8860B' }}>🟡 {licenses.expiring_90d} license{licenses.expiring_90d === 1 ? '' : 's'} expiring within 90 days</strong>
                <a href={`/h/${propertyId}/finance/legal/register/licenses?status=expiring_90d`} style={briefLink}>open →</a>
              </li>
            )}
            {insurance.past_expiry > 0 && (
              <li style={briefRowDanger}>
                <strong style={{ color: '#C62828' }}>🔴 {insurance.past_expiry} insurance{insurance.past_expiry === 1 ? '' : 's'} past expiry</strong>
                <a href={`/h/${propertyId}/finance/legal/register/insurance?status=past_expiry`} style={briefLink}>open →</a>
              </li>
            )}
            {runningCases.length > 0 && (
              <li style={briefRowNeutral}>
                <strong>⌛ {runningCases.length} running case{runningCases.length === 1 ? '' : 's'}: {runningCases.map(c => c.case_ref).join(' · ')}</strong>
                <a href={`/h/${propertyId}/finance/legal/cases/${encodeURIComponent(runningCases[0]?.case_ref ?? '')}`} style={briefLink}>open first →</a>
              </li>
            )}
            {licenses.expired === 0 && licenses.expiring_90d === 0 && insurance.past_expiry === 0 && runningCases.length === 0 && (
              <li style={briefRowNeutral}>
                <strong style={{ color: '#5A5A5A' }}>✓ nothing urgent on file</strong>
              </li>
            )}
          </ul>
        </Container>
      </div>

      {/* Sublinks — docs register lives here now (removed from main strip) */}
      <div style={fullRow}>
        <Container title="Document register" subtitle="Triage / edit / classify every doc · property-scoped" density="compact">
          <a href={`/h/${propertyId}/finance/legal/docs`} style={{
            display: 'inline-block', padding: '6px 12px',
            border: '1px solid #1B1B1B', borderRadius: 3,
            background: '#1B1B1B', color: '#FFFFFF', textDecoration: 'none',
            fontSize: 12, fontWeight: 500,
          }}>
            📋 Open Docs register →
          </a>
          <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 6 }}>
            The full editable doc-triage page. Use the read-only registers below (Contracts / Insurance / Licenses) for share-with-counsel views.
          </div>
        </Container>
      </div>

      {/* 1. Contracts */}
      <Container title={`Contracts · ${contracts.total}`} subtitle="Loan · security · pledges · lease · party-to-party agreements" density="compact">
        <Tile
          icon="§"
          metrics={[
            { label: 'active', value: contracts.active, href: `${reg('contracts')}?status=active` },
            { label: 'draft',  value: contracts.draft,  href: `${reg('contracts')}?status=draft` },
            { label: 'other',  value: contracts.other,  href: `${reg('contracts')}?status=other` },
          ]}
          href={reg('contracts')}
          hrefLabel="open contract register →"
        />
      </Container>

      {/* 2. Insurances */}
      <Container title={`Insurances · ${insurance.total}`} subtitle="Coverage · policies · past-expiry alert" density="compact">
        <Tile
          icon="🛡"
          metrics={[
            { label: 'active',      value: insurance.active,      href: `${reg('insurance')}?status=active` },
            { label: 'past expiry', value: insurance.past_expiry, href: `${reg('insurance')}?status=past_expiry`, danger: insurance.past_expiry > 0 },
          ]}
          extra={insurance.next_expiry ? `next expiry: ${insurance.next_expiry}` : 'no upcoming expiry on record'}
          href={reg('insurance')}
          hrefLabel="open insurance register →"
        />
      </Container>

      {/* 3. Licenses (Dates calendar dropped 2026-06-29 — not yet wired) */}
      <Container title={`Licenses · ${licenses.total}`} subtitle="Compliance permits · operating licenses · governance · titles · APPLICATIONS EXCLUDED" density="compact">
        <Tile
          icon="✱"
          metrics={[
            { label: 'expired',       value: licenses.expired,      href: `${reg('licenses')}?status=expired`,      danger: licenses.expired > 0 },
            { label: 'expiring ≤90d', value: licenses.expiring_90d, href: `${reg('licenses')}?status=expiring_90d`, danger: licenses.expiring_90d > 0 },
            { label: 'current',       value: licenses.current,      href: `${reg('licenses')}?status=current` },
            { label: 'no expiry set', value: licenses.no_expiry,    href: `${reg('licenses')}?status=no_expiry`,    warn: licenses.no_expiry > 0 },
          ]}
          extra={`Lao licenses typically renew annually. ${licenses.no_expiry} doc${licenses.no_expiry === 1 ? '' : 's'} have no valid_until on file — set one in the register to enable countdowns.`}
          href={reg('licenses')}
          hrefLabel="open license register →"
        />
      </Container>

      {/* 4b. Applications */}
      <Container title={`Applications · ${applicationsCount}`} subtitle="Filings · enquiry letters · dissolution notices · liquidator filings" density="compact">
        <Tile
          icon="📨"
          metrics={[
            { label: 'submitted', value: applicationsActive, href: `/h/${propertyId}/finance/legal/register/applications?status=active` },
          ]}
          extra="Anything you have submitted that is not yet a granted license — the License box only counts issued grants."
          href={`/h/${propertyId}/finance/legal/register/applications`}
          hrefLabel="open applications register →"
        />
      </Container>

      {/* 5. Lawyer-mail */}
      <ComingSoon title="Lawyer-mail inbox" subtitle="External counsel · routed mail only" icon="✉" hint="Filtered cockpit_tickets feed: only mail from / to external counsel + the legal team. Threaded by case." />

      {/* 6. Running cases */}
      <Container title="Running cases" subtitle="Open + closed register · click for case file" density="compact">
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontSize: 28, color: 'var(--accent, #b8a878)', opacity: 0.6, marginBottom: 8 }}>⌛</div>
          {runningCases.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-soft, #5a5a5a)' }}>
              No active cases yet. Link a doc to a new case_ref to seed one.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {runningCases.map((c) => (
                <li key={c.case_ref}>
                  <a href={`/h/${propertyId}/finance/legal/cases/${encodeURIComponent(c.case_ref)}`} style={cardLink}>
                    <code style={{ fontSize: 12, fontWeight: 500 }}>{c.case_ref}</code>
                    {c.title && c.title !== c.case_ref && <span style={{ color: '#5A5A5A', fontSize: 11 }}>· {c.title}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#5A5A5A' }}>
                      {c.n_docs} doc{c.n_docs === 1 ? '' : 's'}{c.status ? ` · ${c.status}` : ''}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>

      {/* Bottom legal-team strip removed 2026-06-29 — John card now lives
          at the top in Quick Actions to avoid the duplicate. */}
      {false && (
      <div style={fullRow}>
        <Container title="Talk to the legal team" subtitle="Direct chat · agents pulled from the cockpit roster" density="compact">
          {legalAgents.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-soft, #5a5a5a)' }}>
              No active legal agents found in <code>cockpit_agent_roster</code>.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8 }}>
              {visibleAgents.map((a) => {
                const isPrimary = a.role === primaryRole;
                const href = `/h/${propertyId}/it/cockpit/chat/${encodeURIComponent(a.role)}`;
                return (
                  <li key={a.role}>
                    <a href={href} style={isPrimary ? agentCardPrimary : agentCard}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 18 }}>{a.avatar ?? '⚖'}</span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: isPrimary ? '#FFFFFF' : '#1B1B1B' }}>
                          {a.display_name ?? a.role}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: 9, color: isPrimary ? 'rgba(255,255,255,0.7)' : '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {a.scope_label ?? a.dept ?? ''}
                        </span>
                      </div>
                      {a.tagline && (
                        <div style={{ fontSize: 11, color: isPrimary ? 'rgba(255,255,255,0.85)' : '#5A5A5A', lineHeight: 1.4 }}>
                          {a.tagline.length > 200 ? a.tagline.slice(0, 197) + '…' : a.tagline}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: isPrimary ? 'rgba(255,255,255,0.6)' : '#5A5A5A', marginTop: 4 }}>
                        💬 chat with {a.display_name ?? a.role} →
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Container>
      </div>
      )}
    </DashboardPage>
  );
}

// ── Inline helpers ─────────────────────────────────────────────────────────
function Tile({ icon, metrics, extra, href, hrefLabel }: {
  icon: string;
  metrics: { label: string; value: number; href?: string; danger?: boolean; warn?: boolean }[];
  extra?: string;
  href: string;
  hrefLabel: string;
}) {
  // Compact tile: div wrapper (anchors can't nest) with metric chips that
  // can themselves be drill-down links. The "open register" link sits as an
  // underlined eyebrow at the top right so the whole metric row stays clean.
  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16, opacity: 0.7 }}>{icon}</span>
        <a href={href} style={{ fontSize: 10, color: '#1B1B1B', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1, textDecoration: 'underline' }}>{hrefLabel.replace(' →', '')}</a>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {metrics.map((m) => {
          const chip = (
            <span style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 6,
              padding: '3px 8px', borderRadius: 3,
              border: `1px solid ${m.danger ? '#F5C2C2' : m.warn ? '#E8C972' : '#E0E0E0'}`,
              background: m.danger ? '#FDECEC' : m.warn ? '#FFF8E1' : '#FFFFFF',
              color: '#1B1B1B', fontSize: 11,
            }}>
              <span style={{ fontWeight: 600, color: m.danger ? '#C62828' : m.warn ? '#B8860B' : '#1B1B1B', fontVariantNumeric: 'tabular-nums' }}>{m.value}</span>
              <span style={{ fontSize: 10, color: '#5A5A5A' }}>{m.label}</span>
            </span>
          );
          return m.href ? (
            <a key={m.label} href={m.href} title={`Drill into ${m.label}`} style={{ textDecoration: 'none' }}>{chip}</a>
          ) : (
            <span key={m.label}>{chip}</span>
          );
        })}
      </div>
      {extra && (
        <div style={{ fontSize: 10, color: '#5A5A5A', lineHeight: 1.35, marginTop: 6, maxHeight: 28, overflow: 'hidden' }}>{extra}</div>
      )}
    </div>
  );
}

function ComingSoon({ title, subtitle, icon, hint }: { title: string; subtitle: string; icon: string; hint: string }) {
  return (
    <Container title={title} subtitle={subtitle} density="compact">
      <div style={{ padding: '4px 0' }}>
        <div style={{ fontSize: 28, color: 'var(--accent, #b8a878)', opacity: 0.6, marginBottom: 8 }}>{icon}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft, #5a5a5a)', lineHeight: 1.5, marginBottom: 12 }}>{hint}</div>
        <div style={{
          display: 'inline-block', padding: '4px 10px',
          fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: '#C28F2C', background: 'rgba(194,143,44,0.12)',
          border: '1px solid rgba(194,143,44,0.35)', borderRadius: 4, fontWeight: 700,
        }}>
          Coming soon
        </div>
      </div>
    </Container>
  );
}

const briefRowBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '6px 10px', border: '1px solid #E0E0E0', borderRadius: 4,
};
const briefRowDanger:  React.CSSProperties = { ...briefRowBase, background: '#FDECEC', borderColor: '#F5C2C2' };
const briefRowWarn:    React.CSSProperties = { ...briefRowBase, background: '#FFF8E1', borderColor: '#E8C972' };
const briefRowNeutral: React.CSSProperties = { ...briefRowBase, background: '#FFFFFF' };
const briefLink:       React.CSSProperties = { marginLeft: 'auto', color: '#1B1B1B', textDecoration: 'underline', fontSize: 11 };

const cardLink: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 8,
  padding: '6px 8px', border: '1px solid #E0E0E0', borderRadius: 3,
  background: '#FFFFFF', color: '#1B1B1B', textDecoration: 'none', fontSize: 12,
};

const agentCard: React.CSSProperties = {
  display: 'block', padding: 10,
  border: '1px solid #E0E0E0', borderRadius: 4,
  background: '#FFFFFF', color: '#1B1B1B', textDecoration: 'none',
};

const agentCardPrimary: React.CSSProperties = {
  display: 'block', padding: 10,
  border: '1px solid #1B1B1B', borderRadius: 4,
  background: '#1B1B1B', color: '#FFFFFF', textDecoration: 'none',
};
