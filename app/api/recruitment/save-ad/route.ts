// POST /api/recruitment/save-ad
// Inserts a draft into recruitment.job_ads.

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const propertyId = Number(body.propertyId);
    const positionTitle = String(body.positionTitle ?? '').trim();
    const language = String(body.language ?? '').trim();
    const bodyMd = String(body.body_md ?? '').trim();
    if (!Number.isFinite(propertyId) || !positionTitle || !language || !bodyMd) {
      return NextResponse.json({ error: 'invalid input' }, { status: 400 });
    }
    const { data, error } = await supabase
      .schema('recruitment')
      .from('job_ads')
      .insert({
        property_id: propertyId,
        position_title: positionTitle,
        language,
        body_md: bodyMd,
        salary_band: body.salary_band ?? null,
        channels: body.channels ?? null,
        standards: body.standards ?? null,
        status: 'draft',
        source: 'wizard',
      })
      .select('id, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
