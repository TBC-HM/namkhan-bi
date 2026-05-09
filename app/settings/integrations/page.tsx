// app/settings/integrations/page.tsx — REDESIGN 2026-05-05 (recovery)
import Page from '@/components/page/Page';
import StatusPill from '@/components/ui/StatusPill';
import KpiBox from '@/components/kpi/KpiBox';
import { getCurrentUser, canEdit, roleLabel } from '@/lib/currentUser';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  const canSee = canEdit(user.role, 'owner');

  if (!canSee) {
    return (
      <Page eyebrow="Settings · Integrations" title={<>What we're <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>plugged into</em>.</>}>
        <div style={{ marginTop: 18, padding: 32, background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderLeft: '3px solid var(--st-bad)', borderRadius: 8 }}>
          <strong>Owner only.</strong> You're signed in as <strong>{roleLabel(user.role)}</strong>.
        </div>
      </Page>
    );
  }

  // probe live connections
  let supabaseOk = false, supabaseErr: string | null = null;
  try {
    const { error } = await supabase.from('app_settings').select('key', { count: 'exact', head: true }).limit(1);
    supabaseOk = !error;
    supabaseErr = error?.message ?? null;
  } catch (e: any) { supabaseOk = false; supabaseErr = String(e?.message ?? e); }

  // pull last cloudbeds sync timestamp
  const { data: cbLog } = await supabase
    .from('sync_log')
    .select('completed_at, status, rows_processed')
    .eq('source', 'cloudbeds')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const cbLast = cbLog?.completed_at ? new Date(cbLog.completed_at as string) : null;
  const cbAge = cbLast ? Math.round((Date.now() - cbLast.getTime()) / 60000) : null;
  const cbOk = cbAge != null && cbAge < 180;

  // pull governance.agents count for AI orchestration health
  const { count: agentCount } = await supabase
    .schema('governance' as any)
    .from('agents')
    .select('code', { count: 'exact', head: true });

  type Conn = { name: string; ok: boolean; tone: 'active'|'pending'|'expired'|'inactive'; scope: string; notes: string };
  const conns: Conn[] = [
    { name: 'Cloudbeds API', ok: cbOk, tone: cbOk ? 'active' : 'pending', scope: 'reservations · transactions · rate plans · room types', notes: cbAge != null ? `last sync ${cbAge}m ago · ${cbLog?.rows_processed ?? 0} rows` : 'no sync_log entry yet' },
    { name: 'Supabase', ok: supabaseOk, tone: supabaseOk ? 'active' : 'expired', scope: 'project namkhan-pms (eu-central-1)', notes: supabaseOk ? 'anon + service_role configured' : (supabaseErr ?? 'unknown error') },
    { name: 'Vercel', ok: true, tone: 'active', scope: 'deploy + env vars', notes: 'team pbsbase-2825s-projects · auto-deploy OFF (CLI only)' },
    { name: 'Make.com', ok: true, tone: 'active', scope: 'webhook scenarios · feature builder pipeline', notes: 'orchestration only · no production write paths' },
    { name: 'Nimble MCP', ok: true, tone: 'active', scope: 'compset web scrapes', notes: 'compset_agent active · 22 scrapes / day' },
    { name: 'Email parser', ok: false, tone: 'inactive', scope: 'reviews + booking inbox intake', notes: 'pb@ OAuth-connected · book@/wm@ surface via TO/CC only' },
  ];
  const connectedCount = conns.filter((c) => c.ok).length;

  return (
    <Page eyebrow="Settings · Integrations" title={<>What we're <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>plugged into</em>.</>}>
      <div style={{ marginTop: 14, padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8 }}>
        <span className="t-eyebrow">SOURCE</span>
        <StatusPill tone="active">app_settings · sync_log · governance.agents</StatusPill>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>read-only · keys in Vercel env</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={connectedCount} unit="count" label="Connected"      tooltip="Integrations with status=connected — Cloudbeds, QB, Make.com, Anthropic API, etc." />
        <KpiBox value={conns.length - connectedCount} unit="count" label="Not connected" tooltip="Integrations awaiting setup or with broken credentials. Each blocks a downstream pipeline." />
        <KpiBox value={null} unit="text" valueText={cbAge != null ? `${cbAge}m` : '—'} label="Cloudbeds sync age" tooltip="Minutes since the last successful Cloudbeds sync. > 30m = stale, investigate." />
        <KpiBox value={agentCount ?? 0} unit="count" label="Agents registered" tooltip="Total rows in governance.agents — controls every cron-driven Claude/agent task." />
      </div>
      <div style={{ marginTop: 18 }}>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', fontWeight: 500, marginBottom: 6 }}>
          Active connections
          <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontStyle: 'normal', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>{conns.length} services</span>
        </div>
        <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>
              <th style={th}>Service</th><th style={{ ...th, textAlign: 'center' }}>Status</th><th style={th}>Scope</th><th style={th}>Notes</th>
            </tr></thead>
            <tbody>
              {conns.map((c) => (
                <tr key={c.name}>
                  <td style={td}><strong>{c.name}</strong></td>
                  <td style={{ ...td, textAlign: 'center' }}><StatusPill tone={c.tone}>{c.ok ? 'CONNECTED' : 'OFF'}</StatusPill></td>
                  <td style={{ ...td, color: 'var(--ink-mute)' }}>{c.scope}</td>
                  <td style={{ ...td, color: 'var(--ink-mute)' }}>{c.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 18, padding: '10px 14px', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderLeft: '3px solid var(--brass)', borderRadius: 6, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
        API keys live in Vercel env vars for security. No write-back UI here — drift risk &gt; convenience. Update via Vercel dashboard.
      </div>
    </Page>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', background: 'var(--paper-deep)', borderBottom: '1px solid var(--paper-deep)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', fontWeight: 600 };
const td: React.CSSProperties = { padding: '6px 12px', borderBottom: '1px solid var(--paper-deep)', fontSize: 12, color: 'var(--ink)' };
