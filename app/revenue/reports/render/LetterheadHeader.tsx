// app/revenue/reports/render/LetterheadHeader.tsx
// PBS 2026-05-22 task #92: every report header shows property name (left) and
// address (right), with a "Generated DD MMM YYYY · HH:MM" timestamp below.
// Reads from public.v_property_display (property_name + address).

import { supabase } from '@/lib/supabase';

interface Props {
  propertyId: number;
  reportLabel: string;
  periodLabel: string;
}

export default async function LetterheadHeader({ propertyId, reportLabel, periodLabel }: Props) {
  const { data } = await supabase
    .from('v_property_display')
    .select('property_name, address')
    .eq('property_id', propertyId)
    .maybeSingle();
  const name = String((data as { property_name?: string } | null)?.property_name ?? '');
  const addr = String((data as { address?: string } | null)?.address ?? '');
  const stamp = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div data-panel style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'start',
      gap: 16,
      padding: '14px 16px',
      borderBottom: '2px solid var(--primary, #1F3A2E)',
      background: 'var(--paper, #FFFFFF)',
      marginBottom: 12,
    }}>
      <div>
        <div style={{
          fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase',
          color: 'var(--ink-soft, #5A5A5A)', fontWeight: 600,
        }}>
          {reportLabel}
        </div>
        <div style={{
          fontSize: 22, fontWeight: 600, color: 'var(--ink, #1B1B1B)',
          marginTop: 2,
        }}>
          {name || 'Property'}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', marginTop: 4,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          {periodLabel} · Generated {stamp}
        </div>
      </div>
      <div style={{
        textAlign: 'right',
        fontSize: 12,
        color: 'var(--ink, #1B1B1B)',
        lineHeight: 1.5,
        maxWidth: 280,
      }}>
        {addr ? addr.split(',').map((line, i) => (
          <div key={i}>{line.trim()}</div>
        )) : (
          <span style={{ color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>address not set</span>
        )}
      </div>
    </div>
  );
}
