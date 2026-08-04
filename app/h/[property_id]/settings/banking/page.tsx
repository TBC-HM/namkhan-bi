// app/h/[property_id]/settings/banking/page.tsx
// Banking & Legal — legal entity, bank account, licenses, OTA profiles.
// Read-only display. Edit data via Supabase dashboard or future edit panel.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSettingsTabs } from '@/lib/property-settings-tabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid #F5F1EA' }}>
      <span style={{ width: 220, flexShrink: 0, fontSize: 12, color: '#5A5A5A', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: value ? '#1B1B1B' : '#B0A896', fontStyle: value ? 'normal' : 'italic' }}>
        {value || '—'}
      </span>
    </div>
  );
}

export default async function BankingPage({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  const sb = getSupabaseAdmin();

  const [bankRes, licRes, otaRes] = await Promise.all([
    sb.from('v_property_banking').select('*').eq('property_id', pid).maybeSingle(),
    sb.from('v_property_licenses').select('*').eq('property_id', pid).order('expiry_date'),
    sb.from('v_ota_profiles').select('*').eq('property_id', pid).order('platform'),
  ]);

  const bank = bankRes.data as any;
  const licenses = (licRes.data ?? []) as any[];
  const otas = (otaRes.data ?? []) as any[];

  const billingAddr = [
    bank?.billing_address_line1,
    bank?.billing_address_line2,
    bank?.billing_city,
    bank?.billing_country,
  ].filter(Boolean).join(', ') || null;

  return (
    <DashboardPage
      title="Settings · Banking & Legal"
      subtitle={`Legal entity · bank details · licenses · OTA profiles · property ${pid}`}
      tabs={getSettingsTabs(pid, 'banking')}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Legal Entity" subtitle="company registration · tax ID · billing address">
          <div style={{ padding: '4px 16px 12px' }}>
            <Field label="Legal Entity Name"    value={bank?.legal_entity_name} />
            <Field label="Entity Type"          value={bank?.legal_entity_type} />
            <Field label="Company Reg. Number"  value={bank?.company_reg_number} />
            <Field label="Tax ID"               value={bank?.tax_id} />
            <Field label="VAT Number"           value={bank?.vat_number} />
            <Field label="Billing Address"      value={billingAddr} />
            <Field label="Preferred Currency"   value={bank?.preferred_currency} />
            <Field label="Payment Terms"        value={bank?.payment_terms_days ? `${bank.payment_terms_days} days net` : null} />
          </div>
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container title="Bank Account" subtitle="SWIFT · IBAN · correspondent — treat as confidential">
          <div style={{ padding: '4px 16px 12px' }}>
            <Field label="Bank Name"              value={bank?.bank_name} />
            <Field label="Account Name"           value={bank?.bank_account_name} />
            <Field label="Account Number"         value={bank?.bank_account_number} />
            <Field label="IBAN"                   value={bank?.bank_iban} />
            <Field label="SWIFT / BIC"            value={bank?.bank_swift_bic} />
            <Field label="Correspondent Bank"     value={bank?.bank_correspondent_bank} />
            <Field label="Correspondent SWIFT"    value={bank?.bank_correspondent_swift} />
          </div>
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container title="Licenses & Permits" subtitle={`${licenses.length} on file · expiry tracked`}>
          {licenses.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: '#5A5A5A', fontStyle: 'italic' }}>No licenses registered yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9F7F3', borderBottom: '1px solid #E6DFCC' }}>
                    {['Type','Number','Authority','Issued','Expires','Status'].map(h => (
                      <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: '#5A5A5A', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {licenses.map((l: any) => (
                    <tr key={l.license_id} style={{ borderBottom: '1px solid #F5F1EA' }}>
                      <td style={{ padding: '7px 12px', fontWeight: 500 }}>{l.license_type}</td>
                      <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 11 }}>{l.license_number || '—'}</td>
                      <td style={{ padding: '7px 12px' }}>{l.issuing_authority || '—'}</td>
                      <td style={{ padding: '7px 12px' }}>{l.issue_date || '—'}</td>
                      <td style={{ padding: '7px 12px' }}>{l.expiry_date || '—'}</td>
                      <td style={{ padding: '7px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: l.status === 'active' ? '#E8F5E9' : '#FFF3E0',
                          color: l.status === 'active' ? '#2E7D32' : '#E65100' }}>
                          {l.status || 'unknown'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container title="OTA Profiles" subtitle={`${otas.length} channel${otas.length === 1 ? '' : 's'} · commission · account`}>
          {otas.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: '#5A5A5A', fontStyle: 'italic' }}>No OTA profiles registered yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9F7F3', borderBottom: '1px solid #E6DFCC' }}>
                    {['Platform','Property ID on OTA','Commission','Account Email','Status','Last Verified'].map(h => (
                      <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: '#5A5A5A', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {otas.map((o: any) => (
                    <tr key={o.profile_id} style={{ borderBottom: '1px solid #F5F1EA' }}>
                      <td style={{ padding: '7px 12px', fontWeight: 600 }}>{o.platform}</td>
                      <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 11 }}>{o.property_id_on_platform || '—'}</td>
                      <td style={{ padding: '7px 12px' }}>{o.commission_pct != null ? `${o.commission_pct}%` : '—'}</td>
                      <td style={{ padding: '7px 12px' }}>{o.account_email || '—'}</td>
                      <td style={{ padding: '7px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: o.status === 'active' ? '#E8F5E9' : '#F5F5F5',
                          color: o.status === 'active' ? '#2E7D32' : '#5A5A5A' }}>
                          {o.status || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '7px 12px' }}>{o.last_verified_at || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}
