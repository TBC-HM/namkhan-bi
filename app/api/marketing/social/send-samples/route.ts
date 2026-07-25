// app/api/marketing/social/send-samples/route.ts
// spec-social-media-module (2026-07-25, run 3) · A7 — deliver the acceptance
// evidence: 2 sample posts per ACTIVE channel, rendered per channel format
// spec, emailed to PBS. Real posts from marketing.social_posts are used first;
// when a channel has fewer than 2, deterministic on-brand template samples are
// generated from marketing.social_programs (no LLM call — repeatable evidence).
// Send path reuses the existing send-report-email edge fn (raw html mode),
// same as /api/pickup/email. Auth = app middleware session (PBS-facing button).
//
// POST { to?: string, property_id?: number } → { ok, sent_to, channels }

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { SocialChannelRule, SocialProgram } from '@/lib/marketing';
import type { SocialPostRow } from '@/lib/marketing-social';
import { formatPostForChannel, parseFormat } from '@/lib/social-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NAMKHAN_PID = 260955; // Namkhan-only this iteration (brief §7)
const DEFAULT_TO = 'pb@thenamkhan.com';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}

/** Deterministic on-brand sample copy per program category (fallback generic). */
function sampleFromProgram(platform: string, program: SocialProgram | undefined, n: number): SocialPostRow {
  const cat = program?.category_code ?? 'general';
  const copy: Record<string, { title: string; caption: string; hashtags: string[] }> = {
    inspirational: {
      title: 'Monday Message from the Monks',
      caption: 'Before sunrise, the monks of Luang Prabang walk in silence. This week\'s reflection from the alms round: patience is not waiting — it is how you carry yourself while you wait.\n\nA thought for your Monday, from the banks of the Nam Khan.',
      hashtags: ['#TheNamkhan', '#LuangPrabang', '#mindfulness', '#Laos', '#slowtravel'],
    },
    transactional: {
      title: 'Green Season Escape',
      caption: 'The jungle is at its greenest, the river runs full, and our villas are waiting. Book three nights this green season and your farm-to-table dinner under the stars is on us.\n\nDirect bookings only — link in bio.',
      hashtags: ['#TheNamkhan', '#LuangPrabang', '#ecolodge', '#greenseason'],
    },
    wellness: {
      title: 'Riverside Spa Ritual',
      caption: 'Steam rising off the herbal compress, the Nam Khan drifting past the open sala. Our Lao wellness ritual begins with lemongrass and ends with silence.\n\nBook a treatment on arrival — your body will know why.',
      hashtags: ['#TheNamkhan', '#wellness', '#spa', '#LuangPrabang'],
    },
    fnb: {
      title: 'From Our Farm This Morning',
      caption: 'Picked at dawn on our organic eco-farm, on your plate by lunch. This week the kitchen is cooking with river weed, galangal and young tamarind leaves.\n\nFarm-to-table is not a menu line here — it is a distance of two hundred metres.',
      hashtags: ['#TheNamkhan', '#farmtotable', '#LaoFood', '#LuangPrabang'],
    },
    mystique: {
      title: 'Temples Before the Crowds',
      caption: 'POV: you cross the Nam Khan at first light and Wat Xieng Thong is yours alone.\n\nOur guides know the hour the temples breathe quietest.',
      hashtags: ['#LuangPrabang', '#Laos', '#templerun', '#travelasia'],
    },
    community: {
      title: 'Boat Racing Festival Weekend',
      caption: 'The long boats are out training on the Nam Khan — festival season is close. Our team will be on the bank cheering the village crews, and guests are warmly invited to join us.',
      hashtags: ['#LuangPrabang', '#BounSuangHeua', '#Laos'],
    },
    whats_new: {
      title: 'New at The Namkhan',
      caption: 'Our six new glamping tents above the river are now open — canvas, teak and the sound of the Nam Khan below. The eco-farm tour now runs every morning at 9am, and the riverside restaurant has a new green-season tasting menu. Book direct on our website for the best rate.',
      hashtags: [],
    },
  };
  const c = copy[cat] ?? copy.transactional;
  const now = new Date().toISOString();
  return {
    post_id: `sample-${platform}-${n}`,
    property_id: NAMKHAN_PID,
    social_account_id: null,
    platform,
    title: `Sample · ${c.title}`,
    caption: c.caption,
    hashtags: c.hashtags,
    media_urls: [],
    link_url: null,
    scheduled_at: null,
    status: 'draft',
    ai_generated: false,
    ai_notes: program ? `template sample from program ${program.category_code}` : 'template sample',
    push_channel: 'manual',
    external_post_url: null,
    pushed_at: null,
    last_error: null,
    created_by: 'sample_pack',
    created_at: now,
    updated_at: now,
  };
}

export async function POST(req: NextRequest) {
  let body: { to?: string; property_id?: number } = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const to = (body.to ?? DEFAULT_TO).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  const propertyId = Number(body.property_id) || NAMKHAN_PID;

  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }); }

  const [{ data: ruleRows }, { data: programRows }, { data: postRows }] = await Promise.all([
    sb.from('v_social_channel_rules').select('*').eq('property_id', propertyId).eq('active', true).order('platform'),
    sb.from('v_social_programs').select('*').eq('property_id', propertyId).eq('active', true),
    sb.from('v_social_posts').select('*').eq('property_id', propertyId).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(200),
  ]);
  const rules = (ruleRows ?? []) as SocialChannelRule[];
  const programs = (programRows ?? []) as SocialProgram[];
  const posts = (postRows ?? []) as SocialPostRow[];
  if (rules.length === 0) return NextResponse.json({ ok: false, error: 'no_active_channel_rules' }, { status: 404 });

  const sections: string[] = [];
  const summary: Array<{ platform: string; samples: number; formats: number }> = [];

  for (const rule of rules) {
    const real = posts.filter((p) => p.platform === rule.platform).slice(0, 2);
    const chosen: SocialPostRow[] = [...real];
    const chanPrograms = programs.filter((p) => p.platform === rule.platform);
    let n = 0;
    while (chosen.length < 2) {
      chosen.push(sampleFromProgram(rule.platform, chanPrograms[n % Math.max(1, chanPrograms.length)], n + 1));
      n += 1;
    }
    const formats = (rule.formats ?? []).map((f) => parseFormat(f));

    const postBlocks = chosen.map((post, i) => {
      const fp = formatPostForChannel(post, rule);
      const over = rule.caption_max_chars != null && fp.charCount > rule.caption_max_chars;
      const formatRows = formats.map((f) =>
        `<tr><td style="padding:3px 10px 3px 0;color:#5A5A5A;font-size:12px">${esc(f.name)}</td>` +
        `<td style="padding:3px 10px 3px 0;color:#1B1B1B;font-size:12px">${esc(f.ratio ?? '—')}</td>` +
        `<td style="padding:3px 0;color:#1B1B1B;font-size:12px">${f.width && f.height ? `${f.width}×${f.height}px` : '—'}</td></tr>`
      ).join('');
      return `
        <div style="background:#FFFFFF;border:1px solid #E6DFCC;border-radius:6px;padding:14px 16px;margin:0 0 10px">
          <div style="font-size:13px;font-weight:600;color:#1B1B1B;margin-bottom:2px">Post ${i + 1} · ${esc(post.title ?? '(untitled)')}</div>
          <div style="font-size:10px;color:#8A8A8A;margin-bottom:8px">${post.post_id.startsWith('sample-') ? 'template sample from channel program' : `from marketing.social_posts · status ${esc(post.status)}`}</div>
          <div style="font-size:13px;color:#3A3A3A;white-space:pre-wrap;border-left:3px solid #084838;padding-left:10px;margin-bottom:8px">${esc(fp.text)}</div>
          <div style="font-size:11px;color:${over ? '#B04A2F' : '#5A5A5A'};margin-bottom:8px">
            ${fp.charCount}/${rule.caption_max_chars ?? '∞'} chars${over ? ' — OVER LIMIT' : ' ✓'} ·
            ${rule.hashtags_allowed ? `${fp.hashtags.length}/${rule.hashtag_max ?? '—'} hashtags` : 'hashtags not allowed'}
          </div>
          <table style="border-collapse:collapse"><tr>
            <th style="text-align:left;padding:0 10px 3px 0;font-size:10px;color:#8A8A8A;text-transform:uppercase;letter-spacing:.06em">format</th>
            <th style="text-align:left;padding:0 10px 3px 0;font-size:10px;color:#8A8A8A;text-transform:uppercase;letter-spacing:.06em">ratio</th>
            <th style="text-align:left;padding:0 0 3px;font-size:10px;color:#8A8A8A;text-transform:uppercase;letter-spacing:.06em">export size</th>
          </tr>${formatRows}</table>
        </div>`;
    }).join('');

    sections.push(`
      <h2 style="color:#084838;font-size:16px;margin:22px 0 4px">${esc(rule.platform.replace(/_/g, ' ').toUpperCase())}</h2>
      <div style="font-size:11px;color:#5A5A5A;margin-bottom:10px">
        guardrails: caption ≤ ${rule.caption_max_chars ?? '—'} chars ·
        ${rule.hashtags_allowed ? `≤ ${rule.hashtag_max ?? '—'} hashtags` : 'no hashtags'} ·
        ${esc(rule.posting_frequency ?? '')}
      </div>
      ${postBlocks}`);
    summary.push({ platform: rule.platform, samples: chosen.length, formats: formats.length });
  }

  const html = `
    <h1 style="color:#084838;font-size:20px;margin:0 0 4px">Social module · sample pack</h1>
    <p style="font-size:12px;color:#5A5A5A;margin:0 0 4px">
      2 posts per active channel, validated against the per-channel guardrails in
      /settings/property/social_rules, with every export format and size listed per channel.
      Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · The Namkhan (260955).
    </p>
    ${sections.join('')}`;

  const edge = await sb.functions.invoke('send-report-email', {
    body: {
      to,
      subject: `Social module · sample pack — 2 posts per channel & format (Namkhan)`,
      html,
      from_label: 'The Namkhan · Social',
    },
  });
  if (edge.error) return NextResponse.json({ ok: false, error: edge.error.message }, { status: 502 });

  return NextResponse.json({ ok: true, sent_to: to, channels: summary });
}
