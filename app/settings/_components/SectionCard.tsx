'use client';

import Link from 'next/link';
import { FreshnessDot } from './FreshnessDot';
import type { SettingsSection } from '../types';

interface SectionCardProps {
  section: SettingsSection;
}

export function SectionCard({ section }: SectionCardProps) {
  return (
    <Link
      href={`/settings/${section.section_code}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '0.75rem',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          cursor: 'pointer',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          position: 'relative',
          minHeight: '7rem',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-primary)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(8,72,56,0.12)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        }}
      >
        {/* Lock badge */}
        {section.is_locked && (
          <span
            style={{
              position: 'absolute',
              top: '0.75rem',
              right: '0.75rem',
              fontSize: '0.65rem',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              background: 'var(--color-surface-alt)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.25rem',
              padding: '0.1rem 0.35rem',
            }}
          >
            owner only
          </span>
        )}

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{section.icon}</span>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '0.975rem',
              fontWeight: 600,
              color: 'var(--color-text)',
              lineHeight: 1.3,
            }}
          >
            {section.display_name}
          </span>
        </div>

        {/* Description */}
        <p
          style={{
            margin: 0,
            fontSize: '0.8rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1.5,
            flexGrow: 1,
          }}
        >
          {section.description}
        </p>

        {/* Footer row: freshness + field count */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '0.25rem',
          }}
        >
          <FreshnessDot lastUpdatedAt={section.last_updated_at} showLabel />
          <span
            style={{
              fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-muted)',
            }}
          >
            {section.field_count} fields
          </span>
        </div>
      </div>
    </Link>
  );
}
