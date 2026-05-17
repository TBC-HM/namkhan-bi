'use client';

// app/finance/ledger/_components/HouseAccountsSection.tsx
//
// Controller-mindset house-accounts view.
//
// Cloudbeds gives us metadata only (open/closed, dateCreated, accountName);
// per-account balance + transaction detail isn't pulled by current ETL. So
// money-side reconcile isn't possible TODAY, but the page is structured so
// it WILL be when the bank-data join lands: every active named account is a
// revenue-routing bucket that must be matched against bank/POS settlements.

import { useMemo, useState } from 'react';
import type {
  HouseAccountListItem,
  HouseAccountStats,
  HouseAccountPosLine,
} from '@/lib/data-house-accounts';
import { CLOUDBEDS_BASE } from '@/lib/cloudbedsLinks';
import { fmtMoney } from '@/lib/format';
import HouseAccountDrawer, { type HouseAccountSubject } from './HouseAccountDrawer';

interface Props {
  named:  HouseAccountListItem[];
  walkin: HouseAccountListItem[];
  stats:  HouseAccountStats;
  posByHa: Record<string, HouseAccountPosLine>;
  propertyId: number;
}

const WALKIN_PAGE = 50;

function cloudbedsHouseAccountUrl(propertyId: number, accountId: string): string {
  // Cloudbeds dashboard structure for house accounts. If this path turns out
  // to differ from /reservations/, the user can copy the ID. We open the
  // reservation surface as a stable fallback since both share the same shell.
  return `${CLOUDBEDS_BASE}/${propertyId}#/house-accounts/${accountId}`;
}

export default function HouseAccountsSection({ named, walkin, stats, posByHa, propertyId }: Props) {
  const [walkinLimit, setWalkinLimit] = useState(WALKIN_PAGE);
  const [walkinQ, setWalkinQ]         = useState('');
  const [namedQ, setNamedQ]           = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [subject, setSubject]         = useState<HouseAccountSubject | null>(null);

  const filteredNamed = useMemo(() => {
    const q = namedQ.trim().toLowerCase();
    return named.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (q && !a.account_name.toLowerCase().includes(q) && !a.house_account_id.includes(q)) return false;
      return true;
    });
  }, [named, namedQ, statusFilter]);

  const filteredWalkin = useMemo(() => {
    const q = walkinQ.trim().toLowerCase();
    return walkin.filter((a) => {
      if (q && !a.account_name.toLowerCase().includes(q) && !a.house_account_id.includes(q)) return false;
      return true;
    });
  }, [walkin, walkinQ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ─── Controller-honest banner ─────────────────────────────── */}
      <div
        style={{
          padding: '12px 14px',
          fontSize: 'var(--t-sm)',
          color: 'var(--ink-soft)',
          background: 'var(--paper-warm)',
          border: '1px solid var(--paper-deep)',
          borderLeft: '3px solid var(--brass)',
          borderRadius: 6,
        }}
      >
        <strong style={{ color: 'var(--brass)' }}>How to read this tab —</strong>{' '}
        PMS runs every non-room sale (walk-in F&amp;B, activities, boutique, comp invitations,
        events) through a <em>house account</em>. There are two cohorts:
        <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
          <li>
            <strong>Permanent named accounts</strong> ({stats.active_named} active) — revenue buckets like
            <em> Events/Meetings</em>, <em>Viator Activity Bookings</em>, <em>Boutique – direct payments</em>,
            <em> COMP Invitation</em>, etc. Every $ here MUST land somewhere on the bank side
            (cash, card terminal, supplier invoice, or comp write-off).
          </li>
          <li>
            <strong>Walk-in cohort</strong> ({stats.walkin_30d} in last 30d · {stats.walkin_ytd} YTD) —
            auto-named <em>"The Namkhan – YYYY-MM-DD …"</em> / <em>"Roots Restaurant – …"</em>.
            Opened, charged, paid, closed same day ({stats.same_day_pct}% close-same-day rate).
            That's the F&amp;B / non-resident bill pattern.
          </li>
        </ul>
        <div style={{ marginTop: 8, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
          💡 <strong>Drilldown:</strong> PMS doesn&apos;t give us per-account transactions,
          but we <em>do</em> have the matching Poster POS receipts (same calendar day).
          {' '}<strong>{stats.pos_walkins_matched.toLocaleString()}</strong> of
          {' '}<strong>{stats.total_accounts.toLocaleString()}</strong> walk-in folios match a
          POS receipt — click any row in the walk-in table below to see the actual receipt list
          (waiter, table, payment method, amount).
        </div>
      </div>

      {/* ─── KPI band ─ payment-method totals from same-day POS join ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <Kpi value={fmtMoney(stats.pos_card_usd, 'USD')} label="Card received"  hint="Σ card payments from Poster receipts closed on the same day as a walk-in house account opened" tone="brass" />
        <Kpi value={fmtMoney(stats.pos_cash_usd, 'USD')} label="Cash received"  hint="Σ cash payments — physical cash collected at the F&B outlets" tone="brass" />
        <Kpi value={fmtMoney(stats.pos_bank_usd, 'USD')} label="Bank transfer"  hint="Σ bank-transfer settlements on same-day Poster receipts" tone="brass" />
        <Kpi value={fmtMoney(stats.pos_house_acct_charge_usd, 'USD')} label="House-acct charge" hint='Σ paid where Poster payment_method ILIKE "%House Acc%"' />
        <Kpi value={fmtMoney(stats.pos_charge_room_usd, 'USD')} label="Charge to room" hint="Σ paid where Poster payment_method is Charge Room / to Folio" />
        <Kpi value={fmtMoney(stats.pos_order_usd, 'USD')} label="Order total · all time" hint="Σ order_total across all matched walk-in folios" />
        <Kpi value={stats.active_named}                    label="Active named accounts" hint="Permanent revenue-routing buckets · open" />
        <Kpi value={`${stats.same_day_pct}%`}              label="Close-same-day rate"   hint="Confirms walk-in F&B pattern" />
        <Kpi value={stats.walkin_30d}                      label="Walk-ins · 30d"        hint="Auto-named accounts opened in last 30 days" />
        <Kpi value={stats.walkin_ytd}                      label="Walk-ins · YTD"        hint="Auto-named accounts opened this year" />
        <Kpi value={stats.total_accounts.toLocaleString()} label="Total accounts"        hint="All house accounts in PMS" />
        <Kpi value="—"                                     label="Bank-matched · USD"    hint="Future — once bank.transactions is wired" warn />
      </div>

      {/* ─── Filters strip ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
        padding: 10, background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)', borderRadius: 6,
      }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="t-eyebrow">Status (named)</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit', minWidth: 140 }}
          >
            <option value="all">All</option>
            <option value="open">Open only</option>
            <option value="closed">Closed only</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 200px' }}>
          <span className="t-eyebrow">Search named accounts</span>
          <input
            type="search"
            value={namedQ}
            onChange={(e) => setNamedQ(e.target.value)}
            placeholder="Viator, Boutique, Events…"
            style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit', width: '100%' }}
          />
        </label>
      </div>

      {/* ─── Named house accounts table ─────────────────────────── */}
      <div>
        <div style={{
          padding: '8px 12px',
          fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
          color: 'var(--brass)', fontWeight: 700,
        }}>
          Permanent named accounts · {filteredNamed.length} of {named.length}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ width: '100%', fontSize: 'var(--t-sm)' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Account</th>
                <th style={{ textAlign: 'left' }}>ID</th>
                <th style={{ textAlign: 'left' }}>Status</th>
                <th style={{ textAlign: 'left' }}>Created</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th style={{ textAlign: 'left' }}>Reconcile · cash/card/bill</th>
              </tr>
            </thead>
            <tbody>
              {filteredNamed.map((a) => (
                <tr key={a.house_account_id}>
                  <td style={{ fontWeight: 600 }}>
                    <a
                      href={cloudbedsHouseAccountUrl(propertyId, a.house_account_id)}
                      target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--brass)', textDecoration: 'underline' }}
                    >
                      {a.account_name}
                    </a>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>{a.house_account_id}</td>
                  <td>
                    <span style={{
                      padding: '1px 6px', borderRadius: 3,
                      fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                      background: a.status === 'open' ? 'rgba(45,106,79,0.15)' : 'var(--paper-deep)',
                      color: a.status === 'open' ? 'var(--moss, #2D6A4F)' : 'var(--ink-mute)',
                    }}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>{a.date_created ?? '—'}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>
                    {a.balance == null ? <span title="Not in ETL yet — see banner">—</span> : a.balance.toFixed(0)}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                    <span title="Will populate when bank.transactions is wired">pending bank join</span>
                  </td>
                </tr>
              ))}
              {filteredNamed.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 18, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
                    No named accounts match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Walk-in cohort ──────────────────────────────────────── */}
      <div>
        <div style={{
          padding: '8px 12px',
          fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
          color: 'var(--ink-soft)', fontWeight: 700,
        }}>
          Walk-in cohort · most recent 200 · click a row for the POS drilldown
        </div>
        <div style={{ padding: '6px 10px', marginBottom: 6 }}>
          <input
            type="search"
            value={walkinQ}
            onChange={(e) => { setWalkinQ(e.target.value); setWalkinLimit(WALKIN_PAGE); }}
            placeholder="Search by date or ID"
            style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit', minWidth: 240 }}
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ width: '100%', fontSize: 'var(--t-sm)' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Created</th>
                <th style={{ textAlign: 'left' }}>Account name</th>
                <th style={{ textAlign: 'right' }}>Receipts</th>
                <th style={{ textAlign: 'right' }}>Order $</th>
                <th style={{ textAlign: 'right' }}>Card $</th>
                <th style={{ textAlign: 'right' }}>Cash $</th>
                <th style={{ textAlign: 'left' }}>Top method</th>
                <th style={{ textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredWalkin.slice(0, walkinLimit).map((a) => {
                const pos = posByHa[a.house_account_id];
                const hasPos = pos && pos.receipts_n > 0;
                return (
                  <tr
                    key={a.house_account_id}
                    onClick={() => {
                      if (!a.date_created) return;
                      setSubject({
                        house_account_id: a.house_account_id,
                        account_name: a.account_name,
                        date: a.date_created,
                        receipts_n: pos?.receipts_n ?? 0,
                        order_usd:  pos?.order_usd  ?? 0,
                        cash_usd:   pos?.cash_usd   ?? 0,
                        card_usd:   pos?.card_usd   ?? 0,
                        top_method: pos?.top_method ?? null,
                      });
                    }}
                    style={{
                      cursor: a.date_created ? 'pointer' : 'default',
                      background: hasPos ? undefined : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <td style={{ fontFamily: 'var(--mono)' }}>{a.date_created ?? '—'}</td>
                    <td>
                      <span style={{ color: 'var(--brass)', textDecoration: hasPos ? 'underline' : 'none' }}>
                        {a.account_name}
                      </span>
                      <a
                        href={cloudbedsHouseAccountUrl(propertyId, a.house_account_id)}
                        target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Open in PMS"
                        style={{ marginLeft: 8, color: 'var(--ink-mute)', textDecoration: 'none' }}
                      >↗</a>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: hasPos ? 'var(--ink)' : 'var(--ink-mute)' }}>
                      {pos?.receipts_n ?? 0}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {pos ? fmtMoney(pos.order_usd, 'USD') : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {pos && pos.card_usd > 0 ? fmtMoney(pos.card_usd, 'USD') : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {pos && pos.cash_usd > 0 ? fmtMoney(pos.cash_usd, 'USD') : '—'}
                    </td>
                    <td style={{ color: 'var(--ink-soft)', fontSize: 'var(--t-xs)' }}>
                      {pos?.top_method ?? '—'}
                    </td>
                    <td style={{ color: a.status === 'open' ? 'var(--moss, #2D6A4F)' : 'var(--ink-mute)' }}>
                      {a.status}
                    </td>
                  </tr>
                );
              })}
              {filteredWalkin.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 18, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
                    No walk-in accounts match the current search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredWalkin.length > walkinLimit && (
          <div style={{ textAlign: 'center', padding: 10 }}>
            <button
              onClick={() => setWalkinLimit(walkinLimit + WALKIN_PAGE)}
              style={{
                padding: '6px 14px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
                borderRadius: 4, cursor: 'pointer',
              }}
            >
              Show {Math.min(WALKIN_PAGE, filteredWalkin.length - walkinLimit)} more · {filteredWalkin.length - walkinLimit} left
            </button>
          </div>
        )}
      </div>

      {/* ─── What's needed before bank reconcile works ──────────── */}
      <div style={{
        padding: '12px 14px',
        fontSize: 'var(--t-xs)',
        color: 'var(--ink-soft)',
        background: 'var(--paper)',
        border: '1px dashed var(--paper-deep)',
        borderRadius: 6,
      }}>
        <strong style={{ color: 'var(--ink)' }}>What we need before bank reconciliation works —</strong>
        <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
          <li>
            <strong>ETL extension:</strong> call PMS <code>getHouseAccount(accountID)</code> per
            account to pull <code>balance</code>, <code>charges</code> and <code>payments</code> into
            <code> pms.house_account_transactions</code>.
          </li>
          <li>
            <strong>Bank feed:</strong> ingest BCEL / Wise / Stripe statement lines into
            <code> bank.transactions</code> (date, amount, method, ref).
          </li>
          <li>
            <strong>Match key:</strong> <code>(close_date, amount, payment_method)</code> tuple — proven
            keys for matching POS settlements to bank deposits.
          </li>
          <li>
            <strong>Variance dashboard:</strong> rolls up to a single "<em>unmatched cash/card · USD</em>" tile
            that drives daily reconcile rhythm.
          </li>
        </ol>
      </div>

      {/* ─── POS drilldown drawer ──────────────────────────────── */}
      <HouseAccountDrawer
        subject={subject}
        onClose={() => setSubject(null)}
        propertyId={propertyId}
      />
    </div>
  );
}

function Kpi({ value, label, hint, warn, tone }: {
  value: number | string;
  label: string;
  hint?: string;
  warn?: boolean;
  tone?: 'brass' | 'default';
}) {
  const accent = warn ? 'var(--st-warn, #C28F2C)' : 'var(--brass)';
  return (
    <div
      title={hint}
      style={{
        padding: 12,
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 6,
      }}
    >
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
        color: 'var(--ink-mute)',
      }}>{label}</div>
      <div style={{
        marginTop: 4,
        fontSize: 'var(--t-lg)', fontWeight: 600,
        color: warn ? 'var(--ink-mute)' : tone === 'brass' ? 'var(--brass)' : 'var(--ink)',
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  );
}
