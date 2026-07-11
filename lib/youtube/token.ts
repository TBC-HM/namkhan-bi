// lib/youtube/token.ts
// PBS 2026-07-11 pm — YouTube OAuth token helper.
// Loads the active connection from marketing.yt_channel_connections (via public bridge view),
// pulls the current access + refresh + client id/secret from vault via SECURITY DEFINER RPC
// public.fn_yt_read_connection_secrets, and refreshes the access token against
// https://oauth2.googleapis.com/token when <2 minutes to expiry.
//
// On successful refresh we call SECURITY DEFINER RPC public.fn_yt_rotate_access_token
// which writes the new token to vault and bumps token_expires_at on the connection row.
//
// Everything vault-adjacent runs through those two RPCs so we never touch vault.* from the
// PostgREST client directly (per feedback_postgrest_non_public_schema_write_silent_noop).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface YtConnection {
  id: string;
  property_id: number;
  channel_id: string | null;
  channel_title: string | null;
  channel_handle: string | null;
  subscriber_count: number | null;
  connected_at: string | null;
  token_expires_at: string | null;
  active: boolean;
}

export async function getActiveConnection(propertyId: number): Promise<YtConnection | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_yt_channel_connections')
    .select('id,property_id,channel_id,channel_title,channel_handle,subscriber_count,connected_at,token_expires_at,active')
    .eq('property_id', propertyId)
    .eq('active', true)
    .maybeSingle();
  if (error) return null;
  return (data as YtConnection | null) ?? null;
}

interface ConnectionSecrets {
  ok: boolean;
  error?: string;
  connection_id?: string;
  channel_id?: string | null;
  access_token?: string;
  refresh_token?: string;
  access_token_vault_id?: string;
  refresh_token_vault_id?: string;
  token_expires_at?: string | null;
  client_id?: string;
  client_secret?: string;
}

export interface FreshTokenResult {
  ok: boolean;
  access_token?: string;
  channel_id?: string | null;
  token_expires_at?: string | null;
  refreshed?: boolean;
  error?: string;
  detail?: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

// Returns a valid access token — refreshes if expiry < 2 min out.
export async function getFreshAccessToken(propertyId: number): Promise<FreshTokenResult> {
  const sb = getSupabaseAdmin();

  const { data: raw, error: rpcErr } = await sb.rpc('fn_yt_read_connection_secrets', { p_property_id: propertyId });
  if (rpcErr) return { ok: false, error: 'rpc_read_failed', detail: rpcErr.message };

  const s = (raw ?? {}) as ConnectionSecrets;
  if (!s.ok) return { ok: false, error: s.error ?? 'read_returned_error' };
  if (!s.access_token || !s.refresh_token || !s.client_id || !s.client_secret) {
    return { ok: false, error: 'secrets_missing' };
  }

  const expiresMs = s.token_expires_at ? new Date(s.token_expires_at).getTime() : 0;
  const nowMs = Date.now();
  const twoMinMs = 2 * 60 * 1000;

  // Fresh — return current
  if (expiresMs - nowMs > twoMinMs) {
    return {
      ok: true,
      access_token: s.access_token,
      channel_id: s.channel_id ?? null,
      token_expires_at: s.token_expires_at ?? null,
      refreshed: false,
    };
  }

  // Refresh via Google
  const body = new URLSearchParams({
    client_id:     s.client_id.trim(),
    client_secret: s.client_secret.trim(),
    refresh_token: s.refresh_token.trim(),
    grant_type:    'refresh_token',
  });
  const gRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const gJson = (await gRes.json().catch(() => ({}))) as GoogleTokenResponse;

  if (!gRes.ok || !gJson.access_token) {
    return {
      ok: false,
      error: `refresh_failed_${gRes.status}`,
      detail: (gJson.error_description ?? gJson.error ?? '').slice(0, 240),
    };
  }

  const expiresIn = gJson.expires_in ?? 3600;

  // Rotate access token in vault + bump expiry
  const { data: rotRaw, error: rotErr } = await sb.rpc('fn_yt_rotate_access_token', {
    p_property_id:        propertyId,
    p_new_access_token:   gJson.access_token,
    p_expires_in_seconds: expiresIn,
  });
  if (rotErr) return { ok: false, error: 'rotate_failed', detail: rotErr.message };
  const rot = (rotRaw ?? {}) as { ok?: boolean; token_expires_at?: string };
  if (!rot.ok) return { ok: false, error: 'rotate_returned_error' };

  return {
    ok:               true,
    access_token:     gJson.access_token,
    channel_id:       s.channel_id ?? null,
    token_expires_at: rot.token_expires_at ?? null,
    refreshed:        true,
  };
}
