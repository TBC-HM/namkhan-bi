// app/api/reports/studio/schedules/route.ts
// Spreadsheet Studio — scheduled xlsx-by-email exports (brief §8 option a,
// verifier objection #1 2026-07-31). CRUD surface over
// reports.studio_schedules via public bridge fns (service-role only).
//
//   GET    ?property_id=260955      → { schedules: [...] }
//   POST   { template_id, recipients[], cadence, send_hour_utc?,
//            weekly_dow?, monthly_dom?, property_id?, id?, active? }
//                                   → { ok, id }
//   PATCH  { id, active }           → { ok, id }  (quick enable/disable)
//
// Delivery itself runs in /api/cron/studio-exports (pg_cron hourly,
// x-cron-secret gated, honors fn_automation_enabled).

import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CADENCES = new Set(['daily', 'weekly', 'monthly']);

function emailList(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,;\s]+/) : [];
  return arr
    .map((x) => String(x).trim())
    .filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))
    .slice(0, 10);
}

export async function GET(req: Request) {
  noStore();
  const url = new URL(req.url);
  const propertyId = Number(url.searchParams.get('property_id')) || null;
  const sb = getSupabaseAdmin();
  let q = sb.from('v_studio_schedules').select('*').order('created_at', { ascending: false }).limit(100);
  if (propertyId) q = q.eq('property_id', propertyId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedules: data ?? [] });
}

export async function POST(req: Request) {
  noStore();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const templateId = typeof body.template_id === 'string' ? body.template_id : '';
  const recipients = emailList(body.recipients);
  const cadence = String(body.cadence ?? 'daily');
  if (!templateId) return NextResponse.json({ error: 'template_id required' }, { status: 400 });
  if (recipients.length === 0) return NextResponse.json({ error: 'at least one valid recipient email required' }, { status: 400 });
  if (!CADENCES.has(cadence)) return NextResponse.json({ error: 'cadence must be daily|weekly|monthly' }, { status: 400 });

  const sendHour = Math.min(Math.max(Number(body.send_hour_utc ?? 1) || 0, 0), 23);
  const weeklyDow = body.weekly_dow === null || body.weekly_dow === undefined ? null : Math.min(Math.max(Number(body.weekly_dow) || 0, 0), 6);
  const monthlyDom = body.monthly_dom === null || body.monthly_dom === undefined ? null : Math.min(Math.max(Number(body.monthly_dom) || 1, 1), 28);
  const propertyId = Number(body.property_id) || null;
  const id = typeof body.id === 'string' && body.id ? body.id : null;
  const active = body.active === undefined ? true : Boolean(body.active);

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_studio_save_schedule', {
    p_template_id: templateId,
    p_recipients: recipients,
    p_cadence: cadence,
    p_send_hour_utc: sendHour,
    p_weekly_dow: cadence === 'weekly' ? (weeklyDow ?? 1) : null,
    p_monthly_dom: cadence === 'monthly' ? (monthlyDom ?? 1) : null,
    p_property_id: propertyId,
    p_owner: 'studio',
    p_id: id,
    p_active: active,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data as string });
}

export async function PATCH(req: Request) {
  noStore();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  // Load current row, resave with toggled/explicit active via the same fn
  const { data: rows, error: readErr } = await sb.from('v_studio_schedules').select('*').eq('id', id).limit(1);
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  const cur = (rows ?? [])[0] as Record<string, unknown> | undefined;
  if (!cur) return NextResponse.json({ error: 'schedule not found' }, { status: 404 });

  const active = body.active === undefined ? !Boolean(cur.active) : Boolean(body.active);
  const { data, error } = await sb.rpc('fn_studio_save_schedule', {
    p_template_id: cur.template_id,
    p_recipients: cur.recipients,
    p_cadence: cur.cadence,
    p_send_hour_utc: cur.send_hour_utc,
    p_weekly_dow: cur.weekly_dow,
    p_monthly_dom: cur.monthly_dom,
    p_property_id: cur.property_id,
    p_owner: cur.owner,
    p_id: id,
    p_active: active,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data as string, active });
}
