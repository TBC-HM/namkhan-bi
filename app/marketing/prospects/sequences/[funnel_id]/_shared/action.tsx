// Shared server component for schedule/halt/resume/delete pages — each just wraps a confirm button.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../../../_subpages';
import ActionButton from '../_components/ActionButton';

export type ActionKind = 'schedule' | 'halt' | 'resume' | 'delete';

const CONFIG: Record<ActionKind, { title: string; blurb: string; rpc: string; label: string; variant: 'green' | 'light' | 'red'; expectStates: string[] }> = {
  schedule: { title: 'Schedule sequence',    blurb: 'Flip this sequence from Draft → Scheduled so the cron will start firing steps.',              rpc: 'fn_sequence_activate',           label: 'Schedule this sequence', variant: 'green', expectStates: ['draft'] },
  halt:     { title: 'Halt sequence',        blurb: 'Halt all active enrollments + cancel pending recipients. Sequence returns to Halted state.',   rpc: 'fn_halt_funnel',                 label: 'Halt now',              variant: 'light', expectStates: ['scheduled','live'] },
  resume:   { title: 'Resume sequence',      blurb: 'Bring a Halted sequence back to Scheduled. Existing enrollments stay halted; you can re-enroll.', rpc: 'fn_sequence_activate',          label: 'Resume',                variant: 'green', expectStates: ['halted','draft'] },
  delete:   { title: 'Cancel + revert',      blurb: 'Cancels pending sends and reverts to Draft so you can edit + re-schedule. Sent history preserved.', rpc: 'fn_revert_funnel_to_draft', label: 'Revert to draft ↺',     variant: 'red',   expectStates: ['scheduled','live','halted','draft'] },
};

export async function renderSequenceActionPage(params: { funnel_id: string }, kind: ActionKind) {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_marketing_funnels').select('*').eq('funnel_id', params.funnel_id).maybeSingle();
  if (!data) return notFound();

  const cfg = CONFIG[kind];
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/prospects',
  }));

  const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const CREAM='#F7F0E1';
  const funnel = data as { funnel_id: string; name: string; status: string; steps_count: number };

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title={`Sequences · ${cfg.title}`} subtitle={funnel.name} tabs={tabs}>
        <div style={{ gridColumn:'1 / -1' }}>
          <Link href={`/marketing/prospects/sequences/${funnel.funnel_id}`} style={{ fontSize:12, color:'#084838', textDecoration:'none', fontWeight:600 }}>← Back to sequence</Link>
        </div>

        <div style={{ gridColumn:'1 / -1', border:'1px solid '+HAIR, background:CREAM, borderRadius:6, padding:20, display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ fontSize:14, fontWeight:600, color:INK }}>{cfg.title}</div>
          <div style={{ fontSize:12, color:INK, lineHeight:1.6 }}>{cfg.blurb}</div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12, padding:'10px 14px', background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:4 }}>
            <MetaCell label="Sequence" v={funnel.name} />
            <MetaCell label="Current state" v={funnel.status} />
            <MetaCell label="Steps" v={String(funnel.steps_count)} />
          </div>

          <div>
            <ActionButton
              label={cfg.label}
              workingLabel="Applying…"
              confirmMsg={`${cfg.title}: proceed?`}
              rpc={cfg.rpc}
              payload={{ p_funnel_id: funnel.funnel_id }}
              onSuccessRedirect="/marketing/prospects/sequences"
              variant={cfg.variant}
            />
          </div>

          {!cfg.expectStates.includes(funnel.status) && (
            <div style={{ padding:'8px 12px', background:'#FFF4D6', border:'1px solid #C28F2C', borderRadius:4, fontSize:11, color:INK }}>
              Current state <strong>{funnel.status}</strong> is unexpected for this action. Proceeding may no-op.
            </div>
          )}
        </div>
      </DashboardPage>
    </div>
  );
}

function MetaCell({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#5A5A5A' }}>{label}</div>
      <div style={{ fontSize:12, color:'#1B1B1B' }}>{v}</div>
    </div>
  );
}
