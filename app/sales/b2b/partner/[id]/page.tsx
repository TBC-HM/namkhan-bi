// app/sales/b2b/partner/[id]/page.tsx
// Sales › B2B/DMC › Partner drill-down. WIRED to governance.dmc_contracts.

import Link from 'next/link';
import { getDmcContract, getDmcContracts } from '@/lib/dmc';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const TABS = ['Overview', 'Contract', 'Bookings', 'Parity', 'Performance', 'Activity', 'Documents'] as const;

export default async function PartnerDrilldownPage({ params }: { params: { id: string } }) {
  const c = (await getDmcContract(params.id)) ?? (await getDmcContracts())[0] ?? null;

  if (!c) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-mute)' }}>
        No contracts in <code>governance.dmc_contracts</code> yet. <Link href="/sales/b2b">Back</Link>
      </div>
    );
  }

  const statusBg = c.computed_status === 'active' ? 'var(--st-good-bg)' : c.computed_status === 'expiring' ? 'var(--st-warn-bg)' : 'var(--st-bad-bg)';
  const statusBd = c.computed_status === 'active' ? 'var(--st-good-bd)' : c.computed_status === 'expiring' ? 'var(--st-warn-bd)' : 'var(--st-bad-bd)';
  const statusFg = c.computed_status === 'active' ? 'var(--moss-glow)' : c.computed_status === 'expiring' ? 'var(--brass)' : 'var(--st-bad)';
  const statusEmoji = c.computed_status === 'active' ? '🟢' : c.computed_status === 'expiring' ? '🟡' : c.computed_status === 'expired' ? '🔴' : '○';

  const lorem = (label: string) => <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>lorem · {label}</span>;

  return (
    <>
      <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 14 }}>
        <Link href="/sales/b2b" style={{ color: 'var(--ink-mute)', textDecoration: 'none' }}>← Back</Link>
        {' '}·{' '}
        <strong style={{ color: 'var(--ink-soft)' }}>Sales</strong> › B2B / DMC › Partner
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '18px 22px', margin: '8px 0 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 28 }}>
              {c.partner_short_name}
            </h1>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ background: statusBg, border: `1px solid ${statusBd}`, color: statusFg, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                {statusEmoji} {c.computed_status.charAt(0).toUpperCase() + c.computed_status.slice(1)}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>
                LPA {c.effective_date?.slice(0, 4) ?? '—'}–{c.expiry_date?.slice(0, 4) ?? '—'}
                {c.expiry_date ? ` · expires ${c.expiry_date}` : ''}
                {c.days_to_expiry != null ? ` (${c.days_to_expiry > 0 ? `${c.days_to_expiry} days` : c.days_to_expiry === 0 ? 'today' : `${Math.abs(c.days_to_expiry)}d ago`})` : ''}
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              Type: <strong>{c.partner_type}</strong> · Country: {c.country_flag ?? ''} {c.country ?? '—'} · VAT: <code style={{ fontFamily: 'Menlo, monospace', fontSize: 11 }}>{c.vat_number ?? lorem('VAT')}</code>
              <br />
              Address: {c.address ?? lorem('address')}
              <br />
              Contact: {c.contact_name ?? lorem('contact name')} {c.contact_role ? <>· {c.contact_role}</> : null}
              <br />
              ✉ {c.contact_email ?? lorem('email')} · 📞 {c.contact_phone ?? lorem('phone')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <span style={{ background: 'var(--ink-soft)', color: '#fff', padding: '6px 12px', borderRadius: 4, fontSize: 12 }}>Edit</span>
            <span style={{ background: '#fff', border: '1px solid var(--line-soft)', color: 'var(--ink-soft)', padding: '6px 12px', borderRadius: 4, fontSize: 12 }}>Renew</span>
            <span style={{ background: '#fff', border: '1px solid var(--line-soft)', color: 'var(--ink-soft)', padding: '6px 10px', borderRadius: 4, fontSize: 12 }}>⋯</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--paper-deep)', marginTop: 18, marginBottom: -1 }}>
          {TABS.map((t, i) => {
            const active = i === 0;
            return (
              <span key={t} style={{ padding: '8px 14px', fontSize: 12.5, color: active ? 'var(--ink-soft)' : 'var(--ink-mute)', borderBottom: active ? '2px solid var(--brass)' : '2px solid transparent', fontWeight: active ? 600 : 400 }}>
                {i + 1}. {t}
              </span>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <div style={{ background: '#fff', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Contract status</div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            <strong>{c.computed_status.charAt(0).toUpperCase() + c.computed_status.slice(1)}</strong>
            {c.effective_date && c.expiry_date ? (
              <> · effective {c.effective_date} → {c.expiry_date}</>
            ) : null}
            <br />
            {c.days_to_expiry != null && c.days_to_expiry > 0
              ? `${c.days_to_expiry} days remaining · `
              : c.days_to_expiry != null && c.days_to_expiry < 0
                ? 'expired · '
                : ''}
            auto-renew {c.auto_renew ? <strong style={{ color: 'var(--moss-glow)' }}>YES</strong> : <strong style={{ color: 'var(--st-bad)' }}>NO</strong>}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Booking activity</div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            {lorem('not yet wired — needs dmc_reservation_mapping table')}<br />
            <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>Will show: RNs YTD · Revenue · ADR · last booking</span>
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Parity health</div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            {lorem('parity scan not yet wired')}<br />
            <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>Will show: open violations + last scan timestamp</span>
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Anti-publication clause</div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            {c.anti_publication_clause
              ? <><strong style={{ color: 'var(--moss-glow)' }}>✓ Present</strong> — {c.anti_publication_clause.slice(0, 120)}{c.anti_publication_clause.length > 120 ? '…' : ''}</>
              : <>{lorem('clause text not yet captured')}</>}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Pricing posture</div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            <strong>{c.pricing_model}</strong>
            {c.group_surcharge_pct != null ? <> · group surcharge +{c.group_surcharge_pct}%</> : null}
            {c.group_threshold != null ? <> ({c.group_threshold}+ keys)</> : null}
            {c.extra_bed_usd != null ? <><br />extra bed USD {c.extra_bed_usd}</> : null}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Renewal countdown</div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            {c.days_to_expiry != null && c.days_to_expiry > 0 ? (
              <>
                <strong style={{ color: c.days_to_expiry < 90 ? 'var(--brass)' : 'var(--ink-soft)' }}>{c.days_to_expiry} days</strong>
                {' '}· auto-alerts at 90/60/30/14/7/1 day · last alert: not yet
              </>
            ) : c.days_to_expiry != null && c.days_to_expiry <= 0 ? (
              <strong style={{ color: 'var(--st-bad)' }}>EXPIRED — needs immediate renewal</strong>
            ) : (
              lorem('expiry date not set')
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--st-good-bg)', border: '1px solid var(--st-good-bd)', borderRadius: 6, color: 'var(--moss)', fontSize: 11.5 }}>
        <strong>✓ Wired (Overview tab).</strong> Reading from <code>v_dmc_contracts</code>. Tabs 2-7 (Contract details, Bookings, Parity, Performance, Activity, Documents) need additional schema (<code>dmc_contract_rates</code>, <code>dmc_reservation_mapping</code>, <code>parity_violations</code>) — apply{' '}
        <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>migration-draft.sql</code> to unlock.
      </div>
    </>
  );
}
