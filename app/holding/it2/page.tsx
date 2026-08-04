// app/holding/it2/page.tsx
// PBS 2026-07-30 — ACTION CENTER: the IT2 home (brief it-area-reorg-v1).
// v2 action-center-inbox-v1 (2026-08-04): ONE inbox with CTAs on every row
// (answer / confirm), red-amber finding split, response strip, live counts
// that refetch without reload (ActionCenterClient). Tasks subtab killed —
// tickets are backend-only; awaits_user notices live in the response strip.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '@/components/cockpit/tokens';
import { fetchCockpitOpsKpis, tileNum } from '@/lib/kpi/cockpitOps';
import { fetchActionCenter } from './_lib/actionCenter';
import { ActionCenterClient } from './_components/ActionCenterClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ActionCenterPage() {
  const sb = getSupabaseAdmin();

  const [payload, mcqRes, auditRes, ops] = await Promise.all([
    fetchActionCenter(),
    (sb as any).from('v_module_completion_queue')
      .select('module_doc_type, status, in_production'),
    (sb as any).from('cockpit_audit_log')
      .select('agent, action, target, success, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(12),
    fetchCockpitOpsKpis().catch(() => null),
  ]);

  const mcq: any[] = mcqRes?.data ?? [];
  const audit = auditRes?.data ?? [];

  // ---- Zone 2 · STATUS (counts only — module questions live in the inbox) ----
  const total = mcq.length;
  const inProd = mcq.filter((m) => m.in_production === true).length;
  const inPipeline = mcq.filter((m) => ['in_pipeline', 'spec_created'].includes(m.status)).length;
  const tiles = [
    { label: 'IN PRODUCTION', value: total ? `${inProd}/${total}` : '—', foot: 'modules & workflows', href: '/holding/it2/modules/status' },
    { label: 'IN PIPELINE',   value: String(inPipeline || '—'),          foot: 'being built now',    href: '/holding/it2/modules/queue' },
    { label: 'AGENTS',        value: tileNum((ops as any)?.agents_active), foot: 'active roles',     href: '/holding/it2/fleet/team' },
    { label: 'LIVE BUILDS',   value: '⬤',                                 foot: 'watch the fleet',   href: '/holding/it2/system/live' },
    { label: 'DEPLOYS 24H',   value: tileNum((ops as any)?.deploys_24h),   foot: 'to production',    href: '/holding/it2/system/deploys' },
    { label: 'SLA',           value: (ops as any)?.sla_triage_pct != null ? `${Math.round((ops as any).sla_triage_pct)}%` : '—', foot: '30d · triage ≤5 min', href: '/holding/it2/system/health' },
  ];

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', color: TOKENS.ink }}>
      <div style={{ margin: '4px 0 18px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          Action Center {payload.needsYou > 0 ? `· ${payload.needsYou} waiting on you` : ''}
        </h1>
        <p style={{ fontSize: 12, color: TOKENS.text2, margin: '4px 0 0' }}>
          Everything that needs YOU, in one place. Empty list = the machine is running on its own.
        </p>
      </div>

      {/* Zones 1 + 1b — live inbox + response strip (client, refetches without reload) */}
      <ActionCenterClient initial={payload} />

      {/* Zone 2 · STATUS */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: TOKENS.text2, margin: '0 0 8px' }}>
          STATUS
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {tiles.map((t) => (
            <a key={t.label} href={t.href} style={{
              textDecoration: 'none', color: TOKENS.ink, background: TOKENS.bgRaised,
              border: `1px solid ${TOKENS.border}`, borderRadius: 8, padding: '12px 14px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: TOKENS.text2 }}>{t.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO, margin: '2px 0' }}>{t.value}</div>
              <div style={{ fontSize: 10.5, color: TOKENS.text3 }}>{t.foot}</div>
            </a>
          ))}
        </div>
      </div>

      {/* Zone 3 · LAST 24H */}
      <div>
        <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: TOKENS.text2, margin: '0 0 8px' }}>
          LAST 24H — WHAT THE MACHINE DID
        </h2>
        <div style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, overflow: 'hidden' }}>
          {audit.length === 0 ? (
            <div style={{ fontSize: 12, color: TOKENS.text3, padding: '14px 16px' }}>No agent activity logged in the last 24 hours.</div>
          ) : audit.map((a: any, i: number) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 14px',
              borderBottom: i < audit.length - 1 ? `1px solid ${TOKENS.border}` : 'none', fontSize: 12,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: TOKENS.text3, whiteSpace: 'nowrap' }}>
                {(a.created_at as string).slice(11, 16)}
              </span>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{a.agent ?? '—'}</span>
              <span style={{ color: TOKENS.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.action}{a.target ? ` · ${a.target}` : ''}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: a.success === false ? '#B04A2F' : '#2E6B45' }}>
                {a.success === false ? '✗' : '✓'}
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 6, textAlign: 'right' }}>
          <a href="/holding/it2/system/activity" style={{ fontSize: 11, color: TOKENS.forest, textDecoration: 'none', fontWeight: 600 }}>
            Full activity log →
          </a>
        </div>
      </div>
    </div>
  );
}
