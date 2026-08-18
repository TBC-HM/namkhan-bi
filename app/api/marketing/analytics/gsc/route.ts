// app/api/marketing/analytics/gsc/route.ts
// Google Search Console integration — service account JWT + Search Analytics API
// Modes: queries | pages | countries | devices | trend
// Site URL: reads GSC_SITE_URL from vault (default: https://www.thenamkhan.com/)

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const GSC_BASE = 'https://searchconsole.googleapis.com/webmasters/v3/sites';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

async function getAccessToken(serviceAccountJson: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountJson.client_email,
    scope: GSC_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const privateKeyPem = serviceAccountJson.private_key;
  const pemBody = privateKeyPem.replace(/-----BEGIN PRIVATE KEY-----\n?/,'').replace(/\n?-----END PRIVATE KEY-----\n?/,'').replace(/\n/g,'');
  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('pkcs8', keyBytes, { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['sign']);

  const header = btoa(JSON.stringify({ alg:'RS256', typ:'JWT' })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const body = btoa(JSON.stringify(payload)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const unsigned = `${header}.${body}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsigned));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const jwt = `${unsigned}.${sigB64}`;

  const res = await fetch(TOKEN_URL, {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const json = await res.json() as {access_token?:string;error?:string};
  if (!json.access_token) throw new Error(`Token error: ${json.error}`);
  return json.access_token;
}

function dateRange(range: string): { startDate: string; endDate: string } {
  const end = new Date();
  end.setDate(end.getDate() - 3); // GSC has ~3-day delay
  const start = new Date(end);
  if (range === '7d') start.setDate(start.getDate() - 7);
  else if (range === '90d') start.setDate(start.getDate() - 90);
  else start.setDate(start.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

const DIMENSION_CONFIGS: Record<string, { dimensions: string[]; rowLimit: number }> = {
  queries:   { dimensions: ['query'],   rowLimit: 50 },
  pages:     { dimensions: ['page'],    rowLimit: 30 },
  countries: { dimensions: ['country'], rowLimit: 20 },
  devices:   { dimensions: ['device'],  rowLimit: 5  },
  trend:     { dimensions: ['date'],    rowLimit: 90 },
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({})) as {mode?:string;date_range?:string;site_url?:string};
  const mode = body.mode ?? 'queries';
  const range = body.date_range ?? '30d';

  const sb = getSupabaseAdmin();
  const { data: saJson } = await sb.rpc('fn_read_vault_secret',{p_name:'GMAIL_SERVICE_ACCOUNT_JSON'}).then(r=>r, ()=>({data:null}));
  const { data: vaultSiteUrl } = await sb.rpc('fn_read_vault_secret',{p_name:'GSC_SITE_URL'}).then(r=>r, ()=>({data:null}));

  if (!saJson) return NextResponse.json({ok:false,error:'service_account_not_found'},{status:500});

  const sa = JSON.parse(saJson as string) as Record<string,string>;
  const token = await getAccessToken(sa);
  const siteUrl = body.site_url ?? (vaultSiteUrl as string) ?? 'https://www.thenamkhan.com/';
  const encodedSite = encodeURIComponent(siteUrl);

  const dimConfig = DIMENSION_CONFIGS[mode] ?? DIMENSION_CONFIGS.queries;
  const { startDate, endDate } = dateRange(range);

  const payload = {
    startDate,
    endDate,
    dimensions: dimConfig.dimensions,
    rowLimit: dimConfig.rowLimit,
    dataState: 'final',
  };

  const r = await fetch(`${GSC_BASE}/${encodedSite}/searchAnalytics/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await r.json() as Record<string,unknown>;
  if (!r.ok) return NextResponse.json({ok:false,error:data},{status:r.status});

  const rows = (data.rows ?? []) as any[];
  const totals = {
    clicks: rows.reduce((s:number, row:any) => s + (row.clicks ?? 0), 0),
    impressions: rows.reduce((s:number, row:any) => s + (row.impressions ?? 0), 0),
    ctr: rows.length ? rows.reduce((s:number, row:any) => s + (row.ctr ?? 0), 0) / rows.length : 0,
    position: rows.length ? rows.reduce((s:number, row:any) => s + (row.position ?? 0), 0) / rows.length : 0,
  };

  await sb.rpc('fn_gsc_upsert_report',{p_site_url:siteUrl,p_type:mode,p_range:range,p_rows:rows,p_totals:totals}).then(r=>r, ()=>null);

  return NextResponse.json({ok:true,site_url:siteUrl,mode,date_range:range,start_date:startDate,end_date:endDate,rows_count:rows.length,rows,totals});
}
