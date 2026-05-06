// app/settings/page.tsx — REDESIGN 2026-05-05 (recovery)
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  GuestStatusHeader, StatusCell, SectionHead,
  metaSm, metaStrong, metaDim,
} from '../guest/_components/GuestShell';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

function isLorem(v: any): boolean {
  if (typeof v !== 'string') return false;
  return /\bLOREM IPSUM\b|\bTODO\b/i.test(v);
}

export default async function SettingsSnapshotPage() {
  let admin;
  try { admin = getSupabaseAdmin(); } catch { admin = null; }

  const sectionsP = admin
    ? admin.schema('marketing').from('v_settings_sections_live').select('*').order('display_order')
    : Promise.resolve({ data: [], error: null } as any);
  const profileP = admin
    ? admin.schema('marketing').from('property_profile').select('*').eq('property_id', PROPERTY_ID).maybeSingle()
    : Promise.resolve({ data: null, error: null } as any);
  const roomsP = supabase.from('room_types').select('id', { count: 'exact', head: true }).eq('property_id', PROPERTY_ID);
  const usersP = supabase.from('app_users').select('id', { count: 'exact', head: true }).eq('active', true);
  const dqP = supabase.from('dq_known_issues').select('id, severity, status', { count: 'exact' }).neq('status', 'fixed');

  const [
    { data: sections },
    { data: profile },
    { count: roomsCount },
    { count: activeUsers },
    { data: dqIssues, count: dqOpenCount },
  ] = await Promise.all([sectionsP, profileP, roomsP, usersP, dqP]);

  const dqCritical = (dqIssues ?? []).filter((d: any) => d.severity === 'critical' || d.severity === 'high').length;

  let placeholders = 0, totalFields = 0;
  if (profile) {
    for (const v of Object.values(profile)) {
      totalFields += 1;
      if (Array.isArray(v)) { if (v.some(isLorem)) placeholders += 1; }
      else if (isLorem(v)) placeholders += 1;
    }
  }
  const completePct = totalFields > 0 ? ((totalFields - placeholders) / totalFields) * 100 : 0;
  const sectionsList = (sections ?? []) as Array<{ section_code: string; display_name: string; description: string | null; placeholder_count: number | null; row_count: number | null; }>;

  return (
    <>
      <PageHeader pillar="Settings" tab="Snapshot"
        title={<>One source of truth <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>for the property</em>.</>}
        lede={profile ? `${profile.trading_name ?? 'Property'} · ${roomsCount ?? 0} room types · ${sectionsList.length} editable sections · ${completePct.toFixed(0)}% complete` : `${roomsCount ?? 0} room types`} />
      <GuestStatusHeader
        top={<>
          <StatusCell label="SOURCE"><StatusPill tone="active">marketing.property_profile</StatusPill><span style={metaDim}>· room_types · app_users · dq_known_issues</span></StatusCell>
          <StatusCell label="PROPERTY"><span style={metaStrong}>{profile?.trading_name ?? '—'}</span></StatusCell>
          <StatusCell label="LOCATION"><span style={metaSm}>{profile?.city ?? '—'}{profile?.country ? `, ${profile.country}` : ''}</span></StatusCell>
          <span style={{ flex: 1 }} />
        </>}
        bottom={<>
          <StatusCell label="COMPLETENESS">
            <StatusPill tone={completePct >= 90 ? 'active' : completePct >= 70 ? 'pending' : 'expired'}>{completePct.toFixed(0)}%</StatusPill>
            <span style={metaDim}>{placeholders} placeholders</span>
          </StatusCell>
          <StatusCell label="USERS"><span style={metaSm}>{activeUsers ?? 0}</span></StatusCell>
          <StatusCell label="DQ">
            <StatusPill tone={dqCritical > 0 ? 'expired' : (dqOpenCount ?? 0) > 0 ? 'pending' : 'active'}>{dqOpenCount ?? 0}</StatusPill>
            <span style={metaDim}>open · {dqCritical} crit/high</span>
          </StatusCell>
          <span style={{ flex: 1 }} />
          <Link href="/settings/property" style={{
            padding: '4px 12px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', fontWeight: 600,
            background: 'var(--moss)', color: 'var(--paper-warm)', border: '1px solid var(--moss)',
            borderRadius: 4, textDecoration: 'none',
          }}>EDIT PROPERTY →</Link>
        </>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={null} unit="text" valueText={profile?.trading_name ?? '—'} label="Property" />
        <KpiBox value={roomsCount ?? 0} unit="count" label="Room types" />
        <KpiBox value={completePct} unit="pct" label="Profile complete" />
        <KpiBox value={sectionsList.length} unit="count" label="Editable sections" />
        <KpiBox value={activeUsers ?? 0} unit="count" label="Active users" />
        <KpiBox value={dqOpenCount ?? 0} unit="count" label="DQ open" />
      </div>
      <div style={{ marginTop: 18 }}>
        <SectionHead title="Property sections" emphasis={`${sectionsList.length} editable`} sub="Click to edit · placeholder count flags incomplete" source="marketing.v_settings_sections_live" />
        {sectionsList.length === 0 ? (
          <div style={{ padding: 32, background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            {admin ? 'No sections registered.' : 'Service-role key missing — add SUPABASE_SERVICE_ROLE_KEY in Vercel env.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {sectionsList.map((s) => {
              const ph = Number(s.placeholder_count ?? 0);
              const tone = ph === 0 ? 'active' : ph >= 5 ? 'expired' : 'pending';
              return (
                <Link key={s.section_code} href={`/settings/property/${s.section_code}`}
                  style={{
                    background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
                    borderRadius: 8, padding: '12px 14px', textDecoration: 'none', color: 'inherit',
                    display: 'flex', flexDirection: 'column', gap: 4, minHeight: 90,
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 500, fontSize: 'var(--t-md)' }}>{s.display_name}</div>
                    <StatusPill tone={tone}>{ph === 0 ? '✓' : `${ph}`}</StatusPill>
                  </div>
                  {s.description && <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', lineHeight: 1.4 }}>{s.description}</div>}
                  <div style={{ marginTop: 'auto', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', letterSpacing: 'var(--ls-loose)' }}>
                    {s.row_count ?? 0} {s.row_count === 1 ? 'row' : 'rows'}
                    {ph > 0 && <span style={{ color: 'var(--brass)' }}> · {ph} placeholder{ph === 1 ? '' : 's'}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
