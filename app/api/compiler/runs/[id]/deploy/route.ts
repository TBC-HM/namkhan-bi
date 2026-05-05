// app/api/compiler/runs/[id]/deploy/route.ts
// POST { variantId, designVariant, subdomain } -> creates compiler.deploys row,
// publishes a web.retreats record so the public /r/[slug] page can render.
// Stubs Vercel/Cloudflare integration.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = getSupabaseAdmin();
  const id = params.id;
  const body = await req.json().catch(() => ({}));
  const { variantId, designVariant = 'B', subdomain } = body;
  if (!variantId) return NextResponse.json({ error: 'variantId required' }, { status: 400 });

  const { data: variant } = await admin.schema('compiler').from('variants').select('*').eq('id', variantId).maybeSingle();
  const { data: run } = await admin.schema('compiler').from('runs').select('*').eq('id', id).maybeSingle();
  if (!variant || !run) return NextResponse.json({ error: 'variant/run not found' }, { status: 404 });

  const spec = (run.parsed_spec ?? {}) as any;
  const slug = subdomain || slugify(`${spec.theme ?? 'retreat'}-${spec.season?.[0] ?? 'all'}-${id.slice(0, 6)}`);

  // Create a deploys row
  const { data: deploy, error: depErr } = await admin
    .schema('compiler')
    .from('deploys')
    .insert({
      run_id: id,
      variant_id: variantId,
      design_variant: designVariant,
      subdomain: slug,
      status: 'live',
      deployed_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (depErr) return NextResponse.json({ error: depErr.message }, { status: 500 });

  // Publish a web.retreats row (so /r/[slug] page works)
  const arrival = new Date(); arrival.setDate(arrival.getDate() + 60);
  const departure = new Date(arrival); departure.setDate(departure.getDate() + (spec.duration_nights ?? 4));
  await admin.schema('web').from('retreats').upsert({
    run_id: id,
    variant_id: variantId,
    slug,
    name: `${(spec.theme ?? 'Retreat').replace(/-/g, ' ')} retreat`.replace(/\b\w/g, (c: string) => c.toUpperCase()),
    tagline: `${spec.duration_nights ?? 4} nights · ${spec.pax ?? 4} guests · ${variant.room_category}`,
    arrival_window_from: arrival.toISOString().slice(0, 10),
    arrival_window_to: departure.toISOString().slice(0, 10),
    spots_total: spec.pax ?? 4,
    spots_booked: 0,
    price_usd_from: variant.per_pax_usd,
    series_slug: spec.theme && spec.theme !== 'general' ? spec.theme : null,
    status: 'published',
  }, { onConflict: 'slug' });

  await admin.schema('compiler').from('runs').update({ status: 'deployed' }).eq('id', id);

  return NextResponse.json({
    deployId: deploy!.id,
    subdomain: slug,
    publicUrl: `/r/${slug}`,
    status: 'live',
    note: 'v1 publishes to /r/[slug] on the same Vercel project. Custom subdomain wiring deferred.',
  });
}
