// app/finance/mapping/page.tsx — REDESIGN 2026-05-05 (recovery)
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { supabaseGl } from '@/lib/supabase-gl';
import MappingTable, { type ClassOption, type MappingRow } from './MappingTable';
import {
  FinanceStatusHeader, StatusCell, SectionHead,
  metaSm, metaStrong, metaDim,
} from '../_components/FinanceShell';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

interface VStatusRow {
  account_id: string; account_name: string | null;
  usali_subcategory: string | null; usali_line_label: string | null;
  current_class_id: string | null; current_class_name: string | null; current_dept: string | null;
  override_class_id: string | null; override_class_name: string | null; override_dept: string | null;
  override_note: string | null; override_updated_at: string | null;
  txns: number; usd_total: number; last_seen: string | null; is_unclear: boolean;
}

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

export default async function MappingPage() {
  const [{ data: rowsR }, { data: classesR }] = await Promise.all([
    supabaseGl.from('v_account_class_status').select('*').order('usd_total', { ascending: false }),
    supabaseGl.from('classes').select('class_id, qb_class_name, usali_section, usali_department').order('class_id'),
  ]);
  const allRows = (rowsR ?? []) as VStatusRow[];
  const classes: ClassOption[] = (classesR ?? []).map((c: any) => ({
    class_id: c.class_id,
    label: `${c.qb_class_name} · ${c.usali_department ?? '—'}`,
    section: c.usali_section, department: c.usali_department,
  }));

  type Agg = MappingRow & { _src: VStatusRow[] };
  const byAcct = new Map<string, Agg>();
  for (const r of allRows) {
    const cur = byAcct.get(r.account_id);
    if (!cur) {
      byAcct.set(r.account_id, {
        account_id: r.account_id, account_name: r.account_name ?? r.account_id,
        usali_subcategory: r.usali_subcategory, usali_line_label: r.usali_line_label,
        txns: r.txns, usd_total: Number(r.usd_total) || 0, last_seen: r.last_seen,
        is_unclear: r.is_unclear,
        current_class_id: r.current_class_id, current_class_name: r.current_class_name,
        override_class_id: r.override_class_id, override_class_name: r.override_class_name,
        override_note: r.override_note, override_updated_at: r.override_updated_at,
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
  const standardTotal = standard.reduce((s, r) => s + Math.abs(r.usd_total), 0);
  const grand = unclearTotal + overriddenTotal + standardTotal;
  const total = rows.length;
  const coveragePct = total > 0 ? ((total - unclear.length) / total) * 100 : 0;

  return (
    <>
      <PageHeader pillar="Finance" tab="Mapping"
        title={<>Every account on a USALI <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>line</em> — or it's noise.</>}
        lede={`${total} accounts · ${unclear.length} unclear · ${overridden.length} overridden · ${coveragePct.toFixed(0)}% coverage`} />
      <FinanceStatusHeader
        top={<>
          <StatusCell label="SOURCE"><StatusPill tone="active">gl.v_account_class_status</StatusPill><span style={metaDim}>· classes</span></StatusCell>
          <StatusCell label="ACCOUNTS"><span style={metaStrong}>{total}</span></StatusCell>
          <StatusCell label="UNCLEAR"><StatusPill tone={unclear.length > 0 ? 'pending' : 'active'}>{unclear.length}</StatusPill><span style={metaDim}>{fmtUsd(unclearTotal)} pending</span></StatusCell>
          <span style={{ flex: 1 }} />
        </>}
        bottom={<>
          <StatusCell label="OVERRIDDEN"><span style={metaSm}>{overridden.length}</span><span style={metaDim}>{fmtUsd(overriddenTotal)}</span></StatusCell>
          <StatusCell label="STANDARD"><span style={metaSm}>{standard.length}</span><span style={metaDim}>QB-classified</span></StatusCell>
          <span style={{ flex: 1 }} />
          <span style={metaDim}>USALI coverage {coveragePct.toFixed(0)}%</span>
        </>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={unclear.length} unit="count" label="Unclear accounts" />
        <KpiBox value={overridden.length} unit="count" label="Overridden" />
        <KpiBox value={standard.length} unit="count" label="Standard" />
        <KpiBox value={total} unit="count" label="Total accounts" />
      </div>
      {unclear.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <SectionHead title="Needs your attention" emphasis={`${unclear.length} accounts`} sub="Pick a class · Save updates every gl_entry · refreshes mv_usali_pl_monthly" source="gl.v_account_class_status" />
          <MappingTable rows={unclear} classes={classes} mode="unclear" />
        </div>
      )}
      {overridden.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <SectionHead title="Already overridden" emphasis={`${overridden.length}`} sub="Editable" source="gl.account_class_override" />
          <MappingTable rows={overridden} classes={classes} mode="overridden" />
        </div>
      )}
      <div style={{ marginTop: 18 }}>
        <SectionHead title="Standard mappings" emphasis={`${standard.length}`} sub="QB-classified · expand to view" />
        <details style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '10px 14px' }}>
          <summary style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}>
            Show {standard.length} accounts
          </summary>
          <div style={{ marginTop: 10 }}><MappingTable rows={standard} classes={classes} mode="standard" /></div>
        </details>
      </div>
    </>
  );
}
