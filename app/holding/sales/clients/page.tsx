// app/holding/sales/clients/page.tsx
// SaaS Client & Contract Management (separate from DMC sales)
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage } from '@/app/(cockpit)/_design';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const FOREST = '#084838';
const AMBER = '#B48A3A'; const RED = '#B03826'; const OK = '#0E7A4B';

const STATUS_COLOR: Record<string, string> = {
  prospect: INK_M,
  qualified: AMBER,
  contract_pending: AMBER,
  active: OK,
  churned: RED,
  archived: INK_M,
};

const CONTRACT_STATUS_COLOR: Record<string, string> = {
  draft: INK_M,
  sent: AMBER,
  signed: OK,
  active: OK,
  cancelled: RED,
  expired: RED,
};

export default async function SaaSClientsPage() {
  const sb = getSupabaseAdmin();

  const [clientsRes, contractsRes] = await Promise.all([
    sb.from('v_saas_clients').select('*').order('created_at', { ascending: false }),
    sb.from('v_saas_contracts').select('*').order('created_at', { ascending: false }),
  ]);

  const clients = (clientsRes.data ?? []) as Array<Record<string, any>>;
  const contracts = (contractsRes.data ?? []) as Array<Record<string, any>>;

  const contractsByClient: Record<string, Array<Record<string, any>>> = {};
  for (const ct of contracts) {
    const cid = String(ct.client_id);
    if (!contractsByClient[cid]) contractsByClient[cid] = [];
    contractsByClient[cid].push(ct);
  }

  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === 'active').length;
  const totalMRR = contracts
    .filter(c => ['signed', 'active'].includes(String(c.status)))
    .reduce((s, c) => s + Number(c.mrr_eur ?? 0), 0);

  return (
    <DashboardPage title="SaaS Clients & Contracts">
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, gridColumn: '1/-1' }}>
        {[
          { label: 'Total clients', value: String(totalClients), color: INK },
          { label: 'Active clients', value: String(activeClients), color: OK },
          { label: 'Total MRR', value: `€${Math.round(totalMRR)}`, color: FOREST },
          { label: 'Contracts', value: String(contracts.length), color: INK },
        ].map(k => (
          <div key={k.label} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Client cards */}
      <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
        {clients.map(cl => {
          const clientId = String(cl.client_id);
          const clientContracts = contractsByClient[clientId] ?? [];
          const statusColor = STATUS_COLOR[String(cl.status)] ?? INK_M;

          return (
            <div
              key={clientId}
              style={{
                background: WHITE,
                border: `1px solid ${HAIR}`,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {/* Client header */}
              <div style={{ background: CREAM, borderBottom: `1px solid ${HAIR}`, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: INK, marginBottom: 4 }}>
                      {String(cl.client_name)}
                    </div>
                    <div style={{ fontSize: 13, color: INK_M }}>
                      {cl.contact_name ? `${String(cl.contact_name)} · ` : ''}
                      {cl.contact_email ? `${String(cl.contact_email)} · ` : ''}
                      {String(cl.client_type)}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '6px 12px',
                      borderRadius: 4,
                      background: statusColor + '15',
                      color: statusColor,
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '.06em',
                    }}
                  >
                    {String(cl.status).replace('_', ' ')}
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: INK_M }}>
                  Owner: {cl.owner_user ? String(cl.owner_user) : '—'} · Created: {new Date(String(cl.created_at)).toLocaleDateString()}
                </div>
              </div>

              {/* Contracts list */}
              <div style={{ padding: '16px 20px' }}>
                {clientContracts.length === 0 ? (
                  <div style={{ fontSize: 13, color: INK_M, fontStyle: 'italic' }}>No contracts yet</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                    {clientContracts.map(ct => {
                      const ctStatusColor = CONTRACT_STATUS_COLOR[String(ct.status)] ?? INK_M;
                      const hasOnboarding = ct.onboarding_case_id;

                      return (
                        <div
                          key={String(ct.contract_id)}
                          style={{
                            background: CREAM,
                            border: `1px solid ${HAIR}`,
                            borderRadius: 6,
                            padding: '12px 16px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 2 }}>
                                {String(ct.contract_ref)} · {ct.plan_name ? String(ct.plan_name) : 'No plan'}
                              </div>
                              <div style={{ fontSize: 12, color: INK_M }}>
                                {ct.mrr_eur ? `€${ct.mrr_eur}/mo` : 'No MRR'} · 
                                {ct.user_seats ? ` ${ct.user_seats} seats` : ''} · 
                                {ct.start_date ? ` Start: ${new Date(String(ct.start_date)).toLocaleDateString()}` : ''}
                              </div>
                              {ct.modules && Array.isArray(ct.modules) && ct.modules.length > 0 && (
                                <div style={{ fontSize: 11, color: INK_M, marginTop: 4 }}>
                                  Modules: {ct.modules.join(', ')}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <div
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 4,
                                  background: ctStatusColor + '15',
                                  color: ctStatusColor,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  textTransform: 'uppercase' as const,
                                }}
                              >
                                {String(ct.status)}
                              </div>
                              {hasOnboarding ? (
                                <Link
                                  href="/holding/sales/onboarding"
                                  style={{
                                    padding: '6px 14px',
                                    borderRadius: 4,
                                    background: OK,
                                    color: WHITE,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                  }}
                                >
                                  View Onboarding
                                </Link>
                              ) : (
                                <div
                                  style={{
                                    padding: '6px 14px',
                                    borderRadius: 4,
                                    background: FOREST + '30',
                                    color: FOREST,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    border: `1px solid ${FOREST}`,
                                  }}
                                  title={`Use: SELECT fn_onboarding_start_from_contract('${ct.contract_id}')`}
                                >
                                  ⚙️ Start via SQL
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {clients.length === 0 && (
          <div
            style={{
              background: CREAM,
              border: `1px solid ${HAIR}`,
              borderRadius: 8,
              padding: '32px 24px',
              textAlign: 'center' as const,
            }}
          >
            <div style={{ fontSize: 16, color: INK_M, marginBottom: 8 }}>No SaaS clients yet</div>
            <div style={{ fontSize: 13, color: INK_M }}>
              Create your first client using fn_saas_create_client()
            </div>
          </div>
        )}
      </div>
    </DashboardPage>
  );
}