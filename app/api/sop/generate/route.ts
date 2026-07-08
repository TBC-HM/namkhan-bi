// app/api/sop/generate/route.ts
// PBS 2026-07-07: Thin AI relay. Takes { property_id, dept_code, purpose }, returns
// { draft: {title, short_summary, author, sop_date, bullets, primary_audience} }.
//
// Uses Anthropic Claude if ANTHROPIC_API_KEY is set in Vercel env; else falls back
// to a deterministic template stub so the UI is fully wired even before the key
// is present in the vault (flag: ai_stub=true).

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  property_id: number;
  dept_code:   string;
  purpose:     string;
}

interface Draft {
  title: string;
  short_summary: string;
  author: string;
  sop_date: string;
  bullets: string[];
  primary_audience: string;
}

const DEPT_LABEL: Record<string, string> = {
  housekeeping: 'Housekeeping',
  kitchen: 'F&B',
  front_office: 'Front Office',
  maintenance: 'Engineering',
  governance: 'Governance',
  procurement: 'Procurement',
  hr: 'HR',
  spa: 'Spa',
  marketing: 'Marketing',
  revenue: 'Revenue',
  sales: 'Sales',
  finance: 'Finance',
  it: 'IT',
};

// Match SopBrowser normDept for consistent audience naming.
function audienceFor(dept: string): string {
  return `${(DEPT_LABEL[dept] ?? dept).toLowerCase().replace(/[^a-z]/g, '_')}_staff`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function stubDraft(purpose: string, dept: string): Draft {
  // Cheap deterministic scaffold — 7 generic bullets tailored by dept label.
  const label = DEPT_LABEL[dept] ?? dept;
  const shortPurpose = purpose.split(/[.\n]/)[0].trim().slice(0, 80);
  const title = shortPurpose.length > 5
    ? `${label} · ${shortPurpose.charAt(0).toUpperCase() + shortPurpose.slice(1)}`
    : `${label} · ${purpose.slice(0, 40)}`;
  return {
    title,
    short_summary: `Standard procedure covering: ${purpose.trim().slice(0, 140)}`,
    author: 'AI · Claude Sonnet (stub)',
    sop_date: todayISO(),
    primary_audience: audienceFor(dept),
    bullets: [
      `Confirm the guest / stakeholder need and scope for: ${shortPurpose || purpose.slice(0, 40)}.`,
      `Prepare all required tools and materials at the start of shift.`,
      `Follow department safety and hygiene protocols throughout.`,
      `Execute the core steps in the sequence defined by the ${label} manager.`,
      `Verify quality against the ${label} checklist before completion.`,
      `Log the action in the daily ${label} report with timestamp and initials.`,
      `Escalate any deviation or incident to the HoD ${label} within 15 minutes.`,
    ],
  };
}

async function callAnthropic(purpose: string, dept: string, propertyId: number): Promise<Draft | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const label = DEPT_LABEL[dept] ?? dept;
  const propertyLabel = propertyId === 260955 ? 'Namkhan (boutique river-lodge, Luang Prabang)'
    : propertyId === 1000001 ? 'Donna Portals (boutique apart-hotel, Panama)'
    : `property ${propertyId}`;

  const system = `You are a senior hotel operations consultant writing a Standard Operating Procedure (SOP).
Produce JSON only — no prose wrapper — with EXACTLY this shape:
{
  "title": "Concise, professional SOP title (max 80 chars)",
  "short_summary": "1-sentence subject synopsis (max 160 chars)",
  "primary_audience": "lowercase_snake_case audience (e.g. housekeeping_staff)",
  "bullets": ["7 to 9 actionable steps, each 1-2 lines, starting with an imperative verb"]
}`;
  const user = `Property: ${propertyLabel}
Department: ${label}
Purpose: ${purpose}

Generate a professional hotel SOP. Bullets must be specific and executable — no generic filler.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1200,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!r.ok) return null;
    const j: { content?: Array<{ type: string; text?: string }> } = await r.json();
    const txt = (j.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    if (!parsed.title || !Array.isArray(parsed.bullets)) return null;
    return {
      title: String(parsed.title),
      short_summary: String(parsed.short_summary ?? ''),
      author: 'AI · Claude Sonnet',
      sop_date: todayISO(),
      primary_audience: String(parsed.primary_audience ?? audienceFor(dept)),
      bullets: parsed.bullets.map((b: unknown) => String(b)),
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json() as Body;
    const propertyId = Number(b.property_id);
    const dept       = String(b.dept_code || '');
    const purpose    = String(b.purpose || '').trim();

    if (!Number.isFinite(propertyId) || propertyId <= 0) {
      return NextResponse.json({ error: 'property_id is required' }, { status: 400 });
    }
    if (!dept) return NextResponse.json({ error: 'dept_code is required' }, { status: 400 });
    if (!purpose) return NextResponse.json({ error: 'purpose is required' }, { status: 400 });

    const ai = await callAnthropic(purpose, dept, propertyId);
    if (ai) return NextResponse.json({ ok: true, draft: ai, ai_stub: false });

    const stub = stubDraft(purpose, dept);
    return NextResponse.json({ ok: true, draft: stub, ai_stub: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
