// lib/social-export.ts
// spec-social-media-module (2026-07-25, run 3) · A5 — channel-correct post
// formatting shared by the zip-export route and the sample-pack email route.
// Pure functions only (no supabase import): input = a post row + its channel
// rule from marketing.social_channel_rules; output = ready-to-upload text plus
// validation warnings. Formats live on the rule as strings like
// "feed 1:1 1080x1080" (seeded run 1) — parsed here for filenames + meta.

import type { SocialChannelRule } from '@/lib/marketing';
import type { SocialPostRow } from '@/lib/marketing-social';

export interface FormattedPost {
  /** caption body exactly as it should be pasted into the channel */
  text: string;
  /** hashtags actually included (rule-capped; empty when channel forbids them) */
  hashtags: string[];
  charCount: number;
  warnings: string[];
}

export interface ParsedFormat {
  raw: string;          // "feed 1:1 1080x1080"
  name: string;         // "feed"
  ratio: string | null; // "1:1"
  width: number | null;
  height: number | null;
}

/** "reel 9:16 1080x1920" → { name, ratio, width, height } (all parts optional). */
export function parseFormat(raw: string): ParsedFormat {
  const out: ParsedFormat = { raw, name: raw.trim(), ratio: null, width: null, height: null };
  const dims = raw.match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/i);
  if (dims) { out.width = Number(dims[1]); out.height = Number(dims[2]); }
  const ratio = raw.match(/(\d{1,2}(?:\.\d+)?):(\d{1,2}(?:\.\d+)?)/);
  if (ratio) out.ratio = `${ratio[1]}:${ratio[2]}`;
  const name = raw.trim().split(/\s+/)[0];
  if (name) out.name = name.toLowerCase();
  return out;
}

/**
 * Apply the channel guardrails to a post: hashtag policy (allowed / max count),
 * caption length check. Never silently truncates the caption — an over-limit
 * caption is exported in full with an explicit warning so a human fixes copy,
 * not the pipeline (guardrails are editable in /settings/property/social_rules).
 */
export function formatPostForChannel(post: SocialPostRow, rule: SocialChannelRule | undefined): FormattedPost {
  const warnings: string[] = [];
  const caption = (post.caption ?? '').trim();

  let tags: string[] = Array.isArray(post.hashtags) ? post.hashtags.filter(Boolean) : [];
  if (rule && !rule.hashtags_allowed) {
    if (tags.length > 0) warnings.push(`${post.platform}: hashtags not allowed on this channel — ${tags.length} dropped`);
    tags = [];
  } else if (rule?.hashtag_max != null && tags.length > rule.hashtag_max) {
    warnings.push(`${post.platform}: ${tags.length} hashtags > channel max ${rule.hashtag_max} — trimmed`);
    tags = tags.slice(0, rule.hashtag_max);
  }
  tags = tags.map((t) => (t.startsWith('#') ? t : `#${t}`));

  const parts = [caption];
  if (tags.length > 0) parts.push(tags.join(' '));
  if (post.link_url) parts.push(post.link_url);
  const text = parts.filter(Boolean).join('\n\n');

  const charCount = text.length;
  if (rule?.caption_max_chars != null && charCount > rule.caption_max_chars) {
    warnings.push(`${post.platform}: caption+tags ${charCount} chars OVER channel limit ${rule.caption_max_chars} — shorten before posting`);
  }
  if (rule && Array.isArray(rule.banned_topics)) {
    const lower = text.toLowerCase();
    for (const topic of rule.banned_topics) {
      if (topic && lower.includes(String(topic).toLowerCase())) {
        warnings.push(`${post.platform}: caption mentions banned topic "${topic}"`);
      }
    }
  }
  return { text, hashtags: tags, charCount, warnings };
}

/** Filesystem-safe slug for zip folder names. */
export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'post';
}

/** `instagram/2026-07-27_monday-message` — one folder per post inside the zip. */
export function postFolderName(post: SocialPostRow): string {
  const date = (post.scheduled_at ?? post.created_at ?? '').slice(0, 10) || 'undated';
  return `${post.platform}/${date}_${slugify(post.title ?? post.post_id.slice(0, 8))}`;
}

/** caption.txt body: the paste-ready text plus a spec footer for the operator. */
export function captionFileBody(post: SocialPostRow, rule: SocialChannelRule | undefined, fp: FormattedPost): string {
  const lines = [fp.text, '', '---', `channel: ${post.platform}`];
  if (rule?.caption_max_chars != null) lines.push(`caption limit: ${fp.charCount}/${rule.caption_max_chars} chars${fp.charCount > rule.caption_max_chars ? ' ⚠ OVER' : ''}`);
  if (rule) lines.push(rule.hashtags_allowed ? `hashtags: ${fp.hashtags.length}/${rule.hashtag_max ?? '—'}` : 'hashtags: not allowed on this channel');
  const formats = (rule?.formats ?? []).map((f) => parseFormat(f));
  if (formats.length > 0) {
    lines.push('media formats for this channel:');
    for (const f of formats) lines.push(`  - ${f.name}${f.ratio ? ` ${f.ratio}` : ''}${f.width && f.height ? ` ${f.width}x${f.height}px` : ''}`);
  }
  if (post.scheduled_at) lines.push(`target publish: ${post.scheduled_at}`);
  return lines.join('\n') + '\n';
}

/** meta.json body — machine-readable sidecar per exported post. */
export function metaFileBody(post: SocialPostRow, rule: SocialChannelRule | undefined, fp: FormattedPost): string {
  return JSON.stringify({
    post_id: post.post_id,
    property_id: post.property_id,
    platform: post.platform,
    title: post.title,
    status: post.status,
    scheduled_at: post.scheduled_at,
    caption_chars: fp.charCount,
    caption_limit: rule?.caption_max_chars ?? null,
    hashtags: fp.hashtags,
    link_url: post.link_url,
    media_urls: post.media_urls ?? [],
    formats: (rule?.formats ?? []).map((f) => parseFormat(f)),
    warnings: fp.warnings,
  }, null, 2) + '\n';
}
