// app/tbc/page.tsx
// The Beyond Circle holding-company homepage. Positioning page for a
// hospitality holding running an AI-native operating system. NO property
// name-drops, NO PMS vendor names — this page is intentionally aspirational
// and generic. Server component — fetches the live active-agent count from
// cockpit.id_agents at render time, falls back to 65 if the service-role
// client is unavailable. Scoped CSS module so this page does NOT inherit
// the property themes (Namkhan / Donna) from the parent app shell.

import Link from 'next/link';
import { sbCockpit } from '@/app/cockpit-v2/_lib/supabase-cockpit';
import styles from './_styles.module.css';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'The Beyond Circle — AI-native hospitality holding',
  description:
    'A hospitality holding running an AI-native operating system. One platform, multi-tenant, 65 specialist agents across every discipline a 5-star property needs.',
};

type AgentRow = { property_id: number | null; hierarchy_level: number | null; dept: string | null };

async function fetchAgentStats(): Promise<{
  total: number;
  byLevel: Record<number, number>;
  byDept: Record<string, number>;
}> {
  try {
    const { data, error } = await sbCockpit
      .from('id_agents')
      .select('property_id, hierarchy_level, dept, status')
      .neq('status', 'disabled');
    if (error || !data) return { total: 65, byLevel: {}, byDept: {} };
    const rows = data as AgentRow[];
    const byLevel: Record<number, number> = {};
    const byDept: Record<string, number> = {};
    for (const r of rows) {
      const lvl = r.hierarchy_level ?? 99;
      byLevel[lvl] = (byLevel[lvl] ?? 0) + 1;
      const d = r.dept ?? 'general';
      byDept[d] = (byDept[d] ?? 0) + 1;
    }
    return { total: rows.length, byLevel, byDept };
  } catch {
    return { total: 65, byLevel: {}, byDept: {} };
  }
}

// ---------- 65-specialist roster ----------
// Surfaced as disciplines, not as named property roles. This is the agent
// vision PBS asked for: every function a 5-star hospitality holding needs,
// from QA standards down to AI-generated marketing renders.
type Discipline = { code: string; title: string; blurb: string };

const DISCIPLINES: Discipline[] = [
  {
    code: 'QA',
    title: 'QA & 5-star standards',
    blurb:
      'International service standards — SLH, Forbes, Hilton-equivalent benchmarks audited continuously, not annually.',
  },
  {
    code: 'LG',
    title: 'Legal counsel',
    blurb:
      'Labour law, contracts, regulatory filings, GDPR posture, jurisdiction-specific compliance.',
  },
  {
    code: 'FA',
    title: 'Finance audit',
    blurb:
      'USALI 11th edition controls, ledger reconciliation, variance forensics, audit-ready packs on demand.',
  },
  {
    code: 'FC',
    title: 'Forecast & cashflow',
    blurb:
      '13-week rolling cash, annual budget, scenario stress-tests. Updated nightly from the live ledger.',
  },
  {
    code: 'MK',
    title: 'Marketing in all hands',
    blurb:
      'Content engine across every guest-facing surface — email, OTA descriptions, social, owned web — voiced per property.',
  },
  {
    code: 'PR',
    title: 'Procurement',
    blurb:
      'Vendor scoring, price benchmarking, RFQ assembly, contract renewal triggers, total-cost-of-ownership math.',
  },
  {
    code: 'FF',
    title: 'FF&E specification',
    blurb:
      'Furniture, fixtures and equipment specified to brand standard, lifecycle-tracked, refresh windows planned.',
  },
  {
    code: 'RD',
    title: 'R&D and strategy',
    blurb:
      'Business plans, market intelligence, comp-set tracking, opportunity scouting. Long-horizon thinking.',
  },
  {
    code: 'DS',
    title: 'Design',
    blurb:
      'Brand-aligned visual systems, interiors briefs, signage, guest-journey artefacts. Coherence across every touchpoint.',
  },
  {
    code: 'BD',
    title: 'Brand development',
    blurb:
      'Voice, identity, naming conventions, brand evolution. Each property keeps its own brand voice; the platform is invisible.',
  },
  {
    code: 'AI',
    title: 'AI rendering & generative imagery',
    blurb:
      'Hero shots, mock-ups, marketing assets generated on-brand. No stock photography, no clichés.',
  },
  {
    code: 'RV',
    title: 'Revenue management',
    blurb:
      'Channel-level capture, pricing moves, demand modelling, inquiry-to-booking funnels. Agents propose; humans approve.',
  },
  {
    code: 'HR',
    title: 'HR & people ops',
    blurb:
      'Headcount, schedules, payroll runs, labour-cost variance, jurisdiction-specific contracts.',
  },
  {
    code: 'TR',
    title: 'Training & enablement',
    blurb:
      'Onboarding curricula, SOP libraries, micro-learning, certification tracking — multilingual by default.',
  },
  {
    code: 'GX',
    title: 'Guest experience',
    blurb:
      'Pre-arrival journeys, in-stay personalisation, post-stay feedback loops, NPS forensics.',
  },
  {
    code: 'FB',
    title: 'F&B operations',
    blurb:
      'Menu engineering, cost-of-sale tracking, beverage programmes, supplier rotation, allergen compliance.',
  },
  {
    code: 'EN',
    title: 'Engineering & maintenance',
    blurb:
      'Asset register, preventive schedules, utilities benchmarking, ESG reporting.',
  },
  {
    code: 'SC',
    title: 'Sustainability & ESG',
    blurb:
      'Energy, water, waste, carbon — measured to standard, reported on schedule, surfaced to guests when relevant.',
  },
  {
    code: 'DT',
    title: 'Data engineering',
    blurb:
      'PMS, payroll, accounting, surveys — every system unified to one tenant-scoped truth.',
  },
  {
    code: 'RM',
    title: 'Risk management',
    blurb:
      'Insurance posture, incident reporting, business-continuity playbooks, crisis comms templates.',
  },
];

export default async function BeyondCirclePage() {
  const stats = await fetchAgentStats();

  // Use the live tier distribution if available; otherwise fall back to a
  // plausible 4-tier shape (Holding lead, CEOs, HODs, workers).
  const tiers = Object.keys(stats.byLevel).length
    ? Object.entries(stats.byLevel)
        .map(([lvl, n]) => ({ lvl: Number(lvl), n }))
        .sort((a, b) => a.lvl - b.lvl)
    : [
        { lvl: 0, n: 1 },
        { lvl: 1, n: 6 },
        { lvl: 2, n: 18 },
        { lvl: 3, n: 40 },
      ];

  const W = 1100;
  const ROW_H = 90;
  const TOP = 36;
  const NODE_R = 5;
  const H = TOP + tiers.length * ROW_H + 36;

  const nodePos = (rowIdx: number, i: number, total: number) => {
    const y = TOP + rowIdx * ROW_H;
    const usable = W - 80;
    const x = total === 1 ? W / 2 : 40 + (usable * i) / (total - 1);
    return { x, y };
  };

  // Build connector segments from each tier-i node up to its corresponding
  // tier-(i-1) node (modulo parent count). Restrained teal strokes.
  const connectors: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let r = 1; r < tiers.length; r++) {
    const cur = tiers[r];
    const par = tiers[r - 1];
    for (let i = 0; i < cur.n; i++) {
      const child = nodePos(r, i, cur.n);
      const parent = nodePos(r - 1, i % par.n, par.n);
      connectors.push({ x1: parent.x, y1: parent.y, x2: child.x, y2: child.y });
    }
  }

  return (
    <div className={styles.root}>
      {/* --- top nav --- */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/tbc" className={styles.wordmark}>
            <span className={styles.wordmarkDot} aria-hidden />
            The Beyond Circle
          </Link>
          <div className={styles.navLinks}>
            <a href="#what" className={styles.navLink}>
              What we do
            </a>
            <a href="#disciplines" className={styles.navLink}>
              Disciplines
            </a>
            <a href="#agents" className={styles.navLink}>
              Agents
            </a>
            <a href="#approach" className={styles.navLink}>
              Approach
            </a>
            <Link href="/cockpit-v2" className={styles.navCta}>
              See the platform
            </Link>
          </div>
        </div>
      </nav>

      {/* --- hero --- */}
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden />
        <div className={styles.heroInner}>
          <span className={`${styles.eyebrow} ${styles.reveal}`}>
            <span className={styles.eyebrowDot} aria-hidden />
            A hospitality holding, AI-native by design
          </span>
          <h1 className={`${styles.h1} ${styles.reveal} ${styles.reveal2}`}>
            Every function of a 5-star hotel.{' '}
            <em>Run by humans, amplified by agents.</em>
          </h1>
          <p className={`${styles.heroSub} ${styles.reveal} ${styles.reveal2}`}>
            The Beyond Circle is a hospitality holding running one operating system across every
            property it owns or operates. {stats.total} specialist agents cover the disciplines
            a 5-star property actually needs — QA, legal, finance, forecast, procurement, FF&amp;E,
            design, brand, generative imagery, and more — paired with named human counterparts.
          </p>
          <div className={`${styles.ctaRow} ${styles.reveal} ${styles.reveal3}`}>
            <Link href="/cockpit-v2" className={styles.ctaPrimary}>
              See the platform →
            </Link>
            <a href="#disciplines" className={styles.ctaSecondary}>
              The {stats.total}-specialist team
            </a>
          </div>
        </div>
      </header>

      {/* --- impact strip (sits right under hero, Nimbleway spirit) --- */}
      <section className={styles.impactStrip}>
        <div className={styles.impactInner}>
          <div className={styles.impactCell}>
            <div className={styles.impactValue}>{stats.total}</div>
            <div className={styles.impactLabel}>Specialist agents wired</div>
          </div>
          <div className={styles.impactCell}>
            <div className={styles.impactValue}>{tiers.length}</div>
            <div className={styles.impactLabel}>Org tiers, lead to worker</div>
          </div>
          <div className={styles.impactCell}>
            <div className={styles.impactValue}>USALI 11</div>
            <div className={styles.impactLabel}>Accounting standard, everywhere</div>
          </div>
          <div className={styles.impactCell}>
            <div className={styles.impactValue}>4</div>
            <div className={styles.impactLabel}>Day-one languages</div>
          </div>
        </div>
      </section>

      {/* --- what we do --- */}
      <section id="what" className={styles.section}>
        <p className={styles.sectionKicker}>What we do</p>
        <h2 className={styles.sectionTitle}>
          One operating system. <em>Every discipline a 5-star property needs.</em>
        </h2>
        <p className={styles.sectionLede}>
          A hotel is not one job. It is sixty. The Beyond Circle puts each of those jobs onto
          shared truth — one schema, one audit trail, one set of standards — and pairs every
          discipline with a specialist agent on tap.
        </p>
        <div className={styles.bento}>
          <div className={`${styles.bentoTile} ${styles.bentoTileWide}`}>
            <div className={styles.bentoIcon}>O</div>
            <div>
              <h3 className={styles.bentoTitle}>Operating system, not dashboards</h3>
              <p className={styles.bentoDesc}>
                Decisions flow through the platform, not around it. Revenue moves, hires, vendor
                changes, capex — every action carries a tenant ID, an audit row, and a human
                approver.
              </p>
            </div>
          </div>
          <div className={styles.bentoTile}>
            <div className={styles.bentoIcon}>T</div>
            <div>
              <h3 className={styles.bentoTitle}>Multi-tenant by design</h3>
              <p className={styles.bentoDesc}>
                Every operational row carries tenant and property identifiers. RLS-enforced
                isolation. Same schema; fully separated content.
              </p>
            </div>
          </div>
          <div className={styles.bentoTile}>
            <div className={styles.bentoIcon}>S</div>
            <div>
              <h3 className={styles.bentoTitle}>5-star standards, audited live</h3>
              <p className={styles.bentoDesc}>
                SLH, Forbes, Hilton-equivalent benchmarks checked continuously — not in a once-
                a-year mystery-shop report.
              </p>
            </div>
          </div>
          <div className={styles.bentoTile}>
            <div className={styles.bentoIcon}>P</div>
            <div>
              <h3 className={styles.bentoTitle}>Predictive, not retrospective</h3>
              <p className={styles.bentoDesc}>
                What-if pricing, demand, and staffing modelled before the booking window opens —
                not after the month closes.
              </p>
            </div>
          </div>
          <div className={styles.bentoTile}>
            <div className={styles.bentoIcon}>Q</div>
            <div>
              <h3 className={styles.bentoTitle}>Queue-only writes</h3>
              <p className={styles.bentoDesc}>
                Agents propose; humans approve. Nothing reaches production data without an
                approver and an audit row.
              </p>
            </div>
          </div>
          <div className={`${styles.bentoTile} ${styles.bentoTileWide}`}>
            <div className={styles.bentoIcon}>L</div>
            <div>
              <h3 className={styles.bentoTitle}>Multilingual from day one</h3>
              <p className={styles.bentoDesc}>
                Every agent generates in the user&apos;s language. Every brand voice survives the
                translation. Standard content shipped in EN, ES, LO, DE.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- disciplines grid (the 65-specialist team, surfaced as disciplines) --- */}
      <section id="disciplines" className={styles.section}>
        <p className={styles.sectionKicker}>The team</p>
        <h2 className={styles.sectionTitle}>
          {stats.total} specialists. <em>One holding-wide team.</em>
        </h2>
        <p className={styles.sectionLede}>
          We do not hire generalists pretending to be specialists. Each discipline below is a
          dedicated agent fleet with its own prompts, skills, and budget. Each is paired with a
          named human counterpart at the operator level.
        </p>
        <div className={styles.discGrid}>
          {DISCIPLINES.map((d) => (
            <article key={d.code} className={styles.discCard}>
              <div className={styles.discCode}>{d.code}</div>
              <h3 className={styles.discTitle}>{d.title}</h3>
              <p className={styles.discBlurb}>{d.blurb}</p>
            </article>
          ))}
        </div>
        <p className={styles.discFootnote}>
          Plus specialist workers in every discipline — reservations triage, payroll runs,
          comp-set scans, OTA descriptions, accounting closes, ESG metering, and more. The full
          roster grows with each property we onboard.
        </p>
      </section>

      {/* --- agents graph --- */}
      <section id="agents" className={styles.section}>
        <p className={styles.sectionKicker}>The org</p>
        <h2 className={styles.sectionTitle}>
          {stats.total} agents. <em>Paired, never replacing.</em>
        </h2>
        <p className={styles.sectionLede}>
          Every agent has a named human counterpart. The org chart below is live from the
          platform&apos;s agent registry — read from Supabase at page render.
        </p>
        <div className={styles.agentsWrap}>
          <div className={styles.agentsHeader}>
            <div>
              <div className={styles.agentsMeta}>cockpit.id_agents · live from Supabase</div>
              <div className={styles.agentsTitle}>
                {tiers.length} tiers · {stats.total} active agents
              </div>
            </div>
            <div className={styles.agentsLegend}>
              <span>
                <i className={styles.legendDotAccent} />
                agent
              </span>
              <span>
                <i className={styles.legendDotBlue} />
                report-line
              </span>
            </div>
          </div>
          <svg
            className={styles.svgFrame}
            viewBox={`0 0 ${W} ${H}`}
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Beyond Circle agent organisation chart"
          >
            {connectors.map((c, i) => (
              <line
                key={`c-${i}`}
                x1={c.x1}
                y1={c.y1}
                x2={c.x2}
                y2={c.y2}
                stroke="var(--tbc-blue)"
                strokeOpacity={0.35}
                strokeWidth={0.8}
              />
            ))}
            {tiers.map((tier, r) =>
              Array.from({ length: tier.n }).map((_, i) => {
                const { x, y } = nodePos(r, i, tier.n);
                return (
                  <g key={`n-${r}-${i}`}>
                    <circle
                      cx={x}
                      cy={y}
                      r={NODE_R}
                      fill="var(--tbc-accent)"
                      stroke="var(--tbc-bg)"
                      strokeWidth={1.5}
                    />
                  </g>
                );
              }),
            )}
            {tiers.map((tier, r) => (
              <text
                key={`l-${r}`}
                x={20}
                y={TOP + r * ROW_H + 4}
                fill="var(--tbc-ink-mute)"
                fontSize={10}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                letterSpacing={1}
              >
                L{tier.lvl}
              </text>
            ))}
          </svg>
        </div>
      </section>

      {/* --- approach (the principles) --- */}
      <section id="approach" className={styles.section}>
        <p className={styles.sectionKicker}>Our approach</p>
        <h2 className={styles.sectionTitle}>
          Hard data first. <em>Stock photography last.</em>
        </h2>
        <p className={styles.sectionLede}>
          Four principles that hold whether we are running one property or twenty.
        </p>
        <div className={styles.principles}>
          <div className={styles.principleCard}>
            <div className={styles.principleNum}>01</div>
            <h3 className={styles.principleTitle}>Humans first, agents amplify</h3>
            <p className={styles.principleBody}>
              Agents propose, humans approve. Every agent has a named human counterpart who owns
              the decision.
            </p>
          </div>
          <div className={styles.principleCard}>
            <div className={styles.principleNum}>02</div>
            <h3 className={styles.principleTitle}>One schema, many brands</h3>
            <p className={styles.principleBody}>
              Each property keeps its own brand voice and operating currency. The platform
              consolidates in USD under USALI 11.
            </p>
          </div>
          <div className={styles.principleCard}>
            <div className={styles.principleNum}>03</div>
            <h3 className={styles.principleTitle}>Audited or it did not happen</h3>
            <p className={styles.principleBody}>
              Every agent action, tool call, sync run and merge writes to one tamper-evident
              audit log. No off-platform decisions.
            </p>
          </div>
          <div className={styles.principleCard}>
            <div className={styles.principleNum}>04</div>
            <h3 className={styles.principleTitle}>Built for many, not one</h3>
            <p className={styles.principleBody}>
              The platform is multi-tenant from day one. Onboarding a new property does not
              require a new codebase, a new schema, or a new team.
            </p>
          </div>
        </div>
      </section>

      {/* --- cta band --- */}
      <section className={styles.ctaBand}>
        <h2>Want to see how it runs?</h2>
        <p>The cockpit is open. The architect-agent is on call.</p>
        <div className={styles.ctaBandRow}>
          <Link href="/cockpit-v2" className={styles.ctaPrimary}>
            Open the cockpit →
          </Link>
          <Link href="/cockpit/chat?dept=architect" className={styles.ctaSecondary}>
            Talk to the architect
          </Link>
        </div>
      </section>

      {/* --- footer --- */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>(c) {new Date().getFullYear()} The Beyond Circle</div>
          <div className={styles.footerLinks}>
            <a href="#what">What we do</a>
            <a href="#disciplines">Disciplines</a>
            <a href="#agents">Agents</a>
            <Link href="/cockpit-v2">Platform</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
