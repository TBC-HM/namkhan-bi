// app/api/reports/run/route.ts
// PBS 2026-05-13 #report-templates run endpoint.
//
// POST { template_code: string, params: object }
//   → { html, subject, summary_text, sent, run_id }
//
// If params.email_to is set and RESEND_API_KEY is configured, the rendered
// HTML is emailed via Resend; otherwise the run is persisted in
// public.report_runs and the HTML is returned in the response body.

import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { REPORT_REGISTRY } from '@/lib/reports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RunBody {
  template_code?: string;
  params?: Record<string, any>;
}

function isEmailList(s: unknown): string[] {
  if (typeof s === 'string') {
    return s
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  }
  if (Array.isArray(s)) {
    return s.filter(
      (x) => typeof x === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x),
    );
  }
  return [];
}

async function sendViaResend(opts: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY not set' };
  const from = process.env.REPORT_EMAIL_FROM ?? 'reports@thenamkhan.com';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    if (r.ok) return { ok: true };
    const err = await r.text();
    return { ok: false, error: `resend ${r.status}: ${err.slice(0, 240)}` };
  } catch (e: any) {
    return { ok: false, error: `resend threw: ${e?.message || e}` };
  }
}

export async function POST(req: Request) {
  noStore();
  const body = (await req.json().catch(() => ({}))) as RunBody;
  const code = String(body.template_code ?? '').trim();
  const params = (body.params && typeof body.params === 'object') ? body.params : {};

  if (!code) {
    return NextResponse.json(
      { error: 'template_code is required' },
      { status: 400 },
    );
  }

  const render = REPORT_REGISTRY[code];
  if (!render) {
    return NextResponse.json(
      {
        error: `unknown template_code "${code}"`,
        available: Object.keys(REPORT_REGISTRY),
      },
      { status: 404 },
    );
  }

  const supabase = getSupabaseAdmin();
  const property_id = params.property_id != null ? Number(params.property_id) : null;
  const emailTo = isEmailList(params.email_to);

  // Insert a pending run row (best-effort — never block render on this)
  let run_id: number | null = null;
  try {
    const { data } = await supabase
      .from('report_runs')
      .insert({
        template_code: code,
        property_id,
        params,
        email_to: emailTo.length > 0 ? emailTo.join(',') : null,
        status: 'pending',
      })
      .select('id')
      .single();
    run_id = (data as any)?.id ?? null;
  } catch (e) {
    /* non-fatal */
  }

  let rendered;
  try {
    rendered = await render(params, supabase);
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (run_id != null) {
      await supabase
        .from('report_runs')
        .update({ status: 'error', error_msg: msg })
        .eq('id', run_id);
    }
    return NextResponse.json(
      { error: `render failed: ${msg}`, run_id },
      { status: 500 },
    );
  }

  let sent = false;
  let send_error: string | null = null;
  if (emailTo.length > 0) {
    const res = await sendViaResend({
      to: emailTo,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.summary_text,
    });
    sent = res.ok;
    if (!res.ok) send_error = res.error || 'send failed';
  }

  // Finalise run row
  if (run_id != null) {
    await supabase
      .from('report_runs')
      .update({
        status: sent || emailTo.length === 0 ? 'ok' : 'error',
        output_html: rendered.html,
        output_summary: rendered.summary_text,
        sent_at: sent ? new Date().toISOString() : null,
        error_msg: send_error,
      })
      .eq('id', run_id);
  }

  return NextResponse.json(
    {
      run_id,
      template_code: code,
      subject: rendered.subject,
      summary_text: rendered.summary_text,
      html: rendered.html,
      sent,
      send_error,
    },
    {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    },
  );
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    templates: Object.keys(REPORT_REGISTRY),
  });
}
