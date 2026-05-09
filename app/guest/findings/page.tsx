// app/guest/findings/page.tsx — NEW
// Guest · Findings — placeholder for future structured insights from the guest
// pillar (review themes, sentiment shifts, segment anomalies, recovery cases).
// No invented findings — page is honestly empty until agents start writing rows.

import Page from '@/components/page/Page';
import { GUEST_SUBPAGES } from '../_subpages';
import StatusPill from '@/components/ui/StatusPill';
import { supabase } from '@/lib/supabase';
import {
  GuestStatusHeader, StatusCell, SectionHead,
  metaSm, metaStrong, metaDim,
} from '../_components/GuestShell';
import AgentTopRow from '../_components/AgentTopRow';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function FindingsPage() {
  // Source rows — the future home of findings:
  //   guest.review_themes — text-cluster output from review_agent
  //   guest.recovery_cases — service-recovery cases
  //   guest.nps_responses — net promoter responses
  // None exposed under public.* yet; we show counts via direct schema reads.

  const [themesR, casesR, npsR] = await Promise.all([
    supabase.schema('guest').from('review_themes').select('id', { count: 'exact', head: true }),
    supabase.schema('guest').from('recovery_cases').select('id', { count: 'exact', head: true }),
    supabase.schema('guest').from('nps_responses').select('id', { count: 'exact', head: true }),
  ]);

  const themesCount = themesR.count ?? 0;
  const casesCount = casesR.count ?? 0;
  const npsCount = npsR.count ?? 0;
  const totalRows = themesCount + casesCount + npsCount;

  return (
    <Page
      eyebrow="Guest · Findings"
      title={<>What the data <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>told us</em> this week.</>}
      subPages={GUEST_SUBPAGES}
    >

      <GuestStatusHeader
        top={
          <>
            <AgentTopRow
              code="review_agent"
              fallbackName="Review Agent"
            />
            <span style={{ flex: 1 }} />
            <StatusCell label="SOURCE">
              <StatusPill tone={totalRows > 0 ? 'active' : 'inactive'}>
                guest.review_themes · recovery_cases · nps_responses
              </StatusPill>
            </StatusCell>
          </>
        }
        bottom={
          <>
            <StatusCell label="THEMES">
              <span style={metaStrong}>{themesCount}</span>
              <span style={metaDim}>review-text clusters</span>
            </StatusCell>
            <StatusCell label="RECOVERY CASES">
              <span style={metaStrong}>{casesCount}</span>
              <span style={metaDim}>service-recovery workflow</span>
            </StatusCell>
            <StatusCell label="NPS RESPONSES">
              <span style={metaStrong}>{npsCount}</span>
              <span style={metaDim}>post-stay surveys</span>
            </StatusCell>
            <span style={{ flex: 1 }} />
          </>
        }
      />

      {/* Coming-soon scope — explicit list of what each tile WILL show, no invented data */}
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <ScopeCard
          title="Review theme clusters"
          schema="guest.review_themes"
          count={themesCount}
          desc="Topic clusters from review_agent text mining — what people complain about, what they praise. Empty until review_agent starts writing."
        />
        <ScopeCard
          title="Recovery cases"
          schema="guest.recovery_cases"
          count={casesCount}
          desc="Open complaints / incidents / negative-review follow-ups. Tied to recovery_agent (planned)."
        />
        <ScopeCard
          title="NPS responses"
          schema="guest.nps_responses"
          count={npsCount}
          desc="Post-stay surveys. Trend, score by source, detractor follow-up. nps_agent (planned · daily)."
        />
      </div>

      {totalRows === 0 && (
        <div
          style={{
            marginTop: 18,
            padding: '32px 24px',
            background: 'var(--paper-warm)',
            border: '1px solid var(--paper-deep)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 'var(--t-xl)',
              fontWeight: 500,
              color: 'var(--ink)',
              marginBottom: 8,
            }}
          >
            Coming soon.
          </div>
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)', maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
            This is the future home of structured findings. The page is wired to{' '}
            <code style={{ fontFamily: 'var(--mono)' }}>guest.review_themes</code>,{' '}
            <code style={{ fontFamily: 'var(--mono)' }}>guest.recovery_cases</code>, and{' '}
            <code style={{ fontFamily: 'var(--mono)' }}>guest.nps_responses</code>. As soon as the
            agents (Review · Recovery · NPS) start writing rows, finding cards render here. Empty
            for now — no invented data.
          </div>
        </div>
      )}
    </Page>
  );
}

function ScopeCard({ title, schema, count, desc }: { title: string; schema: string; count: number; desc: string }) {
  return (
    <div
      style={{
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderRadius: 8,
        padding: '14px 16px',
        minHeight: 160,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)', fontWeight: 500 }}>
          {title}
        </div>
        <StatusPill tone={count > 0 ? 'active' : 'inactive'}>
          {count} {count === 1 ? 'row' : 'rows'}
        </StatusPill>
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', color: 'var(--brass)', textTransform: 'uppercase' }}>
        {schema}
      </div>
      <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
        {desc}
      </div>
    </div>
  );
}
