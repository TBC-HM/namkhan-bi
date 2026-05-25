'use client';

// app/_components/registry/PeriodDropdown.tsx
// Client-side period picker for ContainerRoomIntel. Replaces the row of 24
// pills with a compact <select> (YTD pill + Realised optgroup + Future OTB
// optgroup). Navigates by pushing the chosen period into the URL while
// preserving the rest of the search params (notably ?expand=).
// Task #80 phase B · 2026-05-22.

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

interface Props {
  activePeriod: string;
  ytdKey: string;
  ytdLabel: string;
  realisedMonths: string[];   // descending order, current month first
  futureMonths: string[];    // descending order, latest OTB first
  // USALI task #8: aggregate periods (FY-YYYY + Q1-4-YYYY)
  aggregatePeriods?: string[];
  preserveParams?: Record<string, string | undefined>;
  defaultPeriod?: string;     // when value matches default, drop period from URL
}

export default function PeriodDropdown({
  activePeriod, ytdKey, ytdLabel, realisedMonths, futureMonths,
  aggregatePeriods = [], preserveParams = {}, defaultPeriod,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(preserveParams)) {
      if (v) params.set(k, String(v));
    }
    if (!defaultPeriod || value !== defaultPeriod) {
      params.set('period', value);
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `?${qs}` : '?'));
  }

  return (
    <select
      value={activePeriod}
      onChange={(e) => onChange(e.target.value)}
      disabled={pending}
      style={{
        padding: '4px 12px',
        borderRadius: 4,
        border: '1px solid var(--hairline, #E6DFCC)',
        background: 'var(--paper, #FFFFFF)',
        color: 'var(--ink, #1B1B1B)',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'inherit',
        fontVariantNumeric: 'tabular-nums',
        cursor: pending ? 'wait' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      <option value={ytdKey}>{ytdLabel}</option>
      {realisedMonths.length > 0 && (
        <optgroup label="Realised">
          {realisedMonths.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </optgroup>
      )}
      {futureMonths.length > 0 && (
        <optgroup label="Future (OTB)">
          {futureMonths.map((p) => (
            <option key={p} value={p}>{p} · OTB</option>
          ))}
        </optgroup>
      )}
      {aggregatePeriods.length > 0 && (
        <optgroup label="Aggregates">
          {aggregatePeriods.map((p) => {
            const label = p.startsWith('FY-')
              ? `FY ${p.slice(3)}`
              : /^Q[1-4]-\d{4}$/.test(p)
              ? `${p.slice(0, 2)} ${p.slice(3)}`
              : p;
            return (<option key={p} value={p}>{label}</option>);
          })}
        </optgroup>
      )}
    </select>
  );
}
