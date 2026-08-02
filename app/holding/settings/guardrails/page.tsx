// app/holding/settings/guardrails/page.tsx
// PBS 2026-08-02 — Platform-wide guardrail rules across all properties.
// 174 rules · 9 domains. Property-specific = property_id set; holding-wide = property_id NULL.
// Read from public.guardrails — edit via guardrails settings per property for now.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TABS = [
  { key: 'back',       label: '← HoD',     href: '/holding'                     },
  { key: 'platform',   label: 'Platform',   href: '/holding/settings'            },
  { key: 'guardrails', label: 'Guardrails', href: '/holding/settings/guardrails', active: true },
  { key: 'documents',  label: 'Documents',  href: '/holding/settings/documents'  },
  { key: 'media',      label: 'Media',      href: '/holding/settings/media'      },
];

const MONO = 'JetBrains Mono, ui-monospace, monospace';

async function fetchGuardrails() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('guardrails')
    .select('id, property_id, domain, rule_key, threshold_kind, threshold_val, active, notes')
    .order('domain').order('rule_key');
  const rows = (data ?? []) as any[];

  const byDomain = new Map<string, any[]>();
  for (const r of rows) {
    const d = r.domain ?? 'uncategorized';
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d)!.push(r);
  }
  return { rows, byDomain };
}

export default async function HoldingGuardrailsPage() {
  const { rows, byDomain } = await fetchGuardrails();
  const holdingCount = rows.filter((r) => !r.property_id).length;
  const propertyCount = rows.filter((r) => r.property_id).length;

  const hdr: React.CSSProperties = { textAlign: 'left', padding: '6px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: '#5A5A5A', borderBottom: '1px solid #E6DFCC', background: '#FAFAF7', whiteSpace: 'nowrap' as const };
  const cell: React.CSSProperties = { padding: '6px 10px', fontSize: 11, borderBottom: '1px solid #E6DFCC', fontFamily: MONO };

  return (
    <DashboardPage
      title="Holding · Guardrails"
      subtitle={`${rows.length} platform rules · ${holdingCount} holding-wide · ${propertyCount} property-specific · 9 domains`}
      tabs={TABS}
    >
      {/* Summary */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Rule overview" subtitle="platform-wide floors and ceilings applied across all properties" density="compact">
          <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {[...byDomain.entries()].map(([domain, rules]) => (
              <div key={domain} style={{ background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#5A5A5A', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{domain}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO, color: '#1B1B1B', margin: '2px 0' }}>{rules.length}</div>
                <div style={{ fontSize: 10, color: '#5A5A5A' }}>rules</div>
              </div>
            ))}
          </div>
        </Container>
      </div>

      {/* Rules by domain */}
      {[...byDomain.entries()].map(([domain, rules]) => (
        <div key={domain} style={{ gridColumn: '1 / -1', marginTop: 12 }}>
          <Container title={domain} subtitle={`${rules.length} rules · ${rules.filter((r) => !r.property_id).length} holding-wide · ${rules.filter((r) => r.property_id).length} property-specific`}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>{['Rule key', 'Scope', 'Kind', 'Value', 'Active', 'Notes'].map(h => <th key={h} style={hdr}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td style={cell}>{r.rule_key}</td>
                    <td style={{ ...cell, color: r.property_id ? '#1565C0' : '#2E7D32' }}>
                      {r.property_id ? `property ${r.property_id}` : 'holding-wide'}
                    </td>
                    <td style={cell}>{r.threshold_kind ?? '—'}</td>
                    <td style={{ ...cell, fontWeight: 700 }}>{r.threshold_val ?? '—'}</td>
                    <td style={{ ...cell, color: r.active ? '#2E7D32' : '#C62828' }}>{r.active ? '✓' : '✗'}</td>
                    <td style={{ ...cell, color: '#5A5A5A', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{r.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Container>
        </div>
      ))}
    </DashboardPage>
  );
}
