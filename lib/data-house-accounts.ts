// lib/data-house-accounts.ts
//
// House Accounts data layer for /finance/ledger?tab=house_accounts.
//
// PBS controller frame (2026-05-15):
//   Cloudbeds emits ~30 house accounts/month at this property. The vast majority
//   are auto-named "The Namkhan – YYYY-MM-DD HH:MM:SS" or "Roots Restaurant – …"
//   — opened, charged, paid, closed same day. Those are walk-in F&B / non-guest
//   bills. A separate small set are *permanent* named accounts: Events/Meetings,
//   Viator Activity Bookings, Boutique, Farm Product Sales, COMP buckets, etc.
//   Those are the real city-ledger entries (revenue routing for non-room bills).
//
//   Cloudbeds' list endpoint gives us metadata only — `balance` and per-account
//   transactions require getHouseAccount per account_id, which the current ETL
//   doesn't call. So balance/account_type are NULL across the table. This data
//   layer surfaces what we *do* have honestly and prepares the join for the
//   future bank-reconcile step.

import { getSupabaseAdmin } from './supabaseAdmin';

export interface HouseAccountRaw {
  house_account_id: string;
  account_name: string | null;
  account_type: string | null;
  balance: number | null;
  currency: string | null;
  is_active: boolean | null;
  synced_at: string | null;
  raw: Record<string, unknown> | null;
}

export interface HouseAccountListItem {
  house_account_id: string;
  account_name: string;
  status: 'open' | 'closed' | 'unknown';
  date_created: string | null;     // YYYY-MM-DD
  date_modified: string | null;    // YYYY-MM-DD
  balance: number | null;          // always null until ETL is extended
  is_walkin: boolean;              // auto-named cohort
}

export interface HouseAccountStats {
  total_accounts: number;
  active_named: number;            // status=open AND non-walk-in (the true city ledger)
  active_walkin: number;           // status=open AND walk-in (rare — usually closed)
  walkin_30d: number;
  walkin_ytd: number;
  named_total: number;             // all-time named
  same_day_pct: number;            // % of accounts created and closed in same calendar day
  most_recent_open: string | null; // ISO date
  // POS-side money flow rolled up from pos.poster_receipts via same-day join
  // (v_house_account_payment_summary)
  pos_walkins_matched: number;
  pos_order_usd: number;
  pos_cash_usd: number;
  pos_card_usd: number;
  pos_bank_usd: number;
  pos_house_acct_charge_usd: number;
  pos_charge_room_usd: number;
}

export interface HouseAccountPosLine {
  house_account_id: string;
  receipts_n: number;
  order_usd: number;
  cash_usd: number;
  card_usd: number;
  bank_usd: number;
  top_method: string | null;
}

export interface HouseAccountsView {
  named: HouseAccountListItem[];
  walkin: HouseAccountListItem[];  // capped (most recent 200)
  stats: HouseAccountStats;
  posByHa: Record<string, HouseAccountPosLine>;
}

const WALKIN_NAME_RX = /^(The Namkhan|Roots Restaurant)\s+[–-]\s+\d{4}-\d{2}-\d{2}/;

function classify(row: HouseAccountRaw): HouseAccountListItem {
  const raw = (row.raw ?? {}) as Record<string, unknown>;
  const status = (raw.accountStatus as string | undefined)?.toLowerCase() === 'open' ? 'open'
              : (raw.accountStatus as string | undefined)?.toLowerCase() === 'closed' ? 'closed'
              : 'unknown';
  const date_created = (raw.dateCreated as string | undefined) ?? null;
  const date_modified = (raw.dateModified as string | undefined) ?? date_created;
  const name = row.account_name ?? '';
  return {
    house_account_id: row.house_account_id,
    account_name: name || '(unnamed)',
    status,
    date_created,
    date_modified,
    balance: row.balance,
    is_walkin: WALKIN_NAME_RX.test(name),
  };
}

export async function getHouseAccountsView(propertyId: number): Promise<HouseAccountsView> {
  const sb = getSupabaseAdmin();
  const [{ data, error }, { data: payRows }] = await Promise.all([
    sb.from('house_accounts')
      .select('house_account_id, account_name, account_type, balance, currency, is_active, synced_at, raw')
      .eq('property_id', propertyId)
      .limit(5000),
    sb.from('v_house_account_payment_summary')
      .select('house_account_id, receipts_n, order_usd, cash_usd, card_usd, bank_transfer_usd, house_acct_charge_usd, charge_room_usd, top_method')
      .eq('property_id', propertyId)
      .limit(5000),
  ]);

  // Build POS-by-house-account lookup
  const posByHa: Record<string, HouseAccountPosLine> = {};
  let posStats = {
    pos_walkins_matched: 0,
    pos_order_usd: 0,
    pos_cash_usd: 0,
    pos_card_usd: 0,
    pos_bank_usd: 0,
    pos_house_acct_charge_usd: 0,
    pos_charge_room_usd: 0,
  };
  for (const r of (payRows ?? []) as Array<Record<string, unknown>>) {
    const n = Number(r.receipts_n ?? 0);
    const line: HouseAccountPosLine = {
      house_account_id: String(r.house_account_id),
      receipts_n: n,
      order_usd: Number(r.order_usd ?? 0),
      cash_usd: Number(r.cash_usd ?? 0),
      card_usd: Number(r.card_usd ?? 0),
      bank_usd: Number(r.bank_transfer_usd ?? 0),
      top_method: (r.top_method as string | null) ?? null,
    };
    posByHa[line.house_account_id] = line;
    if (n > 0) posStats.pos_walkins_matched += 1;
    posStats.pos_order_usd += line.order_usd;
    posStats.pos_cash_usd  += line.cash_usd;
    posStats.pos_card_usd  += line.card_usd;
    posStats.pos_bank_usd  += line.bank_usd;
    posStats.pos_house_acct_charge_usd += Number(r.house_acct_charge_usd ?? 0);
    posStats.pos_charge_room_usd       += Number(r.charge_room_usd ?? 0);
  }

  if (error || !data) {
    return {
      named: [],
      walkin: [],
      stats: {
        total_accounts: 0, active_named: 0, active_walkin: 0,
        walkin_30d: 0, walkin_ytd: 0, named_total: 0, same_day_pct: 0,
        most_recent_open: null,
        ...posStats,
      },
      posByHa,
    };
  }

  const items = data.map(classify);

  const named = items
    .filter((i) => !i.is_walkin)
    .sort((a, b) => {
      // open first, then by date_created desc
      if ((a.status === 'open') !== (b.status === 'open')) return a.status === 'open' ? -1 : 1;
      return (b.date_created ?? '').localeCompare(a.date_created ?? '');
    });

  const walkin = items
    .filter((i) => i.is_walkin)
    .sort((a, b) => (b.date_created ?? '').localeCompare(a.date_created ?? ''))
    .slice(0, 200);

  // Stats
  const today = new Date();
  const isoToday = today.toISOString().slice(0, 10);
  const isoYearStart = isoToday.slice(0, 4) + '-01-01';
  const iso30dAgo = new Date(today.getTime() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const walkin_30d = items.filter((i) => i.is_walkin && (i.date_created ?? '') >= iso30dAgo).length;
  const walkin_ytd = items.filter((i) => i.is_walkin && (i.date_created ?? '') >= isoYearStart).length;
  const active_named = named.filter((i) => i.status === 'open').length;
  const active_walkin = walkin.filter((i) => i.status === 'open').length;
  const named_total = named.length;

  const sameDay = items.filter((i) =>
    i.date_created && i.date_modified && i.date_created === i.date_modified && i.status === 'closed',
  ).length;
  const same_day_pct = items.length ? Math.round((sameDay / items.length) * 100) : 0;

  const most_recent_open =
    items.filter((i) => i.status === 'open')
         .map((i) => i.date_created ?? '')
         .sort()
         .reverse()[0] ?? null;

  return {
    named,
    walkin,
    stats: {
      total_accounts: items.length,
      active_named,
      active_walkin,
      walkin_30d,
      walkin_ytd,
      named_total,
      same_day_pct,
      most_recent_open,
      ...posStats,
    },
    posByHa,
  };
}
