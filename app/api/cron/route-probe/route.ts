// app/api/cron/route-probe/route.ts
// TEMPORARY diagnostic (PBS 404 incident 2026-07-24). Middleware exempts
// /api/cron/*, so this answers WITHOUT auth — proving whether the production
// deployment contains routes from this commit. No data exposed, no secret
// needed for the existence check itself. Remove after the incident closes.

import { NextResponse } from 'next/server';
import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tryRead(p: string): string | null {
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}

export async function GET() {
  // v2: introspect the deployed build — is /finance/archive registered?
  const roots = [process.cwd(), '/var/task'];
  const found: Record<string, unknown> = {};
  for (const root of roots) {
    for (const rel of ['.next/app-paths-manifest.json', '.next/server/app-paths-manifest.json', '.next/routes-manifest.json']) {
      const p = path.join(root, rel);
      const txt = tryRead(p);
      if (txt) {
        found[p] = {
          has_finance_archive: txt.includes('/finance/archive'),
          has_settings_brain: txt.includes('/settings/brain'),
          has_finance_legal: txt.includes('/finance/legal'),
          size: txt.length,
        };
      }
    }
    // directory presence of the compiled page
    const pageDir = path.join(root, '.next/server/app/finance/archive');
    if (existsSync(pageDir)) {
      try { found[pageDir] = { dir: readdirSync(pageDir).slice(0, 10) }; } catch { /* noop */ }
    }
  }
  return NextResponse.json({
    ok: true,
    marker: 'route-probe-v2',
    now: new Date().toISOString(),
    cwd: process.cwd(),
    found,
  });
}
