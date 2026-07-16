// Public proposal page — anon-accessible via token in URL.
// Uses dedicated public-facing layout (no portal nav).
//
// PBS 2026-07-16 (Feature B) — rebuilt into a proper interactive guest
// confirmation page:
//   - Stay summary
//   - Multi-rate offer picker (radio group, only when rate_offers.length >= 2)
//   - Add-on toggles (checkbox per non-primary block)
//   - Live total with USD conversion
//   - Guest form (name / email / phone / country / arrival time / notes)
//   - Confirm CTA → POST /api/public/proposals/[token]/confirm
//   - NO credit card capture — copy says team contacts within 24h.
//
// Data comes from public.fn_public_proposal_bundle(p_token) — a SECURITY DEFINER
// RPC that returns proposal + blocks + rate_offers + inquiry in one call.

import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import PublicProposalClient from '@/components/proposal/PublicProposalClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Bundle {
  expired: boolean;
  proposal: {
    id: string;
    public_token: string | null;
    property_id: number;
    status: string;
    guest_name: string | null;
    date_in: string | null;
    date_out: string | null;
    total_lak: number | null;
    fx_lak_per_usd: number | null;
    expires_at?: string | null;
  };
  blocks: Array<{
    id: string;
    block_type: string;
    label: string;
    note: string | null;
    qty: number;
    nights: number;
    unit_price_lak: number;
    total_lak: number;
    removable: boolean;
    hero_asset_id: string | null;
    sort_order: number;
    additional_discount_pct: number | null;
  }>;
  rate_offers: Array<{
    id: string;
    rate_plan_id: string;
    position: number;
    label: string | null;
    payment_terms: string | null;
    cancellation_terms: string | null;
    unit_price_lak: number | null;
    total_lak: number | null;
  }>;
  inquiry: {
    guest_email: string | null;
    guest_phone: string | null;
    country: string | null;
    adults: number | null;
    children: number | null;
  } | null;
}

export default async function PublicProposalPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { rate?: string };
}) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_public_proposal_bundle', { p_token: params.token });
  if (error || !data) return notFound();
  const bundle = data as Bundle;

  if (bundle.expired) {
    return (
      <div className="public-prop-bg">
        <div className="public-prop-done">
          <h1 className="public-prop-done-h1">This proposal has expired</h1>
          <p style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-md)', color: 'var(--ink-soft)', marginTop: 14 }}>
            Write back to us — we&apos;ll redraw the rates.
          </p>
          <p style={{ color: 'var(--ink-mute)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase', marginTop: 14 }}>
            book@thenamkhan.com
          </p>
        </div>
      </div>
    );
  }

  return (
    <PublicProposalClient
      token={params.token}
      proposal={{
        id: bundle.proposal.id,
        guest_name: bundle.proposal.guest_name ?? 'guest',
        date_in: bundle.proposal.date_in ?? '',
        date_out: bundle.proposal.date_out ?? '',
        status: bundle.proposal.status,
        fx_lak_per_usd: bundle.proposal.fx_lak_per_usd ?? null,
      }}
      blocks={bundle.blocks}
      rateOffers={bundle.rate_offers ?? []}
      inquiry={bundle.inquiry}
      preselectedRateId={searchParams?.rate ?? null}
    />
  );
}
