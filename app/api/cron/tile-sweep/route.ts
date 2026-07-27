// app/api/cron/tile-sweep/route.ts
// NIGHTLY TILE SWEEP (kpi-conformance-battery §8/A7 · ADR-173).
// Downloads repo main as a tarball (GitHub API, token via fn_get_secret),
// runs the deterministic tile extraction (lib/tileSweep.ts) and hands the
// inventory to public.fn_tile_sweep_ingest, which diffs vs kpi.kpi_catalog
// and auto-registers unmatched tiles as family='tile_autoadd' ai_draft rows.
// Anti-runaway cap lives in SQL: > max_inserts unmatched => zero inserts +
// PBS notification. Fired nightly by pg_cron 'tile-sweep-nightly'
// (POST {"dry_run": false}); manual pokes default to dry_run=true.
//
// Auth: x-cron-secret (CRON_SHARED_SECRET) — /api/cron/* middleware-exempt,
// header gate inside, same pattern as brain-battery.

import { NextResponse, type NextRequest } from 'next/server';
import { gunzipSync } from 'node:zlib';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { extractAllTiles } from '@/lib/tileSweep';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const GH_REPO = 'TBC-HM/namkhan-bi';
const GH_BRANCH = 'main';

function checkCronSecret(req: NextRequest): boolean {
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!provided) return false;
  const envSecret = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET ?? '';
  if (!envSecret) return false;
  return provided === envSecret;
}

export async function POST(req: NextRequest) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { dry_run?: boolean; max_inserts?: number };
  const dryRun = body.dry_run !== false; // manual pokes default to dry-run
  const maxInserts = Number.isInteger(body.max_inserts) ? Number(body.max_inserts) : 40;

  try {
    const sb = getSupabaseAdmin();

    const { data: tokenData, error: tokenErr } = await sb.rpc('fn_get_secret', { p_name: 'github_token' });
    const token: string = typeof tokenData === 'string' ? tokenData : '';
    if (tokenErr || !token) {
      return NextResponse.json({ ok: false, error: `no github token: ${tokenErr?.message ?? 'empty'}` }, { status: 500 });
    }

    const tarRes = await fetch(`https://api.github.com/repos/${GH_REPO}/tarball/${GH_BRANCH}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
    if (!tarRes.ok) {
      return NextResponse.json({ ok: false, error: `tarball fetch ${tarRes.status}` }, { status: 502 });
    }
    const gz = Buffer.from(await tarRes.arrayBuffer());
    const tar = gunzipSync(gz);

    const { files_scanned, tiles } = extractAllTiles(tar);

    const { data: summary, error: ingestErr } = await sb.rpc('fn_tile_sweep_ingest', {
      p_tiles: tiles,
      p_dry_run: dryRun,
      p_max_inserts: maxInserts,
    });
    if (ingestErr) throw new Error(`ingest: ${ingestErr.message}`);

    const byKind: Record<string, number> = {};
    for (const t of tiles) byKind[t.kind] = (byKind[t.kind] ?? 0) + 1;

    return NextResponse.json({
      ok: true,
      files_scanned,
      tiles_extracted: tiles.length,
      by_kind: byKind,
      ingest: summary ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : 'sweep failed' },
      { status: 500 },
    );
  }
}
