// app/api/pickup/email/route.ts
// PBS 2026-07-08: Send the Pickup matrix email with a proper HTML summary + CSV attachment.
// Uses send-report-email edge fn v4 which now accepts a raw `html` param.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Req {
  to: string;
  subject: string;
  html: string;
  attachment_name?: string;
  attachment_base64?: string;
  property_id?: number;
}

export async function POST(req: Request) {
  let body: Req;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  if (!body.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }
  if (!body.html) return NextResponse.json({ ok: false, error: 'html_required' }, { status: 400 });

  const to = body.to.trim().toLowerCase();
  const propLabel = body.property_id === 1000001 ? 'Donna Portals' : 'The Namkhan';

  const attachments = body.attachment_base64 && body.attachment_name ? [{
    filename: body.attachment_name,
    content: body.attachment_base64,
    content_type: 'text/csv',
  }] : undefined;

  const sb = getSupabaseAdmin();
  const edge = await sb.functions.invoke('send-report-email', {
    body: {
      to,
      subject: body.subject,
      html: body.html,
      from_label: `${propLabel} · Revenue`,
      attachments,
    },
  });
  if (edge.error) return NextResponse.json({ ok: false, error: edge.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sent_to: to });
}
