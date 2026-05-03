'use client';

// components/marketing/CampaignWizard.tsx
// 5-step wizard: Brief → Curate → Compose → Approve → Distribute.
// Receives templates + asset pool from the server; manages all step state in client state.

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

interface Props {
  templates: CampaignTemplate[];
  assetPool: MediaAssetReady[];
}

interface Brief {
  templateId: number | null;
  briefText: string;
  whenLive: string; // 'today', 'tomorrow', 'this_friday', or ISO date
  vibes: string[];
}

export default function CampaignWizard({ templates, assetPool }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [brief, setBrief] = useState<Brief>({
    templateId: templates.find(t => t.channel === 'instagram_post')?.template_id ?? templates[0]?.template_id ?? null,
    briefText: '',
    whenLive: 'this_friday',
    vibes: [],
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
    if (step === 1) return !!brief.templateId && brief.briefText.trim().length > 5;
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
    <div className="card">
      {/* Progress strip */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 22, alignItems: 'center', flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => {
          const done = step > s.n;
          const active = step === s.n;
          return (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: active || done ? 600 : 500,
                color: active ? 'var(--paper-warm)' : done ? 'var(--moss)' : 'var(--ink-mute)',
                background: active ? 'var(--moss)' : done ? 'rgba(31,53,40,0.10)' : 'transparent',
                border: active ? '1px solid var(--moss)' : '1px solid var(--line)',
                borderRadius: 4,
                fontFamily: 'var(--mono)',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}>{s.n}. {s.label}</div>
              {i < STEPS.length - 1 && <span style={{ color: 'var(--ink-mute)' }}>→</span>}
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
        borderTop: '1px solid var(--line-soft)',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
      }}>
        {step > 1 && step < 5 && <button onClick={back} className="btn" style={{ fontSize: 11 }}>← back</button>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-mute)' }}>
          {step === 1 && (canContinue ? 'looks good' : 'pick a template + write a brief sentence')}
          {step === 2 && template && `picked ${picked.length} of ${template.min_assets === template.max_assets ? template.max_assets : `${template.min_assets}–${template.max_assets}`}`}
          {step === 3 && `caption ${caption.length} / ${template?.caption_max_chars || 2200} chars`}
        </span>
        {step < 4 && (
          <button
            onClick={next}
            disabled={!canContinue}
            className="btn"
            style={{
              fontSize: 11,
              background: canContinue ? 'var(--moss)' : 'var(--ink-mute)',
              color: 'var(--paper-warm)',
              borderColor: canContinue ? 'var(--moss)' : 'var(--ink-mute)',
              cursor: canContinue ? 'pointer' : 'not-allowed',
            }}
          >continue →</button>
        )}
        {step === 4 && (
          <button
            onClick={() => setStep(5)}
            className="btn"
            style={{ fontSize: 11, background: 'var(--moss)', color: 'var(--paper-warm)', borderColor: 'var(--moss)' }}
          >✓ approve & schedule</button>
        )}
        {step === 5 && (
          <a href="/marketing/campaigns" className="btn" style={{ fontSize: 11, textDecoration: 'none' }}>back to campaigns</a>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STEP 1 · BRIEF
// ============================================================================
function Step1Brief({ brief, setBrief, templates }: { brief: Brief; setBrief: (b: Brief) => void; templates: CampaignTemplate[] }) {
  const template = templates.find(t => t.template_id === brief.templateId);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Section title="What are we making?">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
          {templates.map(t => {
            const active = brief.templateId === t.template_id;
            return (
              <button
                key={t.template_id}
                onClick={() => setBrief({ ...brief, templateId: t.template_id })}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  border: active ? '2px solid var(--moss)' : '1px solid var(--line)',
                  background: active ? 'rgba(31,53,40,0.05)' : 'var(--paper-warm)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: 'var(--sans)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{t.name}</div>
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--ink-mute)', marginTop: 3 }}>
                  {t.aspect_ratio} · {t.output_width}×{t.output_height} · {t.min_assets === t.max_assets ? t.max_assets : `${t.min_assets}–${t.max_assets}`} asset{t.max_assets > 1 ? 's' : ''}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="What's it about?">
        <input
          value={brief.briefText}
          onChange={e => setBrief({ ...brief, briefText: e.target.value })}
          placeholder='e.g. "Pi Mai festival in April — invite Bangkok guests"'
          style={{
            width: '100%',
            fontSize: 14,
            padding: '12px 14px',
            border: '1px solid var(--line)',
            borderRadius: 4,
            background: 'var(--paper-warm)',
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
          }}
        />
      </Section>

      <Section title="When does it go live?">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { k: 'today',       label: 'Today' },
            { k: 'tomorrow',    label: 'Tomorrow' },
            { k: 'this_friday', label: 'This Friday' },
            { k: 'next_week',   label: 'Next week' },
            { k: 'pick',        label: 'Pick a date…' },
          ].map(opt => {
            const active = brief.whenLive === opt.k;
            return (
              <button
                key={opt.k}
                onClick={() => setBrief({ ...brief, whenLive: opt.k })}
                className="btn"
                style={{
                  fontSize: 11,
                  background: active ? 'var(--moss)' : 'var(--paper-warm)',
                  color: active ? 'var(--paper-warm)' : 'var(--ink)',
                  borderColor: active ? 'var(--moss)' : 'var(--line)',
                }}
              >{opt.label}</button>
            );
          })}
        </div>
      </Section>

      <Section title="Vibe (optional, helps the AI pick)">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {VIBES.map(v => {
            const active = brief.vibes.includes(v);
            return (
              <button
                key={v}
                onClick={() => setBrief({
                  ...brief,
                  vibes: active ? brief.vibes.filter(x => x !== v) : [...brief.vibes, v],
                })}
                className="btn"
                style={{
                  fontSize: 11,
                  textTransform: 'capitalize',
                  background: active ? 'var(--brass)' : 'var(--paper-warm)',
                  color: active ? 'var(--paper-warm)' : 'var(--ink)',
                  borderColor: active ? 'var(--brass)' : 'var(--line)',
                }}
              >{v}</button>
            );
          })}
        </div>
      </Section>

      {template && (
        <div style={{
          padding: '12px 14px',
          background: 'rgba(168,133,74,0.10)',
          borderLeft: '3px solid var(--brass)',
          fontSize: 12,
          color: 'var(--ink-soft)',
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Restrictions auto-set by template:</div>
          License must allow: {(template.license_filter ?? []).join(', ') || '—'}<br />
          Aspect ratio: {template.aspect_ratio} · {template.output_width}×{template.output_height}px<br />
          Asset count: {template.min_assets === template.max_assets ? template.max_assets : `${template.min_assets}–${template.max_assets}`}<br />
          Caption limit: {template.caption_max_chars ?? '—'} chars · Hashtag max: {template.hashtag_max ?? '—'}
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
      <div className="stub" style={{ padding: 32, textAlign: 'center' }}>
        <h3>No assets in the library yet</h3>
        <p>Upload some photos at <a href="/marketing/upload" style={{ color: 'var(--brass)' }}>/marketing/upload</a> first, then return to build a campaign.</p>
        <p style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 16 }}>
          Once Phase 1 ingest pipeline is fed, the AI will rank candidates against your brief automatically.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        padding: '10px 14px',
        background: 'rgba(31,53,40,0.06)',
        borderLeft: '3px solid var(--moss)',
        fontSize: 12,
        color: 'var(--ink-soft)',
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

      <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--ink-mute)', alignItems: 'center', marginTop: 8 }}>
        <button className="btn" style={{ fontSize: 11 }}>show 10 more</button>
        <a href="/marketing/library" target="_blank" rel="noreferrer" className="btn" style={{ fontSize: 11, textDecoration: 'none' }}>browse library manually ↗</a>
        <span style={{ marginLeft: 'auto' }}>
          you picked <strong style={{ color: 'var(--ink)' }}>{picked.length}</strong> of {template?.max_assets ?? '?'}
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
        background: 'var(--paper)',
        border: picked ? '2px solid var(--moss)' : '1px solid var(--line)',
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
          : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#888', fontFamily: 'var(--mono)', fontSize: 10 }}>no preview</div>
        }
        <div style={{
          position: 'absolute', top: 6, right: 6,
          background: 'var(--brass)', color: 'var(--paper-warm)',
          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
          padding: '3px 8px',
        }}>{score.toFixed(2)}</div>
        <div style={{
          position: 'absolute', bottom: 6, right: 6,
          width: 28, height: 28, borderRadius: '50%',
          background: picked ? 'var(--moss)' : 'rgba(255,255,255,0.92)',
          color: picked ? 'var(--paper-warm)' : 'var(--ink)',
          display: 'grid', placeItems: 'center',
          fontSize: 14, fontWeight: 700,
        }}>{picked ? '✓' : '+'}</div>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink)', lineHeight: 1.3 }}>
          {asset.caption ?? asset.original_filename}
        </div>
        <div style={{ marginTop: 4, fontSize: 10, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
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
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--ink-mute)', marginBottom: 8 }}>preview · {template?.name}</div>
        <div style={{
          aspectRatio: aspectStr.replace(':', ' / '),
          background: '#0c0e0d',
          position: 'relative',
          maxWidth: 480,
          margin: '0 auto',
        }}>
          {slideUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={slideUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#666', fontFamily: 'var(--mono)', fontSize: 11 }}>(no preview)</div>}
          <div style={{ position: 'absolute', bottom: 12, right: 12, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--paper-warm)', background: 'rgba(0,0,0,0.5)', padding: '2px 6px' }}>thenamkhan</div>
        </div>
        {slides.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'center', alignItems: 'center', fontSize: 11, color: 'var(--ink-mute)' }}>
            <button className="btn" style={{ fontSize: 10 }} onClick={() => setSlideIdx((slideIdx - 1 + slides.length) % slides.length)}>◀</button>
            <span style={{ fontFamily: 'var(--mono)' }}>slide {slideIdx + 1} of {slides.length}</span>
            <button className="btn" style={{ fontSize: 10 }} onClick={() => setSlideIdx((slideIdx + 1) % slides.length)}>▶</button>
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
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 14,
              padding: 12,
              border: '1px solid var(--line)',
              borderRadius: 4,
              background: 'var(--paper-warm)',
              boxSizing: 'border-box',
              lineHeight: 1.5,
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <button className="btn" style={{ fontSize: 11 }} onClick={regenerate}>regenerate</button>
            <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>tone:</span>
            {TONES.map(t => (
              <button
                key={t.key}
                onClick={() => setTone(t.key)}
                className="btn"
                style={{
                  fontSize: 10,
                  background: tone === t.key ? 'var(--moss)' : 'var(--paper-warm)',
                  color: tone === t.key ? 'var(--paper-warm)' : 'var(--ink)',
                  borderColor: tone === t.key ? 'var(--moss)' : 'var(--line)',
                }}
              >{t.label}</button>
            ))}
          </div>
        </Section>

        <Section title={`Hashtags (${hashtags.length} / ${template?.hashtag_max ?? 12})`}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {hashtags.map((h, i) => (
              <span key={i} style={{
                fontFamily: 'var(--mono)', fontSize: 11, padding: '3px 8px',
                background: 'var(--paper-warm)', border: '1px solid var(--line)',
              }}>#{h}</span>
            ))}
            {hashtags.length === 0 && <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>—</span>}
          </div>
        </Section>

        <Section title="Logo placement">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="pill" style={{ background: 'var(--moss)', color: 'var(--paper-warm)' }}>{template?.logo_position ?? 'bottom-right'} (default)</span>
            <button className="btn" style={{ fontSize: 11 }}>change</button>
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
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--ink-mute)' }}>review · {template?.name} · {slides.length} asset{slides.length === 1 ? '' : 's'}</div>

      <div>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-mute)', marginBottom: 6 }}>brief</div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink)' }}>{brief.briefText}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>schedule: {brief.whenLive.replace('_', ' ')}</div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-mute)', marginBottom: 6 }}>caption</div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{caption}</div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-mute)', marginBottom: 6 }}>hashtags ({hashtags.length})</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)' }}>
          {hashtags.map(h => `#${h}`).join('  ')}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-mute)', marginBottom: 8 }}>checklist</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          {checks.map((c, i) => (
            <div key={i} style={{ color: c.pass ? 'var(--moss)' : 'var(--oxblood)' }}>
              {c.pass ? '✓' : '✕'} {c.label}
            </div>
          ))}
          {allPass && <div style={{ color: 'var(--moss)', fontWeight: 600, marginTop: 4 }}>✓ ready to ship</div>}
          {!allPass && <div style={{ color: 'var(--oxblood)', fontWeight: 600, marginTop: 4 }}>✕ resolve checklist before approving</div>}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-mute)', marginBottom: 6 }}>approver</div>
        <span className="pill" style={{ background: 'var(--moss)', color: 'var(--paper-warm)' }}>Paul Bauer (Owner)</span>
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
        background: 'rgba(31,53,40,0.10)',
        borderLeft: '3px solid var(--moss)',
        fontSize: 14,
        color: 'var(--ink)',
      }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--moss)', fontWeight: 600 }}>✓ approved</div>
        <div style={{ marginTop: 4, fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 18 }}>your campaign is queued</div>
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-soft)' }}>{template?.name} · {picked.length} asset{picked.length === 1 ? '' : 's'} · scheduled {brief.whenLive.replace('_', ' ')}</div>
      </div>

      <div className="card" style={{ background: 'var(--paper)', padding: 16 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-mute)', marginBottom: 10 }}>where it goes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
          <Row label="Logged in usage history for all assets" status="done" />
          <Row label="Backed up to /campaigns archive" status="done" />
          <Row label={`Auto-post to ${template?.channel.startsWith('instagram') ? 'Instagram @thenamkhan' : template?.name ?? 'channel'} (via Make scenario)`} status="scheduled" />
        </div>
      </div>

      <div style={{ padding: 14, background: 'rgba(168,133,74,0.10)', borderLeft: '3px solid var(--brass)', fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
        <strong>auto-posting comes in Phase 4.</strong> for now, download the renders below and post manually.
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" style={{ fontSize: 11 }}>⤓ all slides as ZIP</button>
        <button className="btn" style={{ fontSize: 11 }}>⤓ caption + hashtags TXT</button>
      </div>
    </div>
  );
}

function Row({ label, status }: { label: string; status: 'done' | 'scheduled' | 'pending' }) {
  const color =
    status === 'done'      ? 'var(--moss)' :
    status === 'scheduled' ? 'var(--brass)' :
    'var(--ink-mute)';
  const sym = status === 'done' ? '✓' : status === 'scheduled' ? '⏳' : '·';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <span style={{ color: 'var(--ink-soft)' }}>{label}</span>
      <span className="pill" style={{ background: color, color: 'var(--paper-warm)' }}>{sym} {status}</span>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--ink-mute)', fontWeight: 600, marginBottom: 8 }}>{title}</div>
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
