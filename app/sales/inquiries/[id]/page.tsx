// Inquiry detail — staff view of a single inquiry with "Open in Composer" CTA.
// Uses canonical PageHeader + .panel + StatusPill.

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import Page from '@/components/page/Page';
import { SALES_SUBPAGES } from '../../_subpages';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { getInquiry, createProposalFromInquiry } from '@/lib/sales';
import { fmtIsoDate, EMPTY } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUS_TONE: Record<string, { tone: StatusTone; label: string }> = {
  new:      { tone: 'info',     label: 'New' },
  drafted:  { tone: 'pending',  label: 'Drafted' },
  sent:     { tone: 'info',     label: 'Sent' },
  won:      { tone: 'active',   label: 'Won' },
  lost:     { tone: 'expired',  label: 'Lost' },
  archived: { tone: 'inactive', label: 'Archived' },
};

async function openInComposer(formData: FormData) {
  'use server';
  const id = formData.get('inquiry_id') as string;
  if (!id) return;
  const created = await createProposalFromInquiry(id);
  if (created?.id) redirect(`/sales/proposals/${created.id}/edit`);
}

export default async function InquiryDetail({ params }: { params: { id: string } }) {
  const inq = await getInquiry(params.id);
  if (!inq) return notFound();

  const status = STATUS_TONE[inq.status] ?? STATUS_TONE.new;
  const triageLabel = inq.triage_kind ?? EMPTY;
  const triageConf = inq.triage_conf ? `${(Number(inq.triage_conf) * 100).toFixed(0)}%` : EMPTY;

  return (
    <Page
      eyebrow="Sales · Inquiries · Detail"
      title={<>{inq.guest_name ?? 'Unknown guest'} <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>· {inq.country ?? '—'}</em></>}
      subPages={SALES_SUBPAGES}
      topRight={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
    >

      <div className="card-grid-3" style={{ marginTop: 18 }}>
        <article className="panel">
          <div className="panel-head">
            <span className="panel-head-title">Original <em>message</em></span>
            <span className="panel-head-meta">received via {inq.source}</span>
          </div>
          <p style={{
            fontFamily: 'var(--serif)',
            fontSize: 'var(--t-md)',
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
            color: 'var(--ink-soft)',
            marginTop: 8,
          }}>
            {(inq.raw_payload as any)?.body ?? '(no message body)'}
          </p>
        </article>

        <aside className="panel">
          <div className="panel-head">
            <span className="panel-head-title">Auto-Draft <em>tray</em></span>
          </div>
          <dl style={{ margin: '8px 0 14px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px' }}>
            <dt className="t-eyebrow" style={{ alignSelf: 'center' }}>Triage</dt>
            <dd style={{ margin: 0, fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>{triageLabel} · {triageConf}</dd>
            <dt className="t-eyebrow" style={{ alignSelf: 'center' }}>Status</dt>
            <dd style={{ margin: 0, fontSize: 'var(--t-sm)' }}><StatusPill tone={status.tone}>{status.label}</StatusPill></dd>
            <dt className="t-eyebrow" style={{ alignSelf: 'center' }}>Inquiry ID</dt>
            <dd style={{ margin: 0, fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>{inq.id.slice(0, 8)}</dd>
          </dl>

          <form action={openInComposer}>
            <input type="hidden" name="inquiry_id" value={inq.id} />
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Open in Composer →
            </button>
          </form>
        </aside>
      </div>

      <div style={{ marginTop: 18 }}>
        <Link href="/sales/inquiries" className="t-eyebrow" style={{ color: 'var(--ink-mute)' }}>← back to inquiries</Link>
      </div>
    </Page>
  );
}
