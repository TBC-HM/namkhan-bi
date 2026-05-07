/**
 * Unified cockpit chat POST handler.
 *
 * Pre-LLM intercept (ticket #157): messages matching media-search trigger
 * patterns are short-circuited to /api/cockpit/chat/media-search BEFORE
 * the Anthropic call, returning a structured MediaSearchResults payload
 * instead of a text completion.
 *
 * Assumption: the original orchestrator file lives at this path
 * (app/api/cockpit/chat/route.ts) per KB #291 unified_chat_protocol_v1.
 * If this file already existed with custom logic, PBS should merge the
 * MEDIA_SEARCH_TRIGGER block and the mediaSearchIntercept() call into
 * the existing handler rather than replacing it wholesale.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ═══ MEDIA SEARCH TRIGGER PATTERNS (ticket #157) ═══
// Intercept BEFORE LLM call. Extend this list as new patterns emerge.
const MEDIA_SEARCH_TRIGGERS = [
  /\b(show|find|search|get|display|give me)\b.*\b(photo|photos|image|images|picture|pictures|reel|reels|video|videos|media|asset|assets)\b/i,
  /\b(photo|photos|image|images|picture|pictures|reel|reels|video|videos)\b.*\b(of|from|showing|featuring|with|for)\b/i,
  /\b(kayak|kayaking|sunset|pool|hero shot|hero shots|landscape|portrait|aerial|drone)\b.*\b(photo|photos|image|images|reel|reels|video|videos|media)\b/i,
  /\b(media|asset|assets)\b.*\b(for|channel|tikTok|tiktok|instagram|facebook|website|email)\b/i,
  /^(show me|find me|search for|look for|get me)\s+\d*\s*(photo|image|reel|video|media)/i,
];

function isMediaSearchMessage(message: string): boolean {
  return MEDIA_SEARCH_TRIGGERS.some((re) => re.test(message));
}

async function mediaSearchIntercept(
  message: string,
  requestedBy: string,
  origin: string
): Promise<NextResponse> {
  const res = await fetch(`${origin}/api/cockpit/chat/media-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_message: message, p_requested_by: requestedBy }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: `media-search RPC failed: ${err}` },
      { status: res.status }
    );
  }

  const payload = await res.json() as unknown;
  // Wrap in a chat-compatible envelope so the client knows to render
  // MediaSearchResults instead of a text bubble.
  return NextResponse.json({
    type: 'media_search',
    payload,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      message?: string;
      requested_by?: string;
      current_page_url?: string;
      [key: string]: unknown;
    };

    const message = body.message ?? '';
    const requestedBy = body.requested_by ?? 'cockpit_chat';
    const origin = req.nextUrl.origin;

    // ── PRE-LLM INTERCEPT ────────────────────────────────────────────────
    if (isMediaSearchMessage(message)) {
      return await mediaSearchIntercept(message, requestedBy, origin);
    }
    // ─────────────────────────────────────────────────────────────────────

    // TODO: existing LLM orchestration continues here unchanged.
    // This stub returns a placeholder so the route compiles; merge with
    // the real Anthropic/Claude call that existed before ticket #157.
    return NextResponse.json({
      type: 'text',
      content: '[chat orchestrator stub — merge with existing LLM logic]',
      message_echo: message,
    });
  } catch (err) {
    console.error('[chat] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
