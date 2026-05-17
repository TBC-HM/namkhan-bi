// app/sales/packages/page.tsx
//
// PBS 2026-05-16: Sales · Packages — ready-for-sale catalog. Receives
// broadcasts from /marketing/compiler when a retreat is locked.
//
// Phase 1: reads the COMPILER_FIXED_RETREATS list (shared with compiler).
// Phase 2: this page reads sales.packages directly, which Compiler writes
// to on Lock & Distribute confirm.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import { SALES_SUBPAGES } from '../_subpages';
import { COMPILER_FIXED_RETREATS, type CompilerFixedRetreat } from '../../marketing/compiler/_components/CompilerCockpit';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default function SalesPackagesPage() {
  const packages = COMPILER_FIXED_RETREATS;
  const totalRevenue = packages.reduce((s, p) => s + p.revenueMtdUsd, 0);
  const totalBookings = packages.reduce((s, p) => s + p.bookingsMtd, 0);
  const topSeller = packages.slice().sort((a, b) => b.bookingsMtd - a.bookingsMtd)[0];
  const avgPrice = packages.length > 0
    ? Math.round(packages.reduce((s, p) => s + Number(p.pricePax.replace(/[^0-9]/g, '')), 0) / packages.length)
    : 0;

  return (
    <Page
      eyebrow="Sales · Packages"
      title={<>Ready for <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>sale</em></>}
      subPages={SALES_SUBPAGES}
    >
      {/* KPI band */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <KpiBox value={packages.length}  unit="count" label="Active packages"  tooltip="Locked retreats live in /sales/packages" />
        <KpiBox value={totalBookings}    unit="count" label="Bookings MTD"     tooltip="Package bookings this month" />
        <KpiBox value={totalRevenue}     unit="usd"   label="Revenue MTD"      tooltip="Package revenue this month · USD" />
        <KpiBox value={avgPrice}         unit="usd"   label="Avg price / pax"  tooltip="Mean package price across active retreats" />
        <KpiBox value={null}             unit="text"  valueText={topSeller?.name.split(' · ')[0] ?? '—'} label="Top seller" tooltip={`${topSeller?.bookingsMtd ?? 0} bookings MTD`} />
      </div>

      <Panel
        title="Ready-for-sale catalog"
        eyebrow="locked by Compiler · sales-team facing"
        actions={<a href="/marketing/compiler" style={S.btnPrimary}>← Open Compiler</a>}
      >
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
          {packages.map((p) => <PackageCard key={p.id} pkg={p} />)}
        </div>
      </Panel>

      <div style={{ marginTop: 14 }}>
        <Panel title="How packages get here" eyebrow="compiler → broadcast">
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--t-sm)', color: 'var(--text-1, #d8cca8)', lineHeight: 1.6 }}>
            <div>1. Marketing builds the retreat in <a href="/marketing/compiler" style={{ color: 'var(--brass)' }}>/marketing/compiler · Ongoing Offers</a>.</div>
            <div>2. Once PDF is ready + margin ≥ 35%, PBS clicks <strong>🔒 Lock &amp; distribute</strong>.</div>
            <div>3. The wizard generates the PDF and asks where to promote (Sales · Social · Influencer · Web).</div>
            <div>4. <strong>Sales · Packages</strong> is always checked — every locked retreat lands here.</div>
            <div>5. Sales team quotes from this catalog · Compiler emits a <code>compiler_locked</code> audit event.</div>
          </div>
        </Panel>
      </div>

      <div style={S.footerNote}>
        Phase 1 · reads the in-memory <code>COMPILER_FIXED_RETREATS</code> list shared with the Compiler. Phase 2 wires <code>sales.packages</code> table written by the Lock &amp; Distribute confirm step.
      </div>
    </Page>
  );
}

function PackageCard({ pkg }: { pkg: CompilerFixedRetreat }) {
  return (
    <div style={S.card}>
      <div style={S.head}>
        <div>
          <div style={S.meta}>Locked · {pkg.lockedAt}</div>
          <div style={S.name}>{pkg.name}</div>
        </div>
        <span style={S.pillGood}>FOR SALE</span>
      </div>
      <div style={S.metaRow}>{pkg.duration} · {pkg.pax} pax · {pkg.icp}</div>
      <div style={S.priceRow}>
        <span style={S.priceLabel}>Price · per pax</span>
        <span style={S.priceValue}>{pkg.pricePax}</span>
      </div>
      <div style={S.statRow}>
        <Stat label="Bookings MTD" value={String(pkg.bookingsMtd)} />
        <Stat label="Revenue MTD"  value={`$${pkg.revenueMtdUsd.toLocaleString('en-US')}`} />
        <Stat label="PDF" value="✓" />
        <Stat label="Funnel" value={pkg.funnelUrl ? '✓' : '—'} />
      </div>
      <div style={S.actions}>
        <a href={pkg.pdfUrl} target="_blank" rel="noopener noreferrer" style={S.btnSecondary}>📄 PDF</a>
        {pkg.funnelUrl && <a href={pkg.funnelUrl} style={S.btnSecondary}>🌐 Funnel</a>}
        <a href={`/sales/inquiries?package=${pkg.id}&action=quote`} style={S.btnPrimary}>✦ Send quote</a>
        <a href={`/marketing/compiler?view=fixed&retreat=${pkg.id}`} style={S.btnSecondary}>↻ Compiler</a>
      </div>
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

const S: Record<string, React.CSSProperties> = {
  card: { background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderLeft: '3px solid var(--st-good, #82ad8c)', borderRadius: 6, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  meta: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--brass, #a8854a)' },
  name: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--t-md)', color: 'var(--text-0, #e9e1ce)', fontWeight: 500, marginTop: 2 },
  metaRow: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', color: 'var(--text-mute, #9b907a)' },
  priceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 10px', background: 'var(--surf-0, #0a0a0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 3 },
  priceLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-mute, #9b907a)' },
  priceValue: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--t-lg)', color: 'var(--brass, #a8854a)' },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, borderTop: '1px solid var(--border-1, #1f1c15)', paddingTop: 8 },
  statLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-place, #5a5448)' },
  statValue: { fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)', fontVariantNumeric: 'tabular-nums' },
  actions: { display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border-1, #1f1c15)' },
  btnPrimary: { background: 'var(--brass, #a8854a)', color: 'var(--surf-0, #0a0a0a)', border: '1px solid var(--brass, #a8854a)', padding: '4px 10px', borderRadius: 3, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, textDecoration: 'none' },
  btnSecondary: { background: 'transparent', color: 'var(--text-1, #d8cca8)', border: '1px solid var(--border-1, #1f1c15)', padding: '4px 10px', borderRadius: 3, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' },
  pillGood: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--st-good, #82ad8c)', border: '1px solid var(--st-good, #82ad8c)', padding: '2px 6px', borderRadius: 3 },
  footerNote: { marginTop: 18, padding: '10px 12px', fontSize: 'var(--t-xs)', color: 'var(--text-mute, #9b907a)', fontStyle: 'italic', borderTop: '1px solid var(--border-1, #1f1c15)' },
};
