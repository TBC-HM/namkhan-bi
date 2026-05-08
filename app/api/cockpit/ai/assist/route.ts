// app/api/cockpit/ai/assist/route.ts
// 2026-05-08 — single AI-assist endpoint for the dept landing pages.
// Used by:
//   - Project modal: "✨ AI suggest" next to Goal + Description
//   - Tasks card:    "✦ Help me prioritize"
//   - Reports card:  "✦ Analyze a doc" — answer a question against doc text
//
// Anthropic call. Cheap actions use Haiku; doc-analysis uses Sonnet (it
// reads more text and the answer needs to be grounded). Always returns
// { text } or { error }; never fabricates.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";

export const runtime = "nodejs";
export const maxDuration = 90;
export const dynamic = "force-dynamic";

type ProjectSuggestPayload = {
  field: 'goal' | 'description';
  name: string;
  goal?: string;
  dept?: string;
};
type TasksHelpPayload = {
  tasks: { label: string; done?: boolean; due?: string; alert?: boolean }[];
  dept?: string;
};
type DocAnalyzePayload = {
  doc_label: string;
  doc_url?: string;          // public URL (md/txt/csv) — fetched server-side
  doc_body?: string;         // inline body (e.g. summary text already in DB)
  question: string;
};
type Body =
  | { action: 'project_suggest', payload: ProjectSuggestPayload }
  | { action: 'tasks_help',      payload: TasksHelpPayload }
  | { action: 'doc_analyze',     payload: DocAnalyzePayload };

const HAIKU  = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';

async function anthropic(system: string, user: string, model: string, maxTokens = 600) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`anthropic ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const text = (json?.content?.[0]?.text ?? '').trim();
  if (!text) throw new Error('empty response');
  return text;
}

export async function POST(req: Request) {
  noStore();
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  try {
    if (body.action === 'project_suggest') {
      const { field, name, goal, dept } = body.payload;
      if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
      const sys = field === 'goal'
        ? `You write 1-sentence project goals for a hospitality BI cockpit. Output ONE concise sentence, no preamble, no quotes. Include a measurable outcome if obvious from the project name.`
        : `You write 2-3 sentence project descriptions for a hospitality BI cockpit. Plain text, no preamble, no quotes. Cover: situation, why now, who is involved. Be specific to the dept.`;
      const user = field === 'goal'
        ? `Project name: ${name}\nDept: ${dept ?? 'revenue'}\nWrite the goal.`
        : `Project name: ${name}\nGoal: ${goal ?? '(not yet set)'}\nDept: ${dept ?? 'revenue'}\nWrite the description.`;
      const text = await anthropic(sys, user, HAIKU, 200);
      return NextResponse.json({ text });
    }

    if (body.action === 'tasks_help') {
      const { tasks, dept } = body.payload;
      const open = (tasks ?? []).filter(t => !t.done);
      if (open.length === 0) {
        return NextResponse.json({ text: "**Nothing open.** When PBS adds tasks, this assistant will prioritize and surface conflicts." });
      }
      const today = new Date().toISOString().slice(0, 10);
      const sys = `You are the ${dept ?? 'revenue'} HoD's task triage assistant. Output terse markdown:
- 1-line summary (overdue count + load)
- "## Today" section with up to 3 numbered actions in priority order
- "## Watch" section with the rest, 1-line each
- For overdue items, prepend ⚠. Reference the task by its label, not by index.
No preamble, no boilerplate. If you don't have enough info to prioritize, say so explicitly.`;
      const user = `Today: ${today}\nOpen tasks (JSON):\n${JSON.stringify(open, null, 2)}`;
      const text = await anthropic(sys, user, HAIKU, 600);
      return NextResponse.json({ text });
    }

    if (body.action === 'doc_analyze') {
      const { doc_label, doc_url, doc_body, question } = body.payload;
      if (!question?.trim()) return NextResponse.json({ error: 'question required' }, { status: 400 });

      // Resolve doc text. Prefer inline body (e.g. retro markdown) → URL fetch.
      let docText = (doc_body ?? '').trim();
      if (!docText && doc_url) {
        try {
          const r = await fetch(doc_url, { cache: 'no-store' });
          const ct = r.headers.get('content-type') ?? '';
          if (r.ok && (ct.startsWith('text/') || ct.includes('json') || ct.includes('xml') || ct.includes('csv'))) {
            docText = (await r.text()).slice(0, 60_000);
          } else {
            return NextResponse.json({
              error: `cannot read this file type (${ct || 'unknown'}) — analysis only works on text/markdown/csv/json today`,
            }, { status: 422 });
          }
        } catch (e) {
          return NextResponse.json({ error: `fetch failed: ${e instanceof Error ? e.message : 'unknown'}` }, { status: 502 });
        }
      }
      if (!docText) {
        return NextResponse.json({ error: 'no readable doc body — pass doc_body or a text doc_url' }, { status: 400 });
      }

      const sys = `You answer questions about a single document. Output terse markdown grounded in the doc — quote short snippets when useful. If the doc does NOT contain the answer, say so plainly; do not speculate.`;
      const user = `Document: ${doc_label}\n\n--- DOC START ---\n${docText}\n--- DOC END ---\n\nQuestion: ${question}`;
      const text = await anthropic(sys, user, SONNET, 1200);
      return NextResponse.json({ text });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 });
  }
}
