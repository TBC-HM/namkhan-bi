// Redirect stub — Schema detail moved to IT2 (it-area-reorg-v1 consolidation).
import { redirect } from 'next/navigation';
export default async function LegacySchemaDetailRedirect(
  { params }: { params: Promise<{ schema: string; table: string }> },
) {
  const { schema, table } = await params;
  redirect(`/holding/it2/knowledge/data/schemas/${schema}/${table}`);
}
