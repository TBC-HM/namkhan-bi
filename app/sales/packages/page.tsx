// app/sales/packages/page.tsx
// PBS 2026-07-11 pm — Sales · Packages rebuilt on design_system v6.
//
// Data flow (see task brief 2026-07-11):
//   sales.packages  ──▶  public.v_sales_packages  ──▶  this page (RSC).
// Compiler Lock & Distribute (future) INSERTs into sales.packages.
//
// Server component. Accepts optional propertyId for Donna delegate.

import Link from 'next/link';
import { DashboardPage, MetricRow, Container } from '@/app/(cockpit)/_design';
import { SALES_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const NAMKHAN = 260955;

interface PageProps {
  propertyId?: number;
}

interface PackageRow {
  id: string;
  property_id: number;
  name: string;
  slug: string | null;
  eyebrow: string | null;
  description: string | null;
  duration_nights: number | null;
  price_pax_usd: number | string | null;
  currency: string | null;
  status: 'active' | 'paused' | 'archived';
  hero_image_url: string | null;
  compiler_run_id: string | null;
  bookings_mtd: number | null;
  revenue_mtd_usd: number | string | null;
  bookings_ltd: number | null;
  revenue_ltd_usd: number | string | null;
  locked_at: string | null;
  locked_by: string | null;
}

async function loadPackages(propertyId: number): Promise<PackageRow[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_sales_packages')
    .select('id,property_id,name,slug,eyebrow,description,duration_nights,price_pax_usd,currency,status,hero_image_url,compiler_run_id,bookings_mtd,revenue_mtd_usd,bookings_ltd,revenue_ltd_usd,locked_at,locked_by')
    .eq('property_id', propertyId)
    .order('name', { ascending: true });
  return (data ?? []) as PackageRow[];
}

function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function usd(v: number | string | null | undefined): string {
  return `$${num(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default async function SalesPackagesPage({ propertyId }: PageProps = {}) {
  const pid = propertyId ?? NAMKHAN;
  const packages = await loadPackages(pid);

  const active = packages.filter((p) => p.status === 'active');
  const totalBookings = packages.reduce((s, p) => s + num(p.bookings_mtd), 0);
  const totalRevenue  = packages.reduce((s, p) => s + num(p.revenue_mtd_usd), 0);
  const avgPrice = active.length > 0
    ? Math.round(active.reduce((s, p) => s + num(p.price_pax_usd), 0) / active.length)
    : 0;
  const topSeller = packages.slice().sort((a, b) => num(b.bookings_mtd) - num(a.bookings_mtd))[0];
  const topSellerShort = topSeller?.name.split(' · ')[0] ?? '—';

  const tabs = SALES_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href }));

  return (
    <DashboardPage
      title="Packages"
      subtitle="Ready-for-sale catalog · locked by Compiler · sales-team facing"
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow
          tiles={[
            { label: 'Active packages', value: active.length,   unit: 'count' },
            { label: 'Bookings MTD',    value: totalBookings,   unit: 'count' },
            { label: 'Revenue MTD',     value: totalRevenue,    unit: 'USD', currency: 'USD' },
            { label: 'Avg price / pax', value: avgPrice,        unit: 'USD', currency: 'USD' },
            { label: 'Top seller',      value: topSellerShort,  footnote: `${num(topSeller?.bookings_mtd)} bookings MTD` },
          ]}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Ready-for-sale catalog"
          subtitle="One card per locked retreat · updates on Compiler lock"
          action={<Link href="/marketing/compiler" style={linkBtn}>Open Compiler</Link>}
        >
          {packages.length === 0 ? (
            <div style={emptyBox}>
              No packages yet. Open <Link href="/marketing/compiler" style={{ color: 'var(--brand, #B8542A)' }}>Compiler</Link> and lock a retreat to seed this catalog.
            </div>
          ) : (
            <div style={grid}>
              {packages.map((p) => <PackageCard key={p.id} pkg={p} />)}
            </div>
          )}
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="How packages get here" subtitle="compiler → sales.packages → this page">
          <ol style={steps}>
            <li>Marketing builds the retreat in <Link href="/marketing/compiler" style={inlineLink}>/marketing/compiler · Ongoing Offers</Link>.</li>
            <li>Once the PDF is ready + margin ≥ 35%, PBS clicks <strong>Lock &amp; distribute</strong>.</li>
            <li>Lock &amp; distribute INSERTs a row into <code style={code}>sales.packages</code> with the compiler_run_id and locks_at stamp.</li>
            <li>This page reads <code style={code}>public.v_sales_packages</code> filtered by property (Namkhan 260955 · Donna delegate ready).</li>
            <li>Sales team quotes from the catalog above. Nightly cron will fold in bookings_mtd / revenue_mtd_usd from pms.reservations (follow-up).</li>
          </ol>
        </Container>
      </div>
    </DashboardPage>
  );
}

function PackageCard({ pkg }: { pkg: PackageRow }) {
  const statusPill =
    pkg.status === 'active'   ? { bg: '#E9F1EA', fg: '#1F3A2E', label: 'FOR SALE' } :
    pkg.status === 'paused'   ? { bg: '#FBECE0', fg: '#B8542A', label: 'PAUSED' } :
                                { bg: '#EEEEEE', fg: '#5A5A5A', label: 'ARCHIVED' };

  return (
    <div style={card}>
      <div style={cardHead}>
        <div>
          {pkg.eyebrow ? <div style={eyebrow}>{pkg.eyebrow}</div> : null}
          <div style={cardName}>{pkg.name}</div>
        </div>
        <span style={{ ...pill, background: statusPill.bg, color: statusPill.fg }}>{statusPill.label}</span>
      </div>

      {pkg.description ? <div style={cardDesc}>{pkg.description}</div> : null}

      <div style={cardFacts}>
        <div><span style={factK}>Duration</span><span style={factV}>{pkg.duration_nights ?? '—'} nights</span></div>
        <div><span style={factK}>Price / pax</span><span style={factV}>{usd(pkg.price_pax_usd)}</span></div>
        <div><span style={factK}>Bookings MTD</span><span style={factV}>{num(pkg.bookings_mtd)}</span></div>
        <div><span style={factK}>Revenue MTD</span><span style={factV}>{usd(pkg.revenue_mtd_usd)}</span></div>
      </div>

      {pkg.compiler_run_id ? (
        <div style={cardFoot}>
          <Link href={`/marketing/compiler?run=${encodeURIComponent(pkg.compiler_run_id)}`} style={linkBtnSm}>
            Open Compiler run
          </Link>
        </div>
      ) : null}
    </div>
  );
}

// ─── styles (light theme, design_system v6 tokens) ────────────────────────

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 12,
  padding: 14,
};

const card: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E6DFCC',
  borderRadius: 8,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const cardHead: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 8,
};

const eyebrow: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: '#8A7E5F',
  marginBottom: 2,
};

const cardName: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#1B1B1B',
  lineHeight: 1.25,
};

const cardDesc: React.CSSProperties = {
  fontSize: 12.5,
  color: '#5A5A5A',
  lineHeight: 1.5,
};

const cardFacts: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  fontSize: 12.5,
  marginTop: 4,
};

const factK: React.CSSProperties = { display: 'block', color: '#8A7E5F', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 };
const factV: React.CSSProperties = { display: 'block', color: '#1B1B1B', fontWeight: 600, fontSize: 13.5 };

const pill: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.6,
  padding: '3px 8px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
};

const cardFoot: React.CSSProperties = {
  marginTop: 6,
  paddingTop: 8,
  borderTop: '1px solid #E6DFCC',
};

const linkBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 12px',
  background: '#1B1B1B',
  color: '#FFFFFF',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'none',
};

const linkBtnSm: React.CSSProperties = {
  display: 'inline-block',
  padding: '4px 10px',
  background: '#F5F0E1',
  color: '#1B1B1B',
  borderRadius: 6,
  fontSize: 11.5,
  fontWeight: 600,
  textDecoration: 'none',
  border: '1px solid #E6DFCC',
};

const emptyBox: React.CSSProperties = {
  padding: 24,
  textAlign: 'center',
  color: '#5A5A5A',
  fontSize: 13,
};

const steps: React.CSSProperties = {
  padding: '14px 14px 14px 32px',
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  color: '#1B1B1B',
  lineHeight: 1.55,
};

const inlineLink: React.CSSProperties = { color: '#B8542A', textDecoration: 'none' };
const code: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, background: '#F5F0E1', padding: '1px 6px', borderRadius: 4 }
