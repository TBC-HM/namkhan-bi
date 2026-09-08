// app/api/marketing/social/sync-profiles/route.ts
// Triggers social-push edge function in sync_profiles mode for a given property.
// POST { property_id, platforms? }
// Used by the Pinterest board calendar "Sync boards" button.

import { NextRequest, NextResponse } from 'next/server';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.property_id) {
    return NextResponse.json({ ok: false, error: 'property_id required' }, { status: 400 });
  }
  const propertyId = await requirePropertyAccess(req, body.property_id);
  const platforms: string[] = Array.isArray(body.platforms)
    ? body.platforms
    : ['pinterest'];

  const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/social-push`;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!srk) {
    return NextResponse.json({ ok: false, error: 'service_role_key_not_configured' }, { status: 500 });
  }

  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${srk}`,
    },
    body: JSON.stringify({ mode: 'sync_profiles', property_id: propertyId, platforms }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: json.error ?? `edge function ${res.status}`, detail: json }, { status: 502 });
  }
  return NextResponse.json({ ok: true, synced: json.synced ?? json });
}
