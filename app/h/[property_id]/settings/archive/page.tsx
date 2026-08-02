// app/h/[property_id]/settings/archive/page.tsx
// PBS 2026-08-02 — Archive settings consolidated in property settings.
// Covers: document archive vocabulary (tenant-scoped folders) + photo archive thresholds.
// Upload goes through existing pipelines — docs → DMS ingestion, photos → Iris QA.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import UploadDropzone from '@/app/marketing/media/_client/UploadDropzone';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SETTINGS_TABS = (pid: number) => [
  { key: 'property',   label: 'Property',   href: `/h/${pid}/settings/property`   },
  { key: 'media',      label: 'Media',      href: `/h/${pid}/settings/media`      },
  { key: 'rate_plans', label: 'Rate Plans', href: `/h/${pid}/settings/rate-plans` },
  { key: 'guardrails', label: 'Guardrails', href: `/h/${pid}/settings/guardrails` },
  { key: 'documents',  label: 'Documents',  href: `/h/${pid}/settings/documents`  },
  { key: 'archive',    label: 'Archive',    href: `/h/${pid}/settings/archive`, active: true },
  { key: 'data',       label: 'Data',       href: `/h/${pid}/settings/data`       },
  { key: 'brain',      label: 'Brain',      href: `/h/${pid}/settings/brain`      },
  { key: 'knowledge',  label: 'Knowledge',  href: `/h/${pid}/settings/knowledge`  },
];

async function fetchArchiveStats(propertyId: number) {
  const sb = getSupabaseAdmin();
  const [photoArchive, docArchive, tierThresholds] = await Promise.all([
    sb.from('v_marketing_media_page')
      .select('asset_id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('primary_tier', 'tier_archive'),
    sb.from('v_doc_register')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('status', 'archived'),
    sb.from('v_media_tier_thresholds').select('*'),
  ]);
  return {
    photoArchiveCount: photoArchive.count ?? 0,
    docArchiveCount:   docArchive.count ?? 0,
    tierThresholds:    (tierThresholds.data ?? []) as any[],
  };
}

export default async function ArchiveSettingsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const d = await fetchArchiveStats(propertyId);

  const archiveTier = d.tierThresholds.find((t: any) => t.tier === 'tier_archive');
  const archiveMin = archiveTier?.min_quality ?? 25;
  const archiveMax = archiveTier?.max_quality ?? 49;

  return (
    <DashboardPage
      title="Settings · Archive"
      subtitle={`Document archive · photo archive · upload directly to archive · property ${propertyId}`}
      tabs={SETTINGS_TABS(propertyId)}
    >
      {/* Archive overview tiles */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Archive overview" subtitle="current archive state for this property">
          <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { label: 'Archived photos',    value: d.photoArchiveCount, foot: 'quality 25–49 or manual',  href: `/marketing/media` },
              { label: 'Archived documents', value: d.docArchiveCount,   foot: 'status = archived',        href: `/h/${propertyId}/finance/legal/docs` },
              { label: 'Photo archive band', value: `${archiveMin}–${archiveMax}`, foot: 'quality index threshold', href: `/h/${propertyId}/settings/media` },
            ].map(({ label, value, foot, href }) => (
              <Link key={label} href={href} style={{ textDecoration: 'none', color: 'inherit', background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 6, padding: '12px 14px', display: 'block' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#5A5A5A' }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: '#1B1B1B', margin: '2px 0' }}>{value}</div>
                <div style={{ fontSize: 10.5, color: '#5A5A5A' }}>{foot} →</div>
              </Link>
            ))}
          </div>
        </Container>
      </div>

      {/* Upload to archive — media goes through Iris QA, docs through DMS */}
      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container
          title="Upload to archive"
          subtitle="Photos and videos → Iris QA pipeline then auto-archived if quality 25–49 · Documents → Document register (classify after upload)"
        >
          <div style={{ padding: 16 }}>
            <UploadDropzone />
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 6, fontSize: 11, color: '#5A5A5A' }}>
              <strong style={{ color: '#1B1B1B' }}>Routing:</strong> Photos with quality 25–49 auto-land in tier_archive. Photos below 25 = Junk. Photos above 49 = classified into OTA/social/website tiers by Iris. Documents land in the register with status=needs_review — open Finance → Legal → Docs to archive them.
            </div>
          </div>
        </Container>
      </div>

      {/* Archive folder structure — tenant-scoped via document families */}
      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container
          title="Archive folder structure"
          subtitle="Document families define archive folders — each tenant has their own. Manage in Settings → Documents → Families tab"
          action={
            <Link href={`/h/${propertyId}/settings/documents`} style={{ fontSize: 11, fontWeight: 700, color: '#084838', textDecoration: 'none' }}>
              Manage document families →
            </Link>
          }
        >
          <div style={{ padding: '12px 16px', fontSize: 12, color: '#5A5A5A' }}>
            <p style={{ margin: '0 0 8px' }}>Archive folder = document family (e.g. <code>hr_doc</code>, <code>legal</code>, <code>financial</code>, <code>compliance</code>). Different tenants have different families.</p>
            <p style={{ margin: 0 }}>To add a new archive folder: open <strong>Settings → Documents</strong> and click the ⚙ gear → Families tab → set the family on any document to introduce it. To bulk-rename a folder, use the Rename column.</p>
          </div>
        </Container>
      </div>

      {/* Photo archive thresholds — managed via Photo Settings */}
      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container
          title="Photo archive thresholds"
          subtitle="Quality bands that determine when photos go to archive — managed in Settings → Media → Photo Settings → Guardrails"
          action={
            <Link href={`/h/${propertyId}/settings/media`} style={{ fontSize: 11, fontWeight: 700, color: '#084838', textDecoration: 'none' }}>
              Edit in Media settings →
            </Link>
          }
        >
          <div style={{ padding: '12px 16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#FAFAF7' }}>
                  {['Tier', 'Quality band', 'Auto-assigned'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: '#5A5A5A', borderBottom: '1px solid #E6DFCC' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.tierThresholds.sort((a: any, b: any) => (b.min_quality ?? 0) - (a.min_quality ?? 0)).map((t: any) => (
                  <tr key={t.tier}>
                    <td style={{ padding: '7px 10px', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, borderBottom: '1px solid #E6DFCC' }}>{t.tier}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, borderBottom: '1px solid #E6DFCC' }}>{t.min_quality ?? '—'} – {t.max_quality ?? '—'}</td>
                    <td style={{ padding: '7px 10px', fontSize: 11, color: '#5A5A5A', borderBottom: '1px solid #E6DFCC' }}>{t.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
