// ingest-lighthouse-mails v5
// Daily Gmail-attachment ingest for two Lighthouse reports arriving at pb@thenamkhan.com.
// v5: adds ?report=<rateshopping|rate_integrity> single-report mode, ?maxMails=N cap,
//     and pre-skip of already-loaded shop_dates to avoid re-parsing full XLSX. Prevents
//     WORKER_RESOURCE_LIMIT during multi-month backfills.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const PROPERTY_ID = 260955;
const GMAIL_ADDRESS = 'pb@thenamkhan.com';
const REPORTS = [
  { report_type: 'rateshopping',   subject: 'Morning Rateshopping Report - The Namkhan, a Small Luxury Hotel of the World',   attachment_regex: /bookingdotcom_lowest_los1_2guests\.xlsx$/i, feed_source: 'email_auto' },
  { report_type: 'rate_integrity', subject: 'Morning Rate Integrity Report - The Namkhan, a Small Luxury Hotel of the World', attachment_regex: /major_lowest_los1_2guests\.xlsx$/i,          feed_source: 'integrity'  },
];

type Row = Record<string, unknown>;

function parseNumericRate(v: unknown): { bar_rate: number | null; rate_status: 'rate' | 'no_flex' | 'sold_out' | 'no_data'; rate_status_raw: string | null } {
  if (v === null || v === undefined || v === '') return { bar_rate: null, rate_status: 'no_data', rate_status_raw: null };
  const s = String(v).trim();
  if (!s) return { bar_rate: null, rate_status: 'no_data', rate_status_raw: null };
  const low = s.toLowerCase();
  if (low.includes('sold out') || low === 'so')            return { bar_rate: null, rate_status: 'sold_out', rate_status_raw: s };
  if (low.includes('no flex') || low.includes('noflex'))   return { bar_rate: null, rate_status: 'no_flex',  rate_status_raw: s };
  if (low.includes('no data') || low === '-' || low === 'n/a') return { bar_rate: null, rate_status: 'no_data', rate_status_raw: s };
  const num = Number(s.replace(/[^0-9.\-]/g, ''));
  if (Number.isFinite(num) && num > 0) return { bar_rate: num, rate_status: 'rate', rate_status_raw: null };
  return { bar_rate: null, rate_status: 'no_data', rate_status_raw: s };
}

function parseDDMMYYYY(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (m) { const [_, d, mo, y] = m; return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`; }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return null;
}

function parsePct(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).replace('%', '').trim();
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n > 1.5 ? n / 100 : n;
}

function b64UrlDecode(s: string): Uint8Array {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function shopDateFromMsg(internalDate: string): string {
  const d = new Date(Number(internalDate));
  const shifted = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

async function getGmailAccessToken(sb: ReturnType<typeof createClient>, gmailAddress: string): Promise<string> {
  const { data: creds, error: credsErr } = await sb.rpc('fn_gmail_get_refresh_creds', { p_gmail_address: gmailAddress });
  if (credsErr) throw new Error(`get_refresh_creds_failed: ${credsErr.message}`);
  const row = Array.isArray(creds) ? creds[0] : creds;
  if (!row) throw new Error(`no_gmail_connection_for_${gmailAddress}`);
  const { access_token, refresh_token, expires_at, client_id, client_secret } = row as any;
  if (access_token && expires_at && new Date(expires_at).getTime() > Date.now() + 120_000) return access_token as string;
  if (!refresh_token) throw new Error(`no_refresh_token_for_${gmailAddress}`);
  if (!client_id || !client_secret) throw new Error('vault_missing_google_client_creds');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id, client_secret, refresh_token, grant_type: 'refresh_token' }),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) throw new Error(`refresh_failed_${res.status}: ${JSON.stringify(body)}`);
  const newAt = body.access_token as string;
  const expIn = Number(body.expires_in ?? 3600);
  const { error: persistErr } = await sb.rpc('fn_gmail_persist_access_token', {
    p_gmail_address: gmailAddress, p_access_token: newAt, p_expires_in_seconds: expIn,
  });
  if (persistErr) console.error('persist_failed', persistErr.message);
  return newAt;
}

async function gmailList(token: string, q: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | null = null;
  do {
    const u = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    u.searchParams.set('q', q); u.searchParams.set('maxResults', '50');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`gmail_list_${res.status}: ${await res.text()}`);
    const j = await res.json();
    for (const m of (j.messages || [])) ids.push(m.id);
    pageToken = j.nextPageToken || null;
  } while (pageToken);
  return ids;
}

async function gmailGet(token: string, id: string, format = 'full'): Promise<any> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=${format}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`gmail_get_${res.status}`);
  return await res.json();
}

async function gmailAttachment(token: string, msgId: string, attId: string): Promise<Uint8Array> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${attId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`gmail_att_${res.status}`);
  const j = await res.json();
  return b64UrlDecode(j.data as string);
}

function findAttachment(msg: any, regex: RegExp): { filename: string; attachmentId: string } | null {
  const parts = msg.payload?.parts || [];
  for (const p of parts) {
    const fn = p.filename as string | undefined;
    const attId = p.body?.attachmentId as string | undefined;
    if (fn && attId && regex.test(fn)) return { filename: fn, attachmentId: attId };
  }
  return null;
}

function sheetToGrid(ws: XLSX.WorkSheet): (string | null)[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) as (string | null)[][];
}

function findHeaderRowIdx(grid: (string | null)[][]): number {
  for (let i = 0; i < Math.min(grid.length, 20); i++) {
    const row = grid[i] || [];
    const cells = row.map((c) => (typeof c === 'string' ? c.trim().toLowerCase() : ''));
    if (cells.includes('day') && cells.includes('date')) return i;
  }
  return -1;
}

type RateshopParsedRow = { stay_date: string; market_demand: number | null; median_compset: number | null; compset_rank: string | null; ota_ranking: string | null; holidays: string | null; events: string | null; by_hotel: Record<string, unknown>; };
function parseRateshopXlsx(bytes: Uint8Array): RateshopParsedRow[] {
  const wb = XLSX.read(bytes, { type: 'array', cellDates: false });
  const overview = wb.Sheets['Overview']; const rates = wb.Sheets['Rates'];
  if (!overview || !rates) return [];
  const oGrid = sheetToGrid(overview); const rGrid = sheetToGrid(rates);
  const oHeaderIdx = findHeaderRowIdx(oGrid); const rHeaderIdx = findHeaderRowIdx(rGrid);
  if (oHeaderIdx < 0 || rHeaderIdx < 0) return [];
  const oHeader = oGrid[oHeaderIdx];
  const oColIdx = (label: string) => oHeader.findIndex((h) => typeof h === 'string' && h.trim().toLowerCase() === label.toLowerCase());
  const oDateIdx = oColIdx('Date'), oMedIdx = oColIdx('Median lowest compset'), oRankIdx = oColIdx('Compset price rank'),
        oDemandIdx = oColIdx('Market demand'), oBkgRankIdx = oColIdx('Booking.com Ranking'),
        oHolidaysIdx = oColIdx('Holidays'), oEventsIdx = oColIdx('Events');
  const contextByDate = new Map<string, Partial<RateshopParsedRow>>();
  for (let i = oHeaderIdx + 1; i < oGrid.length; i++) {
    const row = oGrid[i]; if (!row) continue;
    const stay = parseDDMMYYYY(row[oDateIdx]); if (!stay) continue;
    contextByDate.set(stay, {
      stay_date: stay,
      market_demand: oDemandIdx >= 0 ? parsePct(row[oDemandIdx]) : null,
      median_compset: oMedIdx >= 0 ? (Number(String(row[oMedIdx] ?? '').replace(/[^0-9.\-]/g, '')) || null) : null,
      compset_rank: oRankIdx >= 0 ? (row[oRankIdx] as string | null) : null,
      ota_ranking: oBkgRankIdx >= 0 ? (row[oBkgRankIdx] as string | null) : null,
      holidays: oHolidaysIdx >= 0 ? (row[oHolidaysIdx] as string | null) : null,
      events: oEventsIdx >= 0 ? (row[oEventsIdx] as string | null) : null,
    });
  }
  const rHeader = rGrid[rHeaderIdx];
  const rDateIdx = rHeader.findIndex((h) => typeof h === 'string' && h.trim().toLowerCase() === 'date');
  const knownContextLabels = new Set(['day', 'date', 'market demand']);
  const hotelCols: { idx: number; name: string }[] = [];
  for (let c = 0; c < rHeader.length; c++) {
    const h = rHeader[c]; if (typeof h !== 'string') continue;
    const t = h.trim(); if (!t) continue;
    if (knownContextLabels.has(t.toLowerCase())) continue;
    hotelCols.push({ idx: c, name: t });
  }
  const out: RateshopParsedRow[] = [];
  for (let i = rHeaderIdx + 1; i < rGrid.length; i++) {
    const row = rGrid[i]; if (!row) continue;
    const stay = parseDDMMYYYY(row[rDateIdx]); if (!stay) continue;
    const ctx = contextByDate.get(stay) || {};
    const byHotel: Record<string, unknown> = {};
    for (const hc of hotelCols) byHotel[hc.name] = row[hc.idx];
    out.push({
      stay_date: stay,
      market_demand: (ctx.market_demand as number | null) ?? null,
      median_compset: (ctx.median_compset as number | null) ?? null,
      compset_rank: (ctx.compset_rank as string | null) ?? null,
      ota_ranking: (ctx.ota_ranking as string | null) ?? null,
      holidays: (ctx.holidays as string | null) ?? null,
      events: (ctx.events as string | null) ?? null,
      by_hotel: byHotel,
    });
  }
  return out;
}

type IntegrityParsedRow = { stay_date: string; by_ota: Record<string, unknown>; };
function parseIntegrityXlsx(bytes: Uint8Array): IntegrityParsedRow[] {
  const wb = XLSX.read(bytes, { type: 'array', cellDates: false });
  const sheetName = wb.SheetNames.find((n) => /rate\s*integrity/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName]; const grid = sheetToGrid(ws);
  const headerIdx = findHeaderRowIdx(grid); if (headerIdx < 0) return [];
  const header = grid[headerIdx];
  const dateIdx = header.findIndex((h) => typeof h === 'string' && h.trim().toLowerCase() === 'date');
  const knownCtx = new Set(['day', 'date']);
  const otaCols: { idx: number; name: string }[] = [];
  for (let c = 0; c < header.length; c++) {
    const h = header[c]; if (typeof h !== 'string') continue;
    const t = h.trim(); if (!t || knownCtx.has(t.toLowerCase())) continue;
    otaCols.push({ idx: c, name: t });
  }
  const out: IntegrityParsedRow[] = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i]; if (!row) continue;
    const stay = parseDDMMYYYY(row[dateIdx]); if (!stay) continue;
    const byOta: Record<string, unknown> = {};
    for (const oc of otaCols) byOta[oc.name] = row[oc.idx];
    out.push({ stay_date: stay, by_ota: byOta });
  }
  return out;
}

type AliasMap = Map<string, { comp_id: string; is_self: boolean }>;
function normHotel(s: string): string { return s.trim().toLowerCase().replace(/\s+/g, ' '); }
async function loadAliasMap(sb: ReturnType<typeof createClient>): Promise<AliasMap> {
  const { data, error } = await sb.from('v_lighthouse_hotel_alias').select('*').eq('property_id', PROPERTY_ID);
  const map: AliasMap = new Map();
  if (error || !data) return map;
  for (const row of data as any[]) map.set(normHotel(row.lighthouse_name), { comp_id: row.comp_id, is_self: !!row.is_self });
  return map;
}

async function loadExistingShopDates(sb: ReturnType<typeof createClient>, feedSource: string): Promise<Set<string>> {
  const out = new Set<string>();
  const { data, error } = await sb.from('v_lighthouse_shop_dates').select('shop_date').eq('feed_source', feedSource);
  if (!error && data) for (const r of data as any[]) out.add(String(r.shop_date));
  return out;
}

function flattenRateshop(parsed: RateshopParsedRow[], shopDate: string, sourceFile: string, aliases: AliasMap): Row[] {
  const rows: Row[] = []; const ota = 'booking.com';
  for (const p of parsed) {
    for (const [hotelName, cell] of Object.entries(p.by_hotel)) {
      const parsedCell = parseNumericRate(cell);
      const alias = aliases.get(normHotel(hotelName));
      rows.push({
        property_id: PROPERTY_ID, ota, shop_date: shopDate, stay_date: p.stay_date,
        hotel_name: hotelName, comp_id: alias?.comp_id ?? null, is_self: alias?.is_self ?? false,
        bar_rate: parsedCell.bar_rate, rate_status: parsedCell.rate_status, currency: 'USD',
        median_compset: p.median_compset ?? null, compset_rank: p.compset_rank ?? null,
        ota_ranking: p.ota_ranking ?? null, market_demand: p.market_demand ?? null,
        holidays: p.holidays ?? null, events: p.events ?? null, los_nights: 1, guests: 2,
        source_file: sourceFile, imported_at: new Date().toISOString(),
        rate_status_raw: parsedCell.rate_status_raw, feed_source: 'email_auto',
      });
    }
  }
  return rows;
}

function flattenIntegrity(parsed: IntegrityParsedRow[], shopDate: string, sourceFile: string): Row[] {
  const rows: Row[] = []; const OWN = 'The Namkhan, a Small Luxury Hotel of the World';
  for (const p of parsed) {
    for (const [otaName, cell] of Object.entries(p.by_ota)) {
      const parsedCell = parseNumericRate(cell);
      rows.push({
        property_id: PROPERTY_ID, ota: otaName.toLowerCase(), shop_date: shopDate, stay_date: p.stay_date,
        hotel_name: OWN, comp_id: null, is_self: true,
        bar_rate: parsedCell.bar_rate, rate_status: parsedCell.rate_status, currency: 'USD',
        median_compset: null, compset_rank: null, ota_ranking: null, market_demand: null,
        holidays: null, events: null, los_nights: 1, guests: 2,
        source_file: sourceFile, imported_at: new Date().toISOString(),
        rate_status_raw: parsedCell.rate_status_raw, feed_source: 'integrity',
      });
    }
  }
  return rows;
}

async function logRun(sb: ReturnType<typeof createClient>, args: Record<string, unknown>) { await sb.rpc('fn_lighthouse_ingest_run_insert', args); }

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const daysParam = Number(url.searchParams.get('days') ?? '1');
    const days = Math.max(1, Math.min(365, Number.isFinite(daysParam) ? daysParam : 1));
    const reportFilter = (url.searchParams.get('report') || '').toLowerCase();
    const maxMailsParam = Number(url.searchParams.get('maxMails') ?? '0');
    const maxMails = Math.max(0, Number.isFinite(maxMailsParam) ? maxMailsParam : 0);
    const skipExisting = (url.searchParams.get('skipExisting') || 'true').toLowerCase() !== 'false';

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = await getGmailAccessToken(sb, GMAIL_ADDRESS);

    const aliases = await loadAliasMap(sb);
    const summary: any[] = [];

    const reportsToRun = reportFilter
      ? REPORTS.filter(r => r.report_type === reportFilter || r.feed_source === reportFilter)
      : REPORTS;

    for (const cfg of reportsToRun) {
      const existing = skipExisting ? await loadExistingShopDates(sb, cfg.feed_source) : new Set<string>();
      const q = `subject:"${cfg.subject}" newer_than:${days}d`;
      let msgIds: string[] = [];
      try { msgIds = await gmailList(token, q); }
      catch (e) {
        await logRun(sb, { p_report_type: cfg.report_type, p_status: 'error', p_error_msg: `list_failed: ${e instanceof Error ? e.message : String(e)}` });
        summary.push({ report_type: cfg.report_type, status: 'error', error: 'list_failed' });
        continue;
      }
      if (msgIds.length === 0) {
        await logRun(sb, { p_report_type: cfg.report_type, p_status: 'no_email' });
        summary.push({ report_type: cfg.report_type, status: 'no_email' });
        continue;
      }

      let processed = 0;
      let skipped = 0;
      for (const msgId of msgIds) {
        if (maxMails > 0 && processed >= maxMails) break;
        const runStart = new Date().toISOString();
        try {
          // Metadata-only fetch to determine shop_date cheaply; skip if already loaded
          const meta = await gmailGet(token, msgId, 'metadata');
          const shopDatePre = shopDateFromMsg(meta.internalDate);
          if (skipExisting && existing.has(shopDatePre)) { skipped++; continue; }

          const msg = await gmailGet(token, msgId, 'full');
          const att = findAttachment(msg, cfg.attachment_regex);
          if (!att) {
            await logRun(sb, { p_report_type: cfg.report_type, p_gmail_message_id: msgId, p_status: 'no_attachment', p_started_at: runStart });
            summary.push({ report_type: cfg.report_type, msgId, status: 'no_attachment' });
            processed++;
            continue;
          }
          const shopDate = shopDateFromMsg(msg.internalDate);
          const bytes = await gmailAttachment(token, msgId, att.attachmentId);
          let rows: Row[];
          if (cfg.report_type === 'rateshopping') {
            rows = flattenRateshop(parseRateshopXlsx(bytes), shopDate, att.filename, aliases);
          } else {
            rows = flattenIntegrity(parseIntegrityXlsx(bytes), shopDate, att.filename);
          }
          let insTotal = 0;
          for (let i = 0; i < rows.length; i += 500) {
            const chunk = rows.slice(i, i + 500);
            const { data: rpcRes, error: rpcErr } = await sb.rpc('fn_lighthouse_rateshop_upsert_batch', { p_rows: chunk });
            if (rpcErr) throw new Error(`upsert_failed: ${rpcErr.message}`);
            const first = Array.isArray(rpcRes) ? rpcRes[0] : rpcRes;
            insTotal += Number((first as any)?.inserted ?? 0);
          }
          await logRun(sb, {
            p_report_type: cfg.report_type, p_gmail_message_id: msgId, p_attachment_filename: att.filename,
            p_shop_date_min: shopDate, p_shop_date_max: shopDate, p_rows_parsed: rows.length,
            p_rows_upserted: insTotal, p_status: 'success', p_started_at: runStart,
          });
          summary.push({ report_type: cfg.report_type, msgId, shopDate, rows_parsed: rows.length, rows_upserted: insTotal });
          processed++;
        } catch (e) {
          await logRun(sb, { p_report_type: cfg.report_type, p_gmail_message_id: msgId, p_status: 'error', p_error_msg: e instanceof Error ? e.message : String(e), p_started_at: runStart });
          summary.push({ report_type: cfg.report_type, msgId, status: 'error', error: e instanceof Error ? e.message : String(e) });
          processed++;
        }
      }
      summary.push({ report_type: cfg.report_type, meta: { mails_listed: msgIds.length, processed, skipped_existing: skipped } });
    }

    return new Response(JSON.stringify({ ok: true, days, report: reportFilter || 'all', maxMails, summary }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
