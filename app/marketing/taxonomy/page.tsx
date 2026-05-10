import React from 'react';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getTaxonomyData() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stg_taxonomy')
    .select('*')
    .order('category', { ascending: true });
  if (error) return [];
  return data ?? [];
}

export default async function TaxonomyPage() {
  const rows = await getTaxonomyData();

  return (
    <main style={{ padding: 'var(--space-6)', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: 'var(--space-5)' }}>
        <h1 style={{ fontSize: 'var(--t-xl)', fontWeight: 600, fontFamily: 'var(--font-fraunces)', fontStyle: 'italic' }}>
          Taxonomy
        </h1>
        <p style={{ fontSize: 'var(--t-sm)', color: 'var(--muted)', marginTop: 'var(--space-1)' }}>
          Marketing segment &amp; channel taxonomy reference.
        </p>
      </header>

      <section
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}
      >
        {rows.length === 0 ? (
          <p style={{ padding: 'var(--space-4)', fontSize: 'var(--t-sm)', color: 'var(--muted)' }}>—</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
            <thead>
              <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                {Object.keys(rows[0]).map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: 'var(--muted)',
                      textTransform: 'capitalize',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: Record<string, unknown>, i: number) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: i % 2 === 0 ? 'transparent' : 'var(--surface-raised)',
                  }}
                >
                  {Object.values(row).map((val, j) => (
                    <td
                      key={j}
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        color: 'var(--fg)',
                      }}
                    >
                      {val === null || val === undefined ? '—' : String(val)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
