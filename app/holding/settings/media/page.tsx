// app/holding/settings/media/page.tsx
// PBS 2026-08-02 — Holding-level media settings.
// Global naming conventions + QA rules apply across all properties.
// Holding media module (assets not tied to property) — activate here.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import MediaQaPanel from '@/components/settings/panels/MediaQaPanel';
import UploadDropzone from '@/app/marketing/media/_client/UploadDropzone';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TABS = [
  { key: 'back',       label: '← HoD',     href: '/holding'                     },
  { key: 'platform',   label: 'Platform',   href: '/holding/settings'            },
  { key: 'guardrails', label: 'Guardrails', href: '/holding/settings/guardrails' },
  { key: 'documents',  label: 'Documents',  href: '/holding/settings/documents'  },
  { key: 'media',      label: 'Media',      href: '/holding/settings/media', active: true },
];

async function fetchMediaStats() {
  const sb = getSupabaseAdmin();
  const [naming, rules] = await Promise.all([
    sb.from('v_media_naming_conventions').select('*'),
    sb.from('v_media_rules_active').select('*'),
  ]);
  return {
    namingCount: (naming.data ?? []).length,
    rulesCount:  (rules.data ?? []).length,
  };
}

export default async function HoldingMediaSettingsPage() {
  const { namingCount, rulesCount } = await fetchMediaStats();
  return (
    <DashboardPage
      title="Holding · Media"
      subtitle={`Global media QA rules · ${namingCount} naming conventions · ${rulesCount} active rules · upload for holding-wide assets`}
      tabs={TABS}
    >
      {/* Upload — holding-wide media assets */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Upload holding media" subtitle="Brand photos · logos · group certificates — Iris QA applies, assets available across all properties">
          <div style={{ padding: 16 }}>
            <UploadDropzone />
            <p style={{ fontSize: 11, color: '#5A5A5A', marginTop: 8, margin: '8px 0 0' }}>
              Uploaded assets go through the existing Iris QA pipeline. To browse holding-level media, open Marketing → Media and filter by holding scope.
            </p>
          </div>
        </Container>
      </div>

      {/* Global QA rules */}
      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container title="Media QA — global rules" subtitle="Naming conventions and scoring rules that apply across ALL properties and the holding">
          <div style={{ padding: 16 }}>
            <MediaQaPanel propertyId={260955} />
            <p style={{ fontSize: 11, color: '#5A5A5A', marginTop: 12 }}>
              These rules are global — changes here affect Namkhan, Donna, and any future property. Property-level overrides can be set in each property's Settings → Media.
            </p>
          </div>
        </Container>
      </div>

      {/* Links to property media */}
      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container title="Property media modules" subtitle="Each property has its own media library">
          <div style={{ padding: '12px 16px', display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
            {[
              { label: 'Namkhan media library', href: '/marketing/media', pid: 260955 },
              { label: 'Namkhan photo settings', href: '/h/260955/settings/media' },
              { label: 'Donna photo settings', href: '/h/1000001/settings/media' },
            ].map(({ label, href }) => (
              <Link key={href} href={href} style={{ fontSize: 12, fontWeight: 600, color: '#084838', textDecoration: 'none', border: '1px solid #E6DFCC', padding: '8px 14px', borderRadius: 6, background: '#FAFAF7' }}>
                {label} →
              </Link>
            ))}
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
