// app/holding/finance/pl/_components/PeriodFilter.tsx
// GET form — no client JS, no state. The date inputs are seeded from the
// period the RPC resolved, so the code carries no date literal and no default.
// Clearing both fields sends (null, null) and the RPC picks the period again.

import Link from 'next/link';
import { PL_PATH, HAIR, INK_M, FOREST, type TabKey } from './ui';

export default function PeriodFilter({ tab, from, to }: {
  tab: TabKey; from: string; to: string;
}) {
  const input: React.CSSProperties = {
    border: `1px solid ${HAIR}`, padding: '5px 8px', fontSize: 12,
    fontFamily: 'inherit', color: 'inherit', background: '#fff',
  };
  return (
    <form method="get" action={PL_PATH} style={{
      display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
      fontSize: 12, color: INK_M,
    }}>
      <input type="hidden" name="tab" value={tab} />
      <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        From <input type="date" name="from" defaultValue={from} style={input} />
      </label>
      <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        To <input type="date" name="to" defaultValue={to} style={input} />
      </label>
      <button type="submit" style={{
        border: `1px solid ${FOREST}`, background: FOREST, color: '#fff',
        padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'inherit',
      }}>Apply</button>
      <Link href={`${PL_PATH}?tab=${tab}`} style={{
        color: INK_M, fontSize: 12, textDecoration: 'underline',
      }}>Reset to full period</Link>
    </form>
  );
}
