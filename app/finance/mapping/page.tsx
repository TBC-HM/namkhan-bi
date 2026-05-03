// app/finance/mapping/page.tsx
// Finance · Account Mapping — accountant UI for resolving "unclear" QB accounts.
//
// Reads gl.v_account_class_status (drives the table) + gl.classes (dropdown options).
// Writes via POST /api/finance/mapping/upsert which calls gl.set_account_class().
//
// The page splits the chart of accounts into three buckets:
//   1. UNCLEAR — gl_entries currently tagged class_id='not_specified'.
//      Highest priority. The accountant picks a class for each account.
//   2. OVERRIDDEN — accounts already remapped via gl.account_class_override.
//      Editable so the accountant can correct mistakes.
//   3. STANDARD — everything else. Read-only summary, collapsed by default.

import { supabaseGl } from '@/lib/supabase-gl';
import MappingTable, { type ClassOption, type MappingRow } from './MappingTable';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

interface VStatusRow {
  account_id: string;
  account_name: string | null;
  usali_subcategory: string | null;
  usali_line_label: string | null;
  current_class_id: string | null;
  current_class_name: string | null;
  current_dept: string | null;
  override_class_id: string | null;
  override_class_name: string | null;
  override_dept: string | null;
  override_note: string | null;
  override_updated_at: string | null;
  txns: number;
  usd_total: number;
  last_seen: string | null;
  is_unclear: boolean;
}

async function getRows(): Promise<VStatusRow[]> {
  const { data, error } = await supabaseGl
    .from('v_account_class_status')
    .select('*')
    .order('usd_total', { ascending: false });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[mapping] v_account_class_status', error);
    return [];
  }
  return (data || []) as VStatusRow[];
}

async function getClassOptions(): Promise<ClassOption[]> {
  const { data, error } = await supabaseGl
    .from('classes')
    .select('class_id, qb_class_name, usali_section, usali_department')
    .order('class_id');
  if (error) return [];
  return (data || []).map((c: any) => ({
    class_id: c.class_id,
    label: `${c.qb_class_name} · ${c.usali_department ?? '—'}`,
    section: c.usali_section,
    department: c.usali_department,
  }));
}

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

export default async function MappingPage() {
  const [allRows, classes] = await Promise.all([getRows(), getClassOptions()]);

  // Aggregate per account: a single account may appear in multiple class rows
  // (split historically). Roll up to one row per account_id, keeping
  // is_unclear=true if ANY of its rows is unclear.
  type Agg = MappingRow & { _src: VStatusRow[] };
  const byAcct = new Map<string, Agg>();
  for (const r of allRows) {
    const k = r.account_id;
    const cur = byAcct.get(k);
    if (!cur) {
      byAcct.set(k, {
        account_id: r.account_id,
        account_name: r.account_name ?? r.account_id,
        usali_subcategory: r.usali_subcategory,
        usali_line_label: r.usali_line_label,
        txns: r.txns,
        usd_total: Number(r.usd_total) || 0,
        last_seen: r.last_seen,
        is_unclear: r.is_unclear,
        current_class_id: r.current_class_id,
        current_class_name: r.current_class_name,
        override_class_id: r.override_class_id,
        override_class_name: r.override_class_name,
        override_note: r.override_note,
        override_updated_at: r.override_updated_at,
        _src: [r],
      });
    } else {
      cur.txns += r.txns;
      cur.usd_total += Number(r.usd_total) || 0;
      cur.is_unclear = cur.is_unclear || r.is_unclear;
      cur._src.push(r);
      if (r.last_seen && (!cur.last_seen || r.last_seen > cur.last_seen)) cur.last_seen = r.last_seen;
    }
  }
  const rows = Array.from(byAcct.values()).map(({ _src: _, ...rest }) => rest);

  const unclear = rows.filter(r => r.is_unclear).sort((a, b) => Math.abs(b.usd_total) - Math.abs(a.usd_total));
  const overridden = rows.filter(r => !r.is_unclear && r.override_class_id).sort((a, b) => (b.override_updated_at || '').localeCompare(a.override_updated_at || ''));
  const standard = rows.filter(r => !r.is_unclear && !r.override_class_id);

  const unclearTotal = unclear.reduce((s, r) => s + Math.abs(r.usd_total), 0);
  const overriddenTotal = overridden.reduce((s, r) => s + Math.abs(r.usd_total), 0);

  return (
    <div className="page">
      <header className="page-head">
        <div className="eyebrow">Finance · Mapping</div>
        <h1>Chart-of-Accounts → USALI class</h1>
        <p className="lead">
          Resolve QuickBooks accounts that landed in the <em>Not specified</em> bucket. Picking a class
          updates every gl_entry for that account from <code>not_specified</code> → the chosen class
          and refreshes <code>mv_usali_pl_monthly</code>. Changes appear immediately in <a href="/finance/pnl">P&amp;L</a>.
        </p>
      </header>

      <section className="kpi-strip">
        <div className="kpi"><div className="lbl">Unclear accounts</div><div className="val">{unclear.length}</div><div className="deltas neu">{fmtUsd(unclearTotal)} pending</div></div>
        <div className="kpi"><div className="lbl">Overridden by accountant</div><div className="val">{overridden.length}</div><div className="deltas neu">{fmtUsd(overriddenTotal)} reclassified</div></div>
        <div className="kpi"><div className="lbl">Standard (QB-classified)</div><div className="val">{standard.length}</div><div className="deltas neu">no action needed</div></div>
        <div className="kpi"><div className="lbl">Total accounts in use</div><div className="val">{rows.length}</div><div className="deltas neu">across all gl_entries</div></div>
      </section>

      {unclear.length > 0 && (
        <section className="table-section">
          <h2>Needs your attention <span className="count">{unclear.length}</span></h2>
          <p className="hint">Accounts where QuickBooks didn&apos;t assign a USALI class. Pick a class and Save — the page reloads with the new state.</p>
          <MappingTable rows={unclear} classes={classes} mode="unclear" />
        </section>
      )}

      {overridden.length > 0 && (
        <section className="table-section">
          <h2>Already overridden <span className="count">{overridden.length}</span></h2>
          <p className="hint">You can change the assignment again at any time.</p>
          <MappingTable rows={overridden} classes={classes} mode="overridden" />
        </section>
      )}

      <section className="table-section collapsed-section">
        <details>
          <summary><strong>Standard mappings ({standard.length})</strong> — accounts QuickBooks already classed correctly</summary>
          <MappingTable rows={standard} classes={classes} mode="standard" />
        </details>
      </section>

      <style>{`
        .page { padding: 24px 28px 80px; max-width: 1280px; }
        .eyebrow { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-mute, #8a8170); }
        h1 { margin: 4px 0 8px; font-family: var(--font-display, 'Playfair Display', serif); font-weight: 500; font-size: 28px; }
        .lead { font-size: 14px; color: var(--ink-mute, #6a6353); max-width: 720px; line-height: 1.5; }
        .lead code { background: rgba(0,0,0,.04); padding: 1px 5px; border-radius: 3px; font-size: 12px; }
        .lead a { color: var(--green-2, #2e4a36); text-decoration: underline; }

        .kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
        .kpi { background: var(--card, #fff); border: 1px solid var(--line, #e7e2d8); border-radius: 8px; padding: 14px 16px; }
        .kpi .lbl { font-size: 11px; color: var(--ink-mute, #8a8170); text-transform: uppercase; letter-spacing: .5px; }
        .kpi .val { font-size: 24px; font-weight: 600; margin: 4px 0 2px; }
        .kpi .deltas.neu { font-size: 12px; color: var(--ink-mute, #8a8170); }

        .table-section { margin: 32px 0; }
        .table-section h2 { font-family: var(--font-display); font-weight: 500; font-size: 20px; margin-bottom: 4px; }
        .table-section h2 .count { font-size: 13px; color: var(--ink-mute); margin-left: 8px; font-weight: 400; }
        .table-section .hint { font-size: 13px; color: var(--ink-mute); margin: 0 0 12px; }
        .collapsed-section summary { cursor: pointer; padding: 12px 0; }
      `}</style>
    </div>
  );
}
