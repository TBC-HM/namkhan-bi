// app/api/compiler/runs/[id]/render/route.ts
// POST { variantId, designVariant } -> stub URLs (Puppeteer not wired in v1).
// Marks the run as 'rendering' then 'ready'.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = getSupabaseAdmin();
  const id = params.id;
  const { variantId, designVariant = 'B' } = await req.json().catch(() => ({}));
  await admin.schema('compiler').from('runs').update({ status: 'rendering' }).eq('id', id);
  // Stub: mark ready and return placeholder URLs
  await admin.schema('compiler').from('runs').update({ status: 'ready' }).eq('id', id);
  return NextResponse.json({
    pdfUrl: `/api/compiler/runs/${id}/pdf?variant=${variantId}&design=${designVariant}`,
    funnelHtmlUrls: {
      lead: `/r/preview-${id}/lead`,
      detail: `/r/preview-${id}`,
      configure: `/r/preview-${id}/configure`,
      checkout: `/r/preview-${id}/checkout`,
    },
    note: 'PDF render is stubbed in v1. Funnel preview lives at /r/[slug].',
  });
}
