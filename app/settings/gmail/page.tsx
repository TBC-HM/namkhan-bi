// app/settings/gmail/page.tsx
// Per-user Gmail connection settings. Reads from bridge view
// public.v_user_gmail_connections (no tokens exposed).
// Guardrail: only @thenamkhan.com Google accounts can connect
// (enforced inside fn_gmail_connect_finalize).
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import GmailSettingsClient from './_client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function currentUser(): Promise<{ id: string; email: string } | null> {
  const jar = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })), setAll: () => {} } },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.id || !user?.email) return null;
  return { id: user.id, email: user.email };
}

export default async function GmailSettingsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = (await searchParams) ?? {};
  const cur = await currentUser();

  const WHITE = '#FFFFFF', HAIR = '#E6DFCC', INK = '#1B1B1B', INK_M = '#5A5A5A', FOREST = '#084838', CREAM = '#F5F0E1', RED = '#B03826';

  if (!cur) {
    return (
      <main style={{ maxWidth: 720, margin: '48px auto', padding: 24, background: WHITE, color: INK, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>Gmail</h1>
        <p style={{ fontSize: 13, color: INK_M }}>You need to be signed in. <a href="/login" style={{ color: FOREST }}>Sign in</a>.</p>
      </main>
    );
  }

  const admin = getSupabaseAdmin();
  const { data: conn } = await admin
    .from('v_user_gmail_connections')
    .select('gmail_address, connected_at, active, expires_at, scope')
    .eq('user_id', cur.id)
    .eq('active', true)
    .maybeSingle();

  const banner = (() => {
    if (params.connected === '1') return { tone: 'ok' as const, text: 'Gmail connected successfully.' };
    if (params.error) {
      const err = String(params.error);
      const detail = params.detail ? ' — ' + decodeURIComponent(String(params.detail)) : '';
      if (err === 'domain_not_allowed') return { tone: 'err' as const, text: 'Only @thenamkhan.com Google accounts can connect.' };
      return { tone: 'err' as const, text: 'Connect failed: ' + err + detail };
    }
    return null;
  })();

  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: 24, background: WHITE, color: INK, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: INK_M }}>Settings · Personal</div>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: '4px 0 0' }}>Gmail</h1>
        <p style={{ fontSize: 13, color: INK_M, margin: '4px 0 0' }}>Connect your @thenamkhan.com Google account to see your inbox in the top nav and send email from inside the app.</p>
      </div>

      {banner && (
        <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 6, background: banner.tone === 'ok' ? '#EDF7F1' : '#FCEDEA', border: '1px solid ' + (banner.tone === 'ok' ? FOREST : RED), color: banner.tone === 'ok' ? FOREST : RED, fontSize: 13 }}>
          {banner.text}
        </div>
      )}

      {conn?.active ? (
        <GmailSettingsClient
          state="connected"
          gmailAddress={conn.gmail_address as string}
          connectedAt={conn.connected_at as string}
        />
      ) : (
        <GmailSettingsClient state="disconnected" />
      )}

      <div style={{ marginTop: 24, padding: 12, background: CREAM, border: '1px solid ' + HAIR, borderRadius: 6, fontSize: 12, color: INK_M }}>
        <strong style={{ color: INK }}>Guardrail:</strong> Only @thenamkhan.com Google accounts can connect. Personal Gmail (@gmail.com) or other domains will be rejected by the server.
      </div>
    </main>
  );
}
