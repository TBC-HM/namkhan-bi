// app/api/website/sitemap.xml/route.ts
// website-module-v1 CMS-4 — dynamic sitemap.xml with hreflang alternates
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = getSupabaseAdmin();
  
  const { data, error } = await sb.rpc('fn_website_sitemap', {
    p_property_id: PROPERTY_ID
  });
  
  if (error || !data) {
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
  
  const baseUrl = data.base_url || 'https://www.thenamkhan.com';
  const locales = data.locales || ['en'];
  const pages = data.pages || [];
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  
  for (const page of pages) {
    const slug = page.slug === '/' ? '' : page.slug;
    const lastmod = page.updated_at ? new Date(page.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    
    for (const locale of locales) {
      const localePrefix = locale === 'en' ? '' : `/${locale}`;
      const url = `${baseUrl}${localePrefix}${slug}`;
      
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(url)}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      
      for (const altLocale of locales) {
        const altPrefix = altLocale === 'en' ? '' : `/${altLocale}`;
        const altUrl = `${baseUrl}${altPrefix}${slug}`;
        xml += `    <xhtml:link rel="alternate" hreflang="${altLocale}" href="${escapeXml(altUrl)}" />\n`;
      }
      
      xml += '  </url>\n';
    }
  }
  
  xml += '</urlset>\n';
  
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}