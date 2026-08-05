// app/api/cockpit/chat/summarize/route.ts
// Summarize a conversation thread using Claude
// Brief: central-chat-missing-ui-features
// POST { conversation_id }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic } from '@/lib/mail/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { conversation_id } = body as { conversation_id?: string };

    if (!conversation_id) {
      return NextResponse.json(
        { ok: false, error: 'conversation_id required' },
        { status: 400 }
      );
    }

    const sb = getSupabaseAdmin();
    
    // Get conversation messages
    const { data: messages, error: msgError } = await sb
      .from('v_chat_messages')
      .select('turn_role, content_md, created_at')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true });

    if (msgError || !messages || messages.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Conversation not found or has no messages' },
        { status: 404 }
      );
    }

    // Build thread text
    const threadText = messages
      .map((m: any) => `${m.turn_role === 'user' ? 'User' : 'Assistant'}: ${m.content_md}`)
      .join('\n\n');

    // Call Claude to summarize (fast tier)
    const summary = await callAnthropic({
      system: 'You are a concise summarizer. Output 3-5 bullet points only.',
      prompt: `Summarize this conversation thread. Focus on key decisions, outcomes, and action items:\n\n${threadText}`,
      maxTokens: 500,
    });

    // Update the conversation summary
    const { error: updateError } = await sb
      .from('conversations')
      .update({ summary_md: summary })
      .eq('id', conversation_id);

    if (updateError) {
      console.error('Failed to save summary:', updateError);
    }

    return NextResponse.json({
      ok: true,
      summary,
      message_count: messages.length,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    );
  }
}