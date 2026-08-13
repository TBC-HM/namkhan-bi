/**
 * Lighthouse Email Ingestion Edge Function
 * 
 * Fetches daily competitive rate reports from Gmail, parses Excel attachments,
 * and upserts data into revenue.lighthouse_rateshop.
 * 
 * Triggered daily at 03:30 UTC via pg_cron (job 139).
 * 
 * Flow:
 * 1. OAuth to Gmail API
 * 2. Search for Lighthouse report emails (from: noreply@lighthouse.app)
 * 3. Download Excel attachments
 * 4. Parse rate data (hotel, OTA, shop_date, stay_date, BAR rate, etc.)
 * 5. Batch upsert to revenue.lighthouse_rateshop
 * 6. Log run to revenue.lighthouse_ingest_runs
 * 
 * Error handling:
 * - Gmail auth failures logged and thrown (requires manual OAuth refresh)
 * - Parse errors logged but don't stop processing other attachments
 * - DB upsert conflicts ignored (ON CONFLICT DO UPDATE)
 * 
 * Data quality checks triggered by DQ rules R-LH-001, R-LH-002 (>36h staleness).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GMAIL_ACCESS_TOKEN = Deno.env.get('GMAIL_ACCESS_TOKEN')! // Stored in Supabase secrets

interface IngestRun {
  id: string
  status: 'success' | 'error'
  error_msg: string | null
  started_at: string
  finished_at: string
  report_type: string
  rows_parsed: number
  rows_upserted: number
  shop_date_range: string
  gmail_message_id: string
  attachment_filename: string
}

serve(async (req) => {
  const startedAt = new Date().toISOString()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    console.log('[LIGHTHOUSE] Starting daily ingestion run')

    // 1. Fetch recent unprocessed Gmail messages
    const messages = await fetchGmailMessages()
    console.log(`[LIGHTHOUSE] Found ${messages.length} Gmail messages`)

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No new Lighthouse emails', processed: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    let totalProcessed = 0
    const runs: IngestRun[] = []

    // 2. Process each message
    for (const msg of messages) {
      try {
        const attachment = await fetchAttachment(msg.id, msg.attachmentId)
        const workbook = XLSX.read(attachment, { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet)

        console.log(`[LIGHTHOUSE] Parsed ${rows.length} rows from ${msg.filename}`)

        // 3. Transform and upsert
        const { data, error } = await supabase.rpc('fn_upsert_lighthouse_rateshop', {
          p_rows: rows,
          p_source_file: msg.filename,
          p_gmail_message_id: msg.id
        })

        if (error) throw error

        const run: IngestRun = {
          id: crypto.randomUUID(),
          status: 'success',
          error_msg: null,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          report_type: detectReportType(msg.filename),
          rows_parsed: rows.length,
          rows_upserted: data?.rows_upserted || 0,
          shop_date_range: data?.shop_date_range || '[unknown,unknown)',
          gmail_message_id: msg.id,
          attachment_filename: msg.filename
        }

        // 4. Log run
        await supabase.from('lighthouse_ingest_runs').insert(run)
        runs.push(run)
        totalProcessed++

      } catch (err) {
        console.error(`[LIGHTHOUSE] Failed to process message ${msg.id}:`, err)
        // Log error run but continue processing other messages
        const errorRun: IngestRun = {
          id: crypto.randomUUID(),
          status: 'error',
          error_msg: String(err),
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          report_type: 'unknown',
          rows_parsed: 0,
          rows_upserted: 0,
          shop_date_range: '[unknown,unknown)',
          gmail_message_id: msg.id,
          attachment_filename: msg.filename || 'unknown'
        }
        await supabase.from('lighthouse_ingest_runs').insert(errorRun)
        runs.push(errorRun)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        total_messages: messages.length,
        runs
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[LIGHTHOUSE] Fatal error:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Fetch unprocessed Lighthouse emails from Gmail
 */
async function fetchGmailMessages() {
  const query = 'from:noreply@lighthouse.app subject:"Rate Shopping Report" has:attachment newer_than:7d'
  
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `Bearer ${GMAIL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  const messages = data.messages || []

  // Fetch full message details for each
  const fullMessages = []
  for (const msg of messages.slice(0, 10)) { // Limit to 10 most recent
    const detail = await fetchMessageDetail(msg.id)
    if (detail) fullMessages.push(detail)
  }

  return fullMessages
}

/**
 * Fetch message detail including attachment metadata
 */
async function fetchMessageDetail(messageId: string) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
    {
      headers: {
        Authorization: `Bearer ${GMAIL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response.ok) return null

  const msg = await response.json()
  const parts = msg.payload?.parts || []
  
  for (const part of parts) {
    if (part.filename && part.filename.endsWith('.xlsx')) {
      return {
        id: messageId,
        attachmentId: part.body.attachmentId,
        filename: part.filename
      }
    }
  }

  return null
}

/**
 * Download attachment binary data
 */
async function fetchAttachment(messageId: string, attachmentId: string) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    {
      headers: {
        Authorization: `Bearer ${GMAIL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch attachment: ${response.status}`)
  }

  const data = await response.json()
  // Gmail returns base64url-encoded data
  const base64 = data.data.replace(/-/g, '+').replace(/_/g, '/')
  const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  return binary
}

/**
 * Detect report type from filename patterns
 */
function detectReportType(filename: string): string {
  if (filename.includes('_major_')) return 'rate_integrity'
  if (filename.includes('_bookingdotcom_')) return 'rateshopping'
  if (filename.includes('_agoda_')) return 'rateshopping'
  return 'unknown'
}
