// app/sales/leads/_components/LeadsCockpitV2.tsx
//
// PBS 2026-05-16: live Leads cockpit driven by sales.scraping_jobs +
// sales.icp_segments + sales.leads. Two tabs (Campaigns | ICP Segments) +
// drawer-on-click for campaign detail with funnel waterfall.
//
// Renders server-side; tab + drawer state in URL query params (?tab=, ?drawer=).
// Each scraping_jobs row IS a campaign — replaces the prior static demo block.

import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import TenantLink from '@/components/nav/TenantLink';
export interface CampaignRow {
  id: number;
  query: string;
  target_category: string | null;
  status: string;
  lead_count: number;
  daily_target: number;
  icp_segment_id: string | null;
  icp_key: string | null;
  icp_name: string | null;
  scrape_tool: string | null;
  enrich_tool: string | null;
  verify_tool: string | null;
  send_tool: string | null;
  cost_per_lead_eur: number | null;
  monthly_budget_eur: number | null;
  spend_7d_eur: number | null;
  notes: string | null;
}

export interface IcpRow {
  id: string;
  key: string;
  name: string;
  description: string;
  daily_quota: number;
  active: boolean;
  criteria: Record<string, unknown>;
  total_leads: number;
  active_campaigns: number;
}

export interface FunnelCount {
  campaign_id: number;
  stage: string;
  n: number;
}

export interface LeadDetailRow {
  id: number;
  company_name: string;
  decision_maker_name: string | null;
  email: string | null;
  country: string | null;
  status: string;
  icp_score: number | null;
  total_cost_eur: number | null;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  reply_sentiment: string | null;
  converted_value_eur: number | null;
}

export interface OverallKpis {
  total_campaigns: number;
  running_campaigns: number;
  total_leads: number;
  total_spend_eur: number;
  converted: number;
  converted_value_eur: number;
  cpl_eur: number;
  reply_rate_pct: number;
  in_nurture: number;
}

interface Props {
  tab: 'campaigns' | 'icp';
  drawerCampaignId: number | null;
  campaigns: CampaignRow[];
  icps: IcpRow[];
  funnelCounts: FunnelCount[];
  drawerLeads: LeadDetailRow[];
  kpis: OverallKpis;
}

const FUNNEL_ORDER = [
  'discovered','enriched','qualified','queued_to_send','sent','delivered',
  'opened','clicked','replied_positive','replied_neutral','replied_negative',
  'converted','disqualified','nurture','dead',
] as const;

const STAGE_LABEL: Record<string, string> = {
  discovered: 'Scraped',
  enriched: 'Enriched',
  qualified: 'Qualified',
  queued_to_send: 'Queued',
  sent: 'Sent',
  delivered: 'Delivered',
  opened: 'Opened',
  clicked: 'Clicked',
  replied_positive: 'Replied +',
  replied_neutral: 'Replied ~',
  replied_negative: 'Replied −',
  converted: 'Converted ✓',
  disqualified: 'Disqualified',
  nurture: 'Nurture',
  dead: 'Dead',
};

export default function LeadsCockpitV2({ tab, drawerCampaignId, campaigns, icps, funnelCounts, drawerLeads, kpis }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* KPI strip — operational lead-gen overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KpiBox value={kpis.running_campaigns} unit="count" label="Running campaigns" tooltip={`${kpis.total_campaigns} total · ${kpis.running_campaigns} running.`} />
        <KpiBox value={kpis.total_leads} unit="count" label="Total leads" tooltip="Sum across all campaigns + ICPs (sales.leads)." />
        <KpiBox value={kpis.total_spend_eur} unit="eur" dp={2} label="Lifetime spend" tooltip="Sum of scrape + enrich + verify + send cost across all leads. Even non-converters preserve their cost trail." />
        <KpiBox value={kpis.cpl_eur} unit="eur" dp={2} label="Avg CPL" tooltip="Cost per lead = spend ÷ total leads." />
        <KpiBox value={kpis.reply_rate_pct} unit="pct" label="Reply rate" tooltip="Leads with replied_at ÷ sent (any reply, any sentiment)." />
        <KpiBox value={kpis.converted} unit="count" label="Converted" tooltip={`€${kpis.converted_value_eur.toLocaleString('en-US')} value`} />
        <KpiBox value={kpis.in_nurture} unit="count" label="In nurture" tooltip="Leads with next_touch_at set — warm but not now. Re-engage on schedule." />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--paper-deep, #1f1c15)', marginBottom: 4 }}>
        <TabLink href="/sales/leads?tab=campaigns" active={tab === 'campaigns'}>Campaigns · {campaigns.length}</TabLink>
        <TabLink href="/sales/leads?tab=icp" active={tab === 'icp'}>ICP segments · {icps.length}</TabLink>
      </div>

      {tab === 'campaigns' && (
        <CampaignsTab
          campaigns={campaigns}
          funnelCounts={funnelCounts}
          drawerCampaignId={drawerCampaignId}
          drawerLeads={drawerLeads}
        />
      )}

      {tab === 'icp' && <IcpTab icps={icps} />}
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <TenantLink
      href={href}
      style={{
        padding: '10px 20px',
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        textDecoration: 'none',
        fontWeight: active ? 700 : 500,
        color: active ? 'var(--brass)' : 'var(--ink-soft, var(--text-1, #d8cca8))',
        borderBottom: active ? '2px solid var(--brass)' : '2px solid transparent',
        marginBottom: -1,
      }}
    >
      {children}
    </TenantLink>
  );
}

function CampaignsTab({ campaigns, funnelCounts, drawerCampaignId, drawerLeads }: {
  campaigns: CampaignRow[]; funnelCounts: FunnelCount[]; drawerCampaignId: number | null; drawerLeads: LeadDetailRow[];
}) {
  const drawerCampaign = drawerCampaignId ? campaigns.find((c) => c.id === drawerCampaignId) ?? null : null;
  const drawerFunnel = drawerCampaignId ? funnelCounts.filter((f) => f.campaign_id === drawerCampaignId) : [];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
        {campaigns.map((c) => {
          const cFunnel = funnelCounts.filter((f) => f.campaign_id === c.id);
          return <CampaignCard key={c.id} campaign={c} funnel={cFunnel} />;
        })}
      </div>

      {drawerCampaign && (
        <CampaignDrawer campaign={drawerCampaign} funnel={drawerFunnel} leads={drawerLeads} />
      )}
    </>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case 'running': return 'var(--moss, #2D6A4F)';
    case 'paused':  return 'var(--st-warn, #C28F2C)';
    case 'stopped': return 'var(--st-bad, #B23B3B)';
    case 'draft':   return 'var(--ink-mute, #7d7565)';
    default:        return 'var(--brass, #a8854a)';
  }
}

function CampaignCard({ campaign, funnel }: { campaign: CampaignRow; funnel: FunnelCount[] }) {
  const total = funnel.reduce((s, f) => s + f.n, 0);
  const todayLanded = Math.min(campaign.daily_target, funnel.filter((f) => ['discovered','enriched','qualified'].includes(f.stage)).reduce((s,f) => s + f.n, 0) || 0);
  const progressPct = campaign.daily_target > 0 ? Math.min(100, (todayLanded / campaign.daily_target) * 100) : 0;
  const replied = funnel.filter((f) => f.stage.startsWith('replied_')).reduce((s,f)=>s+f.n,0);
  const converted = funnel.find((f) => f.stage === 'converted')?.n ?? 0;
  const replyRate = total > 0 ? (replied / total) * 100 : 0;

  return (
    <div style={{
      background: 'var(--surf-1, var(--paper, #f5f0e4))',
      border: '1px solid var(--border-1, var(--paper-deep, #e6daC0))',
      borderLeft: `3px solid ${statusColor(campaign.status)}`,
      borderRadius: 6,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: statusColor(campaign.status) }}>
            {campaign.status}
          </div>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--t-md)', color: 'var(--ink, var(--text-0, #e9e1ce))', fontWeight: 500, marginTop: 2 }}>
            {campaign.query}
          </div>
          {campaign.icp_name && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute, #7d7565)', marginTop: 2 }}>
              ICP · {campaign.icp_name}
            </div>
          )}
        </div>
      </div>

      {/* Tool stack — Scrape → Enrich → Verify → Send */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11, fontFamily: 'var(--mono)' }}>
        {campaign.scrape_tool && <Chip>scrape: {campaign.scrape_tool}</Chip>}
        {campaign.enrich_tool && <Chip>enrich: {campaign.enrich_tool}</Chip>}
        {campaign.verify_tool && <Chip>verify: {campaign.verify_tool}</Chip>}
        {campaign.send_tool && <Chip>send: {campaign.send_tool}</Chip>}
      </div>

      {/* Daily target progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>
          <span>Daily target</span>
          <span>{todayLanded}/{campaign.daily_target}</span>
        </div>
        <div style={{ height: 6, background: 'var(--paper-deep, rgba(0,0,0,0.08))', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: progressPct >= 100 ? 'var(--moss, #2D6A4F)' : 'var(--brass, #a8854a)' }} />
        </div>
      </div>

      {/* Funnel mini-strip */}
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 36 }}>
        {FUNNEL_ORDER.filter((s) => funnel.some((f) => f.stage === s)).map((stage) => {
          const n = funnel.find((f) => f.stage === stage)?.n ?? 0;
          const max = Math.max(1, ...funnel.map((f) => f.n));
          const h = (n / max) * 36;
          const color = stage === 'converted' ? '#2D6A4F'
            : stage.startsWith('replied_') ? '#a8854a'
            : stage === 'dead' || stage === 'disqualified' ? '#B23B3B'
            : '#7d7565';
          return (
            <div
              key={stage}
              title={`${STAGE_LABEL[stage] ?? stage}: ${n}`}
              style={{ flex: 1, height: h, background: color, opacity: 0.85, minWidth: 4, borderRadius: 1 }}
            />
          );
        })}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, borderTop: '1px solid var(--paper-deep, rgba(0,0,0,0.08))', paddingTop: 8 }}>
        <Stat label="Leads"    value={String(total)} />
        <Stat label="Replies"  value={`${replied} · ${replyRate.toFixed(0)}%`} />
        <Stat label="Won"      value={String(converted)} />
        <Stat label="Spend 7d" value={`€${(campaign.spend_7d_eur ?? 0).toFixed(0)}`} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <TenantLink href={`/sales/leads?tab=campaigns&drawer=${campaign.id}`} style={btnPrimary}>✦ Details</TenantLink>
        <button style={btnSecondary} title="Edit campaign (coming soon)">Edit</button>
        {campaign.status === 'running' && <button style={btnSecondary}>Pause</button>}
        {campaign.status === 'paused' && <button style={btnSecondary}>Resume</button>}
        {campaign.status !== 'stopped' && <button style={btnSecondary}>Stop</button>}
        <button style={btnSecondary}>Duplicate</button>
      </div>
    </div>
  );
}

function CampaignDrawer({ campaign, funnel, leads }: { campaign: CampaignRow; funnel: FunnelCount[]; leads: LeadDetailRow[] }) {
  const total = funnel.reduce((s, f) => s + f.n, 0);
  const replied = funnel.filter((f) => f.stage.startsWith('replied_')).reduce((s,f)=>s+f.n,0);
  const converted = funnel.find((f) => f.stage === 'converted')?.n ?? 0;
  const totalSpend = leads.reduce((s, l) => s + Number(l.total_cost_eur ?? 0), 0);
  const totalValue = leads.reduce((s, l) => s + Number(l.converted_value_eur ?? 0), 0);

  return (
    <Panel
      title={`Drawer · ${campaign.query}`}
      eyebrow={`campaign #${campaign.id} · ${campaign.status} · ${total} leads`}
      actions={<TenantLink href="/sales/leads?tab=campaigns" style={btnSecondary}>✕ Close</TenantLink>}
    >
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        <DrawerKpi label="Total leads" value={String(total)} />
        <DrawerKpi label="Replied" value={`${replied} · ${total > 0 ? Math.round(replied/total*100) : 0}%`} />
        <DrawerKpi label="Converted" value={String(converted)} accent="moss" />
        <DrawerKpi label="Spend" value={`€${totalSpend.toFixed(2)}`} />
        <DrawerKpi label="Revenue" value={`€${totalValue.toLocaleString('en-US')}`} accent="brass" />
        <DrawerKpi label="ROI" value={totalSpend > 0 ? `${Math.round(totalValue / totalSpend)}×` : '—'} accent={totalValue > totalSpend ? 'moss' : 'mute'} />
      </div>

      {/* Funnel waterfall (horizontal bars per stage) */}
      <div style={{ padding: '4px 14px 14px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>Funnel</div>
        {FUNNEL_ORDER.filter((s) => funnel.some((f) => f.stage === s)).map((stage) => {
          const n = funnel.find((f) => f.stage === stage)?.n ?? 0;
          const pct = total > 0 ? (n / total) * 100 : 0;
          const color = stage === 'converted' ? '#2D6A4F'
            : stage.startsWith('replied_') ? '#a8854a'
            : stage === 'dead' || stage === 'disqualified' ? '#B23B3B'
            : '#7d7565';
          return (
            <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <div style={{ width: 120, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)' }}>{STAGE_LABEL[stage] ?? stage}</div>
              <div style={{ flex: 1, height: 14, background: 'var(--paper-deep, rgba(0,0,0,0.05))', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, opacity: 0.85 }} />
              </div>
              <div style={{ width: 70, fontFamily: 'var(--mono)', fontSize: 11, textAlign: 'right', color: 'var(--ink)' }}>{n} · {pct.toFixed(0)}%</div>
            </div>
          );
        })}
      </div>

      {/* Lead list (top 15) */}
      <div style={{ padding: '0 14px 14px', overflowX: 'auto' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>Top 15 leads · ranked by ICP score</div>
        <table style={{ width: '100%', fontSize: 'var(--t-sm)', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--paper-deep, rgba(0,0,0,0.12))' }}>
              <th style={th}>Company</th>
              <th style={th}>Contact</th>
              <th style={{...th, textAlign: 'right'}}>ICP</th>
              <th style={th}>Stage</th>
              <th style={{...th, textAlign: 'right'}}>Cost €</th>
              <th style={{...th, textAlign: 'right'}}>Value €</th>
            </tr>
          </thead>
          <tbody>
            {leads.slice(0, 15).map((l) => (
              <tr key={l.id} style={{ borderBottom: '1px solid var(--paper-deep, rgba(0,0,0,0.05))' }}>
                <td style={tdStrong}>{l.company_name}</td>
                <td style={tdMute}>{l.decision_maker_name ?? '—'}</td>
                <td style={{...tdNum, textAlign: 'right'}}>{l.icp_score ?? '—'}</td>
                <td style={tdNum}>{STAGE_LABEL[l.status] ?? l.status}</td>
                <td style={{...tdNum, textAlign: 'right'}}>{l.total_cost_eur != null ? l.total_cost_eur.toFixed(2) : '—'}</td>
                <td style={{...tdNum, textAlign: 'right', color: l.converted_value_eur ? 'var(--moss, #2D6A4F)' : 'var(--ink-mute)'}}>{l.converted_value_eur ? l.converted_value_eur.toLocaleString('en-US') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function IcpTab({ icps }: { icps: IcpRow[] }) {
  return (
    <>
      <Panel
        title="ICP segments · who we're hunting"
        eyebrow={`${icps.length} segments · click [Edit] to refine criteria`}
        actions={
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={btnSecondary}>↻ Generate ICPs (AI)</button>
            <button style={btnPrimary}>+ Create ICP</button>
          </div>
        }
      >
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 12 }}>
          {icps.map((icp) => <IcpCard key={icp.id} icp={icp} />)}
        </div>
      </Panel>
    </>
  );
}

function IcpCard({ icp }: { icp: IcpRow }) {
  const criteria = icp.criteria as any;
  const countries: string[] = Array.isArray(criteria?.countries) ? criteria.countries : [];
  const roles: string[] = Array.isArray(criteria?.role_keywords) ? criteria.role_keywords : [];

  return (
    <div style={{
      background: 'var(--surf-1, var(--paper, #f5f0e4))',
      border: '1px solid var(--border-1, var(--paper-deep, #e6daC0))',
      borderLeft: `3px solid ${icp.active ? 'var(--moss, #2D6A4F)' : 'var(--ink-mute, #7d7565)'}`,
      borderRadius: 6,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--brass)' }}>
          {icp.key} · daily quota {icp.daily_quota}
        </div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--t-md)', color: 'var(--ink)', fontWeight: 500, marginTop: 2 }}>
          {icp.name}
        </div>
      </div>
      <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft, #4a443c)', lineHeight: 1.5 }}>
        {icp.description}
      </div>

      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>
        Countries: {countries.join(', ') || '—'}<br/>
        Roles: {roles.join(', ') || '—'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, borderTop: '1px solid var(--paper-deep, rgba(0,0,0,0.08))', paddingTop: 8 }}>
        <Stat label="Leads" value={String(icp.total_leads)} />
        <Stat label="Campaigns" value={String(icp.active_campaigns)} />
        <Stat label="Status" value={icp.active ? 'Active' : 'Paused'} />
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button style={btnPrimary}>Edit ICP</button>
        <button style={btnSecondary}>Pause</button>
        <button style={btnSecondary}>Duplicate</button>
        <button style={btnSecondary}>Run scrape now</button>
      </div>
    </div>
  );
}

// ─── tiny atoms ──────────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      padding: '2px 6px',
      background: 'var(--paper-deep, rgba(0,0,0,0.05))',
      border: '1px solid var(--border-1, rgba(0,0,0,0.1))',
      borderRadius: 3,
      fontFamily: 'var(--mono)',
      fontSize: 10,
      color: 'var(--ink-soft, #4a443c)',
      letterSpacing: '0.04em',
    }}>{children}</span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-mute, #7d7565)' }}>{label}</span>
      <span style={{ fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--ink, #1A1A1A)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function DrawerKpi({ label, value, accent }: { label: string; value: string; accent?: 'brass' | 'moss' | 'mute' }) {
  const color = accent === 'brass' ? 'var(--brass)'
    : accent === 'moss' ? 'var(--moss, #2D6A4F)'
    : accent === 'mute' ? 'var(--ink-mute)'
    : 'var(--ink)';
  return (
    <div style={{ padding: '8px 10px', background: 'var(--paper-warm, rgba(168,133,74,0.05))', border: '1px solid var(--paper-deep, rgba(0,0,0,0.08))', borderRadius: 4 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>{label}</div>
      <div style={{ marginTop: 2, fontSize: 'var(--t-md)', fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-mute, #7d7565)', fontWeight: 600 };
const tdStrong: React.CSSProperties = { padding: '6px 8px', color: 'var(--ink, #1A1A1A)', fontWeight: 600 };
const tdMute: React.CSSProperties = { padding: '6px 8px', color: 'var(--ink-mute, #7d7565)' };
const tdNum: React.CSSProperties = { padding: '6px 8px', fontFamily: 'var(--mono)', color: 'var(--ink, #1A1A1A)' };
const btnPrimary: React.CSSProperties = { background: 'var(--brass, #a8854a)', color: 'var(--surf-0, #0a0a0a)', border: '1px solid var(--brass, #a8854a)', padding: '4px 10px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, textDecoration: 'none', cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { background: 'transparent', color: 'var(--ink-soft, #4a443c)', border: '1px solid var(--paper-deep, rgba(0,0,0,0.15))', padding: '4px 10px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer' };
