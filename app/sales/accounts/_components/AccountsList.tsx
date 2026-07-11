'use client';
// app/sales/accounts/_components/AccountsList.tsx
// PBS 2026-07-11 pm — Design System rebuild.
// Primitives: MetricRow (4 KpiTile) · Container · Chart(cards for list) ·
// Drawer (the design-system Drawer, NOT a hand-rolled position:fixed div).
// Every drawer tab body wraps in <Container/> holding either a Chart or
// key/value rows.

import { useMemo, useState } from 'react';
import {
  Container,
  MetricRow,
  Chart,
  Drawer,
  type KpiTileProps,
} from '@/app/(cockpit)/_design';

interface Contact  { id: string; account_id: string | null; account_name: string | null; account_type: string | null; full_name: string | null; title: string | null; role: string | null; decision_role: string | null; is_primary: boolean; email: string | null; country: string | null; language: string | null; owner: string | null; tags: string[] | null; status: string | null; created_at: string | null; updated_at: string | null }
interface Contract { id: string; account_id: string; property_id: number; season_label: string; season_start: string | null; season_end: string | null; commission_pct: number | null; net_rate_terms: string | null; allotment: string | null; release_days: number | null; currency: string | null; status: string; notes: string | null; account_name: string | null; account_type: string | null }
interface Deal     { id: string; account_id: string | null; contract_id: string | null; primary_contact_id: string | null; name: string; deal_type: string | null; pipeline_stage: string | null; amount: number | null; currency: string | null; probability: number | null; expected_close: string | null; status: string; source: string | null; owner_user: string | null; stage_changed_at: string | null; won_at: string | null; account_name: string | null; primary_contact_name: string | null }
interface Activity { id: string; contact_id: string | null; account_id: string | null; deal_id: string | null; type: string; direction: string | null; subject: string | null; body: string | null; occurred_at: string; owner_user: string | null }
interface Channel  { id: string; contact_id: string; kind: string; value: string; is_primary: boolean; verified: boolean }
interface Consent  { id: string; contact_id: string; channel: string; basis: string; status: string; captured_at: string | null; source: string | null; expires_at: string | null; notes: string | null }
interface Bundle   { contacts: Contact[]; contracts: Contract[]; deals: Deal[]; activities: Activity[]; channels: Channel[]; consents: Consent[] }
interface AccountRow { account_id: string; account_name: string; account_type: string; primary_contact_name: string | null; primary_email: string | null; contract_count: number; active_contract: Contract | null; deal_count: number; open_deal_count: number; deals_won_30d: number; contacts: Contact[]; contracts: Contract[]; deals: Deal[] }

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B'; const INK_M = '#5A5A5A'; const INK_S = '#3A3A3A';
const FOREST = '#1F3A2E'; const SAND = '#B8A878'; const TERRA = '#B8542A'; const CREAM = '#F5F0E1';

type DrawerTab = 'overview' | 'channels' | 'consent' | 'contracts' | 'business' | 'activity';

export default function AccountsList({ bundle }: { bundle: Bundle; propertyId?: number }) {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');

  const rows: AccountRow[] = useMemo(() => {
    const byId = new Map<string, AccountRow>();
    const now = Date.now();
    const ago30 = now - 30 * 24 * 3600 * 1000;

    const ensure = (id: string, name: string | null, type: string | null): AccountRow => {
      const existing = byId.get(id);
      if (existing) return existing;
      const fresh: AccountRow = { account_id: id, account_name: name ?? '(unnamed)', account_type: type ?? '', primary_contact_name: null, primary_email: null, contract_count: 0, active_contract: null, deal_count: 0, open_deal_count: 0, deals_won_30d: 0, contacts: [], contracts: [], deals: [] };
      byId.set(id, fresh);
      return fresh;
    };
    for (const c of bundle.contacts) {
      if (!c.account_id) continue;
      const row = ensure(c.account_id, c.account_name, c.account_type);
      row.contacts.push(c);
      if (c.is_primary && !row.primary_contact_name) { row.primary_contact_name = c.full_name; row.primary_email = c.email; }
    }
    for (const c of bundle.contracts) {
      const row = ensure(c.account_id, c.account_name, c.account_type);
      row.contracts.push(c);
      row.contract_count = row.contracts.length;
      if (c.status === 'active' && !row.active_contract) row.active_contract = c;
    }
    for (const d of bundle.deals) {
      if (!d.account_id) continue;
      const row = byId.get(d.account_id);
      if (!row) continue;
      row.deals.push(d);
      row.deal_count = row.deals.length;
      if (d.status === 'open') row.open_deal_count++;
      if (d.won_at && new Date(d.won_at).getTime() >= ago30) row.deals_won_30d++;
    }
    return Array.from(byId.values()).sort((a, b) => (b.contract_count + b.deal_count) - (a.contract_count + a.deal_count));
  }, [bundle]);

  const kpiTiles: KpiTileProps[] = useMemo(() => {
    const withActive = rows.filter((r) => r.active_contract).length;
    const openDeals  = rows.reduce((n, r) => n + r.open_deal_count, 0);
    const won30      = rows.reduce((n, r) => n + r.deals_won_30d, 0);
    return [
      { label: 'Accounts total',      value: rows.length,  size: 'sm' },
      { label: 'With active contract',value: withActive,   size: 'sm', status: withActive > 0 ? 'green' : 'grey' },
      { label: 'Open deals',          value: openDeals,    size: 'sm', footnote: 'across all accounts' },
      { label: 'Deals won · 30d',     value: won30,        size: 'sm', status: won30 > 0 ? 'green' : 'grey' },
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (r.account_name ?? '').toLowerCase().includes(needle) || (r.primary_contact_name ?? '').toLowerCase().includes(needle));
  }, [rows, q]);

  const activeAccount = filtered.find((r) => r.account_id === openId) ?? null;
  const drawerContacts   = activeAccount?.contacts   ?? [];
  const drawerContracts  = activeAccount?.contracts  ?? [];
  const drawerDeals      = activeAccount?.deals      ?? [];
  const drawerContactIds = new Set(drawerContacts.map((c) => c.id));
  const drawerChannels   = bundle.channels.filter((c) => drawerContactIds.has(c.contact_id));
  const drawerConsents   = bundle.consents.filter((c) => drawerContactIds.has(c.contact_id));
  const drawerActivities = bundle.activities.filter((a) => (a.account_id && a.account_id === activeAccount?.account_id) || (a.contact_id && drawerContactIds.has(a.contact_id))).sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''));

  // Cards for the list body
  const listCards = filtered.map((r) => ({ id: r.account_id, _r: r }));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow tiles={kpiTiles} size="sm" />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Accounts"
          subtitle={filtered.length + ' accounts · ' + bundle.contracts.length + ' contracts · ' + bundle.deals.length + ' deals'}
          action={
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search accounts or contacts…"
              style={{ padding: '6px 10px', border: '1px solid ' + HAIR, borderRadius: 4, fontSize: 12, background: WHITE, minWidth: 220 }}
            />
          }
        >
          {filtered.length === 0 ? (
            <div style={{ fontSize: 12, color: INK_M, textAlign: 'center', padding: 16 }}>
              No accounts yet. Convert a lead at Negotiation to seed the first one.
            </div>
          ) : (
            <Chart
              variant="cards"
              data={listCards}
              renderItem={(row) => {
                const r = (row as { _r: AccountRow })._r;
                return (
                  <button
                    type="button"
                    onClick={() => { setOpenId(r.account_id); setDrawerTab('overview'); }}
                    style={{ textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'grid', gap: 4, width: '100%' }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{r.account_name}</div>
                    <div style={{ fontSize: 11, color: INK_M }}>{r.account_type || '—'}</div>
                    <div style={{ fontSize: 11, color: INK_M }}>{r.primary_contact_name ?? '—'}</div>
                    <div style={{ fontSize: 10, color: INK_M, marginTop: 4, display: 'flex', gap: 8 }}>
                      <span>Contracts <strong style={{ color: INK }}>{r.contract_count}</strong></span>
                      <span>Deals <strong style={{ color: INK }}>{r.deal_count}</strong></span>
                      {r.open_deal_count > 0 ? <span style={{ color: FOREST, fontWeight: 600 }}>{r.open_deal_count} open</span> : null}
                    </div>
                    <div style={{ fontSize: 10, color: FOREST, fontWeight: 600, marginTop: 4 }}>Open drawer →</div>
                  </button>
                );
              }}
            />
          )}
        </Container>
      </div>

      <Drawer
        open={!!activeAccount}
        onClose={() => setOpenId(null)}
        width="lg"
        title={activeAccount?.account_name ?? ''}
        subtitle={activeAccount ? (activeAccount.account_type || '—') + ' · ' + activeAccount.contracts.length + ' contracts · ' + activeAccount.deals.length + ' deals' : undefined}
      >
        {activeAccount ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid ' + HAIR, overflowX: 'auto' }}>
              {(['overview','channels','consent','contracts','business','activity'] as DrawerTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setDrawerTab(t)}
                  style={{
                    padding: '8px 14px', fontSize: 12, background: 'transparent', border: 'none',
                    borderBottom: '2px solid ' + (drawerTab === t ? FOREST : 'transparent'),
                    color: drawerTab === t ? FOREST : INK_M, cursor: 'pointer',
                    textTransform: 'capitalize', fontWeight: drawerTab === t ? 600 : 400,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {drawerTab === 'overview' ? (
              <Container title="Overview" density="compact" expandable={false}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <KV k="Account type"    v={activeAccount.account_type || '—'} />
                  <KV k="Primary contact" v={activeAccount.primary_contact_name ?? '—'} />
                  <KV k="Primary email"   v={activeAccount.primary_email ?? '—'} />
                  <KV k="Contacts"        v={String(activeAccount.contacts.length)} />
                  <KV k="Active contract" v={activeAccount.active_contract ? activeAccount.active_contract.season_label + ' · ' + (activeAccount.active_contract.commission_pct ?? '—') + '% · ' + (activeAccount.active_contract.currency ?? '') : 'none'} />
                  <KV k="Open deals"      v={String(activeAccount.deals.filter((d) => d.status === 'open').length)} />
                </div>
              </Container>
            ) : null}

            {drawerTab === 'channels' ? (
              <Container title="Channels" subtitle={drawerChannels.length + ' entries'} density="compact" expandable={false}>
                {drawerChannels.length === 0 ? <Empty>No channels captured.</Empty> : (
                  <Chart
                    variant="table"
                    xKey="contact"
                    data={drawerChannels.map((c) => {
                      const contact = drawerContacts.find((x) => x.id === c.contact_id);
                      return { contact: contact?.full_name ?? '—', kind: c.kind, value: c.value, primary: c.is_primary ? '✓' : '', verified: c.verified ? '✓' : '' };
                    })}
                    series={[
                      { key: 'kind', label: 'Kind' },
                      { key: 'value', label: 'Value' },
                      { key: 'primary', label: 'Primary' },
                      { key: 'verified', label: 'Verified' },
                    ]}
                  />
                )}
              </Container>
            ) : null}

            {drawerTab === 'consent' ? (
              <Container title="Consent" subtitle={drawerConsents.length + ' records'} density="compact" expandable={false}>
                {drawerConsents.length === 0 ? <Empty>No consent records.</Empty> : (
                  <Chart
                    variant="table"
                    xKey="contact"
                    data={drawerConsents.map((c) => {
                      const contact = drawerContacts.find((x) => x.id === c.contact_id);
                      return {
                        contact: contact?.full_name ?? '—',
                        channel: c.channel,
                        basis: c.basis.replace(/_/g, ' '),
                        status: c.status.toUpperCase(),
                        captured: c.captured_at ? c.captured_at.slice(0, 10) : '—',
                      };
                    })}
                    series={[
                      { key: 'channel', label: 'Channel' },
                      { key: 'basis', label: 'Basis' },
                      { key: 'status', label: 'Status' },
                      { key: 'captured', label: 'Captured' },
                    ]}
                  />
                )}
              </Container>
            ) : null}

            {drawerTab === 'contracts' ? (
              <Container title="Season contracts" subtitle={drawerContracts.length + ' contracts'} density="compact" expandable={false}>
                {drawerContracts.length === 0 ? <Empty>No season contracts. Corp / retreat business flows through the Business tab.</Empty> : (
                  <Chart
                    variant="table"
                    xKey="season"
                    data={drawerContracts.map((c) => ({
                      season: c.season_label,
                      validity: (c.season_start ?? '—') + ' → ' + (c.season_end ?? '—'),
                      commission: c.commission_pct != null ? c.commission_pct + '%' : '—',
                      allotment: c.allotment ?? '—',
                      release: c.release_days ?? '—',
                      currency: c.currency ?? '—',
                      status: c.status.toUpperCase(),
                    }))}
                    series={[
                      { key: 'validity', label: 'Validity' },
                      { key: 'commission', label: 'Commission' },
                      { key: 'allotment', label: 'Allotment' },
                      { key: 'release', label: 'Release days' },
                      { key: 'currency', label: 'Currency' },
                      { key: 'status', label: 'Status' },
                    ]}
                  />
                )}
              </Container>
            ) : null}

            {drawerTab === 'business' ? (
              <Container title="Deals" subtitle={drawerDeals.length + ' deals'} density="compact" expandable={false}>
                {drawerDeals.length === 0 ? <Empty>No deals yet on this account.</Empty> : (
                  <Chart
                    variant="table"
                    xKey="deal"
                    data={drawerDeals.map((d) => ({
                      deal: d.name,
                      type: d.deal_type ?? '—',
                      stage: (d.pipeline_stage ?? '—').toUpperCase(),
                      amount: d.amount != null ? (d.currency ?? '') + ' ' + Number(d.amount).toFixed(0) : '—',
                      probability: d.probability != null ? d.probability + '%' : '—',
                      expected: d.expected_close ?? '—',
                      owner: d.owner_user ?? '—',
                    }))}
                    series={[
                      { key: 'type', label: 'Type' },
                      { key: 'stage', label: 'Stage' },
                      { key: 'amount', label: 'Amount' },
                      { key: 'probability', label: 'Prob.' },
                      { key: 'expected', label: 'Expected' },
                      { key: 'owner', label: 'Owner' },
                    ]}
                  />
                )}
              </Container>
            ) : null}

            {drawerTab === 'activity' ? (
              <Container title="Activity" subtitle={drawerActivities.length + ' entries'} density="compact" expandable={false}>
                {drawerActivities.length === 0 ? <Empty>No activity logged.</Empty> : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {drawerActivities.map((a) => (
                      <div key={a.id} style={{ borderLeft: '2px solid ' + (a.direction === 'inbound' ? FOREST : a.direction === 'outbound' ? SAND : HAIR), padding: '6px 10px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                          <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', color: INK_M }}>{a.type}</span>
                          <span style={{ fontSize: 10, color: INK_M }}>· {a.direction ?? 'internal'}</span>
                          <span style={{ fontSize: 10, color: INK_M, marginLeft: 'auto' }}>{a.occurred_at?.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <div style={{ fontSize: 13, color: INK, marginTop: 2 }}>{a.subject ?? '(no subject)'}</div>
                        {a.body ? <div style={{ fontSize: 12, color: INK_M, marginTop: 2 }}>{a.body}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </Container>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, fontSize: 13, borderBottom: '1px solid ' + HAIR, paddingBottom: 8 }}>
      <div style={{ color: INK_M, textTransform: 'uppercase', fontSize: 10, letterSpacing: '.04em', fontWeight: 600 }}>{k}</div>
      <div style={{ color: INK }}>{v}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: INK_M, textAlign: 'center', padding: 12 }}>{children}</div>;
}
