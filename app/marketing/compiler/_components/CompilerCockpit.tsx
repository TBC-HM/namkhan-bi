// app/marketing/compiler/_components/CompilerCockpit.tsx
//
// PBS 2026-05-16: Compiler 2-tab workflow + Lock & Distribute wizard.
//
// Mental model:
//   Compiler builds an OFFER or RETREAT. While it's being built it lives
//   in "Ongoing Offers". When PBS clicks "Lock", the wizard:
//     1. Generates the perfect PDF (preview)
//     2. Asks where to distribute · checkboxes:
//          ☐ Sales · /sales/packages (ready for sale)
//          ☐ Social cockpit · enters posting calendar
//          ☐ Influencer cockpit · routed to ambassadors
//          ☐ Web · builds funnel page AND adds to website
//     3. On confirm · package moves to "Fixed Retreats" with broadcast log
//        showing which channels picked it up.
//
// Not every retreat needs a funnel page — the checkboxes default to
// Sales + Social only. PBS opts into Web + Influencer per-retreat.
//
// Sections via ?view=:
//   ongoing  · drafts being built (default)
//   fixed    · locked packages with broadcast log
//   lock     · Lock & Distribute wizard (when ?offer=<id>)

import type { ReactNode } from 'react';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';

type View = 'ongoing' | 'fixed' | 'lock';

interface Props {
  view: View;
  selectedOfferId?: string;
}

// ─── Offers (drafts in progress) ──────────────────────────────────────────

type OfferStatus = 'Draft' | 'Pricing' | 'PDF Review' | 'Awaiting Lock';
type OfferType = 'Retreat' | 'Seasonal Offer' | 'Group Package' | 'Promo';

interface Offer {
  id: string;
  name: string;
  type: OfferType;
  status: OfferStatus;
  duration: string;
  pax: string;
  priceBand: string;
  season: string;
  icp: string;
  pillars: string[];
  description: string;
  pdfReady: boolean;
  marginPct?: number;
  lastEdited: string;
}

const OFFERS: Offer[] = [
  { id: 'o1', name: '5-Day Mindfulness Reset',           type: 'Retreat',        status: 'Awaiting Lock', duration: '5 days',  pax: '4',   priceBand: '$2,800–3,400/pax', season: 'Green',     icp: 'EU Wellness Women',  pillars: ['Morning Rituals', 'Spa Reset', 'Silence', 'Sleep'],     description: 'Five days of daily yoga · spa rituals · river silence · plant-based meals. Designed for the EU Wellness ICP.', pdfReady: true,  marginPct: 41, lastEdited: '8m ago' },
  { id: 'o2', name: '3-Night Detox · Green Season',      type: 'Seasonal Offer', status: 'PDF Review',    duration: '3 nights', pax: '2',   priceBand: '$1,640–1,900/pax', season: 'Green',     icp: 'Digital Detox EU',   pillars: ['Tech-free', 'River Silence', 'Sleep'],                  description: 'Phone-locked weekend · hammock + river + sound bath · no Wi-Fi.',                                                pdfReady: true,  marginPct: 38, lastEdited: '1h ago' },
  { id: 'o3', name: '7-Day River Tales',                 type: 'Retreat',        status: 'Pricing',       duration: '7 days',  pax: '6',   priceBand: 'TBD',              season: 'Cool',      icp: 'Mystique Explorers', pillars: ['Temples', 'Heritage', 'Slow Walks'],                    description: 'Seven days of UNESCO heritage walks · monks at dawn · boat journeys upriver.',                                  pdfReady: false, marginPct: undefined, lastEdited: '3h ago' },
  { id: 'o4', name: '4-Day Lux Couples',                 type: 'Retreat',        status: 'PDF Review',    duration: '4 days',  pax: '2',   priceBand: '$5,200–6,800/pax', season: 'Cool',      icp: 'Luxury Couples',     pillars: ['Privacy', 'Candle Dinners', 'River Floats'],            description: 'Suite + private boat + candle dinners. For anniversaries and reconnection.',                                    pdfReady: true,  marginPct: 47, lastEdited: '6h ago' },
  { id: 'o5', name: 'Farm-to-Table Long Weekend',         type: 'Seasonal Offer', status: 'Draft',         duration: '3 days',  pax: '4',   priceBand: 'TBD',              season: 'Green',     icp: 'Conscious Food',     pillars: ['Herb Garden', 'Foraging', 'Local Chefs'],               description: 'Foraging at dawn · chef-led market run · fermentation class · 4 dinners.',                                       pdfReady: false, marginPct: undefined, lastEdited: '1d ago' },
  { id: 'o6', name: 'Tết · 5-Day Vietnamese New Year',    type: 'Seasonal Offer', status: 'Draft',         duration: '5 days',  pax: '6',   priceBand: 'TBD',              season: 'High',      icp: 'Asia Source Markets', pillars: ['Wellness', 'Cultural Heritage'],                       description: 'Vietnamese-narrated welcome · Tết-aligned ritual schedule · regional food.',                                    pdfReady: false, marginPct: undefined, lastEdited: '2d ago' },
];

// ─── Fixed retreats (locked + distributed) ────────────────────────────────

interface BroadcastTargets {
  sales: 'live' | 'pending' | 'off';
  social: 'live' | 'pending' | 'off';
  influencer: 'live' | 'pending' | 'off';
  web: 'live' | 'pending' | 'off';
}

interface FixedRetreat {
  id: string;
  name: string;
  duration: string;
  pax: string;
  pricePax: string;
  icp: string;
  lockedAt: string;
  bookingsMtd: number;
  revenueMtdUsd: number;
  pdfUrl: string;
  funnelUrl: string | null;
  broadcasts: BroadcastTargets;
}

const FIXED: FixedRetreat[] = [
  { id: 'f1', name: 'Full Moon Reset · 6 Days',          duration: '6 days', pax: '8',  pricePax: '$3,200', icp: 'EU Wellness Women',  lockedAt: '2026-04-22', bookingsMtd: 4, revenueMtdUsd: 102_400, pdfUrl: '/api/compiler/pdf/f1', funnelUrl: '/marketing/funnels?domain=retreatlaos.xy',     broadcasts: { sales: 'live',    social: 'live',    influencer: 'live',    web: 'live' } },
  { id: 'f2', name: '4-Day Anniversary · Couples',       duration: '4 days', pax: '2',  pricePax: '$5,800', icp: 'Luxury Couples',     lockedAt: '2026-04-18', bookingsMtd: 2, revenueMtdUsd:  46_400, pdfUrl: '/api/compiler/pdf/f2', funnelUrl: null,                                            broadcasts: { sales: 'live',    social: 'live',    influencer: 'live',    web: 'off' } },
  { id: 'f3', name: 'Foraging + Fermentation · 5 Days',  duration: '5 days', pax: '6',  pricePax: '$2,650', icp: 'Conscious Food',     lockedAt: '2026-05-02', bookingsMtd: 3, revenueMtdUsd:  47_700, pdfUrl: '/api/compiler/pdf/f3', funnelUrl: '/marketing/funnels?domain=ecoretreatasia.xy',    broadcasts: { sales: 'live',    social: 'live',    influencer: 'pending', web: 'live' } },
  { id: 'f4', name: 'Lao Heritage Walk · 6 Days',        duration: '6 days', pax: '6',  pricePax: '$2,900', icp: 'Mystique Explorers', lockedAt: '2026-04-30', bookingsMtd: 1, revenueMtdUsd:  17_400, pdfUrl: '/api/compiler/pdf/f4', funnelUrl: null,                                            broadcasts: { sales: 'live',    social: 'live',    influencer: 'off',     web: 'off' } },
  { id: 'f5', name: 'Host-Your-Retreat · B2B 7-Day',      duration: '7 days', pax: '14', pricePax: '$1,950', icp: 'Yoga Teachers · B2B', lockedAt: '2026-05-08', bookingsMtd: 0, revenueMtdUsd:       0, pdfUrl: '/api/compiler/pdf/f5', funnelUrl: '/marketing/funnels?domain=hostretreatasia.xy', broadcasts: { sales: 'live',    social: 'pending', influencer: 'off',     web: 'live' } },
];

// ─── Component ────────────────────────────────────────────────────────────

const VIEW_LABEL: Record<View, string> = {
  ongoing: '✶ Ongoing Offers',
  fixed:   '◆ Fixed Retreats',
  lock:    '🔒 Lock & Distribute',
};
const VIEWS: View[] = ['ongoing', 'fixed'];   // Lock is shown only when selectedOfferId is set

export default function CompilerCockpit({ view, selectedOfferId }: Props) {
  const draftsInProgress = OFFERS.length;
  const fixedCount = FIXED.length;
  const totalLiveBroadcasts = FIXED.reduce((s, f) =>
    s + Object.values(f.broadcasts).filter((v) => v === 'live').length, 0);
  const revenueMtd = FIXED.reduce((s, f) => s + f.revenueMtdUsd, 0);
  const bookingsMtd = FIXED.reduce((s, f) => s + f.bookingsMtd, 0);
  const pdfPending = OFFERS.filter((o) => !o.pdfReady).length;

  const selectedOffer = selectedOfferId ? OFFERS.find((o) => o.id === selectedOfferId) : undefined;

  return (
    <>
      {/* KPI band */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <KpiBox value={draftsInProgress}      unit="count" label="Ongoing Offers"     tooltip="Offers + retreats in build · not yet locked" />
        <KpiBox value={fixedCount}            unit="count" label="Fixed Retreats"     tooltip="Locked · for sale" />
        <KpiBox value={pdfPending}            unit="count" label="PDFs pending"       state={pdfPending > 0 ? 'data-needed' : 'live'} needs={pdfPending > 0 ? 'pricing required' : undefined} />
        <KpiBox value={totalLiveBroadcasts}   unit="count" label="Live broadcasts"    tooltip="Sales + Social + Influencer + Web slots currently lit per fixed retreat" />
        <KpiBox value={bookingsMtd}           unit="count" label="Bookings · MTD"     tooltip="Across all fixed retreats this month" />
        <KpiBox value={revenueMtd}            unit="usd"   label="Revenue · MTD"      tooltip="Package revenue this month · USD" />
      </div>

      {/* Sub-strip */}
      <div style={S.subStrip}>
        {VIEWS.map((v) => (
          <a key={v} href={`?view=${v}`}
             style={{ ...S.subStripLink, ...(v === view ? S.subStripLinkActive : {}) }}>
            {VIEW_LABEL[v]}
          </a>
        ))}
        {view === 'lock' && (
          <span style={{ ...S.subStripLink, ...S.subStripLinkActive }}>
            {VIEW_LABEL.lock}{selectedOffer ? ` · ${selectedOffer.name}` : ''}
          </span>
        )}
      </div>

      {view === 'ongoing' && <OngoingSection />}
      {view === 'fixed'   && <FixedSection />}
      {view === 'lock'    && <LockWizardSection offer={selectedOffer} />}
    </>
  );
}

// ─── ONGOING ──────────────────────────────────────────────────────────────

function OngoingSection() {
  return (
    <Panel
      title="Ongoing offers"
      eyebrow={`${OFFERS.length} in build · prompt → pricing → PDF → lock`}
      actions={<a href="?new=offer" style={S.btnPrimary}>+ New offer</a>}
    >
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        {OFFERS.map((o) => <OngoingCard key={o.id} offer={o} />)}
      </div>
    </Panel>
  );
}

function OngoingCard({ offer }: { offer: Offer }) {
  const canLock = offer.status === 'Awaiting Lock' && offer.pdfReady;
  return (
    <div style={S.offerCard}>
      <div style={S.offerHead}>
        <div>
          <div style={S.offerType}>{offer.type}</div>
          <div style={S.offerName}>{offer.name}</div>
        </div>
        <span style={offerStatusPill(offer.status)}>{offer.status}</span>
      </div>
      <div style={S.offerMeta}>{offer.duration} · {offer.pax} pax · {offer.season} season · {offer.icp}</div>
      <div style={S.offerDescr}>{offer.description}</div>
      <div style={S.offerStatRow}>
        <Stat label="Price band" value={offer.priceBand} />
        <Stat label="Margin"     value={offer.marginPct != null ? `${offer.marginPct}%` : '—'} />
        <Stat label="PDF"        value={offer.pdfReady ? '✓ ready' : '⟶ build'} />
        <Stat label="Edited"     value={offer.lastEdited} />
      </div>
      <div style={S.offerPillars}>
        <span style={S.offerFieldLabel}>Pillars</span>
        <div style={S.tagRow}>
          {offer.pillars.map((p) => <span key={p} style={S.tagChip}>{p}</span>)}
        </div>
      </div>
      <div style={S.offerActions}>
        <a href={`?offer=${offer.id}&edit=1`} style={S.btnInlineSecondary}>✎ Edit</a>
        <a href={`?offer=${offer.id}&pdf=1`} style={S.btnInlineSecondary}>📄 {offer.pdfReady ? 'Preview PDF' : 'Generate PDF'}</a>
        <a href={`?view=lock&offer=${offer.id}`}
           aria-disabled={!canLock}
           style={canLock ? S.btnInlinePrimary : { ...S.btnInlineSecondary, opacity: 0.5, pointerEvents: 'none' as const }}>
          🔒 Lock &amp; distribute
        </a>
        <a href={`?offer=${offer.id}&duplicate=1`} style={S.btnInlineSecondary}>⎘ Clone</a>
        <a href={`?offer=${offer.id}&archive=1`} style={S.btnInlineSecondary}>📦 Archive</a>
      </div>
    </div>
  );
}

// ─── FIXED ────────────────────────────────────────────────────────────────

function FixedSection() {
  return (
    <Panel title="Fixed retreats · ready for sale" eyebrow={`${FIXED.length} locked · per-channel broadcast log`}>
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        {FIXED.map((f) => <FixedCard key={f.id} retreat={f} />)}
      </div>
    </Panel>
  );
}

function FixedCard({ retreat }: { retreat: FixedRetreat }) {
  return (
    <div style={S.fixedCard}>
      <div style={S.offerHead}>
        <div>
          <div style={S.offerType}>Locked · {retreat.lockedAt}</div>
          <div style={S.offerName}>{retreat.name}</div>
        </div>
        <span style={{ ...basePill('var(--st-good, #82ad8c)') }}>FOR SALE</span>
      </div>
      <div style={S.offerMeta}>{retreat.duration} · {retreat.pax} pax · {retreat.pricePax}/pax · {retreat.icp}</div>
      <div style={S.offerStatRow}>
        <Stat label="Bookings MTD" value={String(retreat.bookingsMtd)} />
        <Stat label="Revenue MTD"  value={`$${retreat.revenueMtdUsd.toLocaleString('en-US')}`} />
        <Stat label="PDF" value="✓" />
        <Stat label="Funnel" value={retreat.funnelUrl ? '✓' : '—'} />
      </div>
      <div style={S.broadcastBox}>
        <div style={S.broadcastLabel}>Broadcast log</div>
        <div style={S.broadcastRow}>
          <BroadcastBadge label="Sales · Packages"  state={retreat.broadcasts.sales}      />
          <BroadcastBadge label="Social cockpit"    state={retreat.broadcasts.social}     />
          <BroadcastBadge label="Influencer cockpit" state={retreat.broadcasts.influencer} />
          <BroadcastBadge label="Web · Funnel"      state={retreat.broadcasts.web}        />
        </div>
      </div>
      <div style={S.offerActions}>
        <a href={retreat.pdfUrl} target="_blank" rel="noopener noreferrer" style={S.btnInlineSecondary}>📄 Open PDF</a>
        {retreat.funnelUrl && <a href={retreat.funnelUrl} style={S.btnInlineSecondary}>🌐 Funnel page</a>}
        <a href={`?retreat=${retreat.id}&edit-broadcast=1`} style={S.btnInlineSecondary}>✎ Edit broadcast</a>
        <a href={`?retreat=${retreat.id}&relock=1`} style={S.btnInlineSecondary}>🔁 Re-lock</a>
        <a href={`?retreat=${retreat.id}&unlock=1`} style={S.btnInlineSecondary}>🔓 Unlock</a>
      </div>
    </div>
  );
}

function BroadcastBadge({ label, state }: { label: string; state: 'live' | 'pending' | 'off' }) {
  const color = state === 'live'    ? 'var(--st-good, #82ad8c)' :
                state === 'pending' ? 'var(--st-warn, #C28F2C)' :
                                      'var(--text-place, #5a5448)';
  const icon  = state === 'live' ? '✓' : state === 'pending' ? '·' : '—';
  return (
    <span style={{
      display: 'inline-flex', gap: 4, alignItems: 'center',
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: 'var(--t-xs)', letterSpacing: '0.10em',
      padding: '2px 6px',
      border: `1px solid ${color}`, color, borderRadius: 3,
    }}>
      <span style={{ fontWeight: 700 }}>{icon}</span>{label}
    </span>
  );
}

// ─── LOCK & DISTRIBUTE WIZARD ─────────────────────────────────────────────

function LockWizardSection({ offer }: { offer?: Offer }) {
  if (!offer) {
    return (
      <Panel title="Lock & distribute" eyebrow="no offer selected">
        <div style={{ padding: 14 }}>
          <div style={S.emptyState}>
            <div style={S.emptyTitle}>Select an offer to lock.</div>
            <div style={S.emptySub}>Go back to <a href="?view=ongoing" style={{ color: 'var(--brass)' }}>Ongoing Offers</a> and click <strong>🔒 Lock & distribute</strong> on a card.</div>
          </div>
        </div>
      </Panel>
    );
  }

  // Default checkboxes: Sales + Social on. Web + Influencer off (PBS opts in).
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Step 1 — PDF preview */}
        <Panel title="Step 1 · Perfect PDF" eyebrow="generated · brand-locked · printable">
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={S.pdfMockup}>
              <div style={S.pdfHeader}>
                <div style={S.pdfBrand}>THE NAMKHAN · LUANG PRABANG</div>
                <div style={S.pdfTitleBig}>{offer.name}</div>
                <div style={S.pdfSub}>{offer.duration} · {offer.pax} pax · {offer.season} season</div>
              </div>
              <div style={S.pdfBody}>
                <div style={S.pdfSection}>
                  <span style={S.pdfLabel}>For</span>
                  <span style={S.pdfValue}>{offer.icp} · seeking {offer.pillars.slice(0, 2).join(' + ')}</span>
                </div>
                <div style={S.pdfSection}>
                  <span style={S.pdfLabel}>What</span>
                  <span style={S.pdfValue}>{offer.description}</span>
                </div>
                <div style={S.pdfSection}>
                  <span style={S.pdfLabel}>Pillars</span>
                  <span style={S.pdfValue}>{offer.pillars.join(' · ')}</span>
                </div>
                <div style={S.pdfSection}>
                  <span style={S.pdfLabel}>Price</span>
                  <span style={S.pdfValue}>{offer.priceBand} {offer.marginPct ? `· margin ${offer.marginPct}%` : ''}</span>
                </div>
                <div style={S.pdfSection}>
                  <span style={S.pdfLabel}>Includes</span>
                  <span style={S.pdfValue}>Accommodation · daily program · 3 meals · spa rituals · transfers · welcome ritual · personalised concierge.</span>
                </div>
              </div>
              <div style={S.pdfFooter}>
                <span>thenamkhan.com · book@thenamkhan.com · +856 71 256 222</span>
                <span>v.1 · {new Date().toISOString().slice(0, 10)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" style={S.btnPrimary}>↻ Regenerate</button>
              <button type="button" style={S.btnSecondary}>✎ Edit copy</button>
              <button type="button" style={S.btnSecondary}>📥 Download draft</button>
              <button type="button" style={S.btnSecondary}>👁 Open full-size</button>
            </div>
          </div>
        </Panel>

        {/* Step 2 — Distribution checkboxes */}
        <Panel title="Step 2 · Where to promote" eyebrow="opt in per channel · not every retreat needs a funnel page">
          <form style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <DistTarget
              code="sales"
              label="Sales · /sales/packages (ready for sale)"
              desc="Adds to the sales-team packages catalog · agents can quote + book"
              defaultOn
              required
            />
            <DistTarget
              code="social"
              label="Social cockpit · posting calendar"
              desc="Schedules 8-12 posts across IG / Pinterest / TikTok / YouTube tied to the ICP for this retreat"
              defaultOn
            />
            <DistTarget
              code="influencer"
              label="Influencer cockpit · ambassador inclusion"
              desc="Routes the retreat to ambassadors matching the ICP · they include it in monthly posting calendar"
              defaultOn={false}
            />
            <DistTarget
              code="scrape"
              label="Lead scrape · ICP-targeted campaigns"
              desc="Seeds sales.scraping_jobs with this retreat as the target offer · scrapers pull leads matching the ICP, leads are enriched + funnelled into Pipeline tagged to this retreat"
              defaultOn={false}
              hint="Auto-creates 1 campaign per active scrape tool · daily_target = ICP daily_quota"
            />
            <DistTarget
              code="web"
              label="Web · funnel page + website"
              desc="Builds a dedicated funnel page (intent-keyword-targeted) AND adds the retreat to the main website. Skip for one-off / private retreats."
              defaultOn={false}
              hint="≈ 2 hr build time · cost $40-80 for AI hero + reel cover"
            />

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border-1, #1f1c15)' }}>
              <button type="submit" style={S.btnPrimary}>✓ Confirm &amp; broadcast</button>
              <a href="?view=ongoing" style={S.btnSecondary}>← Back</a>
              <button type="button" style={S.btnSecondary}>⟶ Save as draft</button>
            </div>
          </form>
        </Panel>
      </div>

      {/* Right rail */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Panel title="On confirm · what happens" eyebrow="step-by-step">
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Flow step="1" desc="PDF generated + stored in dms.documents" />
            <Flow step="2" desc="Package row inserted into sales.packages (status: live)" />
            <Flow step="3" desc="Social cockpit picks it up · Content Strategist drafts 8-12 posts" />
            <Flow step="4" desc="Influencer cockpit (if opted in) routes to matching ambassadors" />
            <Flow step="5" desc="Lead scrape (if opted in) seeds sales.scraping_jobs · scrapers run on ICP" />
            <Flow step="6" desc="Funnel cockpit (if opted in) builds page + adds to website nav" />
            <Flow step="7" desc="Compiler emits compiler_locked event · audit_log written" />
          </div>
        </Panel>

        <Panel title="Lock checklist" eyebrow="all must pass">
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Check on={offer.pdfReady}                label="PDF generated + reviewed" />
            <Check on={offer.marginPct != null && offer.marginPct >= 35} label="Margin ≥ 35%" />
            <Check on={offer.pillars.length >= 3}       label="≥ 3 pillars defined" />
            <Check on={!!offer.icp}                     label="ICP target identified" />
            <Check on={offer.priceBand !== 'TBD'}        label="Price band confirmed" />
            <Check on={true}                            label="Brand-fit auto-pass" />
          </div>
        </Panel>

        <Panel title="Guardrails" eyebrow="non-negotiable">
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Callout tone="brass">Margin floor: 35% net of F&amp;B + spa + transfer + commission. Compiler refuses lock below.</Callout>
            <Callout tone="warn">Reality Agent checks every PDF claim against actual resort capability. Fabrications blocked.</Callout>
            <Callout tone="soft">Funnel page broadcasts are off by default. Don't ship a funnel for one-off / private / B2B retreats.</Callout>
            <Callout tone="soft">Re-locking a retreat re-broadcasts. Unlock + re-lock if you change pricing or pillars.</Callout>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function DistTarget({ code, label, desc, defaultOn, required, hint }: { code: string; label: string; desc: string; defaultOn: boolean; required?: boolean; hint?: string }) {
  return (
    <label style={S.distRow}>
      <input type="checkbox" defaultChecked={defaultOn} disabled={required} name={`dist_${code}`} style={S.distCheckbox} />
      <div style={{ flex: 1 }}>
        <div style={S.distLabel}>{label}{required && <span style={{ color: 'var(--brass, #a8854a)', marginLeft: 6 }}>· required</span>}</div>
        <div style={S.distDesc}>{desc}</div>
        {hint && <div style={S.distHint}>{hint}</div>}
      </div>
    </label>
  );
}

function Flow({ step, desc }: { step: string; desc: string }) {
  return (
    <div style={S.flowRow}>
      <span style={S.flowStep}>{step}</span>
      <span style={S.flowDesc}>{desc}</span>
    </div>
  );
}

function Check({ on, label }: { on: boolean; label: string }) {
  const color = on ? 'var(--st-good, #82ad8c)' : '#c97b6a';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.10em', color: 'var(--text-1, #d8cca8)' }}>
      <span style={{ width: 14, height: 14, borderRadius: 2, border: `1px solid ${color}`, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{on ? '✓' : '✕'}</span>
      <span>{label}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={S.statLabel}>{label}</span>
      <span style={S.statValue}>{value}</span>
    </div>
  );
}

function Callout({ tone, children }: { tone: 'brass' | 'soft' | 'warn'; children: ReactNode }) {
  const border = tone === 'brass' ? 'var(--brass, #a8854a)' : tone === 'warn' ? 'var(--st-warn, #C28F2C)' : 'var(--border-1, #1f1c15)';
  return (
    <div style={{ padding: '8px 10px', borderLeft: `2px solid ${border}`, background: 'var(--surf-1, #0f0d0a)', fontSize: 'var(--t-sm)', lineHeight: 1.5, color: 'var(--text-1, #d8cca8)' }}>
      {children}
    </div>
  );
}

// ─── Pills ────────────────────────────────────────────────────────────────

function offerStatusPill(s: OfferStatus): React.CSSProperties {
  const c = s === 'Awaiting Lock' ? 'var(--brass, #a8854a)' :
            s === 'PDF Review'    ? 'var(--text-2, #d8cca8)' :
            s === 'Pricing'       ? 'var(--st-warn, #C28F2C)' :
                                    'var(--text-mute, #9b907a)';
  return basePill(c);
}

function basePill(color: string): React.CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color,
    border: `1px solid ${color}`,
    padding: '2px 6px',
    borderRadius: 3,
    whiteSpace: 'nowrap',
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  subStrip: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border-1, #1f1c15)' },
  subStripLink: { padding: '6px 12px', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-mute, #9b907a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 3, textDecoration: 'none', background: 'var(--surf-1, #0f0d0a)' },
  subStripLinkActive: { color: 'var(--surf-0, #0a0a0a)', background: 'var(--brass, #a8854a)', borderColor: 'var(--brass, #a8854a)', fontWeight: 700 },

  // Offer card
  offerCard: { background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderLeft: '3px solid var(--brass, #a8854a)', borderRadius: 6, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 },
  fixedCard: { background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderLeft: '3px solid var(--st-good, #82ad8c)', borderRadius: 6, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 },
  offerHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  offerType: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--brass, #a8854a)' },
  offerName: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--t-md)', color: 'var(--text-0, #e9e1ce)', fontWeight: 500, marginTop: 2 },
  offerMeta: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', color: 'var(--text-mute, #9b907a)' },
  offerDescr: { fontSize: 'var(--t-sm)', lineHeight: 1.5, color: 'var(--text-1, #d8cca8)' },
  offerStatRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, borderTop: '1px solid var(--border-1, #1f1c15)', paddingTop: 8 },
  offerPillars: { display: 'flex', flexDirection: 'column', gap: 4 },
  offerFieldLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-place, #5a5448)' },
  tagRow: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  tagChip: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.10em', padding: '1px 5px', background: 'transparent', color: 'var(--text-1, #d8cca8)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 2 },
  offerActions: { display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border-1, #1f1c15)' },

  // Broadcast log (fixed cards)
  broadcastBox: { padding: '8px 10px', background: 'var(--surf-0, #0a0a0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 6 },
  broadcastLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--brass, #a8854a)' },
  broadcastRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },

  // PDF mockup
  pdfMockup: {
    background: '#f7f1e6',
    border: '1px solid var(--brass, #a8854a)',
    borderRadius: 4,
    padding: '24px 28px',
    color: '#2a2620',
    fontFamily: "'Fraunces', Georgia, serif",
    boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
  },
  pdfHeader: { textAlign: 'center', paddingBottom: 14, borderBottom: '1px solid #a8854a' },
  pdfBrand: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, letterSpacing: '0.32em', color: '#a8854a', marginBottom: 12 },
  pdfTitleBig: { fontSize: 26, fontStyle: 'italic', fontWeight: 400, color: '#2a2620' },
  pdfSub: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7d7565', marginTop: 8 },
  pdfBody: { padding: '18px 0', display: 'flex', flexDirection: 'column', gap: 10 },
  pdfSection: { display: 'grid', gridTemplateColumns: '80px 1fr', gap: 14 },
  pdfLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a8854a', paddingTop: 2 },
  pdfValue: { fontFamily: "'Inter Tight', system-ui, sans-serif", fontSize: 13, lineHeight: 1.6, color: '#2a2620' },
  pdfFooter: { paddingTop: 14, borderTop: '1px solid #a8854a', display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7d7565' },

  // Distribution rows
  distRow: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 4, cursor: 'pointer' },
  distCheckbox: { width: 16, height: 16, marginTop: 3, accentColor: '#a8854a' as any },
  distLabel: { fontSize: 'var(--t-sm)', color: 'var(--text-0, #e9e1ce)', fontWeight: 500 },
  distDesc: { fontSize: 'var(--t-xs)', lineHeight: 1.5, color: 'var(--text-mute, #9b907a)', marginTop: 2 },
  distHint: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', color: 'var(--text-place, #5a5448)', marginTop: 4, fontStyle: 'italic' },

  // Flow rows
  flowRow: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 'var(--t-xs)', lineHeight: 1.5, color: 'var(--text-1, #d8cca8)' },
  flowStep: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.16em', color: 'var(--brass, #a8854a)', minWidth: 16 },
  flowDesc: { flex: 1 },

  // Stats
  statLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-place, #5a5448)' },
  statValue: { fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)', fontVariantNumeric: 'tabular-nums' },

  // Buttons
  btnPrimary: { background: 'var(--brass, #a8854a)', color: 'var(--surf-0, #0a0a0a)', border: '1px solid var(--brass, #a8854a)', padding: '5px 12px', borderRadius: 3, cursor: 'pointer', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, textDecoration: 'none' },
  btnSecondary: { background: 'transparent', color: 'var(--text-1, #d8cca8)', border: '1px solid var(--border-1, #1f1c15)', padding: '5px 12px', borderRadius: 3, cursor: 'pointer', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' },
  btnInlinePrimary: { background: 'var(--brass, #a8854a)', color: 'var(--surf-0, #0a0a0a)', border: '1px solid var(--brass, #a8854a)', padding: '3px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600, textDecoration: 'none' },
  btnInlineSecondary: { background: 'transparent', color: 'var(--text-1, #d8cca8)', border: '1px solid var(--border-1, #1f1c15)', padding: '3px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.10em', textTransform: 'uppercase', textDecoration: 'none' },

  // Empty state
  emptyState: { padding: '32px 18px', textAlign: 'center', background: 'var(--surf-1, #0f0d0a)', border: '1px dashed var(--border-1, #1f1c15)', borderRadius: 6 },
  emptyTitle: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--t-lg)', color: 'var(--text-0, #e9e1ce)', marginBottom: 6 },
  emptySub: { fontSize: 'var(--t-sm)', color: 'var(--text-mute, #9b907a)' },
};

// Export the offer/fixed lists so /sales/packages can read them too
export { FIXED as COMPILER_FIXED_RETREATS };
export type { FixedRetreat as CompilerFixedRetreat };
