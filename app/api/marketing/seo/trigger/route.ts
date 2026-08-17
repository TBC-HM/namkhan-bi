// app/api/marketing/seo/trigger/route.ts
// Trigger SEO pipeline actions via the governed d4s adapter
// Replaces direct edge-function calls with DB-side orchestration
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const ALLOWED_MODES = new Set(['post', 'fetch', 'rankings', 'gbp', 'competitors', 'volume', 'suggestions', 'local', 'onpage', 'llm', 'ranked', 'hotel', 'instant']);

export async function POST(req: NextRequest) {
  let body: { mode?: string; property_id?: number; url?: string } = {};
  try { 
    body = await req.json(); 
  } catch { /**/ }

  const mode = body.mode ?? 'post';
  const propertyId = body.property_id ?? 260955; // Default to The Nam Khan

  if (!ALLOWED_MODES.has(mode)) {
    if (!ALLOWED_MODES.has(mode)) { return NextResponse.json({ ok: false, error: `unknown mode: ${mode}` }, { status: 400 }); }
  }

  if (!SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: 'service key not configured' }, { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    if (mode === 'post' || mode === 'rankings') {
      // Post SERP ranking tasks
      const { data, error } = await sb.rpc('fn_d4s_rank_weekly', { p_property_id: propertyId });
      if (error) throw error;
      return NextResponse.json({ 
        ok: true, 
        mode, 
        result: { posted: data?.keywords_queued ?? 0 } 
      });
    }

    if (mode === 'gbp') {
      // Post GBP daily tasks
      const { data, error } = await sb.rpc('fn_d4s_gbp_daily', { p_property_id: propertyId });
      if (error) throw error;
      return NextResponse.json({ 
        ok: true, 
        mode, 
        result: { posted: data?.tasks_posted ?? 0 } 
      });
    }

    if (mode === 'competitors') {
      // Post competitor analysis tasks
      const { data, error } = await sb.rpc('fn_d4s_competitors_weekly', { p_property_id: propertyId });
      if (error) throw error;
      return NextResponse.json({ 
        ok: true, 
        mode, 
        result: { posted: data?.competitors_queued ?? 0 } 
      });
    }

    if (mode === 'fetch') {
      // Poll tasks and ingest results
      const pollRes = await sb.rpc('fn_d4s_poll');
      if (pollRes.error) throw pollRes.error;
      
      const ingestRes = await sb.rpc('fn_d4s_ingest');
      if (ingestRes.error) throw ingestRes.error;

      const fetched = pollRes.data?.fetched ?? 0;
      const serp = ingestRes.data?.[0]?.serp_count ?? 0;
      
      return NextResponse.json({ 
        ok: true, 
        mode, 
        result: { 
          fetched, 
          with_position: serp,
          upserted: serp 
        } 
      });
    }

    if (mode === 'volume' || mode === 'suggestions' || mode === 'local') {
      const { data: edgeData, error: edgeErr } = await sb.functions.invoke('fetch-serp-rankings', {
        body: { action: mode, property_id: propertyId },
      });
      if (edgeErr) throw edgeErr;
      return NextResponse.json({ ok: true, mode, result: edgeData ?? { upserted: 0 } });
    }

    if (mode === 'onpage') {
      const { data: cfgRows } = await sb.rpc('fn_seo_get_property_config', { p_property_id: propertyId });
      const cfg = (cfgRows as any[])?.[0] as { domain:string } | undefined;
      const domain = cfg?.domain ?? 'thenamkhan.com';
      const { data: creds } = await sb.rpc('fn_dataforseo_credentials');
      if (!creds) throw new Error('dataforseo_creds_missing');
      const keyPages = [`https://www.${domain}/`,`https://www.${domain}/retreats`,`https://www.${domain}/accommodation`,`https://www.${domain}/spa`,`https://www.${domain}/experiences`,`https://www.${domain}/eco-farm`];
      const r = await fetch('https://api.dataforseo.com/v3/on_page/instant_pages', {
        method:'POST', headers:{'Authorization':`Basic ${creds}`,'Content-Type':'application/json'},
        body:JSON.stringify(keyPages.map(url=>({url,enable_javascript:false,load_resources:false}))),
      });
      const json=await r.json() as Record<string,any>;
      const rows=(json?.tasks??[]).flatMap((t:any)=>(t?.result?.[0]?.items??[]).map((item:any)=>({
        property_id:propertyId,url:t?.data?.url,page_title:item?.meta?.title,title_length:item?.meta?.title_length,
        meta_description:item?.meta?.description,meta_length:item?.meta?.description_length,
        h1:item?.meta?.htags?.h1?.[0],h2s:item?.meta?.htags?.h2,h3s:item?.meta?.htags?.h3,
        word_count:item?.meta?.content?.plain_text_word_count,readability:item?.meta?.content?.flesch_kincaid_readability_index,
        internal_links:item?.meta?.internal_links_count,external_links:item?.meta?.external_links_count,images_count:item?.meta?.images_count,
        issues:{title_too_long:(item?.meta?.title_length??0)>60,title_too_short:(item?.meta?.title_length??100)<35,meta_too_long:(item?.meta?.description_length??0)>155,meta_missing:!item?.meta?.description,h1_missing:!item?.meta?.htags?.h1?.[0],readability_low:(item?.meta?.content?.flesch_kincaid_readability_index??0)<60,thin_content:(item?.meta?.content?.plain_text_word_count??0)<600},
        raw:item})),
      ).filter((r:any)=>r.url);
      await sb.rpc('fn_seo_upsert_instant_pages',{p_rows:JSON.stringify(rows)});
      return NextResponse.json({ok:true,mode,result:{pages:rows.length,note:'Pages crawled — refresh Technical tab to see results'}});
    }

    if (mode === 'llm') {
      const domain = propertyId === 1000001 ? 'www.thedonnaportals.com' : 'thenamkhan.com';
      const { data: creds } = await sb.rpc('fn_dataforseo_credentials');
      if (!creds) throw new Error('dataforseo_creds_missing');
      const mRes = await fetch('https://api.dataforseo.com/v3/ai_optimization/llm_mentions/target_metrics/live', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ language_name: 'English', location_code: 2840, target: [{ domain, search_filter: 'include' }] }]),
      });
      const mj = await mRes.json() as Record<string, unknown>;
      const metrics = ((mj?.tasks as any[])?.[0]?.result?.[0]?.aggregated_metrics ?? {}) as Record<string, any>;
      const platforms = (metrics.platform ?? []) as Array<{key:string;mentions:number;ai_search_volume:number}>;
      const total  = ((metrics.location ?? [])[0]?.mentions ?? 0) as number;
      const aiVol  = ((metrics.location ?? [])[0]?.ai_search_volume ?? 0) as number;
      const google = (platforms.find((p:any) => p.key==='google')?.mentions ?? 0) as number;
      const chatgpt= (platforms.find((p:any) => p.key==='chat_gpt')?.mentions ?? 0) as number;
      await sb.rpc('fn_seo_upsert_llm_snapshot', {
        p_property_id: propertyId, p_target: domain, p_total: total, p_ai_vol: aiVol,
        p_google: google, p_chatgpt: chatgpt,
        p_platform: platforms as unknown as string,
        p_sources: ((metrics.sources_domain ?? []).slice(0, 10)) as unknown as string,
      });
      return NextResponse.json({ ok: true, mode, result: { total_mentions: total, ai_search_volume: aiVol, google, chatgpt } });
    }

    if (mode === 'ranked' || mode === 'hotel') {
      const { data: cfgRows } = await sb.rpc('fn_seo_get_property_config', { p_property_id: propertyId });
      const cfg = (cfgRows as any[])?.[0] as { domain:string; hotel_search_kw:string; hotel_location_name:string } | undefined;
      if (!cfg) throw new Error(`no_seo_config_for_property_${propertyId}`);
      const { data: creds } = await sb.rpc('fn_dataforseo_credentials');
      if (!creds) throw new Error('dataforseo_creds_missing');
      if (mode === 'ranked') {
        const res = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live', {
          method: 'POST', headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([{ target: cfg.domain, language_code: 'en', location_code: 2840, limit: 100,
            filters: ['ranked_serp_element.serp_item.rank_absolute','<=','50'], order_by: ['keyword_data.keyword_info.search_volume,desc'] }]),
        });
        const json = await res.json() as Record<string,any>;
        const items = (json?.tasks?.[0]?.result?.[0]?.items ?? []) as any[];
        const rows = items.map((item:any) => ({
          property_id: propertyId, domain: cfg.domain,
          url: item?.ranked_serp_element?.serp_item?.url, keyword: item?.keyword_data?.keyword,
          position: item?.ranked_serp_element?.serp_item?.rank_absolute, volume: item?.keyword_data?.keyword_info?.search_volume,
          keyword_difficulty: item?.keyword_data?.keyword_properties?.keyword_difficulty,
          search_intent: item?.keyword_data?.search_intent_info?.main_intent,
          etv: item?.ranked_serp_element?.serp_item?.etv, raw: item,
        }));
        const { data: stored } = await sb.rpc('fn_seo_upsert_ranked_pages', { p_rows: JSON.stringify(rows) });
        return NextResponse.json({ ok: true, mode, result: { keywords: items.length, upserted: stored ?? 0 } });
      }
      if (mode === 'hotel') {
        const res = await fetch('https://api.dataforseo.com/v3/business_data/google/hotel_searches/live', {
          method: 'POST', headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([{ keyword: cfg.hotel_search_kw, language_code: 'en',
            location_name: cfg.hotel_location_name, adults: 2, depth: 20, sort_by: 'highest_rating' }]),
        });
        const json = await res.json() as Record<string,any>;
        const items = (json?.tasks?.[0]?.result?.[0]?.items ?? []) as any[];
        const rows = items.map((item:any,i:number) => ({
          property_id: propertyId, search_keyword: cfg.hotel_search_kw,
          position: i+1, hotel_title: item.title, stars: item.stars,
          price_usd: item.prices?.price, rating_value: item.reviews?.value,
          votes_count: item.reviews?.votes_count, is_paid: item.is_paid??false,
          is_our_property: (item.title??'').toLowerCase().includes(cfg.domain.split('.')[0].toLowerCase()),
          latitude: item.location?.latitude, longitude: item.location?.longitude,
          overview_image: item.overview_images?.[0]??null, raw: item,
        }));
        if (rows.length>0) await sb.rpc('fn_seo_upsert_hotel_searches',{p_rows:JSON.stringify(rows)});
        return NextResponse.json({ ok: true, mode, result: { hotels: items.length, upserted: rows.length } });
      }
    }

    if (mode === 'instant') {
      const pUrl = body.url; if (!pUrl?.startsWith('http')) throw new Error('valid URL required');
      const { data: creds } = await sb.rpc('fn_dataforseo_credentials');
      if (!creds) throw new Error('dataforseo_creds_missing');
      const res = await fetch('https://api.dataforseo.com/v3/on_page/instant_pages', {
        method:'POST', headers:{'Authorization':`Basic ${creds}`,'Content-Type':'application/json'},
        body:JSON.stringify([{url:pUrl,enable_javascript:false,load_resources:false}]),
      });
      const json=await res.json() as Record<string,any>;
      const item=json?.tasks?.[0]?.result?.[0]?.items?.[0];
      if (!item) throw new Error('no_data_returned');
      const issues={title_too_long:(item?.meta?.title_length??0)>60,title_too_short:(item?.meta?.title_length??100)<35,meta_too_long:(item?.meta?.description_length??0)>155,meta_missing:!item?.meta?.description,h1_missing:!item?.meta?.htags?.h1?.[0],readability_low:(item?.meta?.content?.flesch_kincaid_readability_index??0)<60,thin_content:(item?.meta?.content?.plain_text_word_count??0)<600};
      const row={property_id:propertyId,url:pUrl,page_title:item?.meta?.title,title_length:item?.meta?.title_length,meta_description:item?.meta?.description,meta_length:item?.meta?.description_length,h1:item?.meta?.htags?.h1?.[0],h2s:item?.meta?.htags?.h2,h3s:item?.meta?.htags?.h3,word_count:item?.meta?.content?.plain_text_word_count,readability:item?.meta?.content?.flesch_kincaid_readability_index,internal_links:item?.meta?.internal_links_count,external_links:item?.meta?.external_links_count,images_count:item?.meta?.images_count,issues,raw:item};
      await sb.rpc('fn_seo_upsert_instant_pages',{p_rows:JSON.stringify([row])});
      return NextResponse.json({ok:true,mode,result:{title:row.page_title,h1:row.h1,h2s:item?.meta?.htags?.h2??[],word_count:row.word_count,readability:row.readability,title_length:row.title_length,meta_length:row.meta_length,issues}});
    }

    return NextResponse.json({ ok: false, error: 'mode not implemented' }, { status: 400 });

  } catch (err: any) {
    console.error('SEO trigger error:', err);
    return NextResponse.json({ 
      ok: false, 
      result: { error: err.message ?? 'Internal error' } 
    }, { status: 500 });
  }
}