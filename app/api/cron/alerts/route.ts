// app/api/cron/alerts/route.ts
// GET /api/cron/alerts — daily computation of doc alerts.
// Triggered by Vercel Cron at 06:00 UTC.
//
// Generates these alert kinds:
//   - expiring_30d / expiring_60d / expiring_90d  — contracts/audits coming due
//   - missing_party                               — critical doc with no external_party
//   - missing_dates                               — critical/important doc with no valid_until
//   - low_quality_extract                         — body_chars=0 and tagged needs_review
//   - duplicate                                   — same title + party + valid_from

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  // Wipe today's freshly-computed alerts (idempotent)
  await admin.schema('docs').from('alerts')
    .delete()
    .is('resolved_at', null);

  const findings: any[] = [];

  // 1. EXPIRING CONTRACTS/AUDITS (30 / 60 / 90 day windows)
  const today = new Date();
  for (const days of [30, 60, 90]) {
    const horizon = new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
    const { data: expiries } = await admin.schema('docs').from('documents')
      .select('doc_id, title, valid_until, doc_type, external_party, importance')
      .gte('valid_until', today.toISOString().slice(0, 10))
      .lte('valid_until', horizon)
      .eq('status', 'active');
    for (const d of expiries || []) {
      const daysLeft = Math.ceil(
        (new Date(d.valid_until).getTime() - today.getTime()) / 86400000
      );
      // Only emit at the tightest band per doc
      if (days === 30 && daysLeft <= 30) {
        findings.push({
          alert_kind: 'expiring_30d', doc_id: d.doc_id, severity: 'critical',
          message: `${d.title} expires in ${daysLeft} days`,
          details: { days_left: daysLeft, valid_until: d.valid_until,
                     doc_type: d.doc_type, party: d.external_party },
        });
      } else if (days === 60 && daysLeft > 30 && daysLeft <= 60) {
        findings.push({
          alert_kind: 'expiring_60d', doc_id: d.doc_id, severity: 'high',
          message: `${d.title} expires in ${daysLeft} days`,
          details: { days_left: daysLeft, valid_until: d.valid_until,
                     doc_type: d.doc_type, party: d.external_party },
        });
      } else if (days === 90 && daysLeft > 60 && daysLeft <= 90) {
        findings.push({
          alert_kind: 'expiring_90d', doc_id: d.doc_id, severity: 'medium',
          message: `${d.title} expires in ${daysLeft} days`,
          details: { days_left: daysLeft, valid_until: d.valid_until,
                     doc_type: d.doc_type, party: d.external_party },
        });
      }
    }
  }

  // 2. CRITICAL DOCS MISSING DATES
  const { data: missingDates } = await admin.schema('docs').from('documents')
    .select('doc_id, title, doc_type')
    .eq('importance', 'critical')
    .eq('status', 'active')
    .is('valid_until', null);
  for (const d of missingDates || []) {
    findings.push({
      alert_kind: 'missing_dates', doc_id: d.doc_id, severity: 'medium',
      message: `${d.title} (${d.doc_type}) has no expiry/renewal date`,
      details: { doc_type: d.doc_type },
    });
  }

  // 3. CRITICAL DOCS MISSING PARTY
  const { data: missingParty } = await admin.schema('docs').from('documents')
    .select('doc_id, title, doc_type')
    .eq('importance', 'critical')
    .eq('status', 'active')
    .is('external_party', null)
    .in('doc_type', ['partner', 'legal', 'audit', 'insurance']);
  for (const d of missingParty || []) {
    findings.push({
      alert_kind: 'missing_party', doc_id: d.doc_id, severity: 'low',
      message: `${d.title} has no counterparty/issuer recorded`,
      details: { doc_type: d.doc_type },
    });
  }

  // 4. LOW-QUALITY EXTRACTS (critical/important docs with no body)
  const { data: lowQ } = await admin.schema('docs').from('documents')
    .select('doc_id, title, doc_type, file_size_bytes')
    .in('importance', ['critical', 'standard'])
    .eq('status', 'active')
    .is('body_markdown', null)
    .gte('file_size_bytes', 1)
    .limit(100);
  for (const d of lowQ || []) {
    findings.push({
      alert_kind: 'low_quality_extract', doc_id: d.doc_id, severity: 'low',
      message: `${d.title} couldn't be OCR'd (${(d.file_size_bytes / 1024).toFixed(0)} KB)`,
      details: { doc_type: d.doc_type, file_size_bytes: d.file_size_bytes },
    });
  }

  // Insert
  if (findings.length > 0) {
    const { error } = await admin.schema('docs').from('alerts').insert(findings);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Summary by kind
  const bySeverity = findings.reduce((acc: Record<string, number>, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    ok: true,
    total_alerts: findings.length,
    by_severity: bySeverity,
    by_kind: findings.reduce((acc: Record<string, number>, f) => {
      acc[f.alert_kind] = (acc[f.alert_kind] || 0) + 1;
      return acc;
    }, {}),
    fetched_at: new Date().toISOString(),
  });
}
