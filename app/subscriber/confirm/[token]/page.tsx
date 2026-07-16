// app/subscriber/confirm/[token]/page.tsx
// Public opt-in confirmation. Calls public.fn_subscriber_confirm which sets
// opted_in_at = now() and returns { ok, email }. Shows a paper-white thank-you.
// This route MUST be listed in middleware PUBLIC_PATHS.
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const PAPER = '#FFFFFF';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const BRAND = '#084838';
const HAIRLINE = '#E6DFCC';
const RED = '#B04A2F';

interface Params { params: Promise<{ token: string }> }

export default async function ConfirmPage({ params }: Params) {
  const { token } = await params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const sb = createClient(url, anon, { auth: { persistSession: false } });

  const { data, error } = await sb.rpc('fn_subscriber_confirm', { p_token: token });

  const result = data as { ok?: boolean; email?: string; error?: string } | null;
  const ok = !error && result?.ok === true;
  const email = result?.email ?? null;

  return (
    <html lang="en">
      <body style={{ margin: 0, background: PAPER, fontFamily: 'Georgia, serif', color: INK, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: 'center', border: '1px solid ' + HAIRLINE, borderRadius: 6, padding: 32, background: PAPER }}>
          {ok ? (
            <>
              <div style={{ fontSize: 40, color: BRAND, marginBottom: 12 }}>✓</div>
              <h1 style={{ fontSize: 20, margin: '0 0 8px 0', color: INK }}>You&apos;re on the list</h1>
              {email && <p style={{ fontSize: 13, color: INK_SOFT, margin: '0 0 16px 0' }}>Confirmed: <code>{email}</code></p>}
              <p style={{ fontSize: 14, color: INK, lineHeight: 1.5, margin: 0 }}>
                Thank you. We&apos;ll send occasional stories from the Namkhan — never too often, always worth reading.
              </p>
              <p style={{ fontSize: 12, color: INK_SOFT, marginTop: 20 }}>You can unsubscribe from any future email in one click.</p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 40, color: RED, marginBottom: 12 }}>×</div>
              <h1 style={{ fontSize: 20, margin: '0 0 8px 0', color: INK }}>Link expired or invalid</h1>
              <p style={{ fontSize: 13, color: INK_SOFT, margin: '0 0 16px 0' }}>
                {result?.error === 'invalid_or_expired_token'
                  ? 'This confirmation link is not valid. It may already have been used.'
                  : 'Something went wrong. If you meant to subscribe, please write to us directly.'}
              </p>
              <p style={{ fontSize: 12, color: INK_SOFT }}>hello@thenamkhan.com</p>
            </>
          )}
        </div>
      </body>
    </html>
  );
}
