// app/api/marketing/youtube/generate-title-proposals/route.ts
// PBS 2026-07-12 — Lens 12-month title-proposal generator for a playlist.
// Reads playlist metadata + linked pillar (if any) + recent playlist videos
// + brand vocab matrix + reality profile + best-length signal, calls
// Anthropic to propose 36 titles (3 per month × 12 months, starting from the
// month after now), persists via fn_yt_title_proposals_upsert.
//
// Prompt shape mirrors app/api/marketing/youtube/audit-run/route.ts — same Lens
// persona, same strict-JSON contract, same vocabulary-matrix guardrail.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import {
  fetchChannelPlaylists,
  fetchPlaylistItemsWithStats,
  isErr,
} from '@/lib/youtube/data';
import {
  callAnthropic,
  isLlmOk,
  extractJsonBlock,
  ok,
  err,
} from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const NAMKHAN = 260955;

const LENGTH_BUCKETS = ['0-30s', '30-60s', '1-3min', '3-8min', '8min+'] as const;
type LengthBucket = typeof LENGTH_BUCKETS[number];

interface ProposalOut {
  scheduled_month:        string;   // YYYY-MM-01
  rank:                   number;   // 1..3
  proposed_title:         string;   // <=60 chars
  proposed_angle:         string;   // <=200 chars
  proposed_length_bucket: LengthBucket;
}
interface LlmResp {
  proposals: ProposalOut[];
}

function durationToSeconds(iso: string | undefined): number {
  if (!iso) return 0;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}
function bucketFor(sec: number): LengthBucket {
  if (sec <= 30)  return '0-30s';
  if (sec <= 60)  return '30-60s';
  if (sec <= 180) return '1-3min';
  if (sec <= 480) return '3-8min';
  return '8min+';
}
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
function firstOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const playlistId = String((body as { playlist_id?: string }).playlist_id ?? '').trim();
  if (!playlistId) return err('playlist_id_required', 400);

  const sb = getSupabaseAdmin();

  const tok = await getFreshAccessToken(NAMKHAN);
  if (!tok.ok || !tok.access_token || !tok.channel_id) {
    return err('token_unavailable', 400, { detail: tok.error ?? 'unknown' });
  }

  // === 1) Playlist metadata + items ===
  const [plMetaRes, plItemsRes] = await Promise.all([
    fetchChannelPlaylists(tok.access_token, tok.channel_id, 50),
    fetchPlaylistItemsWithStats(tok.access_token, playlistId, 50),
  ]);
  if (isErr(plMetaRes)) return err('playlist_meta_fetch_failed', 502, { detail: plMetaRes.error });
  if (isErr(plItemsRes)) return err('playlist_items_fetch_failed', 502, { detail: plItemsRes.error });
  const playlist = plMetaRes.data.find((p) => p.id === playlistId) ?? null;
  const videos = plItemsRes.data;

  // === 2) Brand context — vocab + pillars + reality ===
  const [vocabRes, pillarsRes, realityRes] = await Promise.all([
    sb.from('v_yt_vocabulary_matrix').select('banned_term_lower,luxury_alternative,severity').limit(50),
    sb.from('v_yt_content_pillars')
      .select('pillar_key,label,description,target_cadence,youtube_playlist_id')
      .eq('property_id', NAMKHAN).eq('active', true).order('sort_order'),
    sb.from('v_reality_profile').select('*').eq('property_id', NAMKHAN).maybeSingle(),
  ]);
  const vocab = (vocabRes.data ?? []) as Array<{ banned_term_lower: string; luxury_alternative: string; severity: string }>;
  const pillars = (pillarsRes.data ?? []) as Array<{ pillar_key: string; label: string; description: string | null; target_cadence: string | null; youtube_playlist_id: string | null }>;
  const reality = (realityRes.data ?? null) as Record<string, unknown> | null;

  const linkedPillar = pillars.find((p) => p.youtube_playlist_id === playlistId) ?? null;
  const cadence = linkedPillar?.target_cadence ?? 'monthly';

  // === 3) Best-length signal on THIS playlist (guide LLM's length distribution) ===
  const bucketMedians = new Map<LengthBucket, { views: number; n: number }>();
  for (const v of videos) {
    const sec = durationToSeconds(v.duration);
    const b = bucketFor(sec);
    const cur = bucketMedians.get(b) ?? { views: 0, n: 0 };
    cur.views += v.views ?? 0;
    cur.n += 1;
    bucketMedians.set(b, cur);
  }
  const bucketStats: Array<{ bucket: LengthBucket; median_views: number; sample: number }> = [];
  for (const b of LENGTH_BUCKETS) {
    const arr = videos.filter((v) => bucketFor(durationToSeconds(v.duration)) === b).map((v) => v.views ?? 0);
    bucketStats.push({ bucket: b, median_views: median(arr), sample: arr.length });
  }
  const bestBucket = [...bucketStats].sort((a, b) => (b.median_views - a.median_views) || (b.sample - a.sample))[0];

  // === 4) Build the 12-month window (next month → +12) ===
  const start = addMonths(firstOfMonth(new Date()), 1);
  const months: string[] = [];
  for (let i = 0; i < 12; i++) months.push(toIsoDate(addMonths(start, i)));

  const recentTitles = videos.slice(0, 20).map((v) => v.title).filter(Boolean);
  const bannedList = vocab.slice(0, 40)
    .map((r) => `  • "${r.banned_term_lower}" → "${r.luxury_alternative}" (${r.severity})`).join('\n');
  const pillarList = pillars
    .map((p) => `  • ${p.label} (${p.target_cadence ?? 'ad hoc'})${p.youtube_playlist_id === playlistId ? ' ← THIS PLAYLIST' : ''}`)
    .join('\n');
  const bucketList = bucketStats
    .map((b) => `  • ${b.bucket}: median ${b.median_views.toLocaleString()} views over ${b.sample} sample`).join('\n');

  // === 5) Prompt ===
  const systemPrompt = [
    'You are Lens, YouTube programming director for Namkhan — a 24-room boutique river-lodge in Luang Prabang, Laos, at the Nam Khan / Mekong confluence. Small Luxury Hotels member.',
    'Voice: quiet, sensory, culture-first. Never party/casino/megaresort/luxe-hype language.',
    'Job: produce a 12-month editorial calendar of video title ideas for ONE specific playlist. 3 proposals per month × 12 months = exactly 36 proposals.',
    'You MUST respect the brand vocabulary matrix — never use banned terms in titles or angles.',
    '',
    'BRAND REALITY:',
    reality?.location ? `  Location: ${reality.location}` : '',
    Array.isArray(reality?.palette) && reality.palette.length ? `  Palette: ${(reality.palette as string[]).join(', ')}` : '',
    Array.isArray(reality?.architecture) && reality.architecture.length ? `  Architecture: ${(reality.architecture as string[]).join(', ')}` : '',
    Array.isArray(reality?.forbidden) && reality.forbidden.length ? `  Forbidden concepts: ${(reality.forbidden as string[]).join(', ')}` : '',
    '',
    'CONTENT PILLARS (Namkhan-native series):',
    pillarList || '  (none defined yet)',
    '',
    'VOCABULARY MATRIX (top 40 banned → luxury alternative, severity):',
    bannedList || '  (empty)',
    '',
    'BEST-LENGTH SIGNAL on this playlist (median views by duration bucket):',
    bucketList,
    `  Best-performing bucket so far: ${bestBucket?.bucket ?? 'n/a'} (weight new proposals toward this and adjacent buckets).`,
    '',
    'Return ONLY a valid JSON object with this exact shape (no markdown fences, no prose):',
    '{',
    '  "proposals": [',
    '    {',
    '      "scheduled_month": "YYYY-MM-01",',
    '      "rank": 1,',
    '      "proposed_title": "<=60 chars",',
    '      "proposed_angle": "<=200 chars — one-sentence editorial angle explaining WHY this video, WHAT viewer feels, HOW it opens",',
    '      "proposed_length_bucket": "0-30s|30-60s|1-3min|3-8min|8min+"',
    '    }',
    '  ]',
    '}',
    'Rules:',
    '- Emit exactly 36 proposals. 3 per month, ranks 1..3 within each month.',
    '- Use ONLY the 12 scheduled_month values I list in the user prompt.',
    '- Do not repeat titles or angles. Do not use banned vocabulary.',
    '- Length bucket must be one of: 0-30s, 30-60s, 1-3min, 3-8min, 8min+.',
    '- Titles are lowercase-friendly and sensory; do not overuse ALL CAPS or clickbait "!".',
  ].filter(Boolean).join('\n');

  const userPrompt = [
    `PLAYLIST: ${playlist?.title ?? '(unknown title)'} · ${videos.length} videos.`,
    playlist?.description ? `DESCRIPTION: ${playlist.description.slice(0, 400)}` : '',
    linkedPillar
      ? `LINKED PILLAR: ${linkedPillar.label} (cadence: ${cadence}). Description: ${linkedPillar.description ?? '(none)'}`
      : `NO LINKED PILLAR. Default cadence: ${cadence}. Choose whichever pillar the current videos best resemble; explain in the angle.`,
    '',
    'RECENT VIDEO TITLES IN THIS PLAYLIST (for tone reference):',
    recentTitles.length ? recentTitles.map((t) => `  • ${t}`).join('\n') : '  (playlist empty)',
    '',
    'SCHEDULED MONTHS (use exactly these values):',
    months.map((m) => `  • ${m}`).join('\n'),
    '',
    'Emit the JSON now. 36 proposals total.',
  ].filter(Boolean).join('\n');

  // === 6) Anthropic call ===
  const llm = await callAnthropic({ systemPrompt, userPrompt, maxTokens: 8000 });
  if (!isLlmOk(llm)) return err(llm.error, 502, { detail: (llm as { detail?: string }).detail });

  const parsed = extractJsonBlock<LlmResp>(llm.text);
  if (!parsed || !Array.isArray(parsed.proposals) || parsed.proposals.length === 0) {
    return err('llm_bad_shape', 502, { raw_head: llm.text.slice(0, 400) });
  }

  // Normalise + clamp to the 12 allowed months, ranks 1..3.
  const allowedMonths = new Set(months);
  const rows = parsed.proposals
    .filter((p) => p && typeof p.proposed_title === 'string' && p.proposed_title.trim().length > 0)
    .map((p) => ({
      scheduled_month:        allowedMonths.has(String(p.scheduled_month ?? '')) ? String(p.scheduled_month) : months[0],
      rank:                   [1, 2, 3].includes(Number(p.rank)) ? Number(p.rank) : 1,
      proposed_title:         String(p.proposed_title).slice(0, 200).trim(),
      proposed_angle:         (p.proposed_angle ?? '').toString().slice(0, 500).trim(),
      proposed_length_bucket: (LENGTH_BUCKETS as readonly string[]).includes(String(p.proposed_length_bucket))
                                ? String(p.proposed_length_bucket)
                                : (bestBucket?.bucket ?? '1-3min'),
    }))
    .slice(0, 60);   // hard cap in case the model over-produces

  // === 7) Persist via SECURITY DEFINER RPC ===
  const { data: inserted, error: rpcErr } = await sb.rpc('fn_yt_title_proposals_upsert', {
    p_property_id: NAMKHAN,
    p_playlist_id: playlistId,
    p_pillar_key:  linkedPillar?.pillar_key ?? null,
    p_proposals:   rows,
  });
  if (rpcErr) return err('proposals_persist_failed', 500, { detail: rpcErr.message });

  return ok({
    playlist_id:  playlistId,
    inserted:     Number(inserted ?? rows.length),
    best_bucket:  bestBucket?.bucket ?? null,
    cadence,
    months,
    sample:       rows.slice(0, 3),   // small echo so caller can eyeball shape
  });
}
