// app/api/marketing/analytics/ga4/route.ts
// GA4 Analytics integration — service account OAuth + Reporting API + Measurement Protocol
// Property: 420620068 · Measurement ID: G-KKD8CEFS1
// Modes: report (pull data) | event (send server-side event)

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const GA4_REPORTING_BASE = 'https://analyticsdata.googleapis.com/v1beta/properties';
const GA4_MP_BASE = 'https://www.google-analytics.com/mp/collect';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

async function getAccessToken(serviceAccountJson: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountJson.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({})) as {mode?:string;event_name?:string;params?:Record<string,string>;date_range?:string;report_type?:string};
  const mode = body.mode ?? 'report';

  const sb = getSupabaseAdmin();
  const { data: saJson } = await sb.rpc('fn_read_vault_secret',{p_name:'GMAIL_SERVICE_ACCOUNT_JSON'}).then(r=>r, ()=>({data:null}));
  const { data: propertyId } = await sb.rpc('fn_read_vault_secret',{p_name:'Property_ID'}).then(r=>r, ()=>({data:'420620068'}));
  const { data: measurementId } = await sb.rpc('fn_read_vault_secret',{p_name:'Measurement Id'}).then(r=>r, ()=>({data:null}));
  const { data: apiSecret } = await sb.rpc('fn_read_vault_secret',{p_name:'Analytics'}).then(r=>r, ()=>({data:null}));

  if (mode === 'event') {
    if (!measurementId || !apiSecret) return NextResponse.json({ok:false,error:'missing_mp_credentials'},{status:500});
    const eventName = body.event_name ?? 'page_view';
    const r = await fetch(`${GA4_MP_BASE}?measurement_id=${measurementId}&api_secret=${apiSecret}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({client_id:'namkhan-bi-server',events:[{name:eventName,params:body.params??{}}]}),
    });
    return NextResponse.json({ok:r.status===204,status:r.status});
  }

  if (!saJson) return NextResponse.json({ok:false,error:'service_account_not_found'},{status:500});
  const sa = JSON.parse(saJson as string) as Record<string,string>;
  const token = await getAccessToken(sa);
  const pid = (propertyId as string)?.trim() || '420620068';
  const dateRange = body.date_range ?? '30d';
  const reportType = body.report_type ?? 'pages';
  const startDate = dateRange==='7d'?'7daysAgo':dateRange==='90d'?'90daysAgo':'30daysAgo';

  const reportConfigs: Record<string,object> = {
    pages: { dateRanges:[{startDate,endDate:'today'}], metrics:[{name:'sessions'},{name:'screenPageViews'},{name:'engagementRate'},{name:'averageSessionDuration'}], dimensions:[{name:'pagePath'}], orderBys:[{metric:{metricName:'screenPageViews'},desc:true}], limit:30 },
    sources: { dateRanges:[{startDate,endDate:'today'}], metrics:[{name:'sessions'},{name:'newUsers'},{name:'conversions'}], dimensions:[{name:'sessionSource'},{name:'sessionMedium'}], orderBys:[{metric:{metricName:'sessions'},desc:true}], limit:20 },
    overview: { dateRanges:[{startDate,endDate:'today'}], metrics:[{name:'sessions'},{name:'totalUsers'},{name:'newUsers'},{name:'screenPageViews'},{name:'engagementRate'},{name:'averageSessionDuration'},{name:'bounceRate'}] },
  };

  const config = reportConfigs[reportType] ?? reportConfigs.pages;
  const r = await fetch(`${GA4_REPORTING_BASE}/${pid}:runReport`, {
    method:'POST', headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify(config),
  });
  const data = await r.json() as Record<string,unknown>;
  if (!r.ok) {
    const errMsg = (data as any)?.error?.message ?? (data as any)?.message ?? `GA4 API error ${r.status}`;
    return NextResponse.json({ok:false,error:errMsg},{status:r.status});
  }

  const rows = data.rows ?? [];
  const totals = (data.totals as any[])?.[0] ?? null;
  await sb.rpc('fn_ga4_upsert_report',{p_property_id:pid,p_type:reportType,p_range:dateRange,p_rows:rows,p_totals:totals}).then(r=>r, ()=>null);

  return NextResponse.json({ok:true,property_id:pid,report_type:reportType,date_range:dateRange,rows_count:(rows as any[]).length,rows,totals});
}
