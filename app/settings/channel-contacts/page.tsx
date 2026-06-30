// app/settings/channel-contacts/page.tsx
//
// PBS 2026-06-30 v2:
//   - Source list is now DYNAMIC: every source with bookings in 2025 + 2026
//     gets a contact row. Direct channels excluded (no upstream contact to track).
//   - Sources are segmented into containers: OTA · DMC · Wholesale / B2B · Other.
//   - DMC partners hydrate from governance.dmc_contracts (full commercial
//     metadata + signed PDF link, read-only). For DMC sources NOT in
//     governance.dmc_contracts, a regular editable contact row is shown.
//   - Added a back button to /revenue/channels.
//   - Chrome is DashboardPage + Container (v6/v7).

import Link from 'next/link';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';
import ContactsForm, { type ContactRow } from './ContactsForm';
import { getChannelEconomicsForRange } from '@/lib/data-channels';
import { getDmcContracts } from '@/lib/dmc';
import { matchSourceToContract } from '@/lib/dmc-match';
import { SETTINGS_SUBPAGES } from '../_subpages';
import BackButton from '@/components/nav/BackButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// PMS source classifiers — mirror channels/[source]/page.tsx so the same
// source lands in the same segment on both surfaces.
const OTA_RX       = /booking\.com|expedia|agoda|airbnb|ctrip|trip\.com|hotels\.com|traveloka|synxis|tablet|slh|small luxury|hilton|hospitality solutions|siteminder/i;
const WHOLESALE_RX = /hotelbeds|gta|tourico|wholesale|bonotel|miki/i;
const DIRECT_RX    = /^direct|website|booking engine|email|walk[\- ]?in|whatsapp|phone|foc|owner|invitation|social media|staff usage|namkhan horse|extended stay|comp/i;
const DMC_RX       = /travel|tours|trail|safari|holiday|reveal|reseller|discov|easia|amica|nakarath|dth|exo|asev|biig|khiri|indochina|mandaLao|retreat|tripaneer|elephant|bespoke|orla|hospitality.*lao|f young/i;

type Category = 'OTA' | 'DMC' | 'Wholesale' | 'Direct' | 'Other';
function classify(name: string): Category {
  if (OTA_RX.test(name))       return 'OTA';
  if (DIRECT_RX.test(name))    return 'Direct';
  if (WHOLESALE_RX.test(name)) return 'Wholesale';
  if (DMC_RX.test(name))       return 'DMC';
  return 'Other';
}

function blankRow(name: string): ContactRow {
  return {
    source_name: name,
    account_id: '', property_url: '',
    channel_manager_name: '', channel_manager_role: '',
    channel_manager_email: '', channel_manager_phone: '',
    accounting_name: '', accounting_email: '', accounting_phone: '',
    connectivity_provider: '', commission_pct: '',
    contract_start: '', contract_renewal: '', notes: '',
    updated_at: null,
  };
}

export default async function ChannelContactsPage() {
  // Pull everything in parallel: existing channel_contacts rows, bookings list (25+26), DMC contracts.
  const [contactsRes, econ25_26, dmcContracts] = await Promise.all([
    supabase.from('v_channel_contacts').select('*'),
    getChannelEconomicsForRange('2025-01-01', '2026-12-31').catch(() => []),
    getDmcContracts().catch(() => []),
  ]);

  const existing = new Map<string, ContactRow>(
    ((contactsRes.data ?? []) as any[]).map((r) => [String(r.source_name), {
      source_name: String(r.source_name),
      account_id: r.account_id ?? '',
      property_url: r.property_url ?? '',
      channel_manager_name: r.channel_manager_name ?? '',
      channel_manager_role: r.channel_manager_role ?? '',
      channel_manager_email: r.channel_manager_email ?? '',
      channel_manager_phone: r.channel_manager_phone ?? '',
      accounting_name: r.accounting_name ?? '',
      accounting_email: r.accounting_email ?? '',
      accounting_phone: r.accounting_phone ?? '',
      connectivity_provider: r.connectivity_provider ?? '',
      commission_pct: r.commission_pct != null ? String(r.commission_pct) : '',
      contract_start: r.contract_start ?? '',
      contract_renewal: r.contract_renewal ?? '',
      notes: r.notes ?? '',
      updated_at: r.updated_at ?? null,
    }])
  );

  // Distinct sources with bookings in 25+26 — exclude obvious null/empty + Agoda (PBS dropped).
  const distinctSources: string[] = [...new Set(
    (econ25_26 as Array<{ source_name?: string }>).map((r) => r.source_name || '').filter(Boolean)
  )].filter((s) => !/^agoda\b/i.test(s)).sort();

  // Group by category, drop Direct.
  const segmented: Record<Exclude<Category, 'Direct'>, ContactRow[]> = {
    OTA: [], DMC: [], Wholesale: [], Other: [],
  };
  for (const name of distinctSources) {
    const cat = classify(name);
    if (cat === 'Direct') continue;
    const row = existing.get(name) ?? blankRow(name);
    segmented[cat].push(row);
  }

  // Sort each segment by source_name for stable UI.
  for (const k of Object.keys(segmented) as Array<keyof typeof segmented>) {
    segmented[k].sort((a, b) => a.source_name.localeCompare(b.source_name));
  }

  // Sort DMC contracts: nearest expiry first.
  const dmcSorted = [...dmcContracts].sort((a, b) => {
    if (!a.expiry_date && !b.expiry_date) return a.partner_short_name.localeCompare(b.partner_short_name);
    if (!a.expiry_date) return 1;
    if (!b.expiry_date) return -1;
    return a.expiry_date.localeCompare(b.expiry_date);
  });
  const today = new Date();
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const settingsTabs: DashboardTab[] = SETTINGS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: false,
  }));

  return (
    <DashboardPage
      title="Channel contacts"
      subtitle={`Every source with bookings in 2025 + 2026 · segmented OTA / DMC / Wholesale / Other · Direct excluded`}
      tabs={settingsTabs}
      action={<BackButton fallback="/revenue/channels" label="← Channels" />}
    >
      {/* OTA */}
      <Container
        title={`OTA · ${segmented.OTA.length} sources`}
        subtitle="Online travel agencies · extranet credentials + commercial contacts"
      >
        {segmented.OTA.length === 0
          ? <div style={{ padding: 16, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>No OTA sources in window.</div>
          : <ContactsForm rows={segmented.OTA} />}
      </Container>

      {/* DMC partners (governance-managed) */}
      <Container
        title={`DMC partners · ${dmcSorted.length} contracts`}
        subtitle="Read-only roster from governance.dmc_contracts · click any partner for full B2B detail surface"
        action={
          <Link
            href="/sales/b2b"
            style={ctaStyle}
          >
            Open B2B / DMC →
          </Link>
        }
      >
        {dmcSorted.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
            No DMC contracts on file.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--hairline, #E6DFCC)', textAlign: 'left' }}>
                  <th style={th}>Partner</th>
                  <th style={th}>Type</th>
                  <th style={th}>Country</th>
                  <th style={th}>Status</th>
                  <th style={th}>Contact</th>
                  <th style={th}>Email · phone</th>
                  <th style={{ ...th, textAlign: 'right' }}>Comm.</th>
                  <th style={{ ...th, textAlign: 'right' }}>Group +%</th>
                  <th style={th}>Signed</th>
                  <th style={th}>Expires</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {dmcSorted.map((c) => {
                  const expiry = c.expiry_date ? new Date(c.expiry_date) : null;
                  const daysLeft = expiry ? Math.round((expiry.getTime() - today.getTime()) / 86_400_000) : null;
                  const expiryColor =
                    daysLeft == null ? 'var(--ink, #1B1B1B)' :
                    daysLeft < 0     ? 'var(--st-bad-tx, #b03826)' :
                    daysLeft < 90    ? 'var(--st-warn-tx, #8a6418)' :
                    'var(--ink, #1B1B1B)';
                  return (
                    <tr key={c.contract_id} style={{ borderBottom: '1px solid var(--hairline-soft, #F0EDE3)' }}>
                      <td style={td}>
                        <Link href={`/sales/b2b/partner/${encodeURIComponent(c.contract_id)}`} style={{ color: 'var(--ink, #1B1B1B)', fontWeight: 600, textDecoration: 'none' }}>
                          {c.partner_short_name}
                        </Link>
                      </td>
                      <td style={td}>{c.partner_type}</td>
                      <td style={td}>{c.country_flag ?? ''} {c.country ?? '—'}</td>
                      <td style={{ ...td, textTransform: 'capitalize', color: c.status === 'expired' ? 'var(--st-bad-tx, #b03826)' : c.status === 'expiring' ? 'var(--st-warn-tx, #8a6418)' : 'var(--ink, #1B1B1B)' }}>{c.status}</td>
                      <td style={td}>{c.contact_name ?? '—'}{c.contact_role ? ` · ${c.contact_role}` : ''}</td>
                      <td style={td}>
                        {c.contact_email && <div><a href={`mailto:${c.contact_email}`} style={{ color: 'var(--primary, #1F3A2E)' }}>{c.contact_email}</a></div>}
                        {c.contact_phone && <div style={{ color: 'var(--ink-soft, #5A5A5A)' }}>{c.contact_phone}</div>}
                        {!c.contact_email && !c.contact_phone && '—'}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {c.commission_pct != null && Number(c.commission_pct) > 0 ? `${Number(c.commission_pct).toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {c.group_surcharge_pct != null && Number(c.group_surcharge_pct) > 0 ? `${Number(c.group_surcharge_pct).toFixed(0)}%` : '—'}
                      </td>
                      <td style={td}>{fmtDate(c.signed_date)}</td>
                      <td style={{ ...td, color: expiryColor, fontWeight: daysLeft != null && daysLeft < 90 ? 600 : 400 }}>
                        {fmtDate(c.expiry_date)}
                        {daysLeft != null && (
                          <div style={{ fontSize: 10, color: expiryColor, opacity: 0.85 }}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d ago` : `${daysLeft}d left`}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        <Link href={`/sales/b2b/partner/${encodeURIComponent(c.contract_id)}`} style={{ fontSize: 11, color: 'var(--primary, #1F3A2E)', textDecoration: 'underline' }}>Open →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PMS sources classified as DMC but WITHOUT a contract on file —
            surface their contact rows so they're not lost. */}
        {segmented.DMC.length > 0 && (() => {
          // Use matchSourceToContract to remove the ones already covered by governance.dmc_contracts.
          const matchPool = dmcContracts.map((c) => ({ contract_id: c.contract_id, partner_short_name: c.partner_short_name }));
          const uncovered = segmented.DMC.filter((r) => {
            const m = matchSourceToContract(r.source_name, matchPool);
            return !m.contract_id;
          });
          if (uncovered.length === 0) return null;
          return (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
              <div style={{ fontFamily: 'var(--mono, monospace)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--st-warn-tx, #8a6418)', marginBottom: 8 }}>
                {uncovered.length} DMC source{uncovered.length === 1 ? '' : 's'} sending bookings but no contract on file
              </div>
              <ContactsForm rows={uncovered} />
            </div>
          );
        })()}
      </Container>

      {/* Wholesale / B2B */}
      <Container
        title={`Wholesale / B2B · ${segmented.Wholesale.length} sources`}
        subtitle="Bedbanks + B2B aggregators · net-rate exposure"
      >
        {segmented.Wholesale.length === 0
          ? <div style={{ padding: 16, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>No Wholesale sources in window.</div>
          : <ContactsForm rows={segmented.Wholesale} />}
      </Container>

      {/* Other */}
      <Container
        title={`Other · ${segmented.Other.length} sources`}
        subtitle="Sources that don't fit OTA / DMC / Wholesale (groups, retreats, special channels)"
      >
        {segmented.Other.length === 0
          ? <div style={{ padding: 16, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>No Other sources in window.</div>
          : <ContactsForm rows={segmented.Other} />}
      </Container>
    </DashboardPage>
  );
}

const ctaStyle: React.CSSProperties = {
  padding: '6px 12px', fontSize: 11, letterSpacing: '0.08em',
  textTransform: 'uppercase', fontWeight: 600,
  background: 'var(--primary, #1F3A2E)', color: '#FFFFFF',
  borderRadius: 4, textDecoration: 'none',
};

const th: React.CSSProperties = {
  padding: '8px 10px',
  fontFamily: 'var(--mono, monospace)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--ink-soft, #5A5A5A)',
  fontWeight: 600,
};

const td: React.CSSProperties = {
  padding: '10px',
  verticalAlign: 'top',
  color: 'var(--ink, #1B1B1B)',
};
