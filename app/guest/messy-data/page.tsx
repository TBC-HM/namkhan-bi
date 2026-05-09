// app/guest/messy-data/page.tsx — NEW
// Guest · Messy data — DQ findings on the directory itself, surfaced for
// fix-in-PMS workflow. Reads guest.mv_guest_profile and flags rows that need
// cleanup. Every flag wired off real columns. No invented errors.

import Link from 'next/link';
import Page from '@/components/page/Page';
import { GUEST_SUBPAGES } from '../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';
import {
  GuestStatusHeader, StatusCell, SectionHead,
  metaSm, metaStrong, metaDim, cardWrap, cardTitle, cardSub,
} from '../_components/GuestShell';
import AgentTopRow from '../_components/AgentTopRow';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface ProfileRow {
  guest_id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  language: string | null;
  bookings_count: number;
  stays_count: number;
  lifetime_revenue: number;
  last_stay_date: string | null;
}

type Issue =
  | 'no_contact'
  | 'no_email'
  | 'no_phone'
  | 'invalid_email'
  | 'invalid_phone'
  | 'no_country'
  | 'no_name'
  | 'duplicate_email';

const ISSUE_LABEL: Record<Issue, string> = {
  no_contact: 'No email + no phone',
  no_email: 'No email',
  no_phone: 'No phone',
  invalid_email: 'Email looks invalid',
  invalid_phone: 'Phone looks invalid',
  no_country: 'No country',
  no_name: 'No name',
  duplicate_email: 'Duplicate email',
};

const ISSUE_TONE: Record<Issue, 'expired' | 'pending' | 'inactive'> = {
  no_contact: 'expired',
  duplicate_email: 'expired',
  invalid_email: 'pending',
  invalid_phone: 'pending',
  no_email: 'pending',
  no_phone: 'pending',
  no_country: 'inactive',
  no_name: 'inactive',
};

export default async function MessyDataPage() {
  const { data: profilesR } = await supabase
    .schema('guest')
    .from('mv_guest_profile')
    .select(
      'guest_id, full_name, first_name, last_name, email, phone, country, language, bookings_count, stays_count, lifetime_revenue, last_stay_date',
    )
    .eq('property_id', PROPERTY_ID)
    .limit(10000);

  const profiles = (profilesR ?? []) as ProfileRow[];
  const total = profiles.length;

  // Email duplicate detection (case-insensitive trim).
  const emailCounts = new Map<string, number>();
  for (const p of profiles) {
    if (!p.email) continue;
    const k = p.email.trim().toLowerCase();
    emailCounts.set(k, (emailCounts.get(k) ?? 0) + 1);
  }

  // Per-row flagging — every check runs on real string columns.
  function flagsFor(p: ProfileRow): Issue[] {
    const out: Issue[] = [];
    if (!p.email && !p.phone) out.push('no_contact');
    else {
      if (!p.email) out.push('no_email');
      if (!p.phone) out.push('no_phone');
    }
    if (p.email && (!p.email.includes('@') || p.email.length < 5 || p.email.includes(' '))) {
      out.push('invalid_email');
    }
    if (p.phone) {
      const digits = p.phone.replace(/[^\d]/g, '');
      if (digits.length < 7) out.push('invalid_phone');
    }
    if (!p.country) out.push('no_country');
    if (!p.full_name && !p.first_name && !p.last_name) out.push('no_name');
    if (p.email) {
      const k = p.email.trim().toLowerCase();
      if ((emailCounts.get(k) ?? 0) > 1) out.push('duplicate_email');
    }
    return out;
  }

  const flagged = profiles
    .map((p) => ({ p, issues: flagsFor(p) }))
    .filter((r) => r.issues.length > 0);

  // Aggregate by issue
  const issueCounts = new Map<Issue, number>();
  for (const r of flagged) {
    for (const i of r.issues) {
      issueCounts.set(i, (issueCounts.get(i) ?? 0) + 1);
    }
  }

  // Sort flagged: highest-revenue messy guests first (those are the most painful)
  const flaggedSorted = flagged
    .sort((a, b) => Number(b.p.lifetime_revenue) - Number(a.p.lifetime_revenue))
    .slice(0, 100);

  const cleanCount = total - flagged.length;
  const cleanPct = total > 0 ? (cleanCount / total) * 100 : 0;
  const noContactCount = issueCounts.get('no_contact') ?? 0;
  const dupEmailCount = issueCounts.get('duplicate_email') ?? 0;

  return (
    <Page
      eyebrow="Guest · Messy data"
      title={<>Fix it <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>in the PMS</em> — the materialised view follows.</>}
      subPages={GUEST_SUBPAGES}
    >

      <GuestStatusHeader
        top={
          <>
            <AgentTopRow
              code="data_quality_agent"
              fallbackName="DQ Sweeper"
              fallbackHint="planned · auto-flag missing/duplicate fields nightly"
            />
            <span style={{ flex: 1 }} />
            <StatusCell label="SOURCE">
              <StatusPill tone="active">guest.mv_guest_profile</StatusPill>
              <span style={metaDim}>· cleanup workflow: Cloudbeds → cron → mv refresh</span>
            </StatusCell>
          </>
        }
        bottom={
          <>
            <StatusCell label="CLEAN">
              <StatusPill tone={cleanPct >= 80 ? 'active' : cleanPct >= 50 ? 'pending' : 'expired'}>
                {cleanPct.toFixed(0)}%
              </StatusPill>
              <span style={metaDim}>{cleanCount} of {total}</span>
            </StatusCell>
            <StatusCell label="UNREACHABLE">
              <StatusPill tone={noContactCount > 0 ? 'expired' : 'inactive'}>{noContactCount}</StatusPill>
              <span style={metaDim}>no email + no phone</span>
            </StatusCell>
            <StatusCell label="DUPLICATES">
              <StatusPill tone={dupEmailCount > 0 ? 'expired' : 'inactive'}>{dupEmailCount}</StatusPill>
              <span style={metaDim}>same email · multiple guest_id</span>
            </StatusCell>
            <span style={{ flex: 1 }} />
            <Link
              href="/guest/directory"
              style={{
                padding: '4px 10px',
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)',
                textTransform: 'uppercase',
                fontWeight: 600,
                background: 'var(--paper)',
                color: 'var(--ink-soft)',
                border: '1px solid var(--paper-deep)',
                borderRadius: 4,
                textDecoration: 'none',
              }}
            >
              ← DIRECTORY
            </Link>
          </>
        }
      />

      {/* WIRED GRAPH — issue distribution */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 12,
          marginTop: 14,
        }}
      >
        <IssueChart issueCounts={issueCounts} total={total} />
      </div>

      {/* KPI ROW */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginTop: 14,
        }}
      >
        <KpiBox value={total} unit="count" label="Total profiles" />
        <KpiBox value={flagged.length} unit="count" label="Flagged" tooltip="One or more issues" />
        <KpiBox value={cleanPct} unit="pct" label="Clean rate" />
        <KpiBox value={noContactCount} unit="count" label="Unreachable" tooltip="No email AND no phone" />
        <KpiBox value={dupEmailCount} unit="count" label="Duplicate emails" />
      </div>

      {/* TABLE */}
      <div style={{ marginTop: 18 }}>
        <SectionHead
          title="Top messy guests"
          emphasis={`${flaggedSorted.length}`}
          sub={`Sorted by lifetime revenue · top 100 of ${flagged.length} flagged · fix in Cloudbeds`}
          source="guest.mv_guest_profile"
        />
        {flaggedSorted.length === 0 ? (
          <div style={{ padding: 32, background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, textAlign: 'center', color: 'var(--moss)', fontStyle: 'italic' }}>
            ✓ Directory is clean — every profile has email or phone, no duplicates, names + countries on file.
          </div>
        ) : (
          <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={th}>Guest</th>
                  <th style={th}>Issues</th>
                  <th style={th}>Email</th>
                  <th style={th}>Phone</th>
                  <th style={th}>Country</th>
                  <th style={{ ...th, textAlign: 'right' }}>Stays</th>
                  <th style={{ ...th, textAlign: 'right' }}>LTV</th>
                  <th style={{ ...th, textAlign: 'right' }}>Last stay</th>
                </tr>
              </thead>
              <tbody>
                {flaggedSorted.map((r) => (
                  <tr key={r.p.guest_id}>
                    <td style={td}>
                      <strong>{r.p.full_name || r.p.first_name || r.p.last_name || '—'}</strong>
                      <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{r.p.guest_id.slice(0, 12)}</div>
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
                        {r.issues.map((i) => (
                          <StatusPill key={i} tone={ISSUE_TONE[i]}>{ISSUE_LABEL[i]}</StatusPill>
                        ))}
                      </span>
                    </td>
                    <td style={{ ...td, color: r.p.email ? 'var(--ink-mute)' : 'var(--st-bad)' }}>
                      {r.p.email || '—'}
                    </td>
                    <td style={{ ...td, color: r.p.phone ? 'var(--ink-mute)' : 'var(--st-bad)' }}>
                      {r.p.phone || '—'}
                    </td>
                    <td style={{ ...td, color: r.p.country ? 'var(--ink-mute)' : 'var(--st-bad)' }}>
                      {r.p.country || '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{r.p.stays_count}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(Number(r.p.lifetime_revenue || 0), 'USD')}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--ink-mute)' }}>{r.p.last_stay_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 14,
          padding: '12px 14px',
          background: 'var(--paper-warm)',
          border: '1px solid var(--paper-deep)',
          borderLeft: '3px solid var(--brass)',
          fontSize: 'var(--t-xs)',
          color: 'var(--ink-soft)',
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', fontWeight: 600, marginBottom: 6 }}>
          How to fix
        </div>
        Open the guest in Cloudbeds (PMS) · merge duplicates via the guest profile screen · add missing email / phone / country.
        The materialised view <code style={{ fontFamily: 'var(--mono)' }}>guest.mv_guest_profile</code> refreshes via cron, so changes appear here on the next tick.
      </div>
    </Page>
  );
}

function IssueChart({ issueCounts, total }: { issueCounts: Map<Issue, number>; total: number }) {
  const rows: { issue: Issue; n: number }[] = (Object.keys(ISSUE_LABEL) as Issue[])
    .map((i) => ({ issue: i, n: issueCounts.get(i) ?? 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);

  if (rows.length === 0) {
    return (
      <div style={cardWrap}>
        <div style={cardTitle}>Issue breakdown</div>
        <div style={cardSub}>By severity · count of profiles affected</div>
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--moss)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
          ✓ No issues — directory is clean
        </div>
      </div>
    );
  }
  const max = Math.max(1, ...rows.map((r) => r.n));
  const w = 520, lineH = 22, h = Math.max(200, rows.length * lineH + 16);
  const labelW = 160, valW = 60, barMaxW = w - labelW - valW - 8;

  return (
    <div style={cardWrap}>
      <div style={cardTitle}>Issue breakdown</div>
      <div style={cardSub}>By severity · count of profiles affected</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
        {rows.map((r, i) => {
          const y = 6 + i * lineH;
          const barW = (r.n / max) * barMaxW;
          const tone = ISSUE_TONE[r.issue];
          const fill = tone === 'expired' ? 'var(--st-bad)' : tone === 'pending' ? 'var(--brass)' : 'var(--brass-soft)';
          const pct = total > 0 ? (r.n / total) * 100 : 0;
          return (
            <g key={r.issue}>
              <text x={labelW - 4} y={y + 14} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink)' }}>
                {ISSUE_LABEL[r.issue]}
              </text>
              <rect x={labelW} y={y + 4} width={barMaxW} height={14} fill="var(--paper-deep)" />
              <rect x={labelW} y={y + 4} width={barW} height={14} fill={fill}>
                <title>{`${ISSUE_LABEL[r.issue]} · ${r.n} guests · ${pct.toFixed(0)}% of base`}</title>
              </rect>
              <text x={labelW + barMaxW + 4} y={y + 14} style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink-soft)' }}>
                {r.n}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  background: 'var(--paper-deep)',
  borderBottom: '1px solid var(--paper-deep)',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
  fontWeight: 600,
};
const td: React.CSSProperties = {
  padding: '6px 12px',
  borderBottom: '1px solid var(--paper-deep)',
  fontFamily: 'var(--mono)',
  fontSize: 12,
  color: 'var(--ink)',
};
