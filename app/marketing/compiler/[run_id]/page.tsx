// app/marketing/compiler/[run_id]/page.tsx
// Variant comparison — compset-density redesign.
// Compact 2-row header (prompt + spec + status) → inline offer config →
// variants DataTable with expandable price stack.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import Page from '@/components/page/Page';
import { MARKETING_SUBPAGES } from '../../_subpages';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtIsoDate, EMPTY } from '@/lib/format';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import OfferConfigForm from './_components/OfferConfigForm';
import VariantsTable, { type VariantRow } from './_components/VariantsTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUS_TONE: Record<string, StatusTone> = {
  draft: 'pending', compiling: 'pending', ready: 'info',
  rendering: 'pending', deployed: 'active', halted: 'expired',
};

export default async function VariantsPage({ params }: { params: { run_id: string } }) {
  const admin = getSupabaseAdmin();
  const { data: run } = await admin
    .schema('compiler').from('runs').select('*').eq('id', params.run_id).maybeSingle();
  if (!run) notFound();

  const { data: variants } = await admin
    .schema('compiler').from('variants').select('*')
    .eq('run_id', params.run_id).order('label');

  const { data: deploys } = await admin
    .schema('compiler').from('deploys').select('*')
    .eq('run_id', params.run_id).order('created_at', { ascending: false });

  const list = (variants ?? []) as VariantRow[];
  const spec = (run.parsed_spec ?? {}) as any;
  const latestDeploy = deploys?.[0] ?? null;

  return (
    <Page
      eyebrow="Marketing · Compiler · Variants"
      title={<>Compare <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>variants</em></>}
      subPages={MARKETING_SUBPAGES}
      topRight={<StatusPill tone={STATUS_TONE[run.status] ?? 'info'}>{run.status}</StatusPill>}
    >

      {/* Compact 2-row header (prompt + parsed spec + deploy link) */}
      <div style={headerWrap}>
        <div style={headerRow1}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>PROMPT</span>
          <span style={meta}>{run.prompt}</span>
          <span style={{ flex: 1 }} />
          <Link href="/marketing/compiler" style={linkBtn}>← Back</Link>
        </div>
        <div style={headerRow2}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>PARSED</span>
          <span style={meta}>{spec.duration_nights ?? '?'} nights</span>
          <span style={dim}>·</span>
          <span style={meta}>{spec.theme ?? 'general'}</span>
          <span style={dim}>·</span>
          <span style={meta}>{spec.pax ?? '?'} pax</span>
          {spec.lunar_required && (<><span style={dim}>·</span><span style={{ ...meta, color: 'var(--brass)' }}>lunar</span></>)}
          {spec.tier?.length > 0 && (<><span style={dim}>·</span><span style={meta}>{spec.tier.join('/')}</span></>)}
          <span style={{ flex: 1 }} />
          {latestDeploy ? (
            <>
              <span className="t-eyebrow" style={{ marginRight: 4 }}>LIVE</span>
              <Link href={`/r/${latestDeploy.subdomain}`} target="_blank" style={{ ...meta, color: 'var(--brass)', textDecoration: 'none' }}>
                /r/{latestDeploy.subdomain} ↗
              </Link>
              <span style={dim}>· {fmtIsoDate(latestDeploy.deployed_at)}</span>
            </>
          ) : (
            <span style={dim}>not deployed</span>
          )}
        </div>
      </div>

      <OfferConfigForm runId={run.id} initial={spec.offer ?? undefined} />

      <div style={{ marginTop: 18, marginBottom: 8 }}>
        <div className="t-eyebrow">Variants {list.length > 0 && <span style={{ ...dim, marginLeft: 8 }}>{list.length}</span>}</div>
      </div>

      <VariantsTable runId={run.id} rows={list} partySize={Number(spec.pax) || 1} />

      <div style={{ marginTop: 18, fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>
        Sub-pages: <Link href={`/marketing/compiler/${run.id}/edit`} style={{ color: 'var(--brass)' }}>EDIT ITINERARY</Link>
        {' · '}
        <Link href={`/marketing/compiler/${run.id}/preview`} style={{ color: 'var(--brass)' }}>PREVIEW</Link>
        {' · '}
        <Link href={`/marketing/compiler/${run.id}/deploy`} style={{ color: 'var(--brass)' }}>DEPLOY HISTORY</Link>
      </div>
    </Page>
  );
}

const headerWrap: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 6,
  marginTop: 14,
  overflow: 'hidden',
};
const headerRow1: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 12px',
  borderBottom: '1px solid var(--paper-deep)',
  flexWrap: 'wrap',
};
const headerRow2: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 12px',
  flexWrap: 'wrap',
};
const meta: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink)',
};
const dim: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)',
};
const linkBtn: React.CSSProperties = {
  padding: '3px 10px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', fontWeight: 600,
  background: 'var(--paper)', color: 'var(--ink-soft)',
  border: '1px solid var(--paper-deep)', borderRadius: 3, textDecoration: 'none',
};
