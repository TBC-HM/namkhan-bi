'use client';

import { useState, useRef } from 'react';

interface Props {
  propertyId: number;
  initialBannedPhrases: string[];
  initialToneDos: string[];
  initialToneDonts: string[];
}

export default function BrandVoiceClient({ propertyId, initialBannedPhrases, initialToneDos, initialToneDonts }: Props) {
  const [bannedPhrases, setBannedPhrases] = useState<string[]>(initialBannedPhrases);
  const [toneDos, setToneDos]             = useState<string[]>(initialToneDos);
  const [toneDonts, setToneDonts]         = useState<string[]>(initialToneDonts);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch('/api/brand-voice/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id:    propertyId,
          banned_phrases: bannedPhrases,
          tone_dos:       toneDos,
          tone_donts:     toneDonts,
        }),
      });
      const json = await res.json();
      if (!json.ok) setError(json.error ?? 'save failed');
      else setSaved(true);
    } catch {
      setError('network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <TagSection
        title="Banned Phrases"
        description="Words and phrases agents must never write. Applies across email, newsletter, and social content."
        items={bannedPhrases}
        onChange={setBannedPhrases}
        placeholder="e.g. lemongrass"
      />
      <TagSection
        title="Tone — Always"
        description="Characteristics the brand voice must always express."
        items={toneDos}
        onChange={setToneDos}
        placeholder="e.g. warm and grounded"
      />
      <TagSection
        title="Tone — Never"
        description="Registers and mannerisms the brand voice must never adopt."
        items={toneDonts}
        onChange={setToneDonts}
        placeholder="e.g. corporate jargon"
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '8px 20px',
            background: saving ? '#ccc' : 'var(--tbl-fg, #111)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            fontSize: 14,
          }}
        >
          {saving ? 'Saving…' : 'Save Brand Voice'}
        </button>
        {saved && <span style={{ color: 'green', fontSize: 13 }}>Saved — agents will pick this up on their next run.</span>}
        {error && <span style={{ color: 'red', fontSize: 13 }}>{error}</span>}
      </div>
    </div>
  );
}

function TagSection({
  title,
  description,
  items,
  onChange,
  placeholder,
}: {
  title: string;
  description: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function addItem() {
    const val = inputRef.current?.value.trim() ?? '';
    if (!val || items.includes(val)) return;
    onChange([...items, val]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeItem(item: string) {
    onChange(items.filter(i => i !== item));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addItem(); }
  }

  return (
    <div>
      <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 14, color: 'var(--tbl-fg, #111)' }}>{title}</div>
      <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--tbl-fg-mute, #666)' }}>{description}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {items.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--tbl-fg-mute, #999)' }}>No items yet</span>
        )}
        {items.map(item => (
          <span
            key={item}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              background: 'var(--tbl-bg-elev, #f3f3f3)',
              border: '1px solid var(--tbl-border, #ddd)',
              borderRadius: 4,
              fontSize: 12,
              color: 'var(--tbl-fg, #111)',
            }}
          >
            {item}
            <button
              onClick={() => removeItem(item)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
                color: 'var(--tbl-fg-mute, #888)',
                fontSize: 13,
                fontWeight: 700,
              }}
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            flex: 1,
            maxWidth: 320,
            padding: '5px 10px',
            border: '1px solid var(--tbl-border, #ccc)',
            borderRadius: 4,
            fontSize: 13,
            background: 'var(--tbl-bg, #fff)',
            color: 'var(--tbl-fg, #111)',
          }}
        />
        <button
          onClick={addItem}
          style={{
            padding: '5px 14px',
            background: 'var(--tbl-bg-elev, #f3f3f3)',
            border: '1px solid var(--tbl-border, #ccc)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--tbl-fg, #111)',
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
