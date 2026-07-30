// app/api/specs/upload-md/route.ts — MD Intake v1 (brief md-intake-v1)
// POST multipart: file (.md/.txt verbatim · .docx/.xlsx extracted server-side,
// original stored in spec-attachments and noted) + goal_id (required, ADR-165)
// + dry_run ('1' → evaluate + compare, zero writes).
// Pipeline: persist verbatim canon (dms + repo) → evaluate vs platform law →
// register brief + queue row. See lib/specs/mdIntake.ts for the law notes.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { extractText } from '@/lib/docs/extract';
import { runMdIntake } from '@/lib/specs/mdIntake';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // evaluator LLM call + persistence

const TEXT_EXTS = ['md', 'txt', 'sql'];
const CONVERT_EXTS = ['docx', 'xlsx'];

export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    const goalIdRaw = fd.get('goal_id') as string | null;
    const dryRun = (fd.get('dry_run') as string | null) === '1';

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    const goalId = Number(goalIdRaw);
    if (!goalIdRaw || !Number.isInteger(goalId) || goalId <= 0) {
      return NextResponse.json({ error: 'goal_id required — every brief must link a goal (ADR-165)' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (![...TEXT_EXTS, ...CONVERT_EXTS].includes(ext)) {
      return NextResponse.json({ error: `Accepted: .${TEXT_EXTS.join(' .')} (verbatim) · .${CONVERT_EXTS.join(' .')} (converted to md extract)` }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // Validate the goal via the public bridge view (mirror of /api/specs).
    const { data: goal, error: goalErr } = await sb.from('v_goals').select('goal_id').eq('goal_id', goalId).maybeSingle();
    if (goalErr) return NextResponse.json({ error: goalErr.message }, { status: 500 });
    if (!goal) return NextResponse.json({ error: `goal_id ${goalId} not found in governance goals` }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    let content: string;
    let fileName: string;
    let originalNote: string | null = null;

    if (TEXT_EXTS.includes(ext)) {
      content = buffer.toString('utf-8');
      fileName = file.name;
    } else {
      // Convert docx/xlsx → md extract. Original binary is preserved in the
      // public spec-attachments bucket and noted on the dms row (VERBATIM
      // CANON applies to the extract we act on; the binary stays retrievable).
      content = await extractText({ buffer, mimeType: file.type || '', fileName: file.name });
      if (!content.trim()) {
        return NextResponse.json({ error: `Could not extract text from ${file.name}` }, { status: 422 });
      }
      const base = file.name.replace(/\.[^.]+$/, '');
      fileName = `${base}_${ext}_extract.md`;
      if (!dryRun) {
        const origPath = `brief-source-originals/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
        const { error: upErr } = await sb.storage.from('spec-attachments').upload(origPath, buffer, {
          contentType: file.type || 'application/octet-stream', upsert: false,
        });
        originalNote = upErr
          ? `extracted from ${file.name} (original upload failed: ${upErr.message})`
          : `extracted from ${file.name} (original: spec-attachments/${origPath})`;
      } else {
        originalNote = `extracted from ${file.name} (dry-run — original not stored)`;
      }
      content = `<!-- md-intake extract of ${file.name} · ${new Date().toISOString().slice(0, 10)} -->\n\n${content}`;
    }

    if (content.length < 100) {
      return NextResponse.json({ error: 'Document too short to evaluate (<100 chars)' }, { status: 422 });
    }
    if (content.length > 400_000) {
      return NextResponse.json({ error: 'Document too large (>400k chars) — split it' }, { status: 413 });
    }

    const result = await runMdIntake({ fileName, content, goalId, dryRun, originalNote });
    return NextResponse.json(result, { status: dryRun ? 200 : 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
