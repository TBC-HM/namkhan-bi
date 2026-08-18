// app/api/marketing/seo/trigger/route.ts
// Trigger SEO pipeline actions via the governed d4s adapter
// Replaces direct edge-function calls with DB-side orchestration
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const ALLOWED_MODES = new Set(['post', 'fetch', 'rankings', 'gbp', 'competitors', 'volume', 'suggestions', 'local', 'onpage', 'llm', 'ranked', 'hotel', 'instant','schema-sweep','ai-domains','ai-query','backlinks']);

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

    if (mode === 'volume') {
      const { data: kwRows } = await sb.from('v_seo_rankings').select('keyword_id,keyword,location_code').eq('property_id', propertyId);
      const { data: creds } = await sb.rpc('fn_dataforseo_credentials');
      if (!creds) throw new Error('dataforseo_creds_missing');
      const byLoc = new Map<number, {id:number;keyword:string}[]>();
      for (const r of (kwRows ?? []) as any[]) {
        if (!byLoc.has(r.location_code)) byLoc.set(r.location_code, []);
        byLoc.get(r.location_code)!.push({id: r.keyword_id, keyword: r.keyword});
      }
      const updates: any[] = [];
      for (const [locCode, kws] of byLoc.entries()) {
        const res = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
          method: 'POST',
          headers: {'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json'},
          body: JSON.stringify([{keywords: kws.map(k=>k.keyword), location_code: locCode, language_code: 'en'}]),
        });
        const json = await res.json() as Record<string,any>;
        for (const item of (json?.tasks?.[0]?.result ?? []) as any[]) {
          const kw = kws.find(k => k.keyword === item.keyword);
          if (!kw) continue;
          updates.push({keyword_id: kw.id, monthly_searches: item.search_volume ?? 0, keyword_difficulty: item.keyword_properties?.keyword_difficulty ?? null, cpc_usd: item.cpc ?? null, competition: item.competition ?? null});
        }
      }
      const { data: cnt } = await sb.rpc('fn_seo_bulk_update_volume', {p_rows: JSON.stringify(updates)});
      return NextResponse.json({ok: true, mode, result: {updated: cnt ?? 0, note: 'Laos keywords show 0 volume — Google Ads has no data for this market'}});
    }

    if (mode === 'suggestions') {
      const { data: kwRows } = await sb.from('v_seo_rankings').select('keyword_id,keyword,location_code').eq('property_id', propertyId).eq('location_code', 2840).limit(5);
      const seeds = (kwRows ?? []) as any[];
      if (!seeds.length) return NextResponse.json({ok:false,error:'no_tracked_keywords'},{status:400});
      const { data: creds } = await sb.rpc('fn_dataforseo_credentials');
      if (!creds) throw new Error('dataforseo_creds_missing');
      const res = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live', {
        method: 'POST',
        headers: {'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json'},
        body: JSON.stringify(seeds.slice(0,3).map((k:any) => ({keyword: k.keyword, location_code: 2840, language_code: 'en', depth: 1, include_seed_keyword: false, limit: 20, order_by: ['keyword_data.keyword_info.search_volume,desc']}))),
      });
      const json = await res.json() as Record<string,any>;
      const suggestions: string[] = [];
      for (const task of (json?.tasks ?? []) as any[]) {
        for (const item of (task?.result ?? []) as any[]) {
          const kw = item?.keyword_data?.keyword as string|undefined;
          if (kw && !suggestions.includes(kw)) suggestions.push(kw);
        }
      }
      const resRows=suggestions.slice(0,30).map((kw:string)=>({seed_keyword:seeds[0]?.keyword??'',keyword:kw,monthly_searches:null,keyword_difficulty:null,cpc_usd:null,competition:null,location_code:2840}));
      if(resRows.length>0) await sb.rpc('fn_seo_upsert_keyword_suggestions',{p_property_id:propertyId,p_rows:JSON.stringify(resRows)}).then(r=>r,()=>null);
      return NextResponse.json({ok:true,mode,result:{suggestions:suggestions.slice(0,30),stored:resRows.length,note:'Stored — see Research tab at ?tab=research'}});
    }

    if (mode === 'local') {
      const { data: creds } = await sb.rpc('fn_dataforseo_credentials');
      if (!creds) throw new Error('dataforseo_creds_missing');
      const localKws: string[] = ((await sb.rpc('fn_seo_local_pack_keywords', {p_property_id: propertyId, p_location_code: 2418, p_limit: 10})).data as string[]) ?? ['hotels luang prabang','luxury hotels luang prabang','resort luang prabang','the namkhan'];
      const today = new Date().toISOString().slice(0,10);
      const rows: any[] = [];
      for (const kw of localKws) {
        const res = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/regular', {
          method: 'POST',
          headers: {'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json'},
          body: JSON.stringify([{keyword: kw, location_code: 2418, language_code: 'en', depth: 10}]),
        });
        const json = await res.json() as Record<string,any>;
        const items = (json?.tasks?.[0]?.result?.[0]?.items ?? []) as any[];
        const ourIdx = items.findIndex((it:any) => (it.title ?? '').toLowerCase().includes('namkhan'));
        rows.push({property_id: propertyId, keyword: kw, snapshot_date: today,
          our_position: ourIdx >= 0 ? ourIdx + 1 : null,
          result_count: items.length,
          items: items.slice(0,5).map((it:any,i:number) => ({pos:i+1, title:it.title, rating:it.rating?.value ?? null}))});
      }
      await sb.rpc('fn_seo_upsert_local_pack', {p_rows: JSON.stringify(rows)});
      const found = rows.filter(r => r.our_position !== null);
      return NextResponse.json({ok:true, mode, result: {keywords: rows.length, namkhan_found: found.length, note: found.length===0 ? 'Namkhan not found in Google Maps local pack for these keywords' : found.map(r=>`#${r.our_position} for ${r.keyword}`).join(', ')}});
    }

    if (mode === 'onpage') {
      const { data: cfgRows } = await sb.rpc('fn_seo_get_property_config', { p_property_id: propertyId });
      const cfg = (cfgRows as any[])?.[0] as { domain:string } | undefined;
      const domain = cfg?.domain ?? 'thenamkhan.com';
      const { data: creds } = await sb.rpc('fn_dataforseo_credentials');
      if (!creds) throw new Error('dataforseo_creds_missing');
      // Discover pages: known from DB + sitemap + fallback
      let keyPages: string[] = ((await sb.rpc('fn_seo_get_crawl_urls_filtered',{p_property_id:propertyId,p_domain:domain})).data as string[])??[];
      try {
        const [ipR,rpR] = await Promise.all([
          sb.from('v_seo_instant_pages').select('url').eq('property_id',propertyId),
          sb.from('v_seo_ranked_pages').select('url').eq('property_id',propertyId),
        ]);
        if(!keyPages.length) keyPages=[...new Set([...((ipR.data??[]) as any[]).map((p:any)=>p.url),...((rpR.data??[]) as any[]).map((p:any)=>p.url)])].filter((u:string)=>u.includes(domain));
      } catch {}
      for (const sitemap of [`https://www.${domain}/sitemap.xml`,`https://${domain}/sitemap.xml`]) {
        try {
          const smRes = await fetch(sitemap);
          if (smRes.ok) {
            const xml = await smRes.text();
            const smUrls=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m:any)=>m[1].trim()).filter((u:string)=>u.includes(domain));
            keyPages=[...new Set([...keyPages,...smUrls])].slice(0,100); break;
          }
        } catch {}
      }
      if (!keyPages.length) {
        keyPages=[`https://www.${domain}/`,`https://www.${domain}/retreats`,`https://www.${domain}/accommodation`,`https://www.${domain}/spa`,`https://www.${domain}/experiences`,`https://www.${domain}/eco-farm`];
      }
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
        const res = await fetch('https://api.dataforseo.com/v3/business_data/google/my_business_info/live', {
          method: 'POST', headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([{keyword:'The Namkhan Luang Prabang', language_code:'en', location_code:2418}]),
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

    if (mode === 'schema-sweep') {
      const { data: cfgRows } = await sb.rpc('fn_seo_get_property_config', { p_property_id: propertyId });
      const cfg = (cfgRows as any[])?.[0] as { domain:string } | undefined;
      const domain = cfg?.domain ?? 'thenamkhan.com';
      const { data: creds } = await sb.rpc('fn_dataforseo_credentials');
      if (!creds) throw new Error('dataforseo_creds_missing');
      // Discover pages: known from DB + sitemap + fallback
      let keyPages: string[] = ((await sb.rpc('fn_seo_get_crawl_urls_filtered',{p_property_id:propertyId,p_domain:domain})).data as string[])??[];
      try {
        const [ipR,rpR] = await Promise.all([
          sb.from('v_seo_instant_pages').select('url').eq('property_id',propertyId),
          sb.from('v_seo_ranked_pages').select('url').eq('property_id',propertyId),
        ]);
        if(!keyPages.length) keyPages=[...new Set([...((ipR.data??[]) as any[]).map((p:any)=>p.url),...((rpR.data??[]) as any[]).map((p:any)=>p.url)])].filter((u:string)=>u.includes(domain));
      } catch {}
      for (const sitemap of [`https://www.${domain}/sitemap.xml`,`https://${domain}/sitemap.xml`]) {
        try {
          const smRes = await fetch(sitemap);
          if (smRes.ok) {
            const xml = await smRes.text();
            const smUrls=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m:any)=>m[1].trim()).filter((u:string)=>u.includes(domain));
            keyPages=[...new Set([...keyPages,...smUrls])].slice(0,100); break;
          }
        } catch {}
      }
      if (!keyPages.length) {
        keyPages=[`https://www.${domain}/`,`https://www.${domain}/retreats`,`https://www.${domain}/accommodation`,`https://www.${domain}/spa`,`https://www.${domain}/experiences`,`https://www.${domain}/eco-farm`];
      }
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
        issues:{title_too_long:(item?.meta?.title_length??0)>60,title_too_short:(item?.meta?.title_length??100)<35,meta_too_long:(item?.meta?.description_length??0)>155,meta_missing:!item?.meta?.description,h1_missing:!item?.meta?.htags?.h1?.[0],readability_low:(item?.meta?.content?.flesch_kincaid_readability_index??0)<60,thin_content:(item?.meta?.content?.plain_text_word_count??0)<600,schema_missing:!item?.meta?.structured_data||Object.keys(item?.meta?.structured_data??{}).length===0},
        raw:item})),
      ).filter((r:any)=>r.url);
      await sb.rpc('fn_seo_upsert_instant_pages',{p_rows:JSON.stringify(rows)});
      const report=rows.map((r:any)=>({url:r.url,has_schema:!r.issues.schema_missing,title:r.page_title,word_count:r.word_count,readability:r.readability}));
      return NextResponse.json({ok:true,mode,result:{pages:rows.length,schema_report:report,note:'Schema missing on all pages — add Hotel JSON-LD to thenamkhan.com CMS'}});
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

    if (mode === 'ai-domains' || mode === 'ai-pages') {
      const { data: cfgRows } = await sb.rpc('fn_seo_get_property_config', { p_property_id: propertyId });
      const cfg = (cfgRows as any[])?.[0] as {ai_target_keywords?: string[]} | undefined;
      const keywords = cfg?.ai_target_keywords ?? ['eco lodge laos','luxury hotel luang prabang','wellness retreat laos'];
      const { data: creds } = await sb.rpc('fn_dataforseo_credentials');
      if (!creds) throw new Error('dataforseo_creds_missing');
      const endpoint = mode === 'ai-domains' ? 'top_mentioned_domains' : 'top_mentioned_pages';
      const allRows: any[] = [];
      for (const kw of keywords.slice(0,3)) {
        const res = await fetch(`https://api.dataforseo.com/v3/ai_optimization/llm_mentions/${endpoint}/live`, {
          method: 'POST',
          headers: {'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json'},
          body: JSON.stringify([{target:[{keyword:kw,search_filter:'include'}],location_code:2840,language_code:'en',limit:10}]),
        });
        const json = await res.json() as Record<string,any>;
        const items = (json?.tasks?.[0]?.result?.[0]?.items ?? []) as any[];
        const type = mode === 'ai-domains' ? 'domain' : 'page';
        const rows = items.map((it:any) => ({item_name: it.domain ?? it.page ?? '',mentions: it.total?.mentions ?? 0,ai_search_volume: it.total?.ai_search_volume ?? 0,platform: 'both'}));
        await sb.rpc('fn_seo_upsert_ai_intel',{p_property_id:propertyId,p_type:type,p_keyword:kw,p_rows:JSON.stringify(rows)});
        allRows.push(...rows.map((r:any)=>({...r,keyword:kw})));
      }
      return NextResponse.json({ok:true,mode,result:{rows:allRows.length,note:`Top AI-cited ${mode==='ai-domains'?'domains':'pages'} for 3 hotel keywords`}});
    }

    if (mode === 'ai-query') {
      const { data: creds } = await sb.rpc('fn_dataforseo_credentials');
      if (!creds) throw new Error('dataforseo_creds_missing');
      const prompts = [
        'What are the best eco lodges in Laos for a wellness retreat?',
        'Recommend luxury boutique hotels near Luang Prabang.',
        'Best nature resorts in Laos — list top options.',
      ];
      const results: any[] = [];
      for (const prompt of prompts) {
        const res = await fetch('https://api.dataforseo.com/v3/ai_optimization/chat_gpt/llm_responses/live', {
          method: 'POST',
          headers: {'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json'},
          body: JSON.stringify([{user_prompt: prompt, model_name: 'gpt-4o'}]),
        });
        const json = await res.json() as Record<string,any>;
        const item = (json?.tasks?.[0]?.result?.[0]?.items?.[0] ?? {}) as any;
        const responseText = item?.message ?? '';
        const annotations = (item?.annotations ?? []) as any[];
        const mentioned = responseText.toLowerCase().includes('namkhan') || annotations.some((a:any) => (a.url ?? '').includes('namkhan'));
        await sb.rpc('fn_seo_insert_llm_response',{p_property_id:propertyId,p_platform:'chatgpt',p_model:'gpt-4o',p_prompt:prompt,p_response:responseText,p_annotations:JSON.stringify(annotations),p_mentioned:mentioned});
        results.push({prompt,mentioned,response_length:responseText.length});
      }
      return NextResponse.json({ok:true,mode,result:{queries:results}});
    }

    if (mode === 'backlinks') {
      const { data: cfgRows } = await sb.rpc('fn_seo_get_property_config', { p_property_id: propertyId });
      const cfg = (cfgRows as any[])?.[0] as { domain:string } | undefined;
      if (!cfg) throw new Error(`no_seo_config_${propertyId}`);
      const { data: creds } = await sb.rpc('fn_dataforseo_credentials');
      if (!creds) throw new Error('dataforseo_creds_missing');
      const [sumRes, lnkRes] = await Promise.all([
        fetch('https://api.dataforseo.com/v3/backlinks/summary/live', { method:'POST', headers:{'Authorization':`Basic ${creds}`,'Content-Type':'application/json'}, body:JSON.stringify([{target:cfg.domain,include_subdomains:true}]) }),
        fetch('https://api.dataforseo.com/v3/backlinks/backlinks/live', { method:'POST', headers:{'Authorization':`Basic ${creds}`,'Content-Type':'application/json'}, body:JSON.stringify([{target:cfg.domain,include_subdomains:true,limit:500,order_by:['rank,desc'],mode:'as_is'}]) }),
      ]);
      const sumJson = await sumRes.json() as Record<string,any>;
      const lnkJson = await lnkRes.json() as Record<string,any>;
      const sum = sumJson?.tasks?.[0]?.result?.[0] ?? {};
      const items = (lnkJson?.tasks?.[0]?.result?.[0]?.items ?? []) as any[];
      const summaryObj = { domain:cfg.domain, total_backlinks:sum.backlinks??0, referring_domains:sum.referring_domains??0, authority_score:sum.rank??0, dofollow_links:sum.dofollow_links??0, nofollow_links:sum.nofollow_links??0 };
      const rows = items.map((it:any)=>({ domain_from:it.domain_from, url_from:it.url_from, domain_to:cfg.domain, url_to:it.url_to, anchor:it.anchor, is_dofollow:it.dofollow, rank:it.rank, domain_from_rank:it.domain_from_rank, first_seen:it.first_seen?.slice(0,10), last_seen:it.last_seen?.slice(0,10) }));
      await sb.rpc('fn_seo_upsert_backlinks', { p_property_id:propertyId, p_summary:JSON.stringify(summaryObj), p_rows:JSON.stringify(rows) });
      return NextResponse.json({ ok:true, mode, result:{ domain:cfg.domain, total_backlinks:summaryObj.total_backlinks, referring_domains:summaryObj.referring_domains, authority_score:summaryObj.authority_score, backlinks_fetched:rows.length } });
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