'use server';
// app/holding/it2/system/health/actions.ts
// Server actions for the Health page — run with server-side env access.

export async function runHealthSweep(): Promise<{
  ok: boolean; checked?: number; failed?: number;
  failures?: Array<{ url: string; status: number | null; error: string | null }>;
  error?: string;
}> {
  const secret = process.env.CRON_SHARED_SECRET;
  if (!secret) return { ok: false, error: 'CRON_SHARED_SECRET not configured' };
  try {
    const res = await fetch(
      'https://namkhan-bi.vercel.app/api/cockpit/health-sweep?trigger=manual',
      {
        headers: { Authorization: `Bearer ${secret}`, 'x-source': 'health-page-cta' },
        cache: 'no-store',
      }
    );
    return res.json();
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'fetch failed' };
  }
}
