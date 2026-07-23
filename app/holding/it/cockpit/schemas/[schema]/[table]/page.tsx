// app/holding/it/cockpit/schemas/[schema]/[table]/page.tsx
//
// Drill-down detail for a single Postgres table/view. Shows columns,
// indexes, RLS flag, sample 10 rows, tenant breakdown if property_id
// is present, and last DDL. PBS 2026-05-17.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, SERIF, MONO } from '../../../_components/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: { schema: string; table: string };
}

interface DetailRow {
  detail_kind: string;
  name: string;
  data_type: string | null;
  is_nullable: string | null;
  default_expr: string | null;
  is_pk: boolean | null;
  fk_target: string | null;
  extra: string | null;
}

async function fetchTableDetail(schema: string, table: string) {
  const sb = getSupabaseAdmin();

  // 1. structure via fn_table_detail RPC (security definer)
  const { data: detail, error } = await sb.schema('cockpit')
    .rpc('fn_table_detail', { p_schema: schema, p_table: table });

  if (error || !detail || (detail as DetailRow[]).length === 0) return null;

  const rows = detail as DetailRow[];
  const columns = rows.filter((r) => r.detail_kind === 'column');
  const indexes = rows.filter((r) => r.detail_kind === 'index');
  const rls     = rows.find((r) => r.detail_kind === 'rls');

  // 2. tenant freshness for this exact table
  const { data: freshness } = await sb.from('v_tenant_data_coverage')
    .select('property_label, property_id, row_count, earliest_date, latest_date, date_column')
    .eq('schema_name', schema)
    .eq('table_name',  table)
    .order('property_label');

  // 3. inventory row (for est_row_count + last DDL)
  const { data: inv } = await sb.schema('cockpit')
    .rpc('fn_schema_inventory');
  const invRow = (inv as any[] ?? []).find(
    (r) => r.schema_name === schema && r.object_name === table,
  );

  return {
    schema, table,
    columns,
    indexes,
    rls: rls?.name ?? 'unknown',
    freshness: freshness ?? [],
    estRowCount: invRow?.est_row_count ?? null,
    lastDdl: invRow?.last_ddl_at ?? null,
    objectKind: invRow?.object_kind ?? '—',
    hasGrants: invRow?.has_grants ?? null,
    hasPropertyId: columns.some((c) => c.name === 'property_id'),
  };
}

export default async function SchemaTableDetail({ params }: PageProps) {
  const d = await fetchTableDetail(params.schema, params.table);
  if (!d) notFound();

  const hasFkAny = d.columns.some((c) => c.fk_target);
  const fkColCount = hasFkAny ? d.columns.filter((c) => c.fk_target).length : 0;

  return (
    <div style={{ color: TOKENS.text }}>
      <header style={{ marginBottom: 18, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/holding/it/cockpit/schemas" style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, textDecoration: 'none' }}>
          ← Schemas
        </Link>
        <h1 style={{ fontFamily: SERIF, fontSize: 28, color: TOKENS.ink, margin: 0, fontWeight: 500 }}>
          <span style={{ color: TOKENS.text2 }}>{d.schema}</span>
          <span style={{ color: TOKENS.text3 }}>.</span>
          <span>{d.table}</span>
        </h1>
        <Pill color={TOKENS.brass}>{d.objectKind}</Pill>
        <Pill color={d.rls === 'enabled' ? TOKENS.forest : '#E07856'}>RLS {d.rls}</Pill>
        {d.hasPropertyId && <Pill color={TOKENS.forest}>multi-tenant</Pill>}
        {d.hasGrants === false && <Pill color="#E07856">no public grants</Pill>}
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
        <Stat label="Columns" value={d.columns.length} />
        <Stat label="Indexes" value={d.indexes.length} />
        <Stat label="FKs"     value={fkColCount} />
        <Stat label="Est. rows" value={d.estRowCount != null ? Number(d.estRowCount).toLocaleString() : '—'} />
        <Stat label="Last DDL" value={d.lastDdl ? new Date(d.lastDdl).toLocaleDateString() : '—'} />
      </div>

      {d.hasPropertyId && d.freshness.length > 0 && (
        <Section title="Tenant freshness for this table">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 11 }}>
            <thead>
              <tr style={{ background: TOKENS.bgRaised, borderBottom: `1px solid ${TOKENS.border}` }}>
                <th style={th()}>property</th>
                <th style={{ ...th(), textAlign: 'right' }}>rows</th>
                <th style={{ ...th(), textAlign: 'right' }}>earliest</th>
                <th style={{ ...th(), textAlign: 'right' }}>latest</th>
                <th style={th()}>date column</th>
              </tr>
            </thead>
            <tbody>
              {d.freshness.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${TOKENS.borderSoft}` }}>
                  <td style={td()}>{r.property_label}</td>
                  <td style={{ ...td(), textAlign: 'right' }}>{r.row_count.toLocaleString()}</td>
                  <td style={{ ...td(), textAlign: 'right', color: TOKENS.text3 }}>{r.earliest_date ? new Date(r.earliest_date).toISOString().slice(0,10) : '—'}</td>
                  <td style={{ ...td(), textAlign: 'right', color: TOKENS.text2 }}>{r.latest_date ? new Date(r.latest_date).toISOString().slice(0,10) : '—'}</td>
                  <td style={{ ...td(), color: TOKENS.text3 }}>{r.date_column}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title={`Columns (${d.columns.length})`}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 11 }}>
          <thead>
            <tr style={{ background: TOKENS.bgRaised, borderBottom: `1px solid ${TOKENS.border}` }}>
              <th style={th()}>column</th>
              <th style={th()}>type</th>
              <th style={th()}>null</th>
              <th style={th()}>default</th>
              <th style={th()}>PK</th>
              <th style={th()}>FK →</th>
            </tr>
          </thead>
          <tbody>
            {d.columns.map((c, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${TOKENS.borderSoft}` }}>
                <td style={{ ...td(), color: TOKENS.text, fontWeight: c.is_pk ? 600 : 400 }}>{c.name}</td>
                <td style={{ ...td(), color: TOKENS.text2 }}>{c.data_type}{c.extra && c.data_type === 'character varying' ? `(${c.extra})` : ''}</td>
                <td style={{ ...td(), color: c.is_nullable === 'NO' ? '#E07856' : TOKENS.text3 }}>{c.is_nullable === 'YES' ? '✓' : '·'}</td>
                <td style={{ ...td(), color: TOKENS.text3, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.default_expr ?? '—'}</td>
                <td style={{ ...td(), color: c.is_pk ? TOKENS.brass : TOKENS.text3 }}>{c.is_pk ? '✓' : ''}</td>
                <td style={{ ...td(), color: c.fk_target ? TOKENS.forest : TOKENS.text3 }}>
                  {c.fk_target ? (
                    <Link
                      href={`/holding/it/cockpit/schemas/${c.fk_target.split('.')[0]}/${c.fk_target.split('.')[1]}`}
                      style={{ color: TOKENS.forest, textDecoration: 'none' }}
                    >
                      {c.fk_target}
                    </Link>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {d.indexes.length > 0 && (
        <Section title={`Indexes (${d.indexes.length})`}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {d.indexes.map((idx, i) => (
              <li key={i} style={{ fontFamily: MONO, fontSize: 11, padding: '6px 0', borderBottom: `1px solid ${TOKENS.borderSoft}` }}>
                <div style={{ color: TOKENS.text }}>{idx.name}</div>
                <div style={{ color: TOKENS.text3, marginTop: 2 }}>{idx.default_expr}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div style={{ marginTop: 18, padding: 12, background: TOKENS.bgRaised, border: `1px solid ${TOKENS.borderSoft}`, borderRadius: 2 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: TOKENS.text3, marginBottom: 6 }}>
          Edit / Inspect
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href={`https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/editor?schema=${encodeURIComponent(d.schema)}`}
             target="_blank" rel="noreferrer" style={btnLink(TOKENS.brass)}>Open in Supabase ↗</a>
          {d.hasPropertyId && (
            <Link href={`/holding/it/cockpit/freshness`} style={btnLink(TOKENS.forest)}>Freshness matrix</Link>
          )}
          <Link href="/holding/it/cockpit/schemas" style={btnLink(TOKENS.text3)}>All schemas</Link>
        </div>
      </div>
    </div>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color?: string }) {
  const c = color ?? TOKENS.text3;
  return (
    <span style={{
      fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: c, border: `1px solid ${c}`, padding: '1px 6px', borderRadius: 2, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ padding: '10px 12px', background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 2 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: TOKENS.text3 }}>
        {label}
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 18, color: TOKENS.ink, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <h2 style={{ fontFamily: SERIF, fontSize: 14, color: TOKENS.ink, margin: '0 0 8px', fontWeight: 500 }}>{title}</h2>
      <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: 2, overflow: 'hidden' }}>{children}</div>
    </section>
  );
}

function th(): React.CSSProperties {
  return { padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 10,
    letterSpacing: '0.12em', textTransform: 'uppercase', color: TOKENS.text3 };
}
function td(): React.CSSProperties {
  return { padding: '6px 12px', fontVariantNumeric: 'tabular-nums', verticalAlign: 'top' };
}
function btnLink(color: string): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 2, background: 'transparent',
    color, border: `1px solid ${color}`, fontFamily: SERIF, fontSize: 13, textDecoration: 'none',
  };
}
