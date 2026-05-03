// app/operations/inventory/assets/page.tsx
// Fixed-asset register — fa.assets joined to fa.categories.
// Shows NBV (straight-line depreciation against in_service_date).

import PageHeader from '@/components/layout/PageHeader';
import { fmtMoney, fmtDate, EMPTY } from '@/lib/format';
import { getAssetRegister } from '../_data';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const CONDITION_COLORS: Record<string, string> = {
  excellent:      '#2f6f3a',
  good:           '#2f6f3a',
  fair:           '#7d5a18',
  poor:           '#8a3026',
  out_of_service: '#8a3026',
};

export default async function AssetsPage() {
  const assets = await getAssetRegister();

  // Group by FA category (FFE_GUEST, FFE_PUBLIC, etc.)
  const byCat = new Map<string, { name: string; rows: typeof assets }>();
  assets.forEach(a => {
    const code = a.category_code ?? 'OTHER';
    if (!byCat.has(code)) byCat.set(code, { name: a.category_name ?? 'Other', rows: [] });
    byCat.get(code)!.rows.push(a);
  });

  const totalCost = assets.reduce((s, a) => s + (a.purchase_cost_usd ?? 0), 0);
  const totalNbv = assets.reduce((s, a) => s + (a.nbv_usd ?? 0), 0);
  const totalDep = totalCost - totalNbv;

  return (
    <>
      <PageHeader
        pillar="Operations"
        tab="Inventory · Assets"
        title={<>Fixed asset <em style={{ color: 'var(--brass)' }}>register</em></>}
        lede={<>Building, FF&amp;E, plant, vehicles, IT/POS — net book value via straight-line depreciation against in-service date.</>}
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginTop: 18,
        marginBottom: 24,
      }}>
        <Stat label="Total assets"        value={`${assets.length}`} />
        <Stat label="Original cost"       value={fmtMoney(totalCost, 'USD')} />
        <Stat label="Accumulated dep."    value={fmtMoney(totalDep,  'USD')} />
        <Stat label="Net book value"      value={fmtMoney(totalNbv,  'USD')} />
      </div>

      {Array.from(byCat.entries()).map(([code, group]) => (
        <section key={code} style={{ marginBottom: 24 }}>
          <h2 style={{
            marginBottom: 8,
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase',
            color: 'var(--brass)',
          }}>{code} · {group.name} · {group.rows.length}</h2>

          <div style={{ border: '1px solid var(--rule, #e3dfd3)', background: 'var(--paper, #fbf9f3)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--paper-deep, #f6f3ec)' }}>
                  <Th>Tag</Th>
                  <Th>Asset</Th>
                  <Th>Manufacturer</Th>
                  <Th>Location</Th>
                  <Th align="right">Purchased</Th>
                  <Th align="right">Cost</Th>
                  <Th align="right">Life</Th>
                  <Th align="right">NBV</Th>
                  <Th align="center">Condition</Th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map(a => (
                  <tr key={a.asset_tag} style={{ borderBottom: '1px solid var(--rule, #e3dfd3)' }}>
                    <Td><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{a.asset_tag}</span></Td>
                    <Td>
                      {a.name}
                      {a.manufacturer && a.purchase_cost_usd !== null && (
                        <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-faint)' }}>{a.manufacturer}</div>
                      )}
                    </Td>
                    <Td muted>{a.manufacturer ?? EMPTY}</Td>
                    <Td muted>{a.location ?? EMPTY}</Td>
                    <Td align="right" mono>{fmtDate(a.purchase_date)}</Td>
                    <Td align="right" mono>{fmtMoney(a.purchase_cost_usd, 'USD')}</Td>
                    <Td align="right" mono>{a.useful_life_years ? `${a.useful_life_years}y` : EMPTY}</Td>
                    <Td align="right" mono>{fmtMoney(a.nbv_usd, 'USD')}</Td>
                    <Td align="center">
                      <span style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 'var(--t-xs)',
                        letterSpacing: 'var(--ls-extra)',
                        textTransform: 'uppercase',
                        color: a.condition ? (CONDITION_COLORS[a.condition] ?? 'var(--ink-soft)') : 'var(--ink-faint)',
                      }}>{a.condition ?? EMPTY}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {assets.length === 0 && (
        <div style={{ padding: '36px 12px', textAlign: 'center', color: 'var(--ink-soft)' }}>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)' }}>No assets registered yet.</div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      border: '1px solid var(--rule, #e3dfd3)',
      background: 'var(--paper, #fbf9f3)',
      padding: '12px 14px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        color: 'var(--brass)',
        marginBottom: 4,
      }}>{label}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-2xl)', fontStyle: 'italic' }}>{value}</div>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th style={{
      padding: '8px 10px',
      textAlign: align,
      fontFamily: 'var(--mono)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-extra)',
      color: 'var(--brass)',
      fontSize: 'var(--t-xs)',
      borderBottom: '1px solid var(--rule, #e3dfd3)',
      whiteSpace: 'nowrap',
    }}>{children}</th>
  );
}
function Td({ children, align = 'left', mono, muted }: { children: React.ReactNode; align?: 'left' | 'right' | 'center'; mono?: boolean; muted?: boolean }) {
  return (
    <td style={{
      padding: '6px 10px',
      textAlign: align,
      fontFamily: mono ? 'var(--mono)' : undefined,
      fontSize: mono ? 'var(--t-xs)' : 'var(--t-sm)',
      color: muted ? 'var(--ink-soft)' : undefined,
    }}>{children}</td>
  );
}
