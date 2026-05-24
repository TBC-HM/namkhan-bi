// app/finance/mapping/page.tsx — PBS #205 v2 (2026-05-25)
// Full primitive adoption: DashboardPage + Container per section + KpiTile.

import { DashboardPage, Container, KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';
import { FINANCE_SUBPAGES } from '../_subpages';
import { supabaseGl } from '@/lib/supabase-gl';
import MappingTable, { type ClassOption, type MappingRow } from './MappingTable';

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

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

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
  const total = rows.length;
  const coveragePct = total > 0 ? ((total - unclear.length) / total) * 100 : 0;

  const subtitle = `gl.v_account_class_status · ${total} accounts · ${unclear.length} unclear (${fmtUsd(unclearTotal)}) · ${coveragePct.toFixed(0)}% coverage`;

  const tabs = FINANCE_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href }));

  const tiles: KpiTileProps[] = [
    { label: 'Unclear', value: unclear.length, size: 'sm', footnote: 'no USALI mapping', status: unclear.length > 0 ? 'amber' : 'green' },
    { label: 'Overridden', value: overridden.length, size: 'sm', footnote: 'manual overrides' },
    { label: 'Standard', value: standard.length, size: 'sm', footnote: 'rule-mapped' },
    { label: 'Total', value: total, size: 'sm' },
    { label: 'Coverage %', value: `${coveragePct.toFixed(0)}%`, size: 'sm', status: coveragePct >= 90 ? 'green' : coveragePct >= 70 ? 'amber' : 'red' },
    { label: 'Unclear $', value: Math.round(unclearTotal), currency: 'USD', size: 'sm', footnote: 'Σ|usd_total| on unclear', status: unclearTotal > 0 ? 'amber' : 'green' },
  ];

  return (
    <DashboardPage title="Account mapping" subtitle={subtitle} tabs={tabs}>
      {/* 1 · Headline */}
      <div style={fullRow}>
        <Container title="Headline" subtitle="USALI coverage · classification status" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

      {/* 2 · Unclear (action required) */}
      {unclear.length > 0 && (
        <div style={fullRow}>
          <Container
            title="Needs your attention"
            subtitle={`${unclear.length} accounts · pick a class · save updates every gl_entry → refreshes mv_usali_pl_monthly`}
            density="compact"
          >
            <MappingTable rows={unclear} classes={classes} mode="unclear" />
          </Container>
        </div>
      )}

      {/* 3 · Overridden */}
      {overridden.length > 0 && (
        <div style={fullRow}>
          <Container
            title="Already overridden"
            subtitle={`${overridden.length} accounts · editable · gl.account_class_override`}
            density="compact"
          >
            <MappingTable rows={overridden} classes={classes} mode="overridden" />
          </Container>
        </div>
      )}

      {/* 4 · Standard */}
      <div style={fullRow}>
        <Container
          title="Standard mappings"
          subtitle={`${standard.length} accounts · QB-classified · expand to view`}
          density="compact"
        >
          <details style={{ background: 'transparent' }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--ink-soft, #5a5a5a)', fontWeight: 600, padding: '4px 0' }}>
              Show {standard.length} accounts
            </summary>
            <div style={{ marginTop: 10 }}><MappingTable rows={standard} classes={classes} mode="standard" /></div>
          </details>
        </Container>
      </div>
    </DashboardPage>
  );
}
