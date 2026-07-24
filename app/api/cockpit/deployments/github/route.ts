import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GH_REPO = 'TBC-HM/namkhan-bi';
const GH_BRANCH = 'main';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function ghFetch(path: string, token: string) {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export async function GET() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: vaultRow } = await sb
      .from('vault.decrypted_secrets' as any)
      .select('decrypted_secret')
      .eq('name', 'github_token')
      .limit(1)
      .single() as any;

    const token: string = vaultRow?.decrypted_secret ?? '';
    if (!token) return NextResponse.json({ error: 'no github token' }, { status: 500 });

    const commits = await ghFetch(`repos/${GH_REPO}/commits?sha=${GH_BRANCH}&per_page=15`, token);
    if (!Array.isArray(commits)) return NextResponse.json({ commits: [] });

    const rows = await Promise.all(
      commits.slice(0, 12).map(async (c: any) => {
        const sha: string = c.sha;
        const checks = await ghFetch(`repos/${GH_REPO}/commits/${sha}/check-runs`, token);
        const runs: any[] = checks?.check_runs ?? [];
        return {
          sha: sha.slice(0, 8),
          sha_full: sha,
          message: (c.commit?.message ?? '').split('\n')[0].slice(0, 90),
          author: c.commit?.author?.name ?? '',
          date: c.commit?.author?.date ?? '',
          checks: runs.map((r: any) => ({
            name: r.name as string,
            status: r.status as string,
            conclusion: r.conclusion as string | null,
          })),
        };
      }),
    );

    return NextResponse.json({ commits: rows, fetched_at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, commits: [] }, { status: 500 });
  }
}
