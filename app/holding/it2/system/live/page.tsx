// app/holding/it2/system/live/page.tsx
// Builder heartbeat UI (ADR-209, 2026-07-30). One box per builder/verifier
// round — live ones pulse, finished ones fade. Built after tonight's
// discovery that two briefs (gh-pr-bridge-v1, knowledge-goals-intake-v1)
// sat abandoned for 90+ minutes with zero visibility until the hourly
// stall sweep caught it. This reads public.v_builder_liveness (bridge over
// governance.builder_heartbeats) and polls every 10s client-side.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { LiveBuildersView, type LiveRow } from './LiveBuildersView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LiveBuildersPage() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_builder_liveness')
    .select('*')
    .order('last_beat_at', { ascending: false })
    .limit(60);

  return (
    <LiveBuildersView
      initial={(data ?? []) as LiveRow[]}
      initialError={error?.message ?? null}
    />
  );
}
