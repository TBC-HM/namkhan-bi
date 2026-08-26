// app/h/[property_id]/_components/CeoEntry.tsx
// PBS 2026-07-02: new-design CEO landing (path 1 isolated redesign).
// Renders the property's Hotel CEO (Nova for Namkhan, Orion for Donna) with:
//   - Nova/Orion header strip (avatar + tagline + status)
//   - Ask-me box that opens the LLM chat surface
//   - Trailing KPI tiles (all-time main + L30d/L90d/L365d compare[])
//   - 3-container row: Attention · Docs · Tasks
//   - Bug tracker container at the bottom
// All primitives paper-white + hairline + ink · matches /revenue/channels/[source] pattern.
//
// PBS 2026-07-08 (v3): fix Donna $0 bug + currency plumbing.
//   - was: read `public.v_kpi_daily` (hardcoded WHERE property_id=260955) so
//     Donna returned zero rows -> every tile 0 · $0 · $0 · $0.
//   - now: read `public.v_kpi_daily_property` (bridge over kpi.v_kpi_daily) with
//     `.eq('property_id', cfg.propertyId)` -- multi-tenant, filtered per property.
//   - currency prop reads `cfg.baseCurrency` (EUR for Donna, USD for Namkhan);
//     no more hardcoded 'USD' in KpiTile props.
//   - all internal Links now use TenantLink so /h/{property_id} sticks on nav.

import { DashboardPage, Container, type DashboardTab, type Currency } from '@/app/(cockpit)/_design';
// PBS 2026-08-26: the four trailing KPI tiles + the empty Attention container
// are replaced by CeoHeartbeat — score vs SDLY/Budget, profitability, forward
// outlook, ancillary capture, and the live attention feed (was hardcoded []).
import CeoHeartbeat from '@/app/(cockpit)/_design/CeoHeartbeat';
import BookingActivity from '@/app/(cockpit)/_design/BookingActivity';
import HodTasksList from '@/app/revenue/_components/HodTasksList';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export interface CeoConfig {
  propertyId: number;
  propertyLabel: string;
  ceoRole: string;
  ceoName: string;
  ceoAvatar: string;
  ceoTagline: string;
  humanPartner: string;
  baseCurrency?: Currency; // PBS 2026-07-08: 'USD' | 'EUR' | 'LAK'
}

const NAMKHAN_ID = 260955;
const DONNA_ID   = 1000001;

interface BugRow  { id: number; body: string; status: string; created_at: string; fix_link: string | null; fix_label: string | null }

function fallbackCurrency(pid: number): Currency {
  if (pid === NAMKHAN_ID) return 'USD';
  if (pid === DONNA_ID)   return 'EUR';
  return 'USD';
}

export default async function CeoEntry({
  cfg,
  searchParams,
}: {
  cfg: CeoConfig;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = getSupabaseAdmin();

  // PBS 2026-08-26: the KPI aggregation that used to live here moved into
  // CeoHeartbeat, which fetches its own windows (YTD, SDLY, forward months,
  // profitability, capture) — this component no longer pulls v_kpi_daily_property.
  const bugsRes = await Promise.resolve(
    supabase.from('cockpit_bugs')
      .select('id,body,status,created_at,fix_link,fix_label')
      .neq('status', 'archived').order('created_at', { ascending: false }).limit(10),
  ).then((r) => (r.data ?? []) as BugRow[]).catch(() => [] as BugRow[]);

  const docsRes: Array<{ id: string; label: string; href: string | null; uploaded_at: string }> = [];

  const currencyCode: Currency = cfg.baseCurrency ?? fallbackCurrency(cfg.propertyId);

  const tabs: DashboardTab[] = [];

  return (
    <DashboardPage
      title={`${cfg.propertyLabel} · ${cfg.ceoName}`}
      subtitle={cfg.ceoTagline}
      tabs={tabs}
    >
      <div style={{
        gridColumn: '1 / -1',
        display: 'flex', alignItems: 'center', gap: 14,
        background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 8,
        padding: '14px 18px', marginBottom: 6,
      }}>
        <div style={{ fontSize: 36 }}>{cfg.ceoAvatar}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, color: '#1B1B1B' }}>
            {cfg.ceoName} <span style={{ color: '#8A8A8A', fontSize: 13, fontWeight: 400 }}>· paired with {cfg.humanPartner}</span>
          </div>
          <div style={{ fontSize: 12, color: '#5A5A5A', marginTop: 2 }}>
            {cfg.ceoTagline}
          </div>
        </div>
        <span style={{ padding: '3px 10px', background: '#EEF5EE', border: '1px solid #C8DFC8', color: '#2C5F4F', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
          Active
        </span>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Ask ${cfg.ceoName}`} subtitle="Cross-department questions · P&L · guest experience · operations">
          <form
            action={`/chat`}
            method="GET"
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <textarea
              name="q"
              placeholder={`e.g. How is ${cfg.propertyLabel} doing today?`}
              rows={3}
              style={{
                width: '100%', padding: '10px 12px',
                background: '#FFFFFF', color: '#1B1B1B',
                border: '1px solid #E6DFCC', borderRadius: 6,
                fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { label: 'How is the resort doing today?', href: `/h/${cfg.propertyId}/revenue/pulse` },
                  { label: 'Any leakage flags?',             href: `/h/${cfg.propertyId}/revenue/leakage` },
                  { label: 'This week pickup',               href: `/h/${cfg.propertyId}/revenue/pickup` },
                  // dataroom-module-v1 round 2: property data-room cockpit entry
                  { label: 'Data room',                      href: `/h/${cfg.propertyId}/dataroom` },
                ].map((chip) => (
                  <ChipHint key={chip.label} label={chip.label} href={chip.href} />
                ))}
              </div>
              <button type="submit" style={{
                padding: '8px 18px', background: '#1F3A2E', color: '#FFFFFF',
                border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
              }}>
                Ask
              </button>
            </div>
          </form>
        </Container>
      </div>

      <CeoHeartbeat propertyId={cfg.propertyId} currency={currencyCode} />

      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridAutoRows: '1fr', gap: 12, alignItems: 'stretch' }}>
        <Container title={`Docs · ${docsRes.length}`} subtitle="uploads · reports">
          {docsRes.length === 0 ? (
            <EmptyBlock>Drop docs {cfg.ceoName} should read. Reports will queue here after their scheduled runs.</EmptyBlock>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {docsRes.map((d) => (
                <li key={d.id} style={{ padding: '8px 10px', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12 }}>
                  {d.href ? <a href={d.href} style={{ color: '#1B1B1B', textDecoration: 'underline', textDecorationColor: '#C79A6B' }}>{d.label}</a> : d.label}
                  <div style={{ fontSize: 10, color: '#8A8A8A', marginTop: 2 }}>{d.uploaded_at?.slice(0, 10)}</div>
                </li>
              ))}
            </ul>
          )}
        </Container>

        <Container title="Tasks" subtitle="add · due-date · repeat · delete · per property" density="compact">
          <HodTasksList deptSlug="revenue" propertyId={cfg.propertyId} />
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Bugs & fixes · ${bugsRes.length}`} subtitle={`reported by ${cfg.ceoName} / by chat · click a done bug to see the fix`}>
          {bugsRes.length === 0 ? (
            <EmptyBlock>No open bugs. When you flag something in chat it lands here.</EmptyBlock>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bugsRes.map((b) => {
                const dot = b.status === 'done' ? '#3F8A4A' : b.status === 'processing' ? '#A8D05A' : b.status === 'acked' ? '#D68A3A' : '#C0584C';
                return (
                  <li key={b.id} style={{ padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: dot, marginTop: 5 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#1B1B1B' }}>{b.body}</div>
                      <div style={{ fontSize: 10, color: '#8A8A8A', marginTop: 2 }}>{b.status} · {b.created_at?.slice(0, 10)}</div>
                    </div>
                    {b.fix_link && (
                      <a href={b.fix_link} style={{ fontSize: 11, color: '#1F3A2E', textDecoration: 'underline' }}>{b.fix_label ?? 'fix'}</a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <BookingActivity propertyId={cfg.propertyId} searchParams={searchParams} />
      </div>
    </DashboardPage>
  );
}

function EmptyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '18px 16px', background: '#FFFFFF', border: '1px dashed #E6DFCC',
      borderRadius: 4, fontSize: 12, color: '#5A5A5A', lineHeight: 1.5,
    }}>
      {children}
    </div>
  );
}

function ChipHint({ label, href }: { label: string; href: string }) {
  return (
    <a href={href} style={{
      padding: '4px 10px', background: '#FFFFFF', color: '#1B1B1B',
      border: '1px solid #E6DFCC', borderRadius: 12, fontSize: 11,
      textDecoration: 'none', whiteSpace: 'nowrap',
    }}>
      {label}
    </a>
  );
}
