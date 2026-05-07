// lib/chat/mediaSearchTrigger.ts
// ticket #114 — pre-LLM routing: intercept media-search messages BEFORE the LLM call
//
// Usage in chat orchestrator (app/api/cockpit/chat/route.ts or equivalent):
//
//   import { isMediaSearchMessage, runMediaSearch } from '@/lib/chat/mediaSearchTrigger';
//
//   // BEFORE the LLM call:
//   if (isMediaSearchMessage(message)) {
//     return NextResponse.json(await runMediaSearch(message, requestedBy));
//   }

export const MEDIA_SEARCH_PATTERNS: RegExp[] = [
  // Explicit photo/video/reel searches
  /\b(show|find|search|look for|get|fetch|display)\b.{0,40}\b(photo|photos|image|images|pic|pics|picture|pictures|video|videos|reel|reels|shot|shots|asset|assets)\b/i,
  // Media-adjacent noun phrases
  /\b(photo|image|picture|shot|reel|video|thumbnail|asset)s?\s+(of|from|with|for|showing|featuring)\b/i,
  // Explicit "media" keyword
  /\bmedia\s+(search|librar|asset|for|of|with|from)\b/i,
  // "hero shots", "pool photos", "kayak[ing] photos" etc.
  /\b(hero|pool|kayak|kayaking|sunset|sunrise|jungle|river|elephant|hippo|hippopotamus|wildlife|nature|activity|activities|aerial|drone)\s+(photo|image|shot|reel|video|asset)s?\b/i,
  /\b(photo|image|shot|reel|video|asset)s?\s+(of|for|showing|featuring)\s+(kayak|kayaking|sunset|sunrise|pool|jungle|river|elephant|hippo|hippopotamus|wildlife|nature|activity)\b/i,
  // "5 pool hero shots" style count queries
  /\b\d+\s+(photo|image|reel|video|shot|asset)s?\b/i,
  // TikTok / Instagram / OTA channel specifics
  /\b(tiktok|instagram|ota|facebook|youtube)\b.{0,60}\b(photo|image|reel|video|asset|shot)s?\b/i,
  /\b(photo|image|reel|video|asset|shot)s?\b.{0,60}\b(tiktok|instagram|ota|facebook|youtube)\b/i,
  // Exclusion filter hints ("no children", "no guests")
  /\b(without|no|exclude|excluding)\s+(child|children|kid|kids|guest|guests|people|person)\b/i,
];

/**
 * Returns true if the message matches any media-search pattern.
 * Called BEFORE the LLM in the chat orchestrator to avoid unnecessary LLM spend.
 */
export function isMediaSearchMessage(message: string): boolean {
  const trimmed = message.trim();
  return MEDIA_SEARCH_PATTERNS.some((re) => re.test(trimmed));
}

/**
 * Calls the /api/cockpit/chat/media-search endpoint and returns its JSON payload.
 * The orchestrator should return this directly as the chat response.
 */
export async function runMediaSearch(
  message: string,
  requestedBy: string = 'cockpit_chat'
): Promise<{
  results: unknown[];
  count: number;
  parsed_intent: Record<string, unknown>;
  _routed_by: string;
}> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const res = await fetch(`${baseUrl}/api/cockpit/chat/media-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, requested_by: requestedBy }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`media-search route error ${res.status}: ${text}`);
  }

  const payload = (await res.json()) as {
    results: unknown[];
    count: number;
    parsed_intent: Record<string, unknown>;
  };

  return { ...payload, _routed_by: 'mediaSearchTrigger/pre-llm' };
}
