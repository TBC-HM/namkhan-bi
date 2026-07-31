// app/api/cron/studio-exports/route.ts
// SPREADSHEET STUDIO — SCHEDULED EXPORTS (brief module-spreadsheet-studio-v1
// §8 option a: template + cron → stamped xlsx by email).
//
// Fired hourly by pg_cron 'studio-exports-hourly' (x-cron-secret header from
// vault CRON_SHARED_SECRET — same gate as tile-sweep/brain-battery). Flow:
//   1. auth gate + public.fn_automation_enabled() kill switch
//   2. public.fn_studio_schedules_due() → due schedules w/ template definition
//   3. per schedule: fn_studio_query → shared stamped-xlsx builder
//      (lib/studio/xlsxBuild.ts — byte-identical structure to manual export)
//   4. email via Resend w/ attachment; no RESEND_API_KEY → cockpit_tickets
//      fallback row (same non-fabricating pattern as /api/cockpit/reports/send)
//   5. fn_studio_mark_schedule_run + fn_studio_register_workbook per delivery
//
// This route NEVER fabricates success: failed sends are marked failed with
// the error on the schedule row (surfaced in the Studio Schedules panel).

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sanitizeDefinition } from '@/lib/studio/server';
import { buildStudioWorkbook, propertyLabelFor } from '@/lib/studio/xlsxBuild';
import type { StudioRow } from '@/lib/studio/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface DueSchedule {
  id: string;
  template_id: string;
  template_name: string;
  template_version: number;
  definition: unknown;
  property_id: number | null;
  recipients: string[];
  cadence: string;
}

function checkCronSecret(req: NextRequest): boolean {
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!provided) return false;
  const envSecret = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET ?? '';
  if (!envSecret) return false;
  return provided === envSecret;
}

async function sendXlsxViaResend(opts: {
  to: string[];
  subject: string;
  text: string;
  filename: string;
  buf: Buffer;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY not set' };
  const from = process.env.REPORT_EMAIL_FROM ?? 'reports@thenamkhan.com';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        attachments: [{ filename: opts.filename, content: opts.buf.toString('base64') }],
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      return { ok: false, error: `resend ${r.status}: ${detail.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'resend send failed' };
  }
}

export async function POST(req: NextRequest) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const sb = getSupabaseAdmin();

  // kill switch (rule 596: all runners honor fn_automation_enabled)
  const { data: enabled, error: enabledErr } = await sb.rpc('fn_automation_enabled');
  if (enabledErr) {
    return NextResponse.json({ ok: false, error: `automation check failed: ${enabledErr.message}` }, { status: 500 });
  }
  if (!enabled) {
    return NextResponse.json({ ok: true, skipped: 'automation disabled' });
  }

  const { data: dueData, error: dueErr } = await sb.rpc('fn_studio_schedules_due');
  if (dueErr) {
    return NextResponse.json({ ok: false, error: `due lookup failed: ${dueErr.message}` }, { status: 500 });
  }
  const due = (Array.isArray(dueData) ? dueData : []) as DueSchedule[];
  if (due.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, due: 0 });
  }

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const s of due) {
    try {
      const def = sanitizeDefinition(s.definition);
      if (!def) throw new Error('template definition failed sanitize — re-save the template');

      const { data: rowsData, error: qErr } = await sb.rpc('fn_studio_query', {
        p_schema: def.schema,
        p_view: def.view,
        p_columns: def.columns.length ? def.columns : null,
        p_filters: def.filters,
        p_limit: def.limit,
      });
      if (qErr) throw new Error(qErr.message);
      const rawRows = (rowsData ?? []) as StudioRow[];

      const built = buildStudioWorkbook(def, rawRows, {
        title: s.template_name,
        propertyId: s.property_id,
      });
      const filename = `${built.safeName}-${built.generatedAt.slice(0, 10)}.xlsx`;
      const subject = `TBC Studio · ${s.template_name} · ${propertyLabelFor(s.property_id)} · ${built.generatedAt.slice(0, 10)}`;
      const text =
        `Scheduled Spreadsheet Studio export (${s.cadence}).\n\n` +
        `Template: ${s.template_name} (v${s.template_version})\n` +
        `Source view: ${built.sourceView}\nRows: ${built.rowCount}\n` +
        `Generated at: ${built.generatedAt}\nData as of: ${built.dataAsOf}\n\n` +
        `Every number is reproducible by opening the named source view (canon note in the workbook footer).`;

      const send = await sendXlsxViaResend({ to: s.recipients, subject, text, filename, buf: built.buf });

      if (send.ok) {
        // register the delivered workbook (§9.2 registry)
        try {
          await sb.rpc('fn_studio_register_workbook', {
            p_scope: s.property_id ? 'property' : 'holding',
            p_property_id: s.property_id,
            p_type: 'scheduled_xlsx_email',
            p_owner: 'studio-cron',
            p_source_modules: [built.sourceView],
            p_template_id: s.template_id,
            p_template_version: s.template_version,
            p_snapshot: {
              title: s.template_name,
              definition: def,
              row_count: built.rowCount,
              generated_at: built.generatedAt,
              recipients: s.recipients,
              cadence: s.cadence,
            },
            p_data_timestamp: built.dataAsOf,
          });
        } catch {
          // registry is metadata; the delivery already happened
        }
        await sb.rpc('fn_studio_mark_schedule_run', { p_id: s.id, p_status: 'sent', p_error: null });
        results.push({ id: s.id, status: 'sent' });
      } else {
        // no email path → surface as a ticket, never fabricate success
        // (same cockpit_tickets shape as /api/cockpit/reports/send fallback)
        try {
          await sb.from('cockpit_tickets').insert({
            status: 'new',
            arm: 'finance',
            intent: 'send_report',
            source: 'studio-exports-cron',
            email_subject: `Studio scheduled export undeliverable: ${s.template_name}`,
            email_body:
              `Scheduled export could not be emailed (${send.error}).\n` +
              `Template ${s.template_name} v${s.template_version}, recipients ${s.recipients.join(', ')}.\n` +
              `Re-run manually from /h/${s.property_id ?? 260955}/finance/studio once email is configured.`,
            parsed_summary: `Studio scheduled export undeliverable: ${s.template_name}`,
            metadata: { schedule_id: s.id, property_id: s.property_id },
          });
        } catch {
          // ticket fallback best-effort
        }
        await sb.rpc('fn_studio_mark_schedule_run', { p_id: s.id, p_status: 'failed', p_error: send.error ?? 'send failed' });
        results.push({ id: s.id, status: 'failed', error: send.error });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'schedule run failed';
      try {
        await sb.rpc('fn_studio_mark_schedule_run', { p_id: s.id, p_status: 'failed', p_error: msg });
      } catch {
        // marking best-effort
      }
      results.push({ id: s.id, status: 'failed', error: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    due: due.length,
    sent: results.filter((r) => r.status === 'sent').length,
    results,
  });
}
