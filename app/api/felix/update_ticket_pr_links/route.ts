import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * POST /api/felix/update_ticket_pr_links
 * 
 * Felix calls this to attach GitHub PR/commit links to a ticket.
 * 
 * Body: {
 *   ticket_id: string
 *   pr_url?: string
 *   commit_urls?: string[]
 *   branch_name?: string
 * }
 * 
 * Returns: { success: true } | { error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const body = await req.json()
    const { ticket_id, pr_url, commit_urls, branch_name } = body

    if (!ticket_id) {
      return NextResponse.json(
        { error: 'ticket_id required' },
        { status: 400 }
      )
    }

    // Fetch existing metadata
    const { data: ticketData, error: fetchError } = await supabase
      .from('tickets')
      .select('metadata')
      .eq('id', ticket_id)
      .single()

    if (fetchError || !ticketData) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    const existingMetadata = ticketData.metadata || {}
    const updatedMetadata = { ...existingMetadata }

    if (pr_url) updatedMetadata.pr_url = pr_url
    if (commit_urls) updatedMetadata.commit_urls = commit_urls
    if (branch_name) updatedMetadata.branch_name = branch_name

    // Update ticket
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
