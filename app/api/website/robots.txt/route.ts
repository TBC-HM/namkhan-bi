// app/api/website/robots.txt/route.ts
// website-module-v1 CMS-4 — dynamic robots.txt
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = getSupabaseAdmin();
  
  // Get site config
  const { data: siteDataRaw } = await sb.rpc('fn_generate_sitedata', {
    p_property_id: PROPERTY_ID
  });
  
  const siteData = siteDataRaw as { site: { base_url: string; status?: string } };
  const baseUrl = siteData?.site?.base_url || 'https://www.thenamkhan.com';
  const status = siteData?.site?.status || 'inventory';
  
  // Only allow indexing if site is live
  const allowIndex = status === 'live';
  
  let txt = 'User-agent: *\n';
  
  if (allowIndex) {
    txt += 'Allow: /\n';
    txt += `Sitemap: ${baseUrl}/sitemap.xml\n`;
  } else {
    txt += 'Disallow: /\n';
  }
  
  return new NextResponse(txt, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}