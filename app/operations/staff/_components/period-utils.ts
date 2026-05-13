// app/operations/staff/_components/period-utils.ts
// Shared pure utility — usable from both server and client components.

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function fmtPeriodLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m] = iso.split('-');
  if (!y || !m) return iso;
  return `${MONTH_NAMES[Number(m) - 1] ?? '?'} ${y}`;
}
