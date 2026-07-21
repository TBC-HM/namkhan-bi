'use client';
// app/marketing/audience/_components/ScrapeEngineTab.tsx
// PBS 2026-07-21 · Scrape Engine sub-tab under /marketing/audience.
// Moved from the previously-inline scrape section on AudienceUnifiedClient
// so the sub-strip [Audience · Scrape Engine] can render each half cleanly.
// Legacy /marketing/prospects/scrape 302-redirects to /marketing/audience?tab=scrape.

import { useState } from 'react';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_S  = '#5A5A5A';
const BRAND  = '#084838';

interface ScrapeResult { ok: boolean; msg: string; }

export default function ScrapeEngineTab() {
  const [scrapeKeywords, setScrapeKeywords] = useState('luxury travel\ntour operator');
  const [scrapeRoles, setScrapeRoles]       = useState('Marketing Director\nCEO');
  const [scrapeCountry, setScrapeCountry]   = useState('');
  const [scrapeTagHint, setScrapeTagHint]   = useState('');
  const [scrapeMax, setScrapeMax]           = useState(30);
  const [scrapeResult, setScrapeResult]     = useState<ScrapeResult | null>(null);
  const [scrapeRunning, setScrapeRunning]   = useState(false);

  const runScrape = async () => {
    setScrapeRunning(true);
    setScrapeResult(null);
    try {
      const keywords = scrapeKeywords.split('\n').map((s) => s.trim()).filter(Boolean);
      const roles    = scrapeRoles.split('\n').map((s) => s.trim()).filter(Boolean);
      const input: Record<string, unknown> = {
        job_titles: roles, keywords, max_records: scrapeMax,
      };
      if (scrapeCountry.trim()) input.country = scrapeCountry.trim();
      const r = await fetch('/api/marketing/prospects/scrape', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actor: 'leads_finder', input, tag_hint: scrapeTagHint || undefined }),
      });
      const j = await r.json();
      if (j.ok) {
        setScrapeResult({
          ok: true,
          msg: `Scrape ok: ${j.items_returned} items, ${j.inserted} inserted, ${j.skipped} skipped, ${j.duration_ms}ms. Refresh to see them in the Audience table.`,
        });
      } else {
        setScrapeResult({ ok: false, msg: `Scrape failed: ${j.error ?? 'unknown'} — ${j.detail ?? ''}` });
      }
    } catch (e) {
      setScrapeResult({ ok: false, msg: `Scrape error: ${(e as Error).message}` });
    } finally {
      setScrapeRunning(false);
    }
  };

  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 4 }}>
        Scrape Engine
      </div>
      <div style={{ fontSize: 11, color: INK_S, marginBottom: 12 }}>
        leads_finder actor · results land in prospects and appear in the Audience tab.
        <a
          href="/guest/newsletters/sequences"
          style={{ marginLeft: 12, color: BRAND, textDecoration: 'none' }}
        >
          Advanced actors (7 pipelines) &rarr;
        </a>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
      }}>
        <label style={{ fontSize: 11, color: INK_S }}>
          Keywords (one per line)
          <textarea
            value={scrapeKeywords}
            onChange={(e) => setScrapeKeywords(e.target.value)}
            rows={3}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: INK_S }}>
          Job titles / roles (one per line)
          <textarea
            value={scrapeRoles}
            onChange={(e) => setScrapeRoles(e.target.value)}
            rows={3}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: INK_S }}>
          Country (optional)
          <input
            value={scrapeCountry}
            onChange={(e) => setScrapeCountry(e.target.value)}
            placeholder="United States"
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: INK_S }}>
          Tag hint (chip applied to imported rows)
          <input
            value={scrapeTagHint}
            onChange={(e) => setScrapeTagHint(e.target.value)}
            placeholder="wave-2026-07"
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: INK_S }}>
          Max records
          <input
            type="number" min={1} max={500} value={scrapeMax}
            onChange={(e) => setScrapeMax(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
            style={inputStyle}
          />
        </label>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={runScrape} disabled={scrapeRunning}
            style={{
              padding: '8px 14px', background: BRAND, color: WHITE, border: 'none',
              borderRadius: 3, cursor: scrapeRunning ? 'wait' : 'pointer',
              fontSize: 12, fontWeight: 600,
            }}
          >
            {scrapeRunning ? 'Scraping…' : 'Scrape'}
          </button>
        </div>
        {scrapeResult && (
          <div style={{
            gridColumn: '1 / -1',
            padding: 10, borderRadius: 3, fontSize: 12,
            background: scrapeResult.ok ? '#EEF7F0' : '#FBEDE7',
            color: scrapeResult.ok ? BRAND : '#B04A2F',
          }}>{scrapeResult.msg}</div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 4,
  padding: '6px 8px', border: `1px solid ${HAIR}`, borderRadius: 3,
  background: WHITE, color: INK, fontSize: 12,
  boxSizing: 'border-box',
};
