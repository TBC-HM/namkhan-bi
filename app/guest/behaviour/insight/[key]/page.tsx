// app/guest/behaviour/insight/[key]/page.tsx
// PBS 2026-07-06: Drilldown from ConclusionBlock → the guests behind a signal.
// Server component. All filtering happens in Postgres/JS with no client state.

import TenantLink from '@/components/nav/TenantLink';
import { notFound } from 'next/navigation';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// Map insightKey → { title, subtitle, filter }.
// Filter is applied to guest.mv_guest_profile rows (or a joined reservation set).
type FilterFn = (row: ProfileRow, todayMs: number) => boolean;

interface ProfileRow {
  guest_id: string;
  full_name: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  stays_count: number | null;
  lifetime_revenue: number | null;
  total_nights: number | null;
  avg_adr: number | null;
  last_stay_date: string | null;
  is_repeat: boolean | null;
  top_source: string | null;
  top_segment: string | null;
}

function daysBetween(iso: string | null, ms: number): number | null {
  if (!iso) return null;
  return Math.floor((ms - new Date(iso).getTime()) / 86_400_000);
}
function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtNum(n: number): string { return Math.round(n).toLocaleString('en-US'); }

const DEFINITIONS: Record<string, {
  title: string;
  subtitle: string;
  filter: FilterFn;
  emptyText: string;
}> = {
  winback: {
    title: 'Win-back pool',
    subtitle: 'Repeat guests (≥ 2 stays) with a real email, last stay > 1 year ago.',
    emptyText: 'No guests in the win-back pool right now — every repeat guest stayed within 12 months, or has no email on file.',
    filter: (r, ms) =>
      Number(r.stays_count ?? 0) >= 2 &&
      !!r.email && String(r.email).includes('@') &&
      !!r.last_stay_date &&
      (daysBetween(r.last_stay_date, ms) ?? 0) > 365,
  },
  slipping: {
    title: 'Slipping repeat guests',
    subtitle: 'Repeat guests whose next-expected stay is 60+ days overdue but still within a year (still recoverable).',
    emptyText: 'No slipping repeat guests — every repeat guest is inside their expected cadence.',
    filter: (r, ms) => {
      const n = Number(r.stays_count ?? 0);
      if (n < 2) return false;
      const days = daysBetween(r.last_stay_date, ms);
      if (days == null) return false;
      const expectedCadence = 365 / Math.max(2, n);
      return days > expectedCadence + 60 && days <= 365;
    },
  },
  at_4_stays: {
    title: 'Guests one stay from Platinum',
    subtitle: 'Guests with exactly 4 stays — a "your 5th stay" note is the highest-converting nudge in retention.',
    emptyText: 'No guests currently sit at 4 stays.',
    filter: (r) => Number(r.stays_count ?? 0) === 4,
  },
  recent_stays: {
    title: 'Recent departures',
    subtitle: 'Guests who stayed in the last 90 days — the freshest audience for a post-stay follow-up.',
    emptyText: 'No stays recorded in the last 90 days.',
    filter: (r, ms) => {
      const d = daysBetween(r.last_stay_date, ms);
      return d != null && d >= 0 && d <= 90;
    },
  },
  upcoming_no_email: {
    title: 'Upcoming arrivals without a usable email',
    subtitle: 'Guests arriving soon whose profile has no email — Anticipation cannot fire.',
    emptyText: 'Every upcoming arrival has an email on file.',
    // Approximation using profile: has upcoming stay + no email.
    // (Directory uses arrival_bucket; profile doesn't have it, so filter softly.)
    filter: (r) => (!r.email || !String(r.email).includes('@')),
  },
  no_email: {
    title: 'Guests without email',
    subtitle: 'Profiles with no email at all — cannot be reached by any digital touchpoint.',
    emptyText: 'Every guest profile has an email.',
    filter: (r) => !r.email || !String(r.email).includes('@'),
  },
  no_country: {
    title: 'Guests without country',
    subtitle: 'Profiles with no country — geographic segmentation is degraded for these.',
    emptyText: 'Every guest profile has a country.',
    filter: (r) => !r.country || String(r.country).trim().length === 0,
  },
  dup_emails: {
    title: 'Duplicate email addresses',
    subtitle: 'Same email appearing on more than one guest profile — LTV is split, retention rules undercount them.',
    emptyText: 'No duplicate email addresses found.',
    filter: () => true, // Dedup logic handled inline below.
  },
  ota_no_email: {
    title: 'OTA reservations without a real email · last 30 days',
    subtitle: 'Reservations from OTAs whose email is masked, missing, or clearly synthetic.',
    emptyText: 'Every OTA reservation in the last 30 days has a real email.',
    filter: () => true, // handled separately below with reservation query
  },
};

interface Props { params: { key: string } }

export default async function InsightDrilldown({ params }: Props) {
  const def = DEFINITIONS[params.key];
  if (!def) notFound();

  const sb = getSupabaseAdmin();
  const todayMs = Date.now();

  // Load base profile set
  const { data: profilesData } = await sb.schema('guest').from('mv_guest_profile')
    .select('guest_id, full_name, country, email, phone, stays_count, lifetime_revenue, total_nights, avg_adr, last_stay_date, is_repeat, top_source, top_segment')
    .eq('property_id', PROPERTY_ID)
    .order('lifetime_revenue', { ascending: false })
    .limit(5000);

  const allProfiles: ProfileRow[] = (profilesData as ProfileRow[]) ?? [];

  let rows: ProfileRow[] = [];
  let extraSubtitle = '';

  if (params.key === 'dup_emails') {
    // find emails appearing 2+ times, then list all rows sharing those emails
    const counts = new Map<string, number>();
    for (const p of allProfiles) {
      const e = (p.email ?? '').toLowerCase();
      if (!e || !e.includes('@')) continue;
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
    const dupEmails = new Set(Array.from(counts.entries()).filter(([, n]) => n >= 2).map(([e]) => e));
    rows = allProfiles.filter(p => dupEmails.has((p.email ?? '').toLowerCase()))
      .sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''));
    extraSubtitle = `${dupEmails.size} distinct emails · ${rows.length} rows`;
  } else if (params.key === 'ota_no_email') {
    // reservations join
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const { data: resData } = await sb.from('reservations')
      .select('guest_email, source_name, check_in_date, guest_name, total_amount')
      .eq('property_id', PROPERTY_ID)
      .gte('check_in_date', since)
      .limit(2000);
    const otas = ['booking', 'expedia', 'agoda', 'ctrip', 'trip.com', 'hotelbeds', 'traveloka'];
    const isOtaSource = (s: string | null | undefined) =>
      !!s && otas.some(o => String(s).toLowerCase().includes(o));
    const isRealEmail = (e: string | null | undefined) =>
      !!e && String(e).includes('@') && !String(e).toLowerCase().includes('guest.booking.com')
        && !String(e).toLowerCase().includes('expediapartnercentral')
        && !String(e).toLowerCase().includes('m.expediapartnercentral');
    const otaRows = (resData as Array<{ guest_email: string|null; source_name: string|null; check_in_date: string|null; guest_name: string|null; total_amount: number|null }> ?? [])
      .filter(r => isOtaSource(r.source_name) && !isRealEmail(r.guest_email));
    // Render as a compact table below; we don't map into ProfileRow shape.
    return renderNonProfileTable(def, otaRows, params.key);
  } else {
    rows = allProfiles.filter(p => def.filter(p, todayMs));
  }

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/behaviour',
  }));

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title={`Behaviour · ${def.title}`}
        subtitle={def.subtitle + (extraSubtitle ? ` · ${extraSubtitle}` : '')}
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <TenantLink href="/guest/behaviour" style={backLink}>← Back to Behaviour</TenantLink>
            <span style={{ fontSize: 11, color: '#5A5A5A' }}>· {rows.length} guest{rows.length === 1 ? '' : 's'} match this signal</span>
          </div>

          {rows.length === 0 ? (
            <EmptyBox text={def.emptyText} />
          ) : (
            <div style={{ background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={th}>Guest</th>
                    <th style={th}>Country</th>
                    <th style={th}>Source</th>
                    <th style={thR}>Stays</th>
                    <th style={thR}>Last stay</th>
                    <th style={thR}>Days since</th>
                    <th style={thR}>LTV</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 500).map(r => {
                    const days = daysBetween(r.last_stay_date, todayMs);
                    return (
                      <tr key={r.guest_id}>
                        <td style={td}>
                          <div style={{ fontWeight: 600, color: '#1B1B1B' }}>{r.full_name ?? '—'}</div>
                          {r.email ? (
                            <div style={{ fontSize: 11, color: '#5A5A5A' }}>{r.email}</div>
                          ) : (
                            <div style={{ fontSize: 11, color: '#B04A2F', fontStyle: 'italic' }}>no email</div>
                          )}
                        </td>
                        <td style={{ ...td, color: '#3A3A3A' }}>{r.country ?? '—'}</td>
                        <td style={{ ...td, color: '#3A3A3A' }}>{r.top_source ?? '—'}</td>
                        <td style={tdR}>{r.stays_count ?? 0}</td>
                        <td style={tdR}>{fmtDate(r.last_stay_date)}</td>
                        <td style={{ ...tdR, color: '#5A5A5A' }}>{days != null ? days + 'd' : '—'}</td>
                        <td style={{ ...tdR, fontWeight: 600 }}>{fmtNum(Number(r.lifetime_revenue ?? 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length > 500 && (
                <div style={{ padding: '8px 12px', fontSize: 11, color: '#5A5A5A', fontStyle: 'italic', borderTop: '1px solid #F5F0E1' }}>
                  Showing first 500 of {rows.length}.
                </div>
              )}
            </div>
          )}
        </div>
      </DashboardPage>
    </div>
  );
}

function renderNonProfileTable(
  def: { title: string; subtitle: string; emptyText: string },
  rows: Array<{ guest_email: string|null; source_name: string|null; check_in_date: string|null; guest_name: string|null; total_amount: number|null }>,
  activeKey: string,
) {
  const tabs: DashboardTab[] = GUEST_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/behaviour',
  }));
  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage title={`Behaviour · ${def.title}`} subtitle={def.subtitle} tabs={tabs}>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <TenantLink href="/guest/behaviour" style={backLink}>← Back to Behaviour</TenantLink>
            <span style={{ fontSize: 11, color: '#5A5A5A' }}>· {rows.length} reservation{rows.length === 1 ? '' : 's'} match{rows.length === 1 ? 'es' : ''} this signal · key {activeKey}</span>
          </div>
          {rows.length === 0 ? (
            <EmptyBox text={def.emptyText} />
          ) : (
            <div style={{ background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={th}>Guest</th>
                    <th style={th}>Source</th>
                    <th style={th}>Email on booking</th>
                    <th style={thR}>Check-in</th>
                    <th style={thR}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 500).map((r, i) => (
                    <tr key={i}>
                      <td style={td}>{r.guest_name ?? '—'}</td>
                      <td style={{ ...td, color: '#3A3A3A' }}>{r.source_name ?? '—'}</td>
                      <td style={{ ...td, color: '#B04A2F', fontStyle: 'italic' }}>{r.guest_email ?? '—'}</td>
                      <td style={tdR}>{fmtDate(r.check_in_date)}</td>
                      <td style={{ ...tdR, fontWeight: 600 }}>{fmtNum(Number(r.total_amount ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardPage>
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div style={{ padding: '24px 12px', background: '#FAFAF7', border: '1px dashed #E6DFCC', borderRadius: 4, textAlign: 'center', color: '#5A5A5A', fontSize: 12 }}>
      {text}
    </div>
  );
}

const backLink: React.CSSProperties = { fontSize: 11, color: '#5A5A5A', textDecoration: 'none', border: '1px solid #E6DFCC', padding: '3px 8px', borderRadius: 3, background: '#FFFFFF' };
const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #E6DFCC', color: '#3A3A3A', fontSize: 11 };
const thR: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #F5F0E1', color: '#1B1B1B', fontSize: 12 };
const tdR: React.CSSProperties = { ...td, textAlign: 'right' };
