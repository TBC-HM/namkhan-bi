// app/holding/it2/system/recovery/page.tsx
// Recovery cockpit — brief recovery-page-v1, spec recovery_module.
// Sibling of deploys · checks · health · activity · cost in IT2 System.

import { supabase } from '@/lib/supabase';
import RecoveryClient from './_client/RecoveryClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type PosRow = {
  data_class: string;
  freshness: string;
  status: string;
  plain_description: string | null;
  last_bytes: number | null;
  last_object_count: number | null;
  age_hours: number | null;
};
type DrillRow = {
  passed: boolean;
  duration_secs: number;
  rows_asserted: number;
  days_ago: number;
};
type DeployRow = {
  id: string;
  state: string;
  prod_aliased: boolean;
  created_at: string | null;
  url: string | null;
};

export default async function SystemRecoveryPage() {
  const [postureRes, drillRes, deployRes] = await Promise.all([
    supabase.from('v_dr_posture').select('data_class,freshness,status,plain_description,last_bytes,last_object_count,age_hours'),
    supabase.from('v_dr_last_drill').select('passed,duration_secs,rows_asserted,days_ago').limit(1),
    supabase.from('v_deployments').select('id,state,prod_aliased,created_at,url').order('created_at', { ascending: false }).limit(10),
  ]);

  const posture = (postureRes.data ?? []) as PosRow[];
  const drill = (((drillRes.data ?? []) as DrillRow[])[0]) ?? null;
  const deploys = (deployRes.data ?? []) as DeployRow[];

  // Format dates server-side — avoids hydration mismatch (toLocaleString in use-client crashes)
  const prodDeploy = deploys.find(d => d.prod_aliased);
  const lastGoodBuilds = deploys.filter(d => d.state === 'READY' && !d.prod_aliased);

  const prodDate = prodDeploy?.created_at
    ? new Date(prodDeploy.created_at).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
    : null;
  const lastGoodDate = lastGoodBuilds[0]?.created_at
    ? new Date(lastGoodBuilds[0].created_at).toISOString().slice(0, 10)
    : null;

  const storageRow = posture.find(p => p.data_class === 'storage');
  const drillLabel = drill
    ? `${Math.round(drill.days_ago)}d ago · ${drill.rows_asserted.toLocaleString('en')} rows · ${drill.passed ? 'passed' : 'FAILED'}`
    : null;

  // rule 712: locale formatting stays server-side — the client renders strings only
  const fmtBytes = (b: number | null): string | null => {
    if (b == null) return null;
    if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
    if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
    return `${(b / 1e3).toFixed(0)} KB`;
  };
  const storageMetaLabel = storageRow?.last_object_count != null
    ? `${storageRow.last_object_count.toLocaleString('en')} files · ${fmtBytes(storageRow.last_bytes) ?? '—'}`
    : null;

  return (
    <RecoveryClient
      posture={posture}
      drill={drill}
      prodDeploy={prodDeploy ?? null}
      prodDate={prodDate}
      rollbackCount={lastGoodBuilds.length}
      lastGoodDate={lastGoodDate}
      drillLabel={drillLabel}
      storageMetaLabel={storageMetaLabel}
    />
  );
}
