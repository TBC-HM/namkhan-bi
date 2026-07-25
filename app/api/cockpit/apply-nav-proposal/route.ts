import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GH_REPO = 'TBC-HM/namkhan-bi';

async function getGhToken(): Promise<string> {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await (sb as any).from('vault.decrypted_secrets').select('decrypted_secret').eq('name', 'github_token').limit(1).single() as any;
  return data?.decrypted_secret ?? '';
}

async function ghGet(path: string, token: string) {
  const res = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${path}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

async function ghPut(path: string, content: string, message: string, sha: string, token: string) {
  const res = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: Buffer.from(content).toString('base64'), sha }),
  });
  const j = await res.json();
  return { ok: res.ok, sha: j.commit?.sha, error: j.message };
}

export async function POST() {
  try {
    const token = await getGhToken();
    if (!token) return NextResponse.json({ error: 'no github token' }, { status: 500 });

    // ── New groups.ts (Inventory removed, Alerts + Platform Map added) ──
    const newGroups = `// app/holding/it/cockpit/_lib/groups.ts
// PBS 2026-07-25 v4: nav restructuring executed from sitemap.
// Changes: Inventory group removed (broken link), Alerts added to Ops, Platform Map added to Knowledge.

import type { DashboardTab } from '@/app/(cockpit)/_design/types';

export type CockpitGroupKey = 'home' | 'fleet' | 'knowledge' | 'ops' | 'build';

interface GroupSpec {
  key: CockpitGroupKey;
  label: string;
  href: string;
  subs: Array<{ href: string; label: string }>;
}

export const GROUPS: GroupSpec[] = [
  { key: 'home', label: 'Home', href: '/holding/it/cockpit', subs: [] },
  {
    key: 'fleet', label: 'Fleet', href: '/holding/it/cockpit/team',
    subs: [
      { href: '/holding/it/cockpit/team',      label: 'Team' },
      { href: '/holding/it/cockpit/skills',    label: 'Skills' },
      { href: '/holding/it/cockpit/knowledge', label: 'Memory' },
    ],
  },
  {
    key: 'knowledge', label: 'Knowledge', href: '/holding/it/cockpit/docs',
    subs: [
      { href: '/holding/it/cockpit/docs',          label: 'All Docs' },
      { href: '/holding/it/cockpit/schemas',        label: 'Schemas' },
      { href: '/holding/it/cockpit/freshness',      label: 'Freshness' },
      { href: '/holding/it/cockpit/sitemap',        label: 'Sitemap' },
      { href: '/holding/it/cockpit/platform-map',   label: 'Platform Map' },
    ],
  },
  {
    key: 'ops', label: 'Ops', href: '/holding/it/cockpit/tasks',
    subs: [
      { href: '/holding/it/cockpit/tasks',    label: 'Tasks' },
      { href: '/holding/it/cockpit/activity', label: 'Activity' },
      { href: '/holding/it/cockpit/chat',     label: 'Chat' },
      { href: '/holding/it/cockpit/health',   label: 'Health' },
      { href: '/holding/it/cockpit/notify',   label: 'Alerts' },
    ],
  },
  {
    key: 'build', label: 'Build', href: '/holding/it/cockpit/deploys',
    subs: [
      { href: '/holding/it/cockpit/deploys',    label: 'Deploys' },
      { href: '/holding/it/cockpit/checks',     label: 'Checks' },
      { href: '/holding/it/cockpit/cost',       label: 'Cost' },
      { href: '/holding/it/cockpit/specs',      label: 'Module Docs' },
      { href: '/holding/it/cockpit/specs/new',  label: '+ New spec' },
    ],
  },
];

export function groupsAsTabs(activeKey: CockpitGroupKey): DashboardTab[] {
  return GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    href: g.href,
    active: g.key === activeKey,
  }));
}
`;

    // ── cockpit/users redirect page ──
    const redirectPage = `// app/holding/it/cockpit/users/page.tsx
// Redirect to /holding/users — consolidated user management.
import { redirect } from 'next/navigation';
export default function CockpitUsersRedirect() { redirect('/holding/users'); }
`;

    // Fetch current SHAs
    const [groupsFile, usersFile] = await Promise.all([
      ghGet('app/holding/it/cockpit/_lib/groups.ts', token),
      ghGet('app/holding/it/cockpit/users/page.tsx', token),
    ]);

    if (!groupsFile) return NextResponse.json({ error: 'Could not fetch groups.ts' }, { status: 500 });

    const results: string[] = [];

    // Push groups.ts
    const r1 = await ghPut(
      'app/holding/it/cockpit/_lib/groups.ts', newGroups,
      'feat(nav): apply sitemap restructuring — remove Inventory group, add Alerts + Platform Map',
      groupsFile.sha, token);
    results.push('groups.ts: ' + (r1.ok ? 'pushed ' + r1.sha?.slice(0, 8) : 'ERROR ' + r1.error));

    // Push redirect (create or update)
    const r2 = await ghPut(
      'app/holding/it/cockpit/users/page.tsx', redirectPage,
      'feat(nav): cockpit/users redirects to /holding/users',
      usersFile?.sha ?? '', token);
    results.push('cockpit/users: ' + (r2.ok ? 'pushed ' + r2.sha?.slice(0, 8) : 'ERROR ' + r2.error));

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
