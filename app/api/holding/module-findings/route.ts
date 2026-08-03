// app/api/holding/module-findings/route.ts
// owner-findings-ui-v1 (ADR-218): owner/agent findings channel for module cards.
// POST  multipart {module, finding, severity, screenshot?} → optional upload to
//       PUBLIC bucket `module-findings` (spec-attachments precedent — private
//       bucket + getPublicUrl returns dead links) → public.fn_module_finding_add.
// PATCH json {id, status, resolution_note?, actor?} → public.fn_module_finding_resolve
//       (SECURITY DEFINER bridge; governance.* is not PostgREST-reachable).
// PUT   json {finding_id, body, author_role ('pbs'|'agent'), author?, restatement?, confirms?}
//       → public.fn_finding_comment (finding_threads_v1). Agent restatement path:
//       {author_role:'agent', restatement:true} flips finding open→acknowledged.
//       PBS confirm path: {author_role:'pbs', confirms:true} — the fn refuses
//       confirms from any other role; tg_finding_resolution_guard blocks
//       fixed/refuted until a confirmed comment exists on the thread.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const BUCKET = 'module-findings';

export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const moduleName = String(fd.get('module') ?? '').trim();
    const finding = String(fd.get('finding') ?? '').trim();
    const severity = String(fd.get('severity') ?? 'medium').trim();
    const file = fd.get('screenshot') as File | null;

    if (!moduleName) return NextResponse.json({ error: 'module is required' }, { status: 400 });
    if (finding.length < 5) return NextResponse.json({ error: 'finding text is required (min 5 chars)' }, { status: 400 });
    if (!['low', 'medium', 'high', 'critical'].includes(severity))
      return NextResponse.json({ error: 'severity must be low/medium/high/critical' }, { status: 400 });

    const sb = getSupabaseAdmin();
    let screenshotUrl: string | null = null;

    if (file && file.size > 0) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
      const allowed = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
      if (!allowed.includes(ext)) return NextResponse.json({ error: 'Screenshot must be png/jpg/webp/gif' }, { status: 400 });
      const path = `${moduleName.replace(/[^a-z0-9_-]/gi, '-')}/${Date.now()}.${ext}`;
      const bytes = await file.arrayBuffer();
      const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, {
        contentType: file.type || `image/${ext}`,
        upsert: false,
      });
      if (upErr) return NextResponse.json({ error: `screenshot upload failed: ${upErr.message}` }, { status: 500 });
      screenshotUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }

    const { data, error } = await (sb as any).rpc('fn_module_finding_add', {
      p_module: moduleName,
      p_finding: finding,
      p_severity: severity,
      p_screenshot: screenshotUrl,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data, screenshot: screenshotUrl }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unexpected error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const findingId = Number(body?.finding_id);
    const text = String(body?.body ?? '').trim();
    const authorRole = String(body?.author_role ?? '').trim();
    const author = String(body?.author ?? (authorRole === 'pbs' ? 'PBS' : 'it2-ui')).trim();
    const restatement = body?.restatement === true;
    const confirms = body?.confirms === true;

    if (!findingId) return NextResponse.json({ error: 'finding_id is required' }, { status: 400 });
    if (!['pbs', 'agent'].includes(authorRole))
      return NextResponse.json({ error: "author_role must be 'pbs' or 'agent'" }, { status: 400 });
    if (text.length < 5) return NextResponse.json({ error: 'comment body is required (min 5 chars)' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('fn_finding_comment', {
      p_finding_id: findingId,
      p_author_role: authorRole,
      p_author: author,
      p_body: text,
      p_restatement: restatement,
      p_confirms: confirms,
    });
    // Surface fn refusals (e.g. "Only PBS confirms understanding") verbatim.
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ ok: true, comment_id: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unexpected error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = Number(body?.id);
    const status = String(body?.status ?? '').trim();
    const note = body?.resolution_note != null ? String(body.resolution_note) : null;
    const actor = String(body?.actor ?? 'it2-ui').trim();
    if (!id || !status) return NextResponse.json({ error: 'id and status are required' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('fn_module_finding_resolve', {
      p_id: id,
      p_status: status,
      p_resolution_note: note,
      p_actor: actor,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data && data.ok === false) return NextResponse.json({ error: data.error ?? 'resolve refused' }, { status: 422 });
    return NextResponse.json({ ok: true, ...data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unexpected error' }, { status: 500 });
  }
}
