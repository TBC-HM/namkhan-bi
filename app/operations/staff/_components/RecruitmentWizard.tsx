'use client';

// Client wizard for the Recruitment tab. 5 steps:
//   1. Position pick (from existing roster OR free-text)
//   2. Standards (read-only summary)
//   3. Salary band (ops.fn_position_salary_band)
//   4. Where to look (channels)
//   5. Generate ad (POST /api/recruitment/draft-ad → editable result + save/copy)

import { useState } from 'react';

type Lang = 'en' | 'lo' | 'th' | 'es' | 'de' | 'ca';

type SalaryBand = {
  currency: 'LAK' | 'EUR' | 'USD';
  avg_native: number;
  min_native: number;
  max_native: number;
  sample_size: number;
  falls_back_to: 'position' | 'dept' | 'estimate';
};

interface Props {
  propertyId: number;
  propertyLabel: string;
  positionOptions: string[];          // distinct position_titles seen on roster (filtered)
  standardsLabel: string;             // e.g. "SLH 5-star · Lao Labour Law"
  languages: Lang[];                  // languages available for this property
  channels: Array<{ name: string; audience: string; cost: 'free' | 'paid' | 'referral'; tip: string }>;
}

const LANG_LABEL: Record<Lang, string> = {
  en: 'English', lo: 'ລາວ', th: 'ไทย', es: 'Español', de: 'Deutsch', ca: 'Català',
};
const LANG_FLAG: Record<Lang, string> = {
  en: '🇬🇧', lo: '🇱🇦', th: '🇹🇭', es: '🇪🇸', de: '🇩🇪', ca: '🟡',
};

function fmtCcy(amount: number, ccy: SalaryBand['currency']): string {
  const sym = ccy === 'EUR' ? '€' : ccy === 'LAK' ? '₭' : '$';
  if (ccy === 'LAK') {
    if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000)     return `${sym}${Math.round(amount / 1_000)}k`;
    return `${sym}${Math.round(amount)}`;
  }
  if (amount >= 1_000) return `${sym}${(amount / 1_000).toFixed(1)}k`;
  return `${sym}${Math.round(amount).toLocaleString('en-US')}`;
}

export default function RecruitmentWizard({
  propertyId, propertyLabel, positionOptions, standardsLabel, languages, channels,
}: Props) {
  const [position, setPosition] = useState<string>('');
  const [custom, setCustom] = useState<string>('');
  const [salaryBand, setSalaryBand] = useState<SalaryBand | null>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salaryError, setSalaryError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Lang>(languages[0] ?? 'en');
  const [ad, setAd] = useState<string>('');
  const [adLoading, setAdLoading] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const effectivePosition = (custom.trim() || position).trim();
  const canFetchSalary = effectivePosition.length > 0;
  const canDraft = effectivePosition.length > 0 && salaryBand !== null;

  async function fetchSalary() {
    if (!canFetchSalary) return;
    setSalaryLoading(true); setSalaryError(null);
    try {
      const res = await fetch('/api/recruitment/salary-band', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ propertyId, positionTitle: effectivePosition }),
      });
      if (!res.ok) throw new Error(`salary band fetch ${res.status}`);
      const data = await res.json();
      setSalaryBand(data as SalaryBand);
    } catch (e: unknown) {
      setSalaryError(e instanceof Error ? e.message : String(e));
    } finally {
      setSalaryLoading(false);
    }
  }

  async function draftAd() {
    if (!canDraft || !salaryBand) return;
    setAdLoading(true); setAdError(null); setAd('');
    try {
      const res = await fetch('/api/recruitment/draft-ad', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          positionTitle: effectivePosition,
          salaryBand,
          standards: standardsLabel,
          channels: channels.map((c) => c.name),
          language,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`draft-ad ${res.status}: ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      setAd(data.ad_markdown || data.text || '');
    } catch (e: unknown) {
      setAdError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdLoading(false);
    }
  }

  async function saveAd() {
    if (!ad.trim() || !salaryBand) return;
    setSaveMsg(null);
    try {
      const res = await fetch('/api/recruitment/save-ad', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          positionTitle: effectivePosition,
          language,
          body_md: ad,
          salary_band: salaryBand,
          channels,
          standards: standardsLabel,
        }),
      });
      if (!res.ok) throw new Error(`save ${res.status}`);
      const data = await res.json();
      setSaveMsg(`Saved to library · id ${data.id}`);
    } catch (e: unknown) {
      setSaveMsg(`Save failed · ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function copyAd() {
    if (!ad.trim()) return;
    navigator.clipboard.writeText(ad).then(
      () => setSaveMsg('Copied to clipboard'),
      () => setSaveMsg('Copy failed'),
    );
  }

  return (
    <div style={{ marginTop: 16, display: 'grid', gap: 18 }}>
      {/* Step 1 — Position */}
      <Section n={1} label="Position">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <select
            value={position}
            onChange={(e) => { setPosition(e.target.value); setSalaryBand(null); setAd(''); }}
            style={selectStyle}
          >
            <option value="">— pick from current roster —</option>
            {positionOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <span style={muteText}>or</span>
          <input
            placeholder="type a position (e.g. Sous Chef)"
            value={custom}
            onChange={(e) => { setCustom(e.target.value); setSalaryBand(null); setAd(''); }}
            style={inputStyle}
          />
        </div>
        {effectivePosition && (
          <div style={chosenChip}>Position: <b>{effectivePosition}</b> · {propertyLabel}</div>
        )}
      </Section>

      {/* Step 2 — Standards */}
      <Section n={2} label="Standards">
        <div style={chosenChip}>{standardsLabel}</div>
      </Section>

      {/* Step 3 — Salary band */}
      <Section n={3} label="Average salary at this property">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={fetchSalary} disabled={!canFetchSalary || salaryLoading} style={btn(canFetchSalary)}>
            {salaryLoading ? '...' : salaryBand ? 'Re-fetch' : 'Look up salary'}
          </button>
          {salaryError && <span style={errText}>{salaryError}</span>}
        </div>
        {salaryBand && (
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <Stat label="Avg" value={fmtCcy(salaryBand.avg_native, salaryBand.currency)} />
            <Stat label="Min" value={fmtCcy(salaryBand.min_native, salaryBand.currency)} />
            <Stat label="Max" value={fmtCcy(salaryBand.max_native, salaryBand.currency)} />
            <Stat label="Sample" value={salaryBand.sample_size === 0 ? 'estimate' : `${salaryBand.sample_size} on roster`} />
            <Stat label="Source" value={salaryBand.falls_back_to} />
          </div>
        )}
      </Section>

      {/* Step 4 — Channels */}
      <Section n={4} label="Best places to advertise">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {channels.map((c) => (
            <div key={c.name} style={channelCard}>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={muteText}>{c.audience} · {c.cost}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{c.tip}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Step 5 — Generate ad */}
      <Section n={5} label="Generate the job ad">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {languages.map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              style={langPill(language === l)}
            >
              {LANG_FLAG[l]} {LANG_LABEL[l]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={draftAd} disabled={!canDraft || adLoading} style={btn(canDraft)}>
            {adLoading ? 'Drafting…' : ad ? 'Re-draft' : 'Draft ad'}
          </button>
          {adError && <span style={errText}>{adError}</span>}
        </div>
        {ad && (
          <>
            <textarea
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              rows={16}
              style={{
                width: '100%', marginTop: 12, padding: 12, fontFamily: 'var(--sans)',
                fontSize: 14, lineHeight: 1.5, color: 'var(--ink)', background: 'var(--paper-warm)',
                border: '1px solid var(--line)', borderRadius: 6, colorScheme: 'light',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button onClick={copyAd} style={btn(true)}>Copy</button>
              <button onClick={saveAd} style={btn(true)}>Save to library</button>
              {saveMsg && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{saveMsg}</span>}
            </div>
          </>
        )}
      </Section>
    </div>
  );
}

function Section({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <section style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
      <h3 style={{
        margin: 0, marginBottom: 8,
        fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: 'var(--brass)',
      }}>
        Step {n} · {label}
      </h3>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 4, padding: '8px 10px' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: 'var(--paper-warm)', color: 'var(--ink)',
  border: '1px solid var(--kpi-frame)', borderRadius: 4,
  padding: '6px 10px', fontSize: 13, minWidth: 220, colorScheme: 'light',
};
const inputStyle: React.CSSProperties = { ...selectStyle, minWidth: 240 };
const muteText: React.CSSProperties = { fontSize: 12, color: 'var(--ink-mute)' };
const errText: React.CSSProperties = { fontSize: 12, color: 'var(--oxblood-soft)' };
const chosenChip: React.CSSProperties = {
  marginTop: 10, padding: '6px 10px', background: 'var(--paper)', border: '1px solid var(--line-soft)',
  borderRadius: 4, fontSize: 13, color: 'var(--ink)',
};
const channelCard: React.CSSProperties = {
  background: 'var(--paper-warm)', border: '1px solid var(--line-soft)', borderRadius: 4,
  padding: 10, fontSize: 13, color: 'var(--ink)',
};
function btn(enabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px', fontFamily: 'var(--mono)', fontSize: 11,
    letterSpacing: '0.14em', textTransform: 'uppercase',
    background: enabled ? 'var(--moss)' : 'var(--paper-deep)',
    color: enabled ? 'var(--paper-warm)' : 'var(--ink-mute)',
    border: '1px solid var(--line)', borderRadius: 4,
    cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.6,
  };
}
function langPill(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', fontSize: 13,
    background: active ? 'var(--brass)' : 'transparent',
    color: active ? 'var(--paper-warm)' : 'var(--ink)',
    border: `1px solid ${active ? 'var(--brass)' : 'var(--line)'}`,
    borderRadius: 999, cursor: 'pointer',
  };
}
