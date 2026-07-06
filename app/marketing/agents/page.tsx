// app/marketing/agents/page.tsx
// PBS 2026-07-05: migrated from AgentsHub shell to new paper-white DashboardPage.
// All 7 agents + spend caps + brand rules preserved verbatim.
import Link from 'next/link';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';

interface AgentDef { name: string; cadence: string; status: 'idle'|'active'|'paused'; description: string; guardrails: string[]; }

const AGENTS: AgentDef[] = [
  { name: 'Review Responder',        cadence: 'every 30 min',   status: 'idle',   description: 'Drafts responses to new OTA + Google reviews using brand-voice guidelines. Severity-tiered (5★ short ack · 1-2★ escalate to GM).', guardrails: ['Approval-required for every send', 'No legal/medical claims', 'No comp offers without GM'] },
  { name: 'Social Composer',         cadence: 'daily 09:00',    status: 'idle',   description: 'Drafts IG/FB/TikTok posts from upcoming events, weather, F&B specials, and guest-permitted UGC. Outputs caption + hashtag pack + schedule slot.', guardrails: ['Brand voice locked', 'No guest faces without consent log', 'Music license check on Reels'] },
  { name: 'Reputation Alerter',      cadence: 'hourly',         status: 'idle',   description: 'Watches Booking score drops, Google rating shifts, TripAdvisor rank changes, and viral threats; routes to GM with playbook.', guardrails: ['Page GM if rating drops > 0.2 in 7d', 'Aggregator-source verified before alert'] },
  { name: 'Influencer Outreach',     cadence: 'weekly',         status: 'idle',   description: 'Surfaces qualified creators (audience fit, eng rate, brand safety); drafts outreach + comp package; logs in CRM.', guardrails: ['Min audience filter · 10k', 'Brand-safety screen', 'GM approval per offer'] },
  { name: 'Content Calendar Planner',cadence: 'weekly · Sun 18:00', status: 'idle', description: 'Plans next-7d content across owned channels around peak windows, festivals, weather, and upcoming inventory pressure.', guardrails: ['No overlap with paid media flights', 'Festival blackout dates honored'] },
  { name: 'SEO Monitor',             cadence: 'daily 02:00',    status: 'idle',   description: 'Tracks brand + non-brand keyword positions, GMB photo updates, schema integrity, and broken inbound links from partner sites.', guardrails: ['Recommendation only', 'No live site mutations'] },
  { name: 'Paid Media Optimizer',    cadence: 'every 4h',       status: 'paused', description: 'Watches Google Ads / Meta / BDC TravelAds / Expedia bid efficiency; auto-pauses underperforming campaigns when CPA breaches threshold.', guardrails: ['Auto-pause on > $60 CPA', 'Spend cap enforced', 'Daily velocity cap $500/day'] },
];

const CHANNEL_SPEND = [
  { channel: 'Google Ads',           cap: 1500, used: 980, cpaCap: 45 },
  { channel: 'Meta (FB/IG)',         cap: 1000, used: 420, cpaCap: 60 },
  { channel: 'Expedia TravelAds',    cap:  800, used: 720, cpaCap: 50 },
  { channel: 'BDC Visibility/PPC',   cap: 1000, used: 680, cpaCap: 55 },
  { channel: 'Influencer / Creator', cap:  500, used: 300, cpaCap: null },
  { channel: 'Email / Direct',       cap:  200, used: 120, cpaCap: null },
];

const BRAND_RULES = [
  'Brand voice locked · no superlatives ("luxury", "best", "world-class") without owner approval',
  'No guest faces / property interiors in paid creative without consent log',
  'No price discounting in paid messaging > 15%',
  'Festival / blackout dates respected for promotional pushes',
];

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const CREAM='#F7F0E1'; const GREEN='#084838'; const AMBER='#C28F2C'; const RED='#B03826';

export default function MarketingAgentsPage() {
  const spendCap = 5000; const spendUsed = 3200;
  const active = AGENTS.filter(a => a.status === 'active').length;
  const paused = AGENTS.filter(a => a.status === 'paused').length;
  const idle   = AGENTS.filter(a => a.status === 'idle').length;

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({ key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/agents' }));
  const tiles: KpiTileProps[] = [
    { label: 'Agents',        value: AGENTS.length, size: 'sm' },
    { label: 'Active',        value: active,        size: 'sm', status: active > 0 ? 'green' : undefined },
    { label: 'Idle',          value: idle,          size: 'sm' },
    { label: 'Paused',        value: paused,        size: 'sm', status: paused > 0 ? 'red' : undefined },
    { label: 'Monthly spend cap', value: `$${spendCap.toLocaleString()}`, size: 'sm' },
    { label: 'Spent MTD',     value: `$${spendUsed.toLocaleString()}`, size: 'sm', footnote: `${Math.round(spendUsed/spendCap*100)}%` },
  ];

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Marketing · Agents" subtitle="Brand-reach agents across reviews · social · reputation · influencers · content · SEO · paid media" tabs={tabs}>
        <div style={{ gridColumn:'1 / -1', padding:'10px 14px', background:'#FFF4D6', border:'1px solid '+AMBER, borderRadius:4, fontSize:12, color:INK, lineHeight:1.6 }}>
          <strong>HARDCODED DATA · Phase 1 cockpit.</strong> Agents mostly idle until ingest + ad-API connections ship. Live wiring needs Google Ads / Meta / BDC / Expedia APIs + Cloudbeds attribution.
        </div>

        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* Agent cards */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:8 }}>Agent fleet · {AGENTS.length}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:10 }}>
            {AGENTS.map(a => (
              <div key={a.name} style={{ background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:6, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:INK }}>{a.name}</span>
                  <span style={{ ...pillStyle(a.status) }}>{a.status}</span>
                </div>
                <div style={{ fontSize:11, color:INK_M, letterSpacing:'0.06em' }}>{a.cadence}</div>
                <div style={{ fontSize:12, color:INK, lineHeight:1.5 }}>{a.description}</div>
                <div style={{ borderTop:'1px solid '+HAIR, paddingTop:6, fontSize:11, color:INK_M }}>
                  <div style={{ fontWeight:600, marginBottom:3 }}>Guardrails</div>
                  {a.guardrails.map((g, i) => <div key={i}>· {g}</div>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Channel spend */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:8 }}>Channel spend caps · {CHANNEL_SPEND.length}</div>
          <div style={{ border:'1px solid '+HAIR, borderRadius:6, background:'#FFFFFF', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#FAFAF7', borderBottom:'1px solid '+HAIR }}>
                  <th style={th}>Channel</th>
                  <th style={{ ...th, textAlign:'right' }}>Cap</th>
                  <th style={{ ...th, textAlign:'right' }}>Used</th>
                  <th style={{ ...th, textAlign:'right' }}>Used %</th>
                  <th style={{ ...th, textAlign:'right' }}>CPA cap</th>
                </tr>
              </thead>
              <tbody>
                {CHANNEL_SPEND.map(c => {
                  const pct = Math.round(c.used/c.cap*100);
                  return (
                    <tr key={c.channel} style={{ borderTop:'1px solid '+HAIR }}>
                      <td style={tdL}>{c.channel}</td>
                      <td style={tdR}>${c.cap.toLocaleString()}</td>
                      <td style={tdR}>${c.used.toLocaleString()}</td>
                      <td style={{ ...tdR, color: pct > 90 ? RED : pct > 70 ? AMBER : INK }}>{pct}%</td>
                      <td style={tdR}>{c.cpaCap ? `$${c.cpaCap}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Brand rules */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:8 }}>Brand rules · non-negotiable</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {BRAND_RULES.map((r, i) => (
              <div key={i} style={{ padding:'8px 12px', background:CREAM, border:'1px solid '+HAIR, borderLeft:'3px solid '+GREEN, borderRadius:4, fontSize:12, color:INK }}>{r}</div>
            ))}
          </div>
        </div>
      </DashboardPage>
    </div>
  );
}

function pillStyle(status: 'idle'|'active'|'paused') {
  const color = status === 'active' ? GREEN : status === 'paused' ? RED : INK_M;
  return { padding:'2px 8px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, color, border:'1px solid '+color, borderRadius:3 };
}
const th = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, color:INK, textAlign:'left' as const };
const tdL = { padding:'8px 10px', fontSize:12, color:INK };
const tdR = { padding:'8px 10px', fontSize:12, color:INK, textAlign:'right' as const, fontVariantNumeric:'tabular-nums' as const };
