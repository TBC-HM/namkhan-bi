#!/usr/bin/env node
/**
 * Claude session context loader (SessionStart hook)
 * Prints platform version + constitution via public.fn_claude_digest()
 * Never throws on missing env (graceful fallback)
 */

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('[claude-session-context] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — skipping context load');
    return;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fn_claude_digest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      console.log(`[claude-session-context] fn_claude_digest returned ${res.status} — context unavailable`);
      return;
    }

    const digest = await res.json();
    console.log('\n=== PLATFORM CONTEXT ===');
    console.log(digest);
    console.log('========================\n');
  } catch (err) {
    console.log('[claude-session-context] Failed to load context:', err.message);
  }
}

main().catch(err => {
  console.log('[claude-session-context] Unexpected error:', err.message);
});
