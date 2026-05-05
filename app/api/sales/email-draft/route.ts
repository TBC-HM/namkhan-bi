// POST /api/sales/email-draft
// Creates a draft email in sales.email_drafts. Three modes:
//   - mode='ai' + thread_id        → call Anthropic to draft a reply using thread context
//   - mode='ai' + intent='compose' → call Anthropic to draft a fresh email from a brief
//   - mode='manual'                → operator-typed draft, just persist
//   - mode='template' + template_key → load template, persist as draft
//
// Auth: NEXT_PUBLIC_SUPABASE_ANON_KEY guard on Authorization header is intentionally
// soft. The route is server-side only; we trust the operator session via cookies in
// a future step. For now, the action is gated behind /sales/inquiries which is admin.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface DraftBody {
  mode: 'ai' | 'manual' | 'template';
  intent?: 'reply' | 'compose' | 'outreach';
  thread_id?: string | null;
  to_emails?: string[];
  cc_emails?: string[];
  subject?: string;
  body_md?: string;
  brief?: string;             // for ai+compose / outreach
  tone?: string;              // 'warm' | 'neutral' | 'formal'
  template_key?: string;
  created_by?: string;
  prospect_id?: string;        // outreach to a sales.prospects row
  cohort_id?: string;          // outreach to a sales.guest_cohorts row
}

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

const BRAND_VOICE = `You write on behalf of The Namkhan, a riverside boutique hotel and retreat in Luang Prabang, Laos. Tone: warm, personal, never servile, never gushing. Short paragraphs. British-leaning English (favour "we are" over contractions in confirmations). Sign as "The Namkhan Reservations Team" unless context implies a different department (Wellness, B2B, Front Office). Never invent specific rates, dates, or availability — defer to the operator if details aren't in the brief or thread. Keep total length under 220 words for replies, 160 for cold composes.`;

async function aiDraftReplyForThread(threadId: string): Promise<{ subject: string; body: string }> {
  const sb = getSupabaseAdmin();
  const { data: msgs } = await sb.schema('sales').from('email_messages')
    .select('direction,from_email,from_name,subject,body_text,received_at,intended_mailbox')
    .eq('property_id', PROPERTY_ID).eq('thread_id', threadId)
    .order('received_at', { ascending: true });

  const messages = (msgs ?? []) as Array<{
    direction: 'inbound'|'outbound';
    from_email: string | null; from_name: string | null;
    subject: string | null; body_text: string | null;
    received_at: string; intended_mailbox: string | null;
  }>;
  if (messages.length === 0) throw new Error('thread has no messages');

  const subject = messages[0].subject ?? '';
  const last = messages[messages.length - 1];
  const transcript = messages.map((m) => {
    const who = m.direction === 'outbound' ? 'Namkhan' : `${m.from_name ?? m.from_email ?? 'Guest'}`;
    const body = (m.body_text ?? '').slice(0, 1500);
    return `[${who} · ${m.received_at}]\n${body}`;
  }).join('\n\n---\n\n');

  const userPrompt = `Draft a reply to the most recent ${last.direction === 'inbound' ? 'guest message' : 'thread state'}. Reply only with the body of the email, no salutation prelude beyond "Dear …" and no markdown fences. If essential facts are missing (rate, dates, room, payment status), insert a clearly bracketed placeholder like [check Cloudbeds for availability on {{date}}] rather than inventing.\n\nThread (oldest first):\n\n${transcript}`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      system: BRAND_VOICE,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json() as { content: Array<{ type: string; text: string }> };
  const body = (j.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  return { subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`, body };
}

async function aiDraftCompose(brief: string, tone: string = 'warm'): Promise<{ subject: string; body: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const userPrompt = `Tone: ${tone}.\n\nWrite a fresh outbound email based on this brief:\n\n${brief}\n\nReturn the response as two parts separated by a single line "---":\n\nSUBJECT: <one line subject, max 70 chars>\n---\n<body>`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      system: BRAND_VOICE,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json() as { content: Array<{ type: string; text: string }> };
  const raw = (j.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  const lines = raw.split('\n');
  const subjLine = lines.find(l => l.toLowerCase().startsWith('subject:'));
  const subject = subjLine ? subjLine.replace(/^subject:\s*/i, '').trim() : '(no subject)';
  const sepIdx = lines.findIndex(l => l.trim() === '---');
  const body = sepIdx >= 0 ? lines.slice(sepIdx + 1).join('\n').trim() : raw;
  return { subject, body };
}

export async function POST(req: Request) {
  let body: DraftBody;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const sb = getSupabaseAdmin();
  let subject = body.subject ?? '';
  let body_md = body.body_md ?? '';
  let generator: 'human' | 'agent' | 'template' = 'human';
  let agent_name: string | null = null;
  let template_key: string | null = null;

  try {
    if (body.mode === 'ai') {
      generator = 'agent';
      agent_name = body.intent === 'outreach' ? 'lead-outreacher' : 'cockpit-drafter';
      if (body.thread_id) {
        const out = await aiDraftReplyForThread(body.thread_id);
        subject = out.subject;
        body_md = out.body;
      } else if ((body.intent === 'compose' || body.intent === 'outreach') && body.brief) {
        // Enrich the brief with prospect / cohort context if provided
        let brief = body.brief;
        if (body.prospect_id) {
          const { data: p } = await sb.schema('sales').from('prospects')
            .select('name,company,role,country,context_summary,linkedin_url,website')
            .eq('id', body.prospect_id).maybeSingle();
          if (p) {
            const c = p as { name?: string|null; company?: string|null; role?: string|null; country?: string|null; context_summary?: string|null; linkedin_url?: string|null; website?: string|null };
            brief += `\n\nRecipient context:\n- Name: ${c.name ?? '(unknown)'}\n- Company: ${c.company ?? '(unknown)'}\n- Role: ${c.role ?? '(unknown)'}\n- Country: ${c.country ?? '(unknown)'}${c.linkedin_url ? `\n- LinkedIn: ${c.linkedin_url}` : ''}${c.website ? `\n- Website: ${c.website}` : ''}${c.context_summary ? `\n\nWhy them: ${c.context_summary}` : ''}`;
          }
        }
        if (body.cohort_id) {
          const { data: cohort } = await sb.schema('sales').from('guest_cohorts')
            .select('name,description,criteria').eq('id', body.cohort_id).maybeSingle();
          if (cohort) {
            const cc = cohort as { name: string; description: string|null; criteria: Record<string,unknown> };
            brief += `\n\nThis is a campaign-style email to a guest cohort: "${cc.name}". ${cc.description ?? ''}\nCriteria: ${JSON.stringify(cc.criteria)}\nWrite a single message suitable as a 1-to-many template — keep it warm and personal, but avoid specific personal details that would only apply to one guest.`;
          }
        }
        const out = await aiDraftCompose(brief, body.tone);
        subject = out.subject;
        body_md = out.body;
      } else {
        return NextResponse.json({ error: 'ai mode requires thread_id or brief' }, { status: 400 });
      }
    } else if (body.mode === 'template') {
      generator = 'template';
      template_key = body.template_key ?? null;
      if (!template_key) return NextResponse.json({ error: 'template_key required' }, { status: 400 });
      const { data: t } = await sb.schema('sales').from('email_templates')
        .select('subject,body_md').eq('key', template_key).maybeSingle();
      if (!t) return NextResponse.json({ error: 'template not found' }, { status: 404 });
      subject = (t as { subject: string }).subject;
      body_md = (t as { body_md: string }).body_md;
    } else {
      generator = 'human';
    }

    const intent = body.intent ?? (body.thread_id ? 'reply' : 'compose');
    const { data, error } = await sb.schema('sales').from('email_drafts').insert({
      property_id: PROPERTY_ID,
      thread_id: body.thread_id ?? null,
      to_emails: body.to_emails ?? [],
      cc_emails: body.cc_emails ?? [],
      subject,
      body_md,
      generator,
      agent_name,
      template_key,
      status: 'draft',
      created_by: body.created_by ?? 'operator',
      intent,
      prospect_id: body.prospect_id ?? null,
      cohort_id: body.cohort_id ?? null,
    }).select('id,subject,body_md,generator,agent_name,template_key,status,created_at,intent').single();

    // If outreach to a prospect, link the draft back + advance status to 'drafted'
    if (body.prospect_id && data) {
      const draftRow = data as { id: string };
      await sb.schema('sales').from('prospects')
        .update({ last_outreach_draft_id: draftRow.id, status: 'drafted', updated_at: new Date().toISOString() })
        .eq('id', body.prospect_id).eq('property_id', PROPERTY_ID);
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, draft: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[email-draft]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/sales/email-draft  → update draft (body, subject, status)
export async function PATCH(req: Request) {
  let body: { id: string; subject?: string; body_md?: string; status?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const update: Record<string, unknown> = {};
  if (body.subject != null) update.subject = body.subject;
  if (body.body_md != null) update.body_md = body.body_md;
  if (body.status) {
    if (!['draft','approved','sent','discarded'].includes(body.status)) return NextResponse.json({ error: 'bad status' }, { status: 400 });
    update.status = body.status;
    if (body.status === 'approved') update.approved_at = new Date().toISOString();
  }
  const { data, error } = await sb.schema('sales').from('email_drafts')
    .update(update).eq('id', body.id).eq('property_id', PROPERTY_ID).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, draft: data });
}
