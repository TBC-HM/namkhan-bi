// app/api/cockpit/reports/send/route.ts
// PBS 2026-05-09 #report-builder repair: minimal email-send endpoint for the
// printable revenue reports.
//
// POST  { type, url, recipients[], subject?, body? }
//
// Behaviour:
//   - If RESEND_API_KEY is set → send via Resend API.
//   - Else if SMTP_* envvars set → (TODO) — return mode=ticket fallback for
//     now. Wiring nodemailer adds a heavy dep we don't need yet.
//   - Else → drop a row in cockpit_tickets so PBS or another agent can pick
//     it up manually. Returns { ok: true, mode: 'ticket', ticket_id }.
//
// This route NEVER fabricates success — if neither path can deliver we
// surface the ticket id so the operator can trace the request.

import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SendBody {
  type?: string;
  url?: string;
  recipients?: string[];
  subject?: string;
  body?: string;
}

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key",
  );
}

function isEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

export async function POST(req: Request) {
  noStore();
  const body = (await req.json().catch(() => ({}))) as SendBody;

  const type = String(body.type ?? '').slice(0, 64);
  const url  = String(body.url ?? '').slice(0, 1024);
  const recipients = Array.isArray(body.recipients) ? body.recipients.filter(isEmail) : [];
  const subject = String(body.subject ?? `Namkhan · ${type || 'revenue'} report`).slice(0, 200);

  if (!url || recipients.length === 0) {
    return NextResponse.json(
      { error: 'url and recipients[] required' },
      { status: 400 },
    );
  }

  const text =
    body.body && String(body.body).trim().length > 0
      ? String(body.body)
      : `Namkhan · ${type || 'revenue'} report\n\nOpen the live, printable copy here:\n${url}\n\n` +
        `Generated ${new Date().toISOString()} · property 260955.\n` +
        `If the link prompts for credentials, the cockpit auth gate is on for your IP.\n`;

  // ---- 1. Resend ---------------------------------------------------------
  const resendKey = process.env.RESEND_API_KEY;
  const fromAddr  = process.env.REPORT_EMAIL_FROM ?? 'reports@thenamkhan.com';
  if (resendKey) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: fromAddr,
          to: recipients,
          subject,
          text,
        }),
      });
      if (r.ok) {
        return NextResponse.json({ ok: true, mode: 'smtp', provider: 'resend' });
      }
      const err = await r.text();
      console.warn('[reports/send] resend failed', r.status, err.slice(0, 200));
      // Fall through to ticket queue.
    } catch (e: any) {
      console.warn('[reports/send] resend threw', e?.message);
      // Fall through.
    }
  }

  // ---- 2. cockpit_tickets queue (always-available fallback) -------------
  const sb = supa();
  const summary = `Send ${type || 'revenue'} report to ${recipients.join(', ')}`;
  const fullBody =
    `Recipients: ${recipients.join(', ')}\n` +
    `Subject: ${subject}\n` +
    `URL: ${url}\n\n--- BODY ---\n${text}`;
  const { data, error } = await sb
    .from('cockpit_tickets')
    .insert({
      status: 'new',
      arm: 'revenue',
      intent: 'send_report',
      source: 'reports/render',
      email_subject: summary,
      email_body: fullBody,
      parsed_summary: summary,
    })
    .select('id')
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    mode: 'ticket',
    ticket_id: data?.id,
    note: 'SMTP not wired in this env — request queued for manual processing.',
  });
}
