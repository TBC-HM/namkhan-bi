'use client';
// app/sales/accounts/_components/AccountsList.tsx
// PBS 2026-07-11 pm — ADR-147. Accounts list + row→drawer with 6 tabs
// (Overview · Channels · Consent · Contracts · Business · Activity).

import { useMemo, useState } from 'react';

interface Contact  { id: string; account_id: string | null; account_name: string | null; account_type: string | null; full_name: string | null; title: string | null; role: string | null; decision_role: string | null; is_primary: boolean; email: string | null; country: string | null; language: string | null; owner: string | null; tags: string[] | null; status: string | null; created_at: string | null; updated_at: string | null }
interface Contract { id: string; account_id: string; property_id: number; season_label: string; season_start: string | null; season_end: string | null; commission_pct: number | null; net_rate_terms: string | null; allotment: string | null; release_days: number | null; currency: string | null; status: string; notes: string | null; account_name: string | null; account_type: string | null }
interface Deal     { id: string; account_id: string | null; contract_id: string | null; primary_contact_id: string | null; name: string; deal_type: string | null; pipeline_stage: string | null; amount: number | null; currency: string | null; probability: number | null; expected_close: string | null; status: string; source: string | null; owner_user: string | null; stage_changed_at: string | null; won_at: string | null; account_name: string | null; primary_contact_name: string | null }
interface Activity { id: string; contact_id: string | null; account_id: string | null; deal_id: string | null; type: string; direction: string | null; subject: string | null; body: string | null; occurred_at: string; owner_user: string | null }
interface Channel  { id: string; contact_id: string; kind: string; value: string; is_primary: boolean; verified: boolean }
interface Consent  { id: string; contact_id: string; channel: string; basis: string; status: string; captured_at: string | null; source: string | null; expires_at: string | null; notes: string | null }
interface Bundle   { contacts: Contact[]; contracts: Contract[]; deals: Deal[]; activities: Activity[]; channels: Channel[]; consents: Consent[] }
interface AccountRow { account_id: string; account_name: string; account_type: string; primary_contact_name: string | null; primary_email: string | null; contract_count: number; active_contract: Contract | null; deal_count: number; open_deal_count: number; contacts: Contact[]; contracts: Contract[]; deals: Deal[] }

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B'; const INK_M = '#5A5A5A'; const INK_S = '#3A3A3A';
const FOREST = '#1F3A2E'; const SAND = '#B8A878'; const TERRA = '#B8542A'; const CREAM = '#F5F0E1';

type DrawerTab = 'overview' | 'channels' | 'consent' | 'contracts' | 'business' | 'activity';

export default function AccountsList({ bundle }: { bundle: Bundle; propertyId?: number }) {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');

  const rows: AccountRow[] = useMemo(() => {
    const byId = new Map<string, AccountRow>();
    const ensure = (id: string, name: string | null, type: string | null): AccountRow => {
      const existing = byId.get(id);
      if (existing) return existing;
      const fresh: AccountRow = { account_id: id, account_name: name ?? '(unnamed)', account_type: type ?? '', primary_contact_name: null, primary_email: null, contract_count: 0, active_contract: null, deal_count: 0, open_deal_count: 0, contacts: [], contracts: [], deals: [] };
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
    }
    return Array.from(byId.values()).sort((a, b) => (b.contract_count + b.deal_count) - (a.contract_count + a.deal_count));
  }, [bundle]);

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

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search accounts or contacts…" style={{ flex: 1, padding: '8px 12px', border: '1px solid ' + HAIR, borderRadius: 4, fontSize: 13, background: WHITE }} />
        <div style={{ fontSize: 12, color: INK_M }}>{filtered.length} accounts · {bundle.contracts.length} contracts · {bundle.deals.length} deals</div>
      </div>

      <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={TH}>Account</th><th style={TH}>Type</th>
            <th style={TH}>Primary contact</th><th style={TH}>Contracts</th>
            <th style={TH}>Deals</th><th style={TH}></th>
          </tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.account_id} style={{ cursor: 'pointer' }} onClick={() => { setOpenId(r.account_id); setDrawerTab('overview'); }}>
                <td style={TD}><strong>{r.account_name}</strong></td>
                <td style={{ ...TD, color: INK_M }}>{r.account_type || '—'}</td>
                <td style={{ ...TD, color: INK_M }}>{r.primary_contact_name ?? '—'}<div style={{ fontSize: 11 }}>{r.primary_email ?? ''}</div></td>
                <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{r.contract_count} <span style={{ color: INK_M, fontSize: 11 }}>{r.active_contract ? '· ' + r.active_contract.season_label : ''}</span></td>
                <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{r.deal_count} <span style={{ color: INK_M, fontSize: 11 }}>{r.open_deal_count > 0 ? '(' + r.open_deal_count + ' open)' : ''}</span></td>
                <td style={{ ...TD, textAlign: 'right' }}><span style={{ fontSize: 11, color: FOREST, fontWeight: 600 }}>Open drawer →</span></td>
              </tr>
            ))}
            {filtered.length === 0 ? <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: INK_M }}>No accounts yet. Convert a lead at Negotiation to seed the first one.</td></tr> : null}
          </tbody>
        </table>
      </div>

      {activeAccount ? (
        <div onClick={() => setOpenId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(31,58,46,.35)', zIndex: 90, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px, 92vw)', height: '100%', background: WHITE, overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,.15)' }}>
            <div style={{ padding: 20, borderBottom: '1px solid ' + HAIR, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, color: INK }}>{activeAccount.account_name}</div>
                <div style={{ fontSize: 12, color: INK_M, marginTop: 4 }}>{activeAccount.account_type || '—'} · {activeAccount.contracts.length} contracts · {activeAccount.deals.length} deals</div>
              </div>
              <button onClick={() => setOpenId(null)} style={{ background: 'transparent', border: '1px solid ' + HAIR, borderRadius: 2, padding: '4px 10px', cursor: 'pointer', color: INK_M }}>Close ×</button>
            </div>

            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid ' + HAIR, padding: '0 20px', overflowX: 'auto' }}>
              {(['overview','channels','consent','contracts','business','activity'] as DrawerTab[]).map((t) => (
                <button key={t} onClick={() => setDrawerTab(t)} style={{ padding: '10px 14px', fontSize: 12, background: 'transparent', border: 'none', borderBottom: '2px solid ' + (drawerTab === t ? FOREST : 'transparent'), color: drawerTab === t ? FOREST : INK_M, cursor: 'pointer', textTransform: 'capitalize', fontWeight: drawerTab === t ? 600 : 400 }}>{t}</button>
              ))}
            </div>

            <div style={{ padding: 20 }}>
              {drawerTab === 'overview' ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <KV k="Account type" v={activeAccount.account_type || '—'} />
                  <KV k="Primary contact" v={activeAccount.primary_contact_name ?? '—'} />
                  <KV k="Primary email" v={activeAccount.primary_email ?? '—'} />
                  <KV k="Contacts" v={String(activeAccount.contacts.length)} />
                  <KV k="Active contract" v={activeAccount.active_contract ? activeAccount.active_contract.season_label + ' · ' + (activeAccount.active_contract.commission_pct ?? '—') + '% · ' + (activeAccount.active_contract.currency ?? '') : 'none'} />
                  <KV k="Open deals" v={String(activeAccount.deals.filter((d) => d.status === 'open').length)} />
                </div>
              ) : null}

              {drawerTab === 'channels' ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={TH}>Contact</th><th style={TH}>Kind</th><th style={TH}>Value</th><th style={TH}>Primary</th><th style={TH}>Verified</th></tr></thead>
                  <tbody>
                    {drawerChannels.map((c) => {
                      const contact = drawerContacts.find((x) => x.id === c.contact_id);
                      return (
                        <tr key={c.id}>
                          <td style={TD}>{contact?.full_name ?? '—'}</td>
                          <td style={{ ...TD, textTransform: 'capitalize' }}>{c.kind}</td>
                          <td style={{ ...TD, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>{c.value}</td>
                          <td style={TD}>{c.is_primary ? '✓' : ''}</td>
                          <td style={TD}>{c.verified ? '✓' : ''}</td>
                        </tr>
                      );
                    })}
                    {drawerChannels.length === 0 ? <tr><td colSpan={5} style={{ ...TD, color: INK_M, textAlign: 'center' }}>No channels captured.</td></tr> : null}
                  </tbody>
                </table>
              ) : null}

              {drawerTab === 'consent' ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={TH}>Contact</th><th style={TH}>Channel</th><th style={TH}>Basis</th><th style={TH}>Status</th><th style={TH}>Captured</th></tr></thead>
                  <tbody>
                    {drawerConsents.map((c) => {
                      const contact = drawerContacts.find((x) => x.id === c.contact_id);
                      const bg = c.status === 'granted' ? '#E8F0EC' : c.status === 'withdrawn' ? '#FBE7E4' : CREAM;
                      const fg = c.status === 'granted' ? FOREST : c.status === 'withdrawn' ? TERRA : INK_S;
                      return (
                        <tr key={c.id}>
                          <td style={TD}>{contact?.full_name ?? '—'}</td>
                          <td style={{ ...TD, textTransform: 'capitalize' }}>{c.channel}</td>
                          <td style={{ ...TD, color: INK_M, textTransform: 'capitalize' }}>{c.basis.replace(/_/g, ' ')}</td>
                          <td style={TD}><span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 2, background: bg, color: fg, textTransform: 'uppercase', letterSpacing: '.04em' }}>{c.status}</span></td>
                          <td style={{ ...TD, color: INK_M }}>{c.captured_at ? c.captured_at.slice(0, 10) : '—'}</td>
                        </tr>
                      );
                    })}
                    {drawerConsents.length === 0 ? <tr><td colSpan={5} style={{ ...TD, color: INK_M, textAlign: 'center' }}>No consent records.</td></tr> : null}
                  </tbody>
                </table>
              ) : null}

              {drawerTab === 'contracts' ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={TH}>Season</th><th style={TH}>Validity</th><th style={TH}>Commission</th>
                    <th style={TH}>Allotment</th><th style={TH}>Release days</th><th style={TH}>Currency</th><th style={TH}>Status</th>
                  </tr></thead>
                  <tbody>
                    {drawerContracts.map((c) => (
                      <tr key={c.id}>
                        <td style={TD}><strong>{c.season_label}</strong></td>
                        <td style={{ ...TD, color: INK_M }}>{c.season_start ?? '—'} → {c.season_end ?? '—'}</td>
                        <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{c.commission_pct != null ? c.commission_pct + '%' : '—'}</td>
                        <td style={{ ...TD, color: INK_M }}>{c.allotment ?? '—'}</td>
                        <td style={{ ...TD, color: INK_M, fontVariantNumeric: 'tabular-nums' }}>{c.release_days ?? '—'}</td>
                        <td style={{ ...TD, color: INK_M }}>{c.currency ?? '—'}</td>
                        <td style={TD}><span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 2, background: c.status === 'active' ? '#E8F0EC' : CREAM, color: c.status === 'active' ? FOREST : INK_S, textTransform: 'uppercase', letterSpacing: '.04em' }}>{c.status}</span></td>
                      </tr>
                    ))}
                    {drawerContracts.length === 0 ? <tr><td colSpan={7} style={{ ...TD, color: INK_M, textAlign: 'center' }}>No season contracts. Corp / retreat business flows through the Business tab instead.</td></tr> : null}
                  </tbody>
                </table>
              ) : null}

              {drawerTab === 'business' ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={TH}>Deal</th><th style={TH}>Type</th><th style={TH}>Stage</th>
                    <th style={TH}>Amount</th><th style={TH}>Prob.</th><th style={TH}>Expected close</th><th style={TH}>Owner</th>
                  </tr></thead>
                  <tbody>
                    {drawerDeals.map((d) => (
                      <tr key={d.id}>
                        <td style={TD}><strong>{d.name}</strong><div style={{ color: INK_M, fontSize: 11 }}>{d.primary_contact_name ?? ''}</div></td>
                        <td style={{ ...TD, color: INK_M }}>{d.deal_type ?? '—'}</td>
                        <td style={TD}><span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 2, background: CREAM, color: INK_S, textTransform: 'uppercase' }}>{d.pipeline_stage ?? '—'}</span></td>
                        <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{d.amount != null ? (d.currency ?? '') + ' ' + Number(d.amount).toFixed(0) : '—'}</td>
                        <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{d.probability != null ? d.probability + '%' : '—'}</td>
                        <td style={{ ...TD, color: INK_M }}>{d.expected_close ?? '—'}</td>
                        <td style={{ ...TD, color: INK_M }}>{d.owner_user ?? '—'}</td>
                      </tr>
                    ))}
                    {drawerDeals.length === 0 ? <tr><td colSpan={7} style={{ ...TD, color: INK_M, textAlign: 'center' }}>No deals yet on this account.</td></tr> : null}
                  </tbody>
                </table>
              ) : null}

              {drawerTab === 'activity' ? (
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
                  {drawerActivities.length === 0 ? <div style={{ fontSize: 12, color: INK_M }}>No activity logged.</div> : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, fontSize: 13, borderBottom: '1px solid ' + HAIR, paddingBottom: 8 }}>
      <div style={{ color: INK_M, textTransform: 'uppercase', fontSize: 11, letterSpacing: '.04em' }}>{k}</div>
      <div style={{ color: INK }}>{v}</div>
    </div>
  );
}

const TH: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: INK_S, padding: '10px 8px', borderBottom: '1px solid ' + HAIR, fontWeight: 500 };
const TD: React.CSSProperties = { padding: '10px 8px', borderBottom: '1px solid ' + HAIR, fontSize: 13, color: INK, verticalAlign: 'top' };
