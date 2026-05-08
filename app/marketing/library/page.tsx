// app/marketing/library/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface MediaAsset {
  asset_id: string;
  filename: string;
  asset_type: string;
  tier: string;
  status: string;
  qc_score: number | null;
  license_type: string;
  primary_area: string | null;
  tag_slugs: string[] | null;
  created_at: string;
}

interface IngestRow {
  asset_id: string;
  filename: string;
  status: string;
  pipeline_stage: string | null;
  error_message: string | null;
  ingested_at: string | null;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Primary: v_media_ready_v2 (canonical view per KB #327)
  const { data: assets } = await supabase
    .schema('marketing')
    .from('v_media_ready_v2')
    .select('asset_id, filename, asset_type, tier, status, qc_score, license_type, primary_area, tag_slugs, created_at')
    .order('qc_score', { ascending: false })
    .limit(100);

  // Secondary: ingest pipeline status
  const { data: ingestRows } = await supabase
    .schema('public')
    .from('v_media_ingest_status')
    .select('asset_id, filename, status, pipeline_stage, error_message, ingested_at')
    .order('ingested_at', { ascending: false })
    .limit(20);

  const rows: MediaAsset[] = assets ?? [];
  const ingest: IngestRow[] = ingestRows ?? [];

  // KPI aggregates
  const totalAssets = rows.length;
  const heroTier = rows.filter((r) => r.tier === 'tier_website_hero').length;
  const otaTier = rows.filter((r) => r.tier === 'tier_ota_profile').length;
  const socialTier = rows.filter((r) => r.tier === 'tier_social_pool').length;
  const avgQc =
    rows.filter((r) => r.qc_score != null).length > 0
      ? (
          rows
            .filter((r) => r.qc_score != null)
            .reduce((sum, r) => sum + (r.qc_score ?? 0), 0) /
          rows.filter((r) => r.qc_score != null).length
        ).toFixed(1)
      : '—';

  const tierLabel = (tier: string) => {
    const map: Record<string, string> = {
      tier_website_hero: 'Hero',
      tier_ota_profile: 'OTA',
      tier_social_pool: 'Social',
      tier_internal: 'Internal',
      tier_archive: 'Archive',
    };
    return map[tier] ?? tier;
  };

  const assetColumns = [
    { key: 'filename', header: 'Filename' },
    { key: 'asset_type', header: 'Type' },
    { key: 'tier_label', header: 'Tier' },
    { key: 'qc_score_fmt', header: 'QC Score' },
    { key: 'license_type', header: 'License' },
    { key: 'primary_area', header: 'Area' },
    { key: 'status', header: 'Status' },
    { key: 'created_at_fmt', header: 'Added' },
  ];

  const assetTableRows = rows.map((r) => ({
    ...r,
    tier_label: tierLabel(r.tier),
    qc_score_fmt: r.qc_score != null ? r.qc_score.toFixed(1) : '—',
    primary_area: r.primary_area ?? '—',
    created_at_fmt: r.created_at ? r.created_at.slice(0, 10) : '—',
  }));

  const ingestColumns = [
    { key: 'filename', header: 'Filename' },
    { key: 'status', header: 'Status' },
    { key: 'pipeline_stage', header: 'Stage' },
    { key: 'error_message', header: 'Error' },
    { key: 'ingested_at_fmt', header: 'Ingested' },
  ];

  const ingestTableRows = ingest.map((r) => ({
    ...r,
    pipeline_stage: r.pipeline_stage ?? '—',
    error_message: r.error_message ?? '—',
    ingested_at_fmt: r.ingested_at ? r.ingested_at.slice(0, 10) : '—',
  }));

  return (
    <main style={{ padding: '0 24px 48px' }}>
      <PageHeader pillar="Marketing" tab="Library" title="Media Library" />

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Total Assets" value={totalAssets === 0 ? '—' : String(totalAssets)} />
        <KpiBox label="Hero Tier" value={heroTier === 0 ? '—' : String(heroTier)} />
        <KpiBox label="OTA Tier" value={otaTier === 0 ? '—' : String(otaTier)} />
        <KpiBox label="Social Pool" value={socialTier === 0 ? '—' : String(socialTier)} />
        <KpiBox label="Avg QC Score" value={String(avgQc)} />
      </div>

      {/* Asset Library Table */}
      <div style={{ marginBottom: 40 }}>
        <h2
          style={{
            margin: '0 0 12px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            opacity: 0.55,
          }}
        >
          Ready Assets
        </h2>
        {rows.length === 0 ? (
          <p style={{ opacity: 0.5 }}>No ready assets found — check ingest pipeline below.</p>
        ) : (
          <DataTable columns={assetColumns} rows={assetTableRows} />
        )}
      </div>

      {/* Ingest Pipeline Table */}
      <div>
        <h2
          style={{
            margin: '0 0 12px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            opacity: 0.55,
          }}
        >
          Ingest Pipeline (last 20)
        </h2>
        {ingest.length === 0 ? (
          <p style={{ opacity: 0.5 }}>No recent ingest activity.</p>
        ) : (
          <DataTable columns={ingestColumns} rows={ingestTableRows} />
        )}
      </div>
    </main>
  );
}
