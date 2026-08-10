// app/holding/it2/fleet/grants/page.tsx
// Skills registry grant posture — answers the 5 owner questions from brief skills-registry-slice-grant-least-privilege

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const FOREST = '#084838';
const AMBER = '#B48A3A'; const RED = '#B03826'; const OK = '#0E7A4B';

interface GrantPosture {
  role: string;
  dept: string;
  status: string;
  grants_enabled: number;
  grants_revoked: number;
  skills_ever_used: number;
  last_call_at: string | null;
  high_authority_grants: string[];
  approval_required_grants: string[];
}

interface RevocationRow {
  role: string;
  skill_name: string;
  revoked_reason: string;
  revoked_at: string;
}

interface BaselineRow {
  role: string;
  grants_enabled: number;
  skills_ever_used: number;
}

interface BlockedCall {
  role: string;
  skill_name: string;
  status: string;
  error_text: string;
  created_at: string;
}

async function fetchGrantPosture(statusFilter?: string): Promise<GrantPosture[]> {
  const admin = getSupabaseAdmin();
  let q = admin.from('v_cap_grant_posture').select('*').order('grants_enabled', { ascending: false });
  // 'all' (and absent) means no status filter — header totals must equal raw SQL counts (brief DONE WHEN).
  if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
  const { data, error } = await q;
  if (error) { console.error('[grants] posture fetch error', error); return []; }
  return (data ?? []) as GrantPosture[];
}

async function fetchRevocations(): Promise<RevocationRow[]> {
  // cockpit schema is PostgREST-exposed (memory 829); read the audit trail directly.
  const admin = getSupabaseAdmin();
  const { data: skillData, error } = await admin.schema('cockpit')
    .from('cap_agent_skills')
    .select('role, skill_id, revoked_at, revoked_reason')
    .not('revoked_at', 'is', null)
    .order('revoked_at', { ascending: false })
    .limit(500);
  if (error) { console.error('[grants] revocations fetch error', error); return []; }

  const { data: skills, error: skillsError } = await admin.schema('cockpit')
    .from('cap_skills')
    .select('id, name');
  if (skillsError) { console.error('[grants] cap_skills fetch error', skillsError); }

  const skillMap = new Map((skills ?? []).map(s => [s.id, s.name]));

  return (skillData ?? []).map(r => ({
    role: r.role,
    skill_name: skillMap.get(r.skill_id) ?? 'unknown',
    revoked_reason: r.revoked_reason ?? 'unknown',
    revoked_at: r.revoked_at ?? '',
  }));
}

async function fetchBaseline(): Promise<BaselineRow[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.schema('cockpit')
    .from('cap_grant_baseline_20260808')
    .select('role, grants_enabled, skills_ever_used')
    .order('grants_enabled', { ascending: false });
  if (error) { console.error('[grants] baseline fetch error', error); return []; }
  return (data ?? []) as BaselineRow[];
}

async function fetchBlockedCalls(): Promise<BlockedCall[]> {
  // Owner question 5: is any agent blocked because a grant was revoked?
  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await admin
    .from('cockpit_skill_calls')
    .select('role, skill_name, status, error, created_at')
    .neq('status', 'succeeded')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) { console.error('[grants] blocked calls fetch error', error); return []; }
  return (data ?? []).map(r => ({
    role: r.role ?? 'unknown',
    skill_name: r.skill_name ?? 'unknown',
    status: r.status ?? 'failed',
    error_text: typeof r.error === 'object' && r.error !== null
      ? String((r.error as Record<string, unknown>).message ?? JSON.stringify(r.error)).slice(0, 160)
      : String(r.error ?? '').slice(0, 160),
    created_at: r.created_at ?? '',
  }));
}

type PageProps = { searchParams?: Record<string, string | string[] | undefined> };

export default async function GrantsPage({ searchParams }: PageProps) {
  const sp = searchParams ?? {};
  // Default 'all' so a hard refresh shows the raw SQL totals (352 enabled / 3,922 revoked class of numbers),
  // per DONE WHEN "totals equal the raw SQL counts" and §0.V2 objection 4.
  const statusFilter = typeof sp['status'] === 'string' ? sp['status'] : 'all';
  const view = typeof sp['view'] === 'string' ? sp['view'] : 'posture';

  const [posture, revocations, baseline, blockedCalls] = await Promise.all([
    fetchGrantPosture(statusFilter),
    view === 'revocations' ? fetchRevocations() : Promise.resolve([]),
    view === 'baseline' ? fetchBaseline() : Promise.resolve([]),
    fetchBlockedCalls(),
  ]);

  const totalEnabled = posture.reduce((acc, p) => acc + p.grants_enabled, 0);
  const totalRevoked = posture.reduce((acc, p) => acc + p.grants_revoked, 0);
  const overGranted = posture.filter(p => p.grants_enabled > 15 && p.grants_enabled > p.skills_ever_used).length;
  const highAuthAgents = posture.filter(p => p.high_authority_grants.length > 0);
  const approvalReqAgents = posture.filter(p => p.approval_required_grants.length > 0);

  return (
    <div style={{ padding: '32px', fontFamily: 'system-ui, sans-serif', background: CREAM, minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: INK, margin: '0 0 8px 0' }}>
            Skills Grant Posture
          </h1>
          <p style={{ fontSize: '15px', color: INK_M, margin: 0 }}>
            Least-privilege enforcement: {totalEnabled.toLocaleString()} grants enabled, {totalRevoked.toLocaleString()} revoked.
            Each grant is prompt surface area on every agent call.
          </p>
        </div>

        {/* KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
          <KpiCard label="Active agents" value={posture.filter(p => p.status === 'active').length.toString()} color={FOREST} />
          <KpiCard label="Grants enabled" value={totalEnabled.toLocaleString()} color={OK} />
          <KpiCard label="Grants revoked" value={totalRevoked.toLocaleString()} color={AMBER} />
          <KpiCard label="Over-granted" value={overGranted.toString()} color={overGranted > 0 ? AMBER : OK} hint={`Agents with >15 grants and unused skills`} />
          <KpiCard label="High authority" value={highAuthAgents.length.toString()} color={FOREST} hint="Agents with write/admin/system grants" />
        </div>

        {/* Blocked calls strip — owner question 5 */}
        <BlockedCallsStrip rows={blockedCalls} />

        {/* View tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: `1px solid ${HAIR}` }}>
          <TabLink href={`/holding/it2/fleet/grants?view=posture&status=${statusFilter}`} label="Posture" active={view === 'posture'} />
          <TabLink href={`/holding/it2/fleet/grants?view=revocations&status=${statusFilter}`} label="Revocations" active={view === 'revocations'} />
          <TabLink href={`/holding/it2/fleet/grants?view=baseline&status=${statusFilter}`} label="Baseline" active={view === 'baseline'} />
        </div>

        {/* Status filter */}
        <div style={{ marginBottom: '24px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: INK_M }}>Filter:</span>
          <FilterLink href={`/holding/it2/fleet/grants?view=${view}&status=all`} label="All" active={statusFilter === 'all'} />
          <FilterLink href={`/holding/it2/fleet/grants?view=${view}&status=active`} label="Active" active={statusFilter === 'active'} />
          <FilterLink href={`/holding/it2/fleet/grants?view=${view}&status=not_yet_live`} label="Not yet live" active={statusFilter === 'not_yet_live'} />
          <FilterLink href={`/holding/it2/fleet/grants?view=${view}&status=disabled`} label="Disabled" active={statusFilter === 'disabled'} />
          <FilterLink href={`/holding/it2/fleet/grants?view=${view}&status=dormant`} label="Dormant" active={statusFilter === 'dormant'} />
        </div>

        {/* Main view */}
        {view === 'posture' && (
          <PostureTable rows={posture} />
        )}

        {view === 'revocations' && (
          <RevocationsTable rows={revocations} />
        )}

        {view === 'baseline' && (
          <BaselineTable rows={baseline} />
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: '8px', padding: '16px' }} title={hint}>
      <div style={{ fontSize: '13px', color: INK_M, marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

function BlockedCallsStrip({ rows }: { rows: BlockedCall[] }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${rows.length > 0 ? RED : HAIR}`, borderRadius: '8px', padding: '16px 20px', marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: rows.length > 0 ? '12px' : 0 }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: rows.length > 0 ? RED : OK }}>
          {rows.length > 0 ? `${rows.length} failed skill call${rows.length === 1 ? '' : 's'} in the last 7 days` : 'No failed or blocked skill calls in the last 7 days'}
        </span>
        <span style={{ fontSize: '12px', color: INK_M }}>
          Restore a wrongly revoked grant = one row: UPDATE cockpit.cap_agent_skills SET enabled = true — the audit trail (revoked_at, revoked_reason) is preserved. Effective on the agent&apos;s next call.
        </span>
      </div>
      {rows.slice(0, 8).map((r, i) => (
        <div key={i} style={{ fontSize: '13px', color: INK, padding: '3px 0', borderTop: i === 0 ? 'none' : `1px solid ${HAIR}` }}>
          <Link href={`/holding/it2/fleet/team/agent/${r.role}`} style={{ color: FOREST, textDecoration: 'none', fontWeight: 500 }}>
            {r.role}
          </Link>
          {' → '}
          <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{r.skill_name}</span>
          {' '}
          <span style={{ color: RED, fontSize: '12px' }}>{r.status}</span>
          {' '}
          <span style={{ color: INK_M, fontSize: '12px' }}>
            {r.error_text}{r.created_at ? ` (${new Date(r.created_at).toLocaleDateString()})` : ''}
          </span>
        </div>
      ))}
      {rows.length > 8 && (
        <div style={{ color: INK_M, fontSize: '12px', marginTop: '6px' }}>
          ... and {rows.length - 8} more in public.cockpit_skill_calls
        </div>
      )}
    </div>
  );
}

function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        padding: '12px 16px',
        fontSize: '14px',
        fontWeight: active ? 600 : 400,
        color: active ? INK : INK_M,
        borderBottom: active ? `2px solid ${FOREST}` : 'none',
        textDecoration: 'none',
      }}
    >
      {label}
    </Link>
  );
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        padding: '6px 12px',
        fontSize: '13px',
        fontWeight: active ? 600 : 400,
        color: active ? WHITE : INK,
        background: active ? FOREST : 'transparent',
        border: `1px solid ${active ? FOREST : HAIR}`,
        borderRadius: '4px',
        textDecoration: 'none',
      }}
    >
      {label}
    </Link>
  );
}

function PostureTable({ rows }: { rows: GrantPosture[] }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: '8px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ background: CREAM, borderBottom: `1px solid ${HAIR}` }}>
            <Th>Role</Th>
            <Th>Dept</Th>
            <Th>Status</Th>
            <Th align="right">Enabled</Th>
            <Th align="right">Revoked</Th>
            <Th align="right">Ever used</Th>
            <Th>Last call</Th>
            <Th>High authority</Th>
            <Th>Needs approval</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const overGranted = r.grants_enabled > 15 && r.grants_enabled > r.skills_ever_used;
            return (
              <tr key={r.role} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${HAIR}` : 'none' }}>
                <Td>
                  <Link href={`/holding/it2/fleet/team/agent/${r.role}`} style={{ color: FOREST, textDecoration: 'none', fontWeight: 500 }}>
                    {r.role}
                  </Link>
                </Td>
                <Td>{r.dept}</Td>
                <Td>
                  <span style={{
                    padding: '2px 6px',
                    fontSize: '12px',
                    background: r.status === 'active' ? OK : INK_M,
                    color: WHITE,
                    borderRadius: '3px'
                  }}>
                    {r.status}
                  </span>
                </Td>
                <Td align="right" style={{ fontWeight: overGranted ? 700 : 400, color: overGranted ? AMBER : INK }}>
                  {r.grants_enabled}
                </Td>
                <Td align="right">{r.grants_revoked}</Td>
                <Td align="right">{r.skills_ever_used}</Td>
                <Td>{r.last_call_at ? new Date(r.last_call_at).toLocaleDateString() : '—'}</Td>
                <Td>
                  {r.high_authority_grants.length > 0 ? (
                    <span style={{ fontSize: '12px', color: AMBER }} title={r.high_authority_grants.join(', ')}>
                      {r.high_authority_grants.length} grants
                    </span>
                  ) : '—'}
                </Td>
                <Td>
                  {r.approval_required_grants.length > 0 ? (
                    <span style={{ fontSize: '12px', color: FOREST }} title={r.approval_required_grants.join(', ')}>
                      {r.approval_required_grants.length} grants
                    </span>
                  ) : '—'}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RevocationsTable({ rows }: { rows: RevocationRow[] }) {
  const grouped = rows.reduce((acc, r) => {
    if (!acc[r.revoked_reason]) acc[r.revoked_reason] = [];
    acc[r.revoked_reason].push(r);
    return acc;
  }, {} as Record<string, RevocationRow[]>);

  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: '8px', padding: '24px' }}>
      <h3 style={{ fontSize: '18px', fontWeight: 600, color: INK, marginTop: 0 }}>
        Recent revocations ({rows.length} shown, newest first)
      </h3>
      <p style={{ fontSize: '13px', color: INK_M, marginTop: '-8px' }}>
        Full audit trail: cockpit.cap_agent_skills (revoked_at, revoked_reason). Restore = one-row enabled = true.
      </p>
      {Object.entries(grouped).map(([reason, items]) => (
        <div key={reason} style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: INK_M, marginBottom: '8px', textTransform: 'uppercase' }}>
            {reason.replace(/_/g, ' ')} ({items.length})
          </h4>
          <div style={{ fontSize: '13px', color: INK, lineHeight: 1.6 }}>
            {items.slice(0, 10).map((r, i) => (
              <div key={i} style={{ padding: '4px 0' }}>
                <Link href={`/holding/it2/fleet/team/agent/${r.role}`} style={{ color: FOREST, textDecoration: 'none' }}>
                  {r.role}
                </Link>
                {' → '}
                <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{r.skill_name}</span>
                {' '}
                <span style={{ color: INK_M }}>
                  ({new Date(r.revoked_at).toLocaleDateString()})
                </span>
              </div>
            ))}
            {items.length > 10 && (
              <div style={{ color: INK_M, fontSize: '12px', marginTop: '8px' }}>
                ... and {items.length - 10} more
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function BaselineTable({ rows }: { rows: BaselineRow[] }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: '8px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ background: CREAM, borderBottom: `1px solid ${HAIR}` }}>
            <Th>Role</Th>
            <Th align="right">Grants (before sweep)</Th>
            <Th align="right">Skills ever used</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.role} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${HAIR}` : 'none' }}>
              <Td>
                <Link href={`/holding/it2/fleet/team/agent/${r.role}`} style={{ color: FOREST, textDecoration: 'none', fontWeight: 500 }}>
                  {r.role}
                </Link>
              </Td>
              <Td align="right">{r.grants_enabled}</Td>
              <Td align="right">{r.skills_ever_used}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{ padding: '12px 16px', textAlign: align, fontWeight: 600, color: INK, fontSize: '13px' }}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left', style = {} }: { children: React.ReactNode; align?: 'left' | 'right'; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: '12px 16px', textAlign: align, color: INK, ...style }}>
      {children}
    </td>
  );
}
