import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const supabase = createClient()

    // Calculate 24h window - use UTC to avoid timezone issues
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Fetch emails from last 24h
    const { data: emails, error } = await supabase
      .from('gmail_messages')
      .select('id, message_id, thread_id, from_email, to_email, subject, snippet, received_at, labels')
      .gte('received_at', twentyFourHoursAgo.toISOString())
      .order('received_at', { ascending: false })

    if (error) {
      console.error('[inbox/summary] Error fetching emails:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count incoming vs outgoing
    // Incoming: emails where we are in the 'to' field
    // Outgoing: emails where we are in the 'from' field or have SENT label
    const ourDomain = '@namkhan.com' // Adjust if needed
    
    let emailsIn = 0
    let emailsOut = 0

    for (const email of emails || []) {
      const labels = email.labels || []
      const isSent = labels.includes('SENT') || labels.includes('Sent')
      const isDraft = labels.includes('DRAFT') || labels.includes('Draft')
      
      // Skip drafts
      if (isDraft) continue

      if (isSent) {
        emailsOut++
      } else {
        emailsIn++
      }
    }

    return NextResponse.json({
      success: true,
      window: '24h',
      emailsIn,
      emailsOut,
      total: (emails || []).length,
      windowStart: twentyFourHoursAgo.toISOString(),
      windowEnd: now.toISOString()
    })
  } catch (err: any) {
    console.error('[inbox/summary] Unexpected error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}