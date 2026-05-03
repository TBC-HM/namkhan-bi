// lib/composerRunner.ts
// Auto-Offer Composer: drafts subject + intro + outro + PS for a proposal.
// Two modes:
//   1. ANTHROPIC_API_KEY set → real Claude Sonnet 4.6 call via fetch
//   2. ANTHROPIC_API_KEY absent → graceful stub (returns Soho-House-style template)
//
// Cost cap: €0.20 per draft. Logs every run to sales.agent_runs.

import { logAgentRun } from '@/lib/sales';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS_OUT = 1500;
const COST_CAP_EUR = 0.20;
const COST_IN_USD_PER_M = 3;
const COST_OUT_USD_PER_M = 15;
const USD_TO_EUR = 0.92;

export interface ComposerInput {
  inquiryId?: string | null;
  proposalId: string;
  guestName: string;
  guestCountry?: string | null;
  language?: string | null;
  partyAdults?: number | null;
  partyChildren?: number | null;
  dateIn: string;
  dateOut: string;
  blocksContext: Array<{ label: string; type: string; sellLak: number }>;
}

export interface ComposerOutput {
  subject: string;
  intro: string;
  outro: string;
  ps: string;
  source: 'claude' | 'stub';
  costEur: number;
  tokensIn: number;
  tokensOut: number;
}

const SYSTEM_PROMPT = `You are the Auto-Offer Composer for The Namkhan in Luang Prabang, a 30-room riverside hotel in the Soho House register: quiet, observational, river/Mekong-grounded, owner-led "we" voice. Your job is to draft a personalised proposal email for a specific guest based on their inquiry and the rooms/activities the sales team has assembled.

Voice rules:
- Sentences are short. Verbs are concrete. The river, the boat, the kitchen, the deck, the boat again.
- Never use cliches. Never use exclamation marks. Never use "exquisite", "unparalleled", "breathtaking", "nestled", "haven", "paradise".
- Sign off as "Sebastian, on behalf of the Namkhan team".
- Output JSON only. No prose outside the JSON. No markdown fences.

JSON schema:
{
  "subject": string (max 70 chars),
  "intro": string (60-120 words, opens the email, references one specific thing about the inquiry),
  "outro": string (40-80 words, closes warmly without selling),
  "ps": string (15-30 words, one concrete observational note about Luang Prabang at the time of year of their stay)
}`;

function buildUserPrompt(input: ComposerInput): string {
  const party = `${input.partyAdults ?? 2}A ${input.partyChildren ?? 0}C`;
  const blocksText = input.blocksContext.length === 0
    ? '(no blocks added yet — write a generic warm intro for a stay of these dates)'
    : input.blocksContext.map(b => `${b.label} [${b.type}, ${(b.sellLak / 21800).toFixed(0)} USD]`).join('; ');

  return `Guest: ${input.guestName}${input.guestCountry ? ` (${input.guestCountry})` : ''}
Language: ${input.language ?? 'en'}
Party: ${party}
Dates: ${input.dateIn} → ${input.dateOut}
Blocks pre-filled by sales: ${blocksText}

Compose subject + intro + outro + PS. Return JSON only.`;
}

function stubResponse(input: ComposerInput): ComposerOutput {
  const firstName = (input.guestName || 'guest').split(' ')[0];
  const stayWord = input.partyChildren && input.partyChildren > 0 ? 'family stay' : 'stay';
  return {
    subject: `Your ${stayWord} at The Namkhan, ${input.dateIn}`,
    intro: `Dear ${firstName},\n\nWe've drawn up something quiet for you. ${input.dateIn} to ${input.dateOut} is a good window — the river is high enough for the dawn boat and the gardens are at their fullest. Take what you like below, leave what you don't. The page lets you adjust quantities or remove anything that doesn't fit. We're here when you want to talk it through.`,
    outro: `If anything wants changing, write back. We sit on the river and we have time. We can hold this rate until ${new Date(Date.now() + 14 * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.`,
    ps: `P.S. The 06:30 boat is the reason. The light comes off the Mekong before the town wakes.`,
    source: 'stub',
    costEur: 0,
    tokensIn: 0,
    tokensOut: 0,
  };
}

export async function composeOffer(input: ComposerInput): Promise<ComposerOutput> {
  const t0 = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    const stub = stubResponse(input);
    await logAgentRun({
      inquiry_id: input.inquiryId ?? null,
      proposal_id: input.proposalId,
      agent_name: 'auto_offer_composer',
      model: 'stub',
      status: 'stub_no_api_key',
      duration_ms: Date.now() - t0,
    });
    return stub;
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS_OUT,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(input) }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      await logAgentRun({
        inquiry_id: input.inquiryId ?? null,
        proposal_id: input.proposalId,
        agent_name: 'auto_offer_composer',
        model: MODEL,
        status: 'error_api',
        error: `${resp.status} ${errText.slice(0, 200)}`,
        duration_ms: Date.now() - t0,
      });
      return stubResponse(input);
    }

    const json = await resp.json();
    const tokensIn = json.usage?.input_tokens ?? 0;
    const tokensOut = json.usage?.output_tokens ?? 0;
    const costEur = (tokensIn * COST_IN_USD_PER_M + tokensOut * COST_OUT_USD_PER_M) / 1_000_000 * USD_TO_EUR;

    if (costEur > COST_CAP_EUR) {
      await logAgentRun({
        inquiry_id: input.inquiryId ?? null,
        proposal_id: input.proposalId,
        agent_name: 'auto_offer_composer',
        model: MODEL,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost_eur: costEur,
        status: 'blocked_by_cost_cap',
        duration_ms: Date.now() - t0,
      });
      return stubResponse(input);
    }

    const text = (json.content?.[0]?.text as string) ?? '';
    const cleaned = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleaned);

    await logAgentRun({
      inquiry_id: input.inquiryId ?? null,
      proposal_id: input.proposalId,
      agent_name: 'auto_offer_composer',
      model: MODEL,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_eur: costEur,
      status: 'success',
      duration_ms: Date.now() - t0,
    });

    return {
      subject: String(parsed.subject ?? '').slice(0, 200),
      intro: String(parsed.intro ?? ''),
      outro: String(parsed.outro ?? ''),
      ps: String(parsed.ps ?? ''),
      source: 'claude',
      costEur,
      tokensIn,
      tokensOut,
    };
  } catch (e: any) {
    await logAgentRun({
      inquiry_id: input.inquiryId ?? null,
      proposal_id: input.proposalId,
      agent_name: 'auto_offer_composer',
      model: MODEL,
      status: 'error_exception',
      error: String(e?.message ?? e).slice(0, 200),
      duration_ms: Date.now() - t0,
    });
    return stubResponse(input);
  }
}
