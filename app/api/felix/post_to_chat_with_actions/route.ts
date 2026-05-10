import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * POST /api/felix/post_to_chat_with_actions
 * 
 * Felix calls this to post a message to a chat channel with optional action buttons.
 * 
 * Body: {
 *   channel_id: string
 *   message: string
 *   actions?: Array<{
 *     label: string
 *     action_type: 'approve' | 'reject' | 'escalate' | 'custom'
 *     action_payload?: Record<string, any>
 *   }>
 *   thread_id?: string (optional, for replies)
 *   metadata?: Record<string, any>
 * }
 * 
 * Returns: { success: true, message_id: string } | { error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const body = await req.json()
    const { channel_id, message, actions, thread_id, metadata } = body

    if (!channel_id || !message) {
      return NextResponse.json(
        { error: 'channel_id and message required' },
        { status: 400 }
      )
    }

    // Verify channel exists
    const { data: channelData, error: channelError } = await supabase
      .from('chat_channels')
      .select('id')
      .eq('id', channel_id)
      .single()

    if (channelError || !channelData) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      )
    }

    // Get Felix's user ID (system user)
    const { data: userData, error: userError } = await supabase
      .from('staff')
      .select('id')
      .eq('email', 'felix@namkhan.ai')
      .single()

    const sender_id = userData?.id || '00000000-0000-0000-0000-000000000001' // fallback system ID

    // Build message payload
    const messagePayload: any = {
      channel_id,
      sender_id,
      content: message,
      created_at: new Date().toISOString(),
    }

    if (thread_id) {
      messagePayload.thread_id = thread_id
    }

    if (actions && actions.length > 0) {
      messagePayload.actions = actions
    }

    if (metadata) {
      messagePayload.metadata = metadata
    }

    // Insert message
    const { data: msgData, error: msgError } = await supabase
      .from('chat_messages')
      .insert(messagePayload)
      .select('id')
      .single()

    if (msgError || !msgData) {
      return NextResponse.json(
        { error: 'Failed to post message', details: msgError?.message },
        { status: 500 }
      )
    }

    // Update channel last_activity
    await supabase
      .from('chat_channels')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', channel_id)

    return NextResponse.json({
      success: true,
      message_id: msgData.id,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    )
