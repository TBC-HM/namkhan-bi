// app/h/[property_id]/_components/CeoEntry.tsx
// PBS 2026-07-02: new-design CEO landing (path 1 isolated redesign).
// Renders the property's Hotel CEO (Nova for Namkhan, Orion for Donna) with:
//   - Nova/Orion header strip (avatar + tagline + status)
//   - Ask-me box that opens the LLM chat surface
//   - Trailing KPI tiles (all-time main + L30d/L90d/L365d compare[])
//   - 3-container row: Attention · Docs · Tasks
//   - Bug tracker container at the bottom
// All primitives paper-white + hairline + ink · matches /revenue/channels/[source] pattern.

import Link from 'next/link';
import { DashboardPage, Container, KpiTile, type DashboardTab, type KpiTileProps, type KpiComparison } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export interface CeoConfig {
  propertyId: number;
  propertyLabel: string;
  ceoRole: string;
  ceoName: string;
  ceoAvatar: string;
  ceoTagline: string;
  humanPartner: string;
}

const NAMKHAN_ID = 260955;
const DONNA_ID   = 1000001;

interface KpiRow {
  metric_date: string;
  rooms_available: number;
  rooms_sold: number;
  rooms_revenue: number;
  total_revenue: number;
  is_actual: boolean;
}

interface BugRow  { id: number; body: string; status: string; created_at: string; fix_link: string | null; fix_label: string | null }

function agg(rows: KpiRow[]) {
  const roomsAvail = rows.reduce((s, r) => s + Number(r.rooms_available ?? 0), 0);
  const roomsSold  = rows.reduce((s, r) => s + Number(r.rooms_sold ?? 0), 0);
  const roomsRev   = rows.reduce((s, r) => s + Number(r.rooms_revenue ?? 0), 0);
  const totalRev   = rows.reduce((s, r) => s + Number(r.total_revenue ?? 0), 0);
  return {
    occ:    roomsAvail > 0 ? (roomsSold / roomsAvail) * 100 : 0,
    adr:    roomsSold  > 0 ? roomsRev / roomsSold : 0,
    revpar: roomsAvail > 0 ? roomsRev / roomsAvail : 0,
    rev:    roomsRev,
    totalRev,
  };
}

function isoBack(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export default async function CeoEntry({ cfg }: { cfg: CeoConfig }) {
  const supabase = getSupabaseAdmin();
  const today    = new Date().toISOString().slice(0, 10);
  const d30      = isoBack(30);
  const d90      = isoBack(90);
  const d365     = isoBack(365);
  // PBS 2026-07-02: main tile value is YTD (Jan 1 of current year → today).
  const dYtd     = `${new Date().getFullYear()}-01-01`;
  const yearNow  = new Date().getFullYear();

  // Namkhan-only view today. Donna would need its own view — safe fallback.
  const kpiView = cfg.propertyId === NAMKHAN_ID ? 'v_kpi_daily' : null;
  const kpiSelect = 'metric_date,rooms_available,rooms_sold,rooms_revenue,total_revenue,is_actual';
  const pull = (from: string) => kpiView
    ? supabase.from(kpiView).select(kpiSelect).gte('metric_date', from).lte('metric_date', today).eq('is_actual', true).then(r => (r.data ?? []) as KpiRow[]).catch(() => [] as KpiRow[])
    : Promise.resolve([] as KpiRow[]);

  const [kpi30, kpi90, kpi365, kpiYtd, bugsRes] = await Promise.all([
    pull(d30),
    pull(d90),
    pull(d365),
    pull(dYtd),
    supabase.from('cockpit_bugs').select('id,body,status,created_at,fix_link,fix_label').neq('status', 'archived').order('created_at', { ascending: false }).limit(10).then(r => (r.data ?? []) as BugRow[]).catch(() => [] as BugRow[]),
  ]);
  // Attention / Docs / Tasks tables not yet installed — render empty state.
  const attnRes: Array<{ id: string; label: string; severity: 'high'|'medium'|'low'; href: string | null }> = [];
  const docsRes: Array<{ id: string; label: string; href: string | null; uploaded_at: string }> = [];
  const tasksRes: Array<{ id: string; label: string; done: boolean; due: string | null; alert: boolean | null }> = [];

  const A30  = agg(kpi30);
  const A90  = agg(kpi90);
  const A365 = agg(kpi365);
  const AYtd = agg(kpiYtd);

  const cmp = (v30: number, v90: number, v365: number, format: 'absolute'|'currency'|'percent' = 'absolute'): KpiComparison[] => [
    { label: 'L30d',  value: v30,  format, direction: 'flat' },
    { label: 'L90d',  value: v90,  format, direction: 'flat' },
    { label: 'L365d', value: v365, format, direction: 'flat' },
  ];

  // PBS 2026-07-02: main = YTD (Jan 1 → today). compare[] = trailing 30/90/365d.
  const tiles: KpiTileProps[] = [
    { label: 'Occupancy',     value: `${AYtd.occ.toFixed(1)}%`,        size: 'md',
      footnote: `rooms sold ÷ rooms available · YTD ${yearNow}`,
      compare: cmp(Number(A30.occ.toFixed(1)), Number(A90.occ.toFixed(1)), Number(A365.occ.toFixed(1)), 'percent') },
    { label: 'ADR',           value: Math.round(AYtd.adr),    currency: 'USD', size: 'md',
      footnote: `rooms revenue ÷ rooms sold · YTD ${yearNow}`,
      compare: cmp(Math.round(A30.adr), Math.round(A90.adr), Math.round(A365.adr), 'currency') },
    { label: 'RevPAR',        value: Math.round(AYtd.revpar), currency: 'USD', size: 'md',
      footnote: `rooms revenue ÷ rooms available · YTD ${yearNow}`,
      compare: cmp(Math.round(A30.revpar), Math.round(A90.revpar), Math.round(A365.revpar), 'currency') },
    { label: 'Rooms revenue', value: Math.round(AYtd.rev),    currency: 'USD', size: 'md',
      footnote: `rooms-only revenue (excl. F&B & extras) · YTD ${yearNow}`,
      compare: cmp(Math.round(A30.rev), Math.round(A90.rev), Math.round(A365.rev), 'currency') },
  ];

  const tabs: DashboardTab[] = [];  // property nav handled by parent TopDeptStrip

  const severityTone: Record<string, string> = {
    high:   '#B03826',
    medium: '#B8542A',
    low:    '#2C5F4F',
  };

  return (
    <DashboardPage
      title={`${cfg.propertyLabel} · ${cfg.ceoName}`}
      subtitle={cfg.ceoTagline}
      tabs={tabs}
    >
      {/* CEO greeting strip */}
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
          🟢 Active
        </span>
      </div>

      {/* Ask-me chat entry */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Ask ${cfg.ceoName}`} subtitle="Cross-department questions · P&L · guest experience · operations">
          <form
            action={`/api/chat-v2/init?role=${encodeURIComponent(cfg.ceoRole)}&propertyId=${cfg.propertyId}`}
            method="POST"
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
                {['How is the resort doing today?', 'Yesterday\'s P&L', 'Any leakage flags?', 'This week\'s pickup'].map((chip) => (
                  <ChipHint key={chip} label={chip} propertyId={cfg.propertyId} role={cfg.ceoRole} />
                ))}
              </div>
              <button type="submit" style={{
                padding: '8px 18px', background: '#1F3A2E', color: '#FFFFFF',
                border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
              }}>
                Ask →
              </button>
            </div>
          </form>
        </Container>
      </div>

      {/* KPI tiles */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 6 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      {/* 3-container row: Attention · Docs · Tasks */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridAutoRows: '1fr', gap: 12, alignItems: 'stretch' }}>
        <Container title={`Attention · ${attnRes.length}`} subtitle="leakage · opportunities · watchlist">
          {attnRes.length === 0 ? (
            <EmptyBlock>No attention items. Nova will surface leakage and pickup flags here as they land.</EmptyBlock>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attnRes.map((a) => (
                <li key={a.id} style={{ padding: '8px 10px', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: severityTone[a.severity] ?? '#8A8A8A', marginRight: 8 }} />
                  {a.href ? <Link href={a.href} style={{ color: '#1B1B1B', textDecoration: 'underline', textDecorationColor: '#C79A6B' }}>{a.label}</Link> : a.label}
                </li>
              ))}
            </ul>
          )}
        </Container>

        <Container title={`Docs · ${docsRes.length}`} subtitle="uploads · reports">
          {docsRes.length === 0 ? (
            <EmptyBlock>Drop docs Nova should read. Reports will queue here after their scheduled runs.</EmptyBlock>
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

        <Container title={`Tasks · ${tasksRes.length}`} subtitle="Nova-owned todos">
          {tasksRes.length === 0 ? (
            <EmptyBlock>No open tasks. Tasks created in chat land here.</EmptyBlock>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tasksRes.map((t) => (
                <li key={t.id} style={{ padding: '8px 10px', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <input type="checkbox" defaultChecked={t.done} disabled style={{ marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#1B1B1B' }}>{t.label}</div>
                    {t.due && <div style={{ fontSize: 10, color: t.alert ? '#B03826' : '#8A8A8A', marginTop: 2 }}>due {t.due}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </div>

      {/* Bug tracker */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Bugs & fixes · ${bugsRes.length}`} subtitle="reported by Nova / by chat · click a done bug to see the fix">
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

function ChipHint({ label, propertyId, role }: { label: string; propertyId: number; role: string }) {
  const href = `/api/chat-v2/init?role=${encodeURIComponent(role)}&propertyId=${propertyId}&q=${encodeURIComponent(label)}`;
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
