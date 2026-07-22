'use client';
// app/marketing/audience/_components/ScrapeEngineTab.tsx
// PBS 2026-07-21 · Scrape Engine sub-tab under /marketing/audience.
// PBS 2026-07-21 pm · Added live count tiles above the scrape form.
//   Tiles read from /api/marketing/prospects/stats (backed by
//   v_marketing_prospects_directory) so numbers are always fresh — no more
//   hardcoded / cached counts from the old #308 layout.
// Moved from the previously-inline scrape section on AudienceUnifiedClient
// so the sub-strip [Audience · Scrape Engine] can render each half cleanly.
// Legacy /marketing/prospects/scrape 302-redirects to /marketing/audience?tab=scrape.

import { useEffect, useState } from 'react';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_S  = '#5A5A5A';
const BRAND  = '#084838';

interface ScrapeResult { ok: boolean; msg: string; }

interface ProspectStats {
  total: number;
  with_email: number;
  mx_valid: number;
  contacted: number;
  contacted_l30: number;
  last_ingest_at: string | null;
}

export default function ScrapeEngineTab() {
  const [scrapeKeywords, setScrapeKeywords] = useState('luxury travel\ntour operator');
  const [scrapeRoles, setScrapeRoles]       = useState('Marketing Director\nCEO');
  const [scrapeCountry, setScrapeCountry]   = useState('');
  const [scrapeTagHint, setScrapeTagHint]   = useState('');
  const [scrapeMax, setScrapeMax]           = useState(30);
  const [scrapeResult, setScrapeResult]     = useState<ScrapeResult | null>(null);
  const [scrapeRunning, setScrapeRunning]   = useState(false);

  const [stats, setStats]                   = useState<ProspectStats | null>(null);
  const [statsLoading, setStatsLoading]     = useState(true);
  const [statsError, setStatsError]         = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/marketing/prospects/stats', { cache: 'no-store' });
        const j = await r.json();
        if (cancelled) return;
        if (j?.ok) setStats(j.stats);
        else setStatsError(j?.error ?? 'stats_failed');
      } catch (e: any) {
        if (!cancelled) setStatsError(e?.message ?? 'stats_failed');
      } finally { if (!cancelled) setStatsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

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
        // Re-fetch stats after a successful scrape
        try {
          const rr = await fetch('/api/marketing/prospects/stats', { cache: 'no-store' });
          const jj = await rr.json();
          if (jj?.ok) setStats(jj.stats);
        } catch { /* ignore */ }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Live prospect stat tiles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 8,
      }}>
        <Tile label="Prospects (total)" value={stats?.total} loading={statsLoading} />
        <Tile label="With email" value={stats?.with_email} loading={statsLoading} />
        <Tile label="MX-valid" value={stats?.mx_valid} loading={statsLoading} />
        <Tile label="Contacted (all-time)" value={stats?.contacted} loading={statsLoading} />
        <Tile label="Contacted (last 30d)" value={stats?.contacted_l30} loading={statsLoading} />
        <Tile label="Last ingest"
              value={stats?.last_ingest_at ? new Date(stats.last_ingest_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) : '—'}
              loading={statsLoading} isString />
      </div>
      {statsError && (
        <div style={{ padding: 8, borderRadius: 3, background: '#FBEDE7', color: '#B03826', fontSize: 11 }}>
          Stats failed: {statsError} — showing scrape form only.
        </div>
      )}

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
    </div>
  );
}

function Tile({ label, value, loading, isString }: { label: string; value: number | string | undefined; loading: boolean; isString?: boolean }) {
  const display = loading ? '…' : value == null ? '—' : isString ? String(value) : Number(value).toLocaleString('en-US');
  return (
    <div style={{
      background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{ fontSize: 10, color: INK_S, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>{display}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 4,
  padding: '6px 8px', border: `1px solid ${HAIR}`, borderRadius: 3,
  background: WHITE, color: INK, fontSize: 12,
  boxSizing: 'border-box',
};
