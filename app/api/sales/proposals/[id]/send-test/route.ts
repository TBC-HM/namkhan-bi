// app/api/sales/proposals/[id]/send-test/route.ts
// PBS 2026-07-20 pm · item #5 · send-test-to-me endpoint.
//
// Fires the SAME preview render pipeline as /email/preview, but delivers the
// resulting HTML to the currently-signed-in user's Gmail (from the OAuth
// connection stored in marketing.user_gmail_connections) instead of the guest.
//
// Subject is prefixed with "[TEST] " and the body carries a small banner at
// the top so PBS can distinguish it from a live send. Does NOT touch the
// proposal's status, does NOT mint a public_token, does NOT fire the Make
// webhook — this is a preview delivery mechanism only.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentAuthUser, refreshIfExpired, sendMessage } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }

export async function POST(req: Request, { params }: Ctx) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  if (!user.email) return NextResponse.json({ error: 'no_user_email' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: proposal } = await sb.schema('sales').from('proposals')
    .select('id, property_id, guest_name_snapshot')
    .eq('id', params.id).maybeSingle();
  if (!proposal) return NextResponse.json({ error: 'proposal_not_found' }, { status: 404 });

  // ---- render preview HTML via /email/preview ----
  const proto = process.env.VERCEL_URL ? 'https' : 'http';
  const host = process.env.VERCEL_URL ?? 'localhost:3000';
  const url = new URL(req.url);
  const withPhotos = url.searchParams.get('with_photos') !== '0';
  const factsheetId = url.searchParams.get('factsheet_id') ?? '';
  const cookieHeader = req.headers.get('cookie') ?? '';

  const previewUrl = `${proto}://${host}/api/sales/proposals/${params.id}/email/preview?format=json&with_photos=${withPhotos ? 1 : 0}${factsheetId ? '&factsheet_id=' + factsheetId : ''}`;

  let emailHtml: string | null = null;
  let emailSubject: string = 'Test preview';
  let previewDiag: string | null = null;
  try {
    const r = await fetch(previewUrl, {
      cache: 'no-store',
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });
    if (r.ok) {
      const j = await r.json();
      emailHtml = j.html ?? null;
      if (j.subject) emailSubject = j.subject;
    } else {
      previewDiag = `HTTP ${r.status}`;
    }
  } catch (e) {
    previewDiag = e instanceof Error ? e.message : String(e);
  }

  if (!emailHtml) {
    return NextResponse.json({
      error: 'preview_render_failed',
      message: `Could not render preview HTML.${previewDiag ? ' · ' + previewDiag : ''}`,
    }, { status: 500 });
  }

  // Prepend visible TEST banner + prefix subject.
  const banner = `<div style="background:#FBEFD9;border-bottom:2px solid #B87F26;padding:14px 20px;font-family:system-ui,sans-serif;font-size:13px;color:#3A3A3A"><strong style="color:#B87F26">[TEST PREVIEW]</strong> — this is a copy of the proposal for <em>${(proposal.guest_name_snapshot ?? 'guest').replace(/</g,'&lt;')}</em>. It was NOT sent to the guest. Sender-side preview only.</div>`;
  const bodyWithBanner = emailHtml.replace(/<body([^>]*)>/i, (m) => `${m}${banner}`);
  const testSubject = `[TEST] ${emailSubject}`;

  // ---- send via the current user's Gmail (to themselves) ----
  try {
    const { access, gmail } = await refreshIfExpired(user.id);
    const toHeader = user.email;
    const sendRes = await sendMessage(access, {
      from: gmail,
      to: toHeader,
      subject: testSubject,
      body_html: bodyWithBanner,
    });
    return NextResponse.json({
      ok: true,
      to: user.email,
      subject: testSubject,
      gmail_message_id: sendRes?.id ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'gmail_send_failed';
    return NextResponse.json({
      error: 'gmail_send_failed',
      message: msg,
      hint: 'Check your Gmail connection at /mail (Connect / Reconnect Email).',
    }, { status: 500 });
  }
}