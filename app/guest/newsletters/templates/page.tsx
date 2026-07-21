// app/guest/newsletters/templates/page.tsx
// PBS 2026-07-03: newsletter templates management.
// Lists all templates for the property. Edit / Duplicate / Create new.
// PBS 2026-07-21 pm (Add 3): AI Propose Template button added to page header.

import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import AiProposeTemplateButton from './_components/AiProposeTemplateButton';
import NewslettersSubStrip from '../_components/NewslettersSubStrip';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

interface TemplateRow {
  template_key: string;
  label: string | null;
  description: string | null;
  subject: string | null;
  category: string | null;
  hero_image_url: string | null;
  trigger_kind: string | null;
  trigger_days: number | null;
  audience_hint: string | null;
  is_active: boolean | null;
  updated_at: string | null;
}

const CATEGORY_COLOR: Record<string, { bg: string; fg: string; brd: string }> = {
  transactional: { bg: '#E4F1E0', fg: '#1F5C2C', brd: '#A9CFA0' },
  marketing:     { bg: '#F5EAD9', fg: '#8B5A1C', brd: '#E8C89B' },
  editorial:     { bg: '#E4EAF1', fg: '#1F3A5C', brd: '#A0B4CF' },
};

const TRIGGER_LABEL: Record<string, string> = {
  manual: 'Manual send',
  relative_before_checkin: 'Auto · before check-in',
  relative_after_checkout: 'Auto · after check-out',
  quarterly: 'Quarterly',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function TemplatesListPage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_newsletter_templates')
    .select('*').eq('property_id', PROPERTY_ID)
    .order('category').order('label');
  const templates: TemplateRow[] = (data as TemplateRow[]) ?? [];

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/newsletters',
  }));

  const WHITE = '#FFFFFF';
  const HAIR  = '#E6DFCC';
  const INK   = '#1B1B1B';
  const INK_S = '#3A3A3A';
  const INK_M = '#5A5A5A';
  const GREEN = '#1F3A2E';

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Newsletter templates"
        subtitle="Locked chrome (header + footer) · restrained templates to avoid garbage"
        tabs={tabs}
      >
        <NewslettersSubStrip active="templates" />

        {/* Actions row */}
        <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
          <div>
            <TenantLink href="/guest/newsletters" style={{ fontSize:11, color:INK_M, textDecoration:'none' }}>
              ← Back to newsletters overview
            </TenantLink>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <AiProposeTemplateButton propertyId={PROPERTY_ID} />
            <TenantLink href="/guest/newsletters/templates/new" style={{
              padding:'6px 14px', fontSize:12, fontWeight:600,
              background:GREEN, color:WHITE, border:'none', borderRadius:4, textDecoration:'none',
            }}>+ New template</TenantLink>
          </div>
        </div>

        {/* Templates grid */}
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(360px, 1fr))', gap:12 }}>
          {templates.length === 0 ? (
            <div style={{ padding:'40px 24px', background:WHITE, border:'1px solid '+HAIR, borderRadius:6, textAlign:'center', color:INK_M, fontSize:12 }}>
              No templates yet — click &quot;New template&quot; or &quot;AI Propose Template&quot; to create one.
            </div>
          ) : (
            templates.map((t) => {
              const cat = CATEGORY_COLOR[t.category ?? 'marketing'] ?? CATEGORY_COLOR.marketing;
              return (
                <div key={t.template_key} style={{
                  background: WHITE, border:'1px solid '+HAIR, borderRadius:6,
                  display:'flex', flexDirection:'column', overflow:'hidden',
                }}>
                  {t.hero_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.hero_image_url} alt="" style={{ width:'100%', height:120, objectFit:'cover', display:'block' }} />
                  ) : (
                    <div style={{ width:'100%', height:120, background:'#F5F0E1', display:'flex', alignItems:'center', justifyContent:'center', color:INK_M, fontSize:11 }}>
                      No hero image
                    </div>
                  )}
                  <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8, flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:INK }}>{t.label}</div>
                      <span style={{
                        fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase',
                        padding:'2px 8px', borderRadius:10,
                        background:cat.bg, color:cat.fg, border:'1px solid '+cat.brd,
                      }}>{t.category ?? '—'}</span>
                    </div>
                    <div style={{ fontSize:11, color:INK_M, lineHeight:1.5 }}>{t.description}</div>
                    <div style={{ fontSize:11, color:INK_S, borderTop:'1px dashed '+HAIR, paddingTop:8, marginTop:2 }}>
                      <div><span style={{ color:INK_M }}>Subject:</span> {t.subject}</div>
                      <div style={{ marginTop:2 }}>
                        <span style={{ color:INK_M }}>Trigger:</span> {TRIGGER_LABEL[t.trigger_kind ?? 'manual'] ?? t.trigger_kind}
                        {t.trigger_days != null ? ` · ${t.trigger_days} days` : ''}
                      </div>
                      <div style={{ marginTop:2 }}>
                        <span style={{ color:INK_M }}>Audience:</span> {t.audience_hint ?? '—'}
                      </div>
                    </div>
                    <div style={{ marginTop:'auto', display:'flex', gap:8, paddingTop:6 }}>
                      <TenantLink href={`/guest/newsletters/templates/${t.template_key}`} style={{
                        padding:'5px 12px', fontSize:11, fontWeight:600,
                        background:GREEN, color:WHITE, border:'none', borderRadius:4, textDecoration:'none',
                      }}>Edit</TenantLink>
                      <TenantLink href={`/guest/newsletters/templates/new?copy=${t.template_key}`} style={{
                        padding:'5px 12px', fontSize:11, fontWeight:600,
                        background:'#F5F0E1', color:INK_S, border:'1px solid '+HAIR, borderRadius:4, textDecoration:'none',
                      }}>Duplicate</TenantLink>
                      <span style={{ marginLeft:'auto', fontSize:10, color:INK_M, alignSelf:'center' }}>
                        {t.is_active ? 'active' : 'inactive'} · {fmtDate(t.updated_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Chrome explainer */}
        <div style={{ gridColumn:'1 / -1', marginTop:12 }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, margin:'4px 2px 8px' }}>
            Every newsletter uses the same locked chrome
          </div>
          <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:'12px 14px', fontSize:11, color:INK_S, lineHeight:1.6 }}>
            <strong>Header:</strong> THE NAMKHAN · Luang Prabang, Laos · centered wordmark on warm off-white.<br />
            <strong>Footer:</strong> address · phone · social icons (IG · FB · TikTok · Website) · unsubscribe · preference link.<br />
            Templates only shape the body between them — no template can override the chrome.
          </div>
        </div>
      </DashboardPage>
    </div>
  );
}
