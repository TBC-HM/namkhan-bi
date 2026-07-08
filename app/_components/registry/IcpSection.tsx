// app/_components/registry/IcpSection.tsx
// PBS #145 (2026-05-24) — ICP block inside the rooms drill drawer.
// Server component; reads public.v_icp_segments_active (bridge for
// sales.icp_segments per claude_md §0.5). Until ICPs are tagged per room
// category, this lists all active ICPs with a link to manage them.
//
// Future iteration: add room_categories text[] column to sales.icp_segments
// and filter here. For now, all active ICPs are surfaced — operator picks
// the matching ones manually.

import { supabase } from '@/lib/supabase';
import TenantLink from '@/components/nav/TenantLink';
interface IcpRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  daily_quota: number | null;
  criteria: Record<string, unknown> | null;
}

interface Props {
  /** Reserved for future per-category filtering once ICPs are tagged. */
  category?: string;
}

export default async function IcpSection({ category: _category }: Props) {
  const { data, error } = await supabase
    .from('v_icp_segments_active')
    .select('id, key, name, description, daily_quota, criteria')
    .limit(10);

  if (error) {
    return (
      <section style={S.wrap}>
        <h3 style={S.heading}>ICPs</h3>
        <p style={S.error}>Failed to load ICPs — {error.message}</p>
      </section>
    );
  }

  const icps = (data ?? []) as IcpRow[];

  return (
    <section style={S.wrap}>
      <header style={S.header}>
        <h3 style={S.heading}>Matching ICPs</h3>
        <TenantLink href="/marketing/audiences" style={S.manageLink}>
          Manage ICPs →
        </TenantLink>
      </header>
      {icps.length === 0 ? (
        <p style={S.empty}>No active ICPs yet. <TenantLink href="/marketing/audiences" style={S.inlineLink}>Add one →</TenantLink></p>
      ) : (
        <ul style={S.list}>
          {icps.map((i) => (
            <li key={i.id} style={S.item}>
              <div style={S.itemHead}>
                <span style={S.itemName}>{i.name}</span>
                {typeof i.daily_quota === 'number' && (
                  <span style={S.quota}>{i.daily_quota}/day</span>
                )}
              </div>
              {i.description && <p style={S.desc}>{i.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap:        { marginTop: 24, padding: '16px 0', borderTop: '1px solid var(--hairline, #E6DFCC)' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  heading:     { margin: 0, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink, #1B1B1B)' },
  manageLink:  { fontSize: 12, color: 'var(--brass, #C4A06B)', textDecoration: 'none', fontWeight: 500 },
  inlineLink:  { color: 'var(--brass, #C4A06B)', textDecoration: 'none' },
  empty:       { fontSize: 13, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' },
  list:        { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  item:        { padding: '10px 12px', background: 'var(--paper, #FFFFFF)', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 6 },
  itemHead:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  itemName:    { fontSize: 13, fontWeight: 600, color: 'var(--ink, #1B1B1B)' },
  quota:       { fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', background: 'var(--bg, #F4EFE2)', padding: '2px 8px', borderRadius: 99, fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)' },
  desc:        { margin: 0, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.4 },
  error:       { fontSize: 12, color: 'var(--st-bad, #C0584C)' },
};
