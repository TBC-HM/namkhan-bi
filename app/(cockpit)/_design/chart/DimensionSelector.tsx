'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useContainerAction } from '../internal/container-action';
import type { ChartDimension } from '../types';

interface Props {
  dimensions: ChartDimension[];
  activeKey?: string;
  onChange?: (d: ChartDimension) => void;
}

export default function DimensionSelector({ dimensions, activeKey, onChange }: Props) {
  const ctx = useContainerAction();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (dimensions.length < 2) return null;

  const active = dimensions.find((d) => d.key === activeKey)
    ?? dimensions.find((d) => d.isDefault)
    ?? dimensions[0];

  const ui = (
    <label style={S.wrap}>
      <span style={S.label}>View:</span>
      <select
        value={active.key}
        onChange={(e) => {
          const next = dimensions.find((d) => d.key === e.target.value);
          if (next && next.status !== 'pending' && next.status !== 'blocked') onChange?.(next);
        }}
        style={S.select}
      >
        {dimensions.map((d) => {
          const disabled = d.status === 'pending' || d.status === 'blocked';
          const label = disabled
            ? `${d.label}${d.status === 'pending' ? ' (coming soon)' : ' (blocked)'}`
            : d.label;
          return (
            <option key={d.key} value={d.key} disabled={disabled}>{label}</option>
          );
        })}
      </select>
    </label>
  );

  if (!mounted) return null;
  if (ctx.ref?.current) return createPortal(ui, ctx.ref.current);
  return ui;
}

const S: Record<string, CSSProperties> = {
  wrap: { display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)' },
  label: { fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  select: {
    padding: '4px 8px',
    border: '1px solid var(--hairline, #E6DFCC)',
    borderRadius: 4,
    background: 'var(--paper, #FFFFFF)',
    color: 'var(--ink, #1B1B1B)',
    fontSize: 12,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
};
