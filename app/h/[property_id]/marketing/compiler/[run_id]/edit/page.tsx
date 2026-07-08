// app/h/[property_id]/marketing/compiler/[run_id]/edit/page.tsx
// Donna delegate — thin passthrough. Namkhan body filters by unique ID, no
// property scoping, so the same ID resolves the same row regardless of tenant.
// Delegate exists so ThemeInjector applies the Donna (cream) theme + subnav.
import { notFound } from 'next/navigation';
import NamkhanCompilerEdit from '@/app/marketing/compiler/[run_id]/edit/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params { property_id: string; run_id: string }

export default function DonnaDelegatePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <NamkhanCompilerEdit params={{ run_id: params.run_id }} searchParams={searchParams as any} />;
}
