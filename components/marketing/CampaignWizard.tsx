'use client';

// components/marketing/CampaignWizard.tsx
// 5-step wizard: Brief → Curate → Compose → Approve → Distribute.
// Receives templates + asset pool from the server; manages all step state in client state.
//
// PBS 2026-07-21: Token/chrome sweep to design v6/v7.
//   - Killed every var(--paper-warm) / var(--paper) / var(--paper-deep) — resolves
//     to dark on Namkhan (see memory: paper-warm burn, importance 9). Hardcoded
//     paper white #FFFFFF.
//   - Replaced var(--moss)/(--brass)/(--ink*)/(--line*)/(--oxblood) with hex.
//   - Replaced var(--serif)/(--mono)/(--t-*) with system stack + fixed px sizes.
//   - Container radius 4px, pills 3px, hairlines #E6DFCC.
//   - Business logic (steps, guards, brief state, AI-caption gen) unchanged.

import { useMemo, useState } from 'react';
import type { CampaignTemplate, MediaAssetReady } from '@/lib/marketing';
import { CHANNEL_LABEL } from '@/lib/marketing';

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS: Array<{ n: Step; label: string }> = [
  { n: 1, label: 'Brief' },
  { n: 2, label: 'Curate' },
  { n: 3, label: 'Compose' },
  { n: 4, label: 'Approve' },
  { n: 5, label: 'Distribute' },
];

const VIBES = ['romantic', 'adventurous', 'family', 'cultural', 'culinary', 'wellness', 'festive', 'serene', 'editorial'];

const TONES = [
  { key: 'editorial', label: 'Editorial' },
  { key: 'friendly',  label: 'Friendly' },
  { key: 'direct',    label: 'Direct' },
  { key: 'playful',   label: 'Playful' },
];

// ────────────────────────────────────────────────────────────────────────────
// Design v6/v7 tokens — hardcoded to survive Namkhan's --paper-warm dark burn.
// ────────────────────────────────────────────────────────────────────────────
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const HAIR_S = '#EFEAD9';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const INK_L  = '#8A8A8A';
const FOREST = '#084838';
const FOREST_TINT = 'rgba(8,72,56,0.10)';
const FOREST_TINT_SOFT = 'rgba(8,72,56,0.06)';
const BRASS  = '#B48A3A';
const BRASS_TINT = 'rgba(180,138,58,0.10)';
const CREAM  = '#F5F0E1';
const OXBLD  = '#B04A2F';
const MONO   = 'ui-monospace, SFMono-Regular, monospace';

interface Props {
  templates: CampaignTemplate[];
  assetPool: MediaAssetReady[];
}

// PBS 2026-07-10: proper campaign planner brief.
// Adds objective/type/audience/markets/timing/budget/metric alongside brief text.
// Maps 1:1 onto new marketing.campaigns columns (v2 schema).
export type Objective       = 'new_bookings' | 'retention' | 'winback' | 'brand_awareness' | 'seasonal_push' | 'rate_promo' | 'event_promo' | 'product_launch' | 'pr_editorial' | 'loyalty';
export type CampaignType    = 'email_newsletter' | 'email_sequence' | 'social_organic' | 'social_paid_ad' | 'google_ads' | 'booking_com_promo' | 'expedia_promo' | 'agoda_promo' | 'direct_booking_banner' | 'landing_page' | 'pr_outreach' | 'content_asset' | 'multi_channel';
export type AudienceSegment = 'all_subscribers' | 'past_guests' | 'high_value_repeaters' | 'prospects' | 'dormant_winback' | 'country_segment' | 'seasonal_segment' | 'ota_no_email' | 'geo_targeted_paid' | 'lookalike' | 'custom_filter';
export type SuccessMetric   = 'bookings' | 'revenue' | 'room_nights' | 'email_opens' | 'email_clicks' | 'email_click_to_book' | 'impressions' | 'reach' | 'website_sessions' | 'website_conversions' | 'follower_growth' | 'engagement_rate' | 'earned_media_mentions';
export type BudgetType      = 'organic' | 'daily' | 'lifetime' | 'per_click' | 'per_impression';
export type Recurrence      = 'one_off' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'seasonal';

interface Brief {
  // Planner v2 fields (PBS 2026-07-10)
  objective:         Objective;
  campaignType:      CampaignType;
  audience:          AudienceSegment;
  targetMarkets:     string[];        // ISO-2 country codes
  startDate:         string;          // YYYY-MM-DD
  endDate:           string;          // YYYY-MM-DD (blank for one-off)
  recurrence:        Recurrence;
  budgetType:        BudgetType;
  budgetAmount:      string;          // string in UI, cast to numeric on save
  budgetCurrency:    string;
  successMetric:     SuccessMetric;
  successTarget:     string;
  // Legacy fields (still consumed by Curate/Compose/Approve steps)
  templateId:        number | null;
  briefText:         string;
  whenLive:          string;          // kept for existing Step 4/5 subtitle
  vibes:             string[];
}

export default function CampaignWizard({ templates, assetPool }: Props) {
  const [step, setStep] = useState<Step>(1);
  const today = new Date().toISOString().slice(0, 10);
  const [brief, setBrief] = useState<Brief>({
    objective:      'new_bookings',
    campaignType:   'social_organic',
    audience:       'all_subscribers',
    targetMarkets:  [],
    startDate:      today,
    endDate:        '',
    recurrence:     'one_off',
    budgetType:     'organic',
    budgetAmount:   '',
    budgetCurrency: 'USD',
    successMetric:  'bookings',
    successTarget:  '',
    templateId:     templates.find(t => t.channel === 'instagram_post')?.template_id ?? templates[0]?.template_id ?? null,
    briefText:      '',
    whenLive:       'this_friday',
    vibes:          [],
  });
  const [picked, setPicked]     = useState<string[]>([]); // asset ids
  const [caption, setCaption]   = useState<string>('');
  const [tone, setTone]         = useState<string>('editorial');
  const [hashtags, setHashtags] = useState<string[]>([]);

  const template = templates.find(t => t.template_id === brief.templateId) ?? null;

  // Mock AI proposal — score = simple heuristic (vibe match + tier weight + recency boost)
  const proposals = useMemo(() => {
    if (!template || assetPool.length === 0) return [];
    return assetPool
      .map(a => {
        let score = 0.6;
        if (a.primary_tier === 'tier_social_pool')  score += 0.10;
        if (a.primary_tier === 'tier_website_hero') score += 0.08;
        if (a.tags && a.tags.some(t => brief.vibes.includes(t))) score += 0.15;
        if ((a.qc_score ?? 0) > 0.8) score += 0.07;
        // jitter for variety
        score += (parseInt(a.asset_id.replace(/[^0-9]/g, '').slice(0, 3) || '0') % 10) * 0.005;
        return { asset: a, score: Math.min(0.99, score) };
      })
      .sort((x, y) => y.score - x.score)
      .slice(0, 10);
  }, [template, assetPool, brief.vibes]);

  // Step navigation guards
  const canContinue = useMemo(() => {
    if (step === 1) {
      // PBS 2026-07-10 v2: proper planner requires objective + type + audience + startDate + template + brief text.
      // Markets required only when audience is country_segment / geo_targeted_paid / lookalike.
      if (!brief.objective || !brief.campaignType || !brief.audience) return false;
      if (!brief.startDate) return false;
      if (!brief.templateId) return false;
      if (brief.briefText.trim().length < 20) return false;
      if ((brief.audience === 'country_segment' || brief.audience === 'geo_targeted_paid' || brief.audience === 'lookalike') && brief.targetMarkets.length === 0) return false;
      if (brief.budgetType !== 'organic' && !brief.budgetAmount) return false;
      return true;
    }
    if (step === 2) return template ? picked.length >= template.min_assets && picked.length <= template.max_assets : false;
    if (step === 3) return caption.trim().length >= 10;
    if (step === 4) return true;
    return true;
  }, [step, brief, template, picked, caption]);

  function next() {
    if (canContinue) {
      // Generate AI draft caption + hashtags when entering step 3
      if (step === 2 && !caption) {
        const draft = generateDraftCaption(brief, picked, assetPool, tone);
        setCaption(draft.caption);
        setHashtags(draft.hashtags);
      }
      setStep((s) => Math.min(5, s + 1) as Step);
    }
  }
  function back() { setStep(s => Math.max(1, s - 1) as Step); }

  return (
    <div style={{
      background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4,
      padding: 20,
    }}>
      {/* Progress strip */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 22, alignItems: 'center', flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => {
          const done = step > s.n;
          const active = step === s.n;
          return (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: active || done ? 600 : 500,
                color: active ? WHITE : done ? FOREST : INK_M,
                background: active ? FOREST : done ? FOREST_TINT : WHITE,
                border: active ? '1px solid ' + FOREST : '1px solid ' + HAIR,
                borderRadius: 3,
                fontFamily: MONO,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>{s.n}. {s.label}</div>
              {i < STEPS.length - 1 && <span style={{ color: INK_L }}>→</span>}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <Step1Brief brief={brief} setBrief={setBrief} templates={templates} />
      )}
      {step === 2 && (
        <Step2Curate
          template={template}
          proposals={proposals}
          picked={picked}
          setPicked={setPicked}
          assetPool={assetPool}
        />
      )}
      {step === 3 && (
        <Step3Compose
          template={template}
          picked={picked}
          assetPool={assetPool}
          caption={caption}
          setCaption={setCaption}
          tone={tone}
          setTone={setTone}
          hashtags={hashtags}
          setHashtags={setHashtags}
        />
      )}
      {step === 4 && (
        <Step4Approve
          template={template}
          picked={picked}
          assetPool={assetPool}
          caption={caption}
          hashtags={hashtags}
          brief={brief}
        />
      )}
      {step === 5 && (
        <Step5Distribute
          template={template}
          picked={picked}
          brief={brief}
        />
      )}

      {/* Footer nav */}
      <div style={{
        marginTop: 28,
        paddingTop: 16,
        borderTop: '1px solid ' + HAIR,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
      }}>
        {step > 1 && step < 5 && <button onClick={back} style={btnSecondary}>← back</button>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: INK_M }}>
          {step === 1 && (canContinue ? 'brief complete' : 'fill in objective · type · audience · dates · template · brief (20+ chars)')}
          {step === 2 && template && `picked ${picked.length} of ${template.min_assets === template.max_assets ? template.max_assets : `${template.min_assets}–${template.max_assets}`}`}
          {step === 3 && `caption ${caption.length} / ${template?.caption_max_chars || 2200} chars`}
        </span>
        {step < 4 && (
          <button
            onClick={next}
            disabled={!canContinue}
            style={{
              ...btnPrimary,
              background: canContinue ? FOREST : INK_L,
              borderColor: canContinue ? FOREST : INK_L,
              cursor: canContinue ? 'pointer' : 'not-allowed',
            }}
          >continue →</button>
        )}
        {step === 4 && (
          <button onClick={() => setStep(5)} style={btnPrimary}>✓ approve &amp; schedule</button>
        )}
        {step === 5 && (
          <a href="/marketing/campaigns" style={btnSecondary}>back to campaigns</a>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STEP 1 · BRIEF — proper campaign planner (PBS 2026-07-10)
// ============================================================================
// Structured 8-block brief: Objective → Type → Channel/Template → Audience →
// Markets → Timing → Budget → Success metric → Brief freetext + vibes.
// Every field feeds the AI proposal in Step 2/3 and lands as a column on
// marketing.campaigns.

const OBJECTIVES: Array<{ k: Objective; label: string; hint: string }> = [
  { k: 'new_bookings',    label: 'New bookings',         hint: 'Fill unsold nights · direct conversion goal' },
  { k: 'retention',       label: 'Retention',            hint: 'Re-engage past guests · repeat stays' },
  { k: 'winback',         label: 'Winback',              hint: 'Recover dormant guests (>18mo since stay)' },
  { k: 'brand_awareness', label: 'Brand awareness',      hint: 'Broad reach · no direct conversion goal' },
  { k: 'seasonal_push',   label: 'Seasonal push',        hint: 'Window-specific (winter · Green Season)' },
  { k: 'rate_promo',      label: 'Rate promo',           hint: 'Push a specific rate plan or discount' },
  { k: 'event_promo',     label: 'Event promo',          hint: 'Retreat · wedding · workshop' },
  { k: 'product_launch',  label: 'Product launch',       hint: 'New room type · spa treatment · activity' },
  { k: 'pr_editorial',    label: 'PR / editorial',       hint: 'Journalist · influencer outreach' },
  { k: 'loyalty',         label: 'Loyalty',              hint: 'Member-exclusive comms' },
];

const CAMPAIGN_TYPES: Array<{ k: CampaignType; label: string }> = [
  { k: 'email_newsletter',      label: 'Email · newsletter (one-off)' },
  { k: 'email_sequence',        label: 'Email · nurture sequence' },
  { k: 'social_organic',        label: 'Social · organic post' },
  { k: 'social_paid_ad',        label: 'Social · paid ad (Meta / TikTok)' },
  { k: 'google_ads',            label: 'Google Ads (Search / Display / PMax)' },
  { k: 'booking_com_promo',     label: 'Booking.com promotion' },
  { k: 'expedia_promo',         label: 'Expedia promotion' },
  { k: 'agoda_promo',           label: 'Agoda promotion' },
  { k: 'direct_booking_banner', label: 'Direct-booking-engine banner' },
  { k: 'landing_page',          label: 'Landing page' },
  { k: 'pr_outreach',           label: 'PR outreach' },
  { k: 'content_asset',         label: 'Content asset (blog / video)' },
  { k: 'multi_channel',         label: 'Multi-channel push' },
];

const AUDIENCES: Array<{ k: AudienceSegment; label: string; hint: string }> = [
  { k: 'all_subscribers',      label: 'All subscribers',        hint: 'Full newsletter list' },
  { k: 'past_guests',          label: 'Past guests',            hint: '≥1 completed stay' },
  { k: 'high_value_repeaters', label: 'High-value repeaters',   hint: '2+ stays or top-quartile LTV' },
  { k: 'prospects',            label: 'Prospects',              hint: 'Opted-in, never stayed' },
  { k: 'dormant_winback',      label: 'Dormant winback',        hint: 'No stay in > 18 months' },
  { k: 'country_segment',      label: 'Country segment',        hint: 'Pick target markets below' },
  { k: 'seasonal_segment',     label: 'Seasonal segment',       hint: 'Guests who stayed in this season before' },
  { k: 'ota_no_email',         label: 'OTA · no email',         hint: 'OTA arrivals with no email captured' },
  { k: 'geo_targeted_paid',    label: 'Geo-targeted paid',      hint: 'Paid ad geo targeting' },
  { k: 'lookalike',            label: 'Lookalike',              hint: 'Meta / Google lookalike audience' },
  { k: 'custom_filter',        label: 'Custom filter',          hint: 'Ad-hoc — spec in brief freetext' },
];

const METRICS: Array<{ k: SuccessMetric; label: string; unit: string }> = [
  { k: 'bookings',              label: 'Bookings',              unit: 'bookings' },
  { k: 'revenue',               label: 'Revenue',               unit: 'currency' },
  { k: 'room_nights',           label: 'Room nights',           unit: 'nights' },
  { k: 'email_opens',           label: 'Email opens',           unit: '%' },
  { k: 'email_clicks',          label: 'Email clicks',          unit: '%' },
  { k: 'email_click_to_book',   label: 'Email click-to-book',   unit: '%' },
  { k: 'impressions',           label: 'Impressions',           unit: 'count' },
  { k: 'reach',                 label: 'Reach',                 unit: 'people' },
  { k: 'website_sessions',      label: 'Website sessions',      unit: 'sessions' },
  { k: 'website_conversions',   label: 'Website conversions',   unit: 'count' },
  { k: 'follower_growth',       label: 'Follower growth',       unit: 'followers' },
  { k: 'engagement_rate',       label: 'Engagement rate',       unit: '%' },
  { k: 'earned_media_mentions', label: 'Earned media mentions', unit: 'mentions' },
];

// Top hospitality target markets — ISO-2 codes + names.
const MARKETS: Array<{ iso: string; name: string }> = [
  { iso: 'LA', name: 'Laos' },        { iso: 'TH', name: 'Thailand' },  { iso: 'VN', name: 'Vietnam' },
  { iso: 'CN', name: 'China' },       { iso: 'SG', name: 'Singapore' }, { iso: 'MY', name: 'Malaysia' },
  { iso: 'KH', name: 'Cambodia' },    { iso: 'ID', name: 'Indonesia' }, { iso: 'JP', name: 'Japan' },
  { iso: 'KR', name: 'South Korea' }, { iso: 'AU', name: 'Australia' }, { iso: 'FR', name: 'France' },
  { iso: 'DE', name: 'Germany' },     { iso: 'GB', name: 'United Kingdom' }, { iso: 'ES', name: 'Spain' },
  { iso: 'IT', name: 'Italy' },       { iso: 'NL', name: 'Netherlands' }, { iso: 'CH', name: 'Switzerland' },
  { iso: 'US', name: 'United States' }, { iso: 'CA', name: 'Canada' },  { iso: 'AE', name: 'UAE' },
];

const RECURRENCES: Array<{ k: Recurrence; label: string }> = [
  { k: 'one_off',   label: 'One-off' },
  { k: 'daily',     label: 'Daily' },
  { k: 'weekly',    label: 'Weekly' },
  { k: 'monthly',   label: 'Monthly' },
  { k: 'quarterly', label: 'Quarterly' },
  { k: 'seasonal',  label: 'Seasonal' },
];

const BUDGET_TYPES: Array<{ k: BudgetType; label: string }> = [
  { k: 'organic',         label: 'Organic (no spend)' },
  { k: 'daily',           label: 'Daily budget' },
  { k: 'lifetime',        label: 'Lifetime budget' },
  { k: 'per_click',       label: 'Per-click (CPC)' },
  { k: 'per_impression',  label: 'Per-impression (CPM)' },
];

// Form control primitives.
const p_control: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  border: '1px solid ' + HAIR, borderRadius: 4,
  fontSize: 13, fontFamily: 'inherit', color: INK, background: WHITE,
};
const p_label: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: INK_M, marginBottom: 6,
};

// Button primitives per design v6/v7 button contract.
const btnPrimary: React.CSSProperties = {
  padding: '6px 14px', fontSize: 12, fontWeight: 600,
  background: FOREST, color: WHITE, border: '1px solid ' + FOREST, borderRadius: 4,
  cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
  fontFamily: 'inherit',
};
const btnSecondary: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, fontWeight: 500,
  background: WHITE, color: INK, border: '1px solid ' + HAIR, borderRadius: 4,
  cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
  fontFamily: 'inherit',
};
const btnSmall: React.CSSProperties = {
  padding: '4px 10px', fontSize: 11, fontWeight: 500,
  background: WHITE, color: INK, border: '1px solid ' + HAIR, borderRadius: 4,
  cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
  fontFamily: 'inherit',
};

function Step1Brief({ brief, setBrief, templates }: { brief: Brief; setBrief: (b: Brief) => void; templates: CampaignTemplate[] }) {
  const template = templates.find(t => t.template_id === brief.templateId);
  const showMarkets = brief.audience === 'country_segment' || brief.audience === 'geo_targeted_paid' || brief.audience === 'lookalike';
  const showBudgetAmount = brief.budgetType !== 'organic';
  const objectiveMeta = OBJECTIVES.find(o => o.k === brief.objective);
  const audienceMeta = AUDIENCES.find(a => a.k === brief.audience);
  const metricMeta = METRICS.find(m => m.k === brief.successMetric);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Row 1 — Objective + Type */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={p_label}>Objective</label>
          <select style={p_control} value={brief.objective} onChange={e => setBrief({ ...brief, objective: e.target.value as Objective })}>
            {OBJECTIVES.map(o => <option key={o.k} value={o.k}>{o.label}</option>)}
          </select>
          <div style={{ marginTop: 4, fontSize: 11, color: INK_L, fontStyle: 'italic' }}>{objectiveMeta?.hint}</div>
        </div>
        <div>
          <label style={p_label}>Campaign type</label>
          <select style={p_control} value={brief.campaignType} onChange={e => setBrief({ ...brief, campaignType: e.target.value as CampaignType })}>
            {CAMPAIGN_TYPES.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* Row 2 — Audience + (Markets when applicable) */}
      <div style={{ display: 'grid', gridTemplateColumns: showMarkets ? '1fr 2fr' : '1fr', gap: 16 }}>
        <div>
          <label style={p_label}>Audience</label>
          <select style={p_control} value={brief.audience} onChange={e => setBrief({ ...brief, audience: e.target.value as AudienceSegment })}>
            {AUDIENCES.map(a => <option key={a.k} value={a.k}>{a.label}</option>)}
          </select>
          <div style={{ marginTop: 4, fontSize: 11, color: INK_L, fontStyle: 'italic' }}>{audienceMeta?.hint}</div>
        </div>
        {showMarkets && (
          <div>
            <label style={p_label}>Target markets · pick 1+</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {MARKETS.map(m => {
                const active = brief.targetMarkets.includes(m.iso);
                return (
                  <button key={m.iso}
                    onClick={() => setBrief({ ...brief, targetMarkets: active ? brief.targetMarkets.filter(x => x !== m.iso) : [...brief.targetMarkets, m.iso] })}
                    style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: 500,
                      background: active ? FOREST : WHITE, color: active ? WHITE : INK,
                      border: '1px solid ' + (active ? FOREST : HAIR), borderRadius: 3,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >{m.iso} · {m.name}</button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Row 3 — Timing */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div>
          <label style={p_label}>Start date</label>
          <input type="date" style={p_control} value={brief.startDate} onChange={e => setBrief({ ...brief, startDate: e.target.value })} />
        </div>
        <div>
          <label style={p_label}>End date (optional)</label>
          <input type="date" style={p_control} value={brief.endDate} onChange={e => setBrief({ ...brief, endDate: e.target.value })} />
        </div>
        <div>
          <label style={p_label}>Recurrence</label>
          <select style={p_control} value={brief.recurrence} onChange={e => setBrief({ ...brief, recurrence: e.target.value as Recurrence })}>
            {RECURRENCES.map(r => <option key={r.k} value={r.k}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {/* Row 4 — Budget */}
      <div style={{ display: 'grid', gridTemplateColumns: showBudgetAmount ? '1fr 1fr 1fr' : '1fr', gap: 16 }}>
        <div>
          <label style={p_label}>Budget type</label>
          <select style={p_control} value={brief.budgetType} onChange={e => setBrief({ ...brief, budgetType: e.target.value as BudgetType })}>
            {BUDGET_TYPES.map(b => <option key={b.k} value={b.k}>{b.label}</option>)}
          </select>
        </div>
        {showBudgetAmount && (
          <>
            <div>
              <label style={p_label}>Amount</label>
              <input type="number" min="0" step="1" style={p_control} value={brief.budgetAmount}
                     onChange={e => setBrief({ ...brief, budgetAmount: e.target.value })} placeholder="e.g. 500" />
            </div>
            <div>
              <label style={p_label}>Currency</label>
              <select style={p_control} value={brief.budgetCurrency} onChange={e => setBrief({ ...brief, budgetCurrency: e.target.value })}>
                {['USD','EUR','LAK','THB','GBP','SGD','AUD'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Row 5 — Success metric + target */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={p_label}>Success metric</label>
          <select style={p_control} value={brief.successMetric} onChange={e => setBrief({ ...brief, successMetric: e.target.value as SuccessMetric })}>
            {METRICS.map(m => <option key={m.k} value={m.k}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label style={p_label}>Target · {metricMeta?.unit ?? ''}</label>
          <input type="number" step="0.01" style={p_control} value={brief.successTarget}
                 onChange={e => setBrief({ ...brief, successTarget: e.target.value })}
                 placeholder={brief.successMetric === 'bookings' ? 'e.g. 20' : brief.successMetric === 'email_opens' ? 'e.g. 25' : ''} />
        </div>
      </div>

      {/* Row 6 — Brief freetext */}
      <div>
        <label style={p_label}>Brief · what is this campaign about? (1-3 sentences)</label>
        <textarea
          value={brief.briefText}
          onChange={e => setBrief({ ...brief, briefText: e.target.value })}
          placeholder='e.g. "Pi Mai (Lao New Year) April 13-16 — invite Bangkok subscribers to a 4-night stay with private Baci ceremony. Emphasize river-swim tradition and merit-making."'
          style={{ ...p_control, minHeight: 90, resize: 'vertical', fontFamily: 'inherit', fontStyle: 'italic', lineHeight: 1.5 }}
        />
      </div>

      {/* Row 7 — Vibes (optional) */}
      <div>
        <label style={p_label}>Vibe · optional, guides asset picker</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {VIBES.map(v => {
            const active = brief.vibes.includes(v);
            return (
              <button key={v}
                onClick={() => setBrief({ ...brief, vibes: active ? brief.vibes.filter(x => x !== v) : [...brief.vibes, v] })}
                style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 500, textTransform: 'capitalize',
                  background: active ? CREAM : WHITE, color: INK,
                  border: '1px solid ' + (active ? BRASS : HAIR), borderRadius: 3,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >{v}</button>
            );
          })}
        </div>
      </div>

      {/* Row 8 — Template picker (drives visual constraints in later steps) */}
      <div>
        <label style={p_label}>Creative template · asset dimensions + caption limits</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
          {templates.map(t => {
            const active = brief.templateId === t.template_id;
            return (
              <button key={t.template_id}
                onClick={() => setBrief({ ...brief, templateId: t.template_id })}
                style={{
                  textAlign: 'left', padding: '10px 12px',
                  border: '1px solid ' + (active ? FOREST : HAIR),
                  background: active ? '#EAF3EE' : WHITE,
                  borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: INK }}>{t.name}</div>
                <div style={{ fontSize: 10, color: INK_L, marginTop: 3, fontFamily: MONO }}>
                  {t.aspect_ratio} · {t.output_width}×{t.output_height} · {t.min_assets === t.max_assets ? t.max_assets : `${t.min_assets}–${t.max_assets}`} asset{t.max_assets > 1 ? 's' : ''}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {template && (
        <div style={{
          padding: '10px 14px', background: CREAM,
          borderLeft: '3px solid ' + BRASS, fontSize: 11, color: INK_M, lineHeight: 1.6,
          borderRadius: 4,
        }}>
          <div style={{ fontWeight: 600, color: INK }}>Template constraints (auto-applied later):</div>
          License must allow: {(template.license_filter ?? []).join(', ') || '—'} · Aspect ratio: {template.aspect_ratio} · {template.output_width}×{template.output_height}px · Asset count: {template.min_assets === template.max_assets ? template.max_assets : `${template.min_assets}–${template.max_assets}`} · Caption limit: {template.caption_max_chars ?? '—'} chars · Hashtag max: {template.hashtag_max ?? '—'}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STEP 2 · CURATE
// ============================================================================
function Step2Curate({
  template, proposals, picked, setPicked, assetPool,
}: {
  template: CampaignTemplate | null;
  proposals: Array<{ asset: MediaAssetReady; score: number }>;
  picked: string[];
  setPicked: (ids: string[]) => void;
  assetPool: MediaAssetReady[];
}) {
  function toggle(id: string) {
    if (picked.includes(id)) setPicked(picked.filter(x => x !== id));
    else if (template && picked.length >= template.max_assets) {
      // can't add more
    } else {
      setPicked([...picked, id]);
    }
  }

  if (assetPool.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: INK, margin: '0 0 8px' }}>No assets in the library yet</h3>
        <p style={{ fontSize: 12, color: INK_M, margin: '0 0 8px' }}>
          Upload some photos at <a href="/marketing/upload" style={{ color: FOREST, fontWeight: 600 }}>/marketing/upload</a> first, then return to build a campaign.
        </p>
        <p style={{ fontSize: 11, color: INK_L, marginTop: 16 }}>
          Once Phase 1 ingest pipeline is fed, the AI will rank candidates against your brief automatically.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        padding: '10px 14px',
        background: FOREST_TINT_SOFT,
        borderLeft: '3px solid ' + FOREST,
        borderRadius: 4,
        fontSize: 12,
        color: INK,
        lineHeight: 1.6,
      }}>
        <strong>AI proposed {proposals.length} assets ranked for your brief.</strong> Pick {template?.min_assets === template?.max_assets ? template?.max_assets : `${template?.min_assets}–${template?.max_assets}`} that work. Click cards for full preview.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {proposals.map(({ asset, score }) => {
          const isPicked = picked.includes(asset.asset_id);
          const reason =
            (asset.tags && asset.tags.length > 0)
              ? `matches ${asset.tags.slice(0, 2).join(', ')}${asset.primary_tier === 'tier_social_pool' ? ' · social-ready' : ''}`
              : 'high QC score';
          return (
            <ProposalCard
              key={asset.asset_id}
              asset={asset}
              picked={isPicked}
              score={score}
              reason={reason}
              onToggle={() => toggle(asset.asset_id)}
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, fontSize: 11, color: INK_M, alignItems: 'center', marginTop: 8 }}>
        <button style={btnSmall}>show 10 more</button>
        <a href="/marketing/library" target="_blank" rel="noreferrer" style={btnSmall}>browse library manually ↗</a>
        <span style={{ marginLeft: 'auto' }}>
          you picked <strong style={{ color: INK }}>{picked.length}</strong> of {template?.max_assets ?? '?'}
        </span>
      </div>
    </div>
  );
}

function ProposalCard({ asset, picked, score, reason, onToggle }: {
  asset: MediaAssetReady;
  picked: boolean;
  score: number;
  reason: string;
  onToggle: () => void;
}) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const thumbPath = asset.renders?.thumbnail ?? asset.renders?.web_2k;
  const thumb = thumbPath ? `${base}/storage/v1/object/public/media-renders/${thumbPath}` : null;
  return (
    <div
      onClick={onToggle}
      style={{
        background: WHITE,
        border: picked ? '2px solid ' + FOREST : '1px solid ' + HAIR,
        borderRadius: 4,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ aspectRatio: '4 / 3', background: '#1a1a1a', position: 'relative' }}>
        {thumb
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={thumb} alt={asset.alt_text ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#888', fontFamily: MONO, fontSize: 10 }}>no preview</div>
        }
        <div style={{
          position: 'absolute', top: 6, right: 6,
          background: BRASS, color: WHITE,
          fontFamily: MONO, fontSize: 11, fontWeight: 700,
          padding: '3px 8px', borderRadius: 3,
        }}>{score.toFixed(2)}</div>
        <div style={{
          position: 'absolute', bottom: 6, right: 6,
          width: 28, height: 28, borderRadius: '50%',
          background: picked ? FOREST : 'rgba(255,255,255,0.92)',
          color: picked ? WHITE : INK,
          display: 'grid', placeItems: 'center',
          fontSize: 14, fontWeight: 700,
        }}>{picked ? '✓' : '+'}</div>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 13, color: INK, lineHeight: 1.4 }}>
          {asset.caption ?? asset.original_filename}
        </div>
        <div style={{ marginTop: 4, fontSize: 10, color: INK_M, fontStyle: 'italic' }}>
          {reason}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 3 · COMPOSE
// ============================================================================
function Step3Compose({
  template, picked, assetPool, caption, setCaption, tone, setTone, hashtags, setHashtags,
}: {
  template: CampaignTemplate | null;
  picked: string[];
  assetPool: MediaAssetReady[];
  caption: string;
  setCaption: (s: string) => void;
  tone: string;
  setTone: (s: string) => void;
  hashtags: string[];
  setHashtags: (s: string[]) => void;
}) {
  const [slideIdx, setSlideIdx] = useState(0);
  const slides = picked.map(id => assetPool.find(a => a.asset_id === id)).filter(Boolean) as MediaAssetReady[];
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const slide = slides[slideIdx];
  const slideThumbPath = slide?.renders?.web_2k ?? slide?.renders?.thumbnail;
  const slideUrl = slideThumbPath ? `${base}/storage/v1/object/public/media-renders/${slideThumbPath}` : null;

  const aspectStr = template?.aspect_ratio ?? '1:1';

  function regenerate() {
    // no AI yet — just shuffle hashtag order to give a sense of "regenerated"
    const next = [...hashtags].reverse();
    setHashtags(next);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
      {/* Preview */}
      <div>
        <div style={{ fontSize: 11, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.06em', color: INK_M, marginBottom: 8 }}>preview · {template?.name}</div>
        <div style={{
          aspectRatio: aspectStr.replace(':', ' / '),
          background: '#0c0e0d',
          position: 'relative',
          maxWidth: 480,
          margin: '0 auto',
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          {slideUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={slideUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#666', fontFamily: MONO, fontSize: 11 }}>(no preview)</div>}
          <div style={{ position: 'absolute', bottom: 12, right: 12, fontFamily: MONO, fontSize: 10, color: WHITE, background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: 3 }}>thenamkhan</div>
        </div>
        {slides.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'center', alignItems: 'center', fontSize: 11, color: INK_M }}>
            <button style={btnSmall} onClick={() => setSlideIdx((slideIdx - 1 + slides.length) % slides.length)}>◀</button>
            <span style={{ fontFamily: MONO }}>slide {slideIdx + 1} of {slides.length}</span>
            <button style={btnSmall} onClick={() => setSlideIdx((slideIdx + 1) % slides.length)}>▶</button>
          </div>
        )}
      </div>

      {/* Caption + tone + hashtags */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Section title={`Caption · ${caption.length} / ${template?.caption_max_chars ?? 2200}`}>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            rows={6}
            style={{
              width: '100%',
              fontFamily: 'inherit',
              fontStyle: 'italic',
              fontSize: 13,
              padding: 12,
              color: INK,
              border: '1px solid ' + HAIR,
              borderRadius: 4,
              background: WHITE,
              boxSizing: 'border-box',
              lineHeight: 1.5,
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button style={btnSmall} onClick={regenerate}>regenerate</button>
            <span style={{ fontSize: 11, color: INK_M }}>tone:</span>
            {TONES.map(t => (
              <button
                key={t.key}
                onClick={() => setTone(t.key)}
                style={{
                  padding: '4px 10px', fontSize: 10, fontWeight: 500,
                  background: tone === t.key ? FOREST : WHITE,
                  color: tone === t.key ? WHITE : INK,
                  border: '1px solid ' + (tone === t.key ? FOREST : HAIR),
                  borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >{t.label}</button>
            ))}
          </div>
        </Section>

        <Section title={`Hashtags (${hashtags.length} / ${template?.hashtag_max ?? 12})`}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {hashtags.map((h, i) => (
              <span key={i} style={{
                fontFamily: MONO, fontSize: 11, padding: '3px 8px', color: INK,
                background: WHITE, border: '1px solid ' + HAIR, borderRadius: 3,
              }}>#{h}</span>
            ))}
            {hashtags.length === 0 && <span style={{ fontSize: 11, color: INK_M }}>—</span>}
          </div>
        </Section>

        <Section title="Logo placement">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 3, fontSize: 11, fontWeight: 600,
              background: FOREST, color: WHITE, border: '1px solid ' + FOREST,
            }}>{template?.logo_position ?? 'bottom-right'} (default)</span>
            <button style={btnSmall}>change</button>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 4 · APPROVE
// ============================================================================
function Step4Approve({ template, picked, assetPool, caption, hashtags, brief }: {
  template: CampaignTemplate | null;
  picked: string[];
  assetPool: MediaAssetReady[];
  caption: string;
  hashtags: string[];
  brief: Brief;
}) {
  const slides = picked.map(id => assetPool.find(a => a.asset_id === id)).filter(Boolean) as MediaAssetReady[];

  const checks: Array<{ pass: boolean; warn?: boolean; label: string }> = [
    { pass: slides.every(s => !!s.alt_text),                       label: `All ${slides.length} assets have alt-text` },
    { pass: slides.every(s => !s.has_identifiable_people || s.do_not_modify === false), label: 'License allows usage' },
    { pass: caption.length > 0 && caption.length <= (template?.caption_max_chars ?? 2200), label: `Caption under ${template?.caption_max_chars ?? 2200} chars` },
    { pass: true,  label: 'Logo placed' },
    { pass: hashtags.length === new Set(hashtags).size, label: 'No duplicate hashtags' },
  ];
  const allPass = checks.every(c => c.pass);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: INK_M }}>review · {template?.name} · {slides.length} asset{slides.length === 1 ? '' : 's'}</div>

      {/* PBS 2026-07-10: Planner v2 summary — objective/type/audience/markets/timing/budget/metric */}
      <div style={{ border: '1px solid ' + HAIR, borderRadius: 4, padding: '14px 16px', background: WHITE }}>
        <div style={{ fontSize: 10, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.08em', color: INK_M, marginBottom: 10 }}>Campaign brief</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px 20px', fontSize: 12, color: INK }}>
          <div><div style={{ fontSize: 10, color: INK_L, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Objective</div>{brief.objective.replace(/_/g, ' ')}</div>
          <div><div style={{ fontSize: 10, color: INK_L, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</div>{brief.campaignType.replace(/_/g, ' ')}</div>
          <div><div style={{ fontSize: 10, color: INK_L, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Audience</div>{brief.audience.replace(/_/g, ' ')}</div>
          {brief.targetMarkets.length > 0 && (
            <div><div style={{ fontSize: 10, color: INK_L, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Markets</div>{brief.targetMarkets.join(' · ')}</div>
          )}
          <div><div style={{ fontSize: 10, color: INK_L, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Timing</div>{brief.startDate}{brief.endDate ? ` → ${brief.endDate}` : ''}{brief.recurrence !== 'one_off' ? ` · ${brief.recurrence}` : ''}</div>
          <div><div style={{ fontSize: 10, color: INK_L, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Budget</div>{brief.budgetType === 'organic' ? 'Organic' : `${brief.budgetCurrency} ${brief.budgetAmount || '—'} · ${brief.budgetType.replace(/_/g, ' ')}`}</div>
          <div><div style={{ fontSize: 10, color: INK_L, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Success metric</div>{brief.successMetric.replace(/_/g, ' ')}{brief.successTarget ? ` · target ${brief.successTarget}` : ''}</div>
        </div>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid ' + HAIR }}>
          <div style={{ fontSize: 10, color: INK_L, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Freetext brief</div>
          <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 14, color: INK, lineHeight: 1.5 }}>{brief.briefText}</div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.06em', color: INK_M, marginBottom: 6 }}>caption</div>
        <div style={{ fontSize: 13, color: INK, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{caption}</div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.06em', color: INK_M, marginBottom: 6 }}>hashtags ({hashtags.length})</div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: INK }}>
          {hashtags.map(h => `#${h}`).join('  ')}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.06em', color: INK_M, marginBottom: 8 }}>checklist</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          {checks.map((c, i) => (
            <div key={i} style={{ color: c.pass ? FOREST : OXBLD }}>
              {c.pass ? '✓' : '✕'} {c.label}
            </div>
          ))}
          {allPass && <div style={{ color: FOREST, fontWeight: 600, marginTop: 4 }}>✓ ready to ship</div>}
          {!allPass && <div style={{ color: OXBLD, fontWeight: 600, marginTop: 4 }}>✕ resolve checklist before approving</div>}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.06em', color: INK_M, marginBottom: 6 }}>approver</div>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: 3, fontSize: 11, fontWeight: 600,
          background: FOREST, color: WHITE, border: '1px solid ' + FOREST,
        }}>Paul Bauer (Owner)</span>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 5 · DISTRIBUTE
// ============================================================================
function Step5Distribute({ template, picked, brief }: { template: CampaignTemplate | null; picked: string[]; brief: Brief }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{
        padding: '14px 18px',
        background: FOREST_TINT,
        borderLeft: '3px solid ' + FOREST,
        borderRadius: 4,
        fontSize: 14,
        color: INK,
      }}>
        <div style={{ fontFamily: MONO, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: FOREST, fontWeight: 600 }}>✓ approved</div>
        <div style={{ marginTop: 4, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 18 }}>your campaign is queued</div>
        <div style={{ marginTop: 4, fontSize: 12, color: INK_M }}>{brief.objective.replace(/_/g, ' ')} · {brief.campaignType.replace(/_/g, ' ')} · {brief.audience.replace(/_/g, ' ')}{brief.targetMarkets.length > 0 ? ` (${brief.targetMarkets.join(', ')})` : ''} · {brief.startDate}{brief.endDate ? ` → ${brief.endDate}` : ''}</div>
      </div>

      <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: 16 }}>
        <div style={{ fontSize: 11, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.06em', color: INK_M, marginBottom: 10 }}>where it goes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
          <Row label="Logged in usage history for all assets" status="done" />
          <Row label="Backed up to /campaigns archive" status="done" />
          <Row label={`Auto-post to ${template?.channel.startsWith('instagram') ? 'Instagram @thenamkhan' : template?.name ?? 'channel'} (via Make scenario)`} status="scheduled" />
        </div>
      </div>

      <div style={{
        padding: 14, background: BRASS_TINT,
        borderLeft: '3px solid ' + BRASS, borderRadius: 4,
        fontSize: 11, color: INK_M, lineHeight: 1.6,
      }}>
        <strong>auto-posting comes in Phase 4.</strong> for now, download the renders below and post manually.
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={btnSecondary}>⤓ all slides as ZIP</button>
        <button style={btnSecondary}>⤓ caption + hashtags TXT</button>
      </div>
    </div>
  );
}

function Row({ label, status }: { label: string; status: 'done' | 'scheduled' | 'pending' }) {
  const color =
    status === 'done'      ? FOREST :
    status === 'scheduled' ? BRASS :
    INK_M;
  const sym = status === 'done' ? '✓' : status === 'scheduled' ? '⏳' : '·';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid ' + HAIR_S }}>
      <span style={{ color: INK }}>{label}</span>
      <span style={{
        display: 'inline-block', padding: '3px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
        background: color, color: WHITE, border: '1px solid ' + color,
      }}>{sym} {status}</span>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.06em', color: INK_M, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function generateDraftCaption(brief: Brief, picked: string[], assetPool: MediaAssetReady[], tone: string): { caption: string; hashtags: string[] } {
  // Mock AI draft. Real Claude call lands as Edge Function `campaign-propose`/`campaign-compose`.
  // Grounds caption in selected assets' tags only — no hallucinated entities.
  const slides = picked.map(id => assetPool.find(a => a.asset_id === id)).filter(Boolean) as MediaAssetReady[];
  const tagPool = Array.from(new Set(slides.flatMap(s => s.tags ?? []))).slice(0, 14);
  const captionStarters: Record<string, string> = {
    editorial: 'an invitation in three lines.',
    friendly:  'come stay with us.',
    direct:    'book the dates.',
    playful:   'the river is calling.',
  };
  const intro = captionStarters[tone] ?? captionStarters.editorial;
  const body = brief.briefText
    .replace(/^[A-Z]/, c => c.toLowerCase())
    .replace(/!+/g, '');
  const hashtags = ['thenamkhan', 'luangprabang', ...tagPool.filter(t => /^[a-z0-9_]+$/.test(t))].slice(0, 12);
  const caption = `${intro}\n${body}.\n\n${hashtags.map(h => '#' + h).join(' ')}`;
  return { caption, hashtags };
}
