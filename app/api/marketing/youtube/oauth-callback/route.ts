// app/api/marketing/youtube/oauth-callback/route.ts
// PBS 2026-07-11 pm — Google returns here after user grants consent.
// Uses public.fn_yt_* RPCs (SECURITY DEFINER) for all writes, per PostgREST
// public-only exposure rule.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REDIRECT_URI = 'https://namkhan-bi.vercel.app/api/marketing/youtube/oauth-callback';
const APP_ROOT     = 'https://namkhan-bi.vercel.app';

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface ChannelResponse {
  items?: Array<{
    id: string;
    snippet?: { title?: string; customUrl?: string };
    statistics?: { subscriberCount?: string };
  }>;
  error?: { message?: string };
}

interface PendingRow {
  id: string;
  property_id: number;
  pkce_verifier: string;
}

function fail(msg: string, detail?: string) {
  const u = new URL(`${APP_ROOT}/marketing/youtube`);
  u.searchParams.set('connected', '0');
  u.searchParams.set('err', msg);
  if (detail) u.searchParams.set('detail', detail.slice(0, 200));
  return NextResponse.redirect(u.toString(), 302);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errParam = url.searchParams.get('error');

  if (errParam) return fail('google_denied', errParam);
  if (!code || !state) return fail('missing_code_or_state');

  const sb = getSupabaseAdmin();

  // 1. Look up pending row via SECURITY DEFINER RPC
  const { data: pendingRows, error: pendErr } = await sb.rpc('fn_yt_lookup_pending', { p_state: state });
  if (pendErr) return fail('lookup_failed', pendErr.message);

  const pending: PendingRow | null = Array.isArray(pendingRows) && pendingRows.length > 0
    ? pendingRows[0] as PendingRow
    : null;
  if (!pending || !pending.pkce_verifier) return fail('unknown_state');

  // 2. Fetch OAuth client credentials from vault
  const [{ data: cid }, { data: csec }] = await Promise.all([
    sb.rpc('fn_get_secret', { p_name: 'YOUTUBE_OAUTH_CLIENT_ID' }),
    sb.rpc('fn_get_secret', { p_name: 'YOUTUBE_OAUTH_CLIENT_SECRET' }),
  ]);
  if (!cid || !csec) return fail('vault_missing_credentials');

  const clientId     = String(cid).trim();
  const clientSecret = String(csec).trim();

  // 3. Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
      code_verifier: pending.pkce_verifier,
    }).toString(),
  });
  const tokens = (await tokenRes.json()) as TokenResponse;
  if (!tokenRes.ok || !tokens.access_token) {
    return fail('token_exchange_failed', tokens.error_description ?? tokens.error ?? String(tokenRes.status));
  }

  // 4. Fetch channel meta. PBS 2026-07-11 pm: prefer the Namkhan brand channel by ID,
  // falling back to mine=true. Google's mine=true returns the primary personal channel
  // (Paul Bauer) even when the user has brand-account manager access to Namkhan.
  const NAMKHAN_CHANNEL_ID = 'UCnOK4wDxsEs5VKXGH3EkOmw';
  const property_id_num = Number(state_row?.property_id ?? propertyId);
  const preferredId = property_id_num === 260955 ? NAMKHAN_CHANNEL_ID : null;

  let chItem: ChannelResponse['items'][number] | undefined = undefined;

  if (preferredId) {
    const preferRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=' + preferredId,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    const preferData = (await preferRes.json()) as ChannelResponse;
    if (preferRes.ok && preferData.items?.length) {
      chItem = preferData.items[0];
    }
  }

  if (!chItem) {
    const chRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    const ch = (await chRes.json()) as ChannelResponse;
    if (!chRes.ok || !ch.items?.length) {
      return fail('channel_meta_failed', ch.error?.message ?? String(chRes.status));
    }
    chItem = ch.items[0];
  }
  const chId    = chItem.id;
  const chTitle = chItem.snippet?.title ?? null;
  const chHandle = chItem.snippet?.customUrl ?? null;
  const subs    = chItem.statistics?.subscriberCount ? Number(chItem.statistics.subscriberCount) : null;

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  // 5. Persist via vault-upsert RPC (already SECURITY DEFINER)
  const { data: rpcData, error: rpcErr } = await sb.rpc('fn_vault_upsert_youtube_tokens', {
    p_property_id:      pending.property_id,
    p_access_token:     tokens.access_token,
    p_refresh_token:    tokens.refresh_token ?? null,
    p_expires_at:       expiresAt,
    p_channel_id:       chId,
    p_channel_title:    chTitle,
    p_channel_handle:   chHandle,
    p_subscriber_count: subs,
  });
  if (rpcErr) return fail('vault_upsert_failed', rpcErr.message);
  if (!rpcData || (rpcData as { ok?: boolean }).ok === false) {
    return fail('vault_upsert_returned_error');
  }

  // 6. Delete the pending row (RPC already deactivated all previous active rows
  //    for this property and inserted a fresh active one; the pending row is orphan)
  await sb.rpc('fn_yt_delete_pending', { p_id: pending.id });

  const done = new URL(`${APP_ROOT}/marketing/youtube`);
  done.searchParams.set('connected', '1');
  return NextResponse.redirect(done.toString(), 302);
}
