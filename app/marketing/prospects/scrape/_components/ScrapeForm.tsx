'use client';
// app/marketing/prospects/scrape/_components/ScrapeForm.tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ActorId = 'gmaps_contacts' | 'google_search' | 'booking' | 'email_social' | 'leads_finder' | 'email_verifier';

const ACTORS: Record<ActorId, { label: string; hint: string; costHint: string }> = {
  gmaps_contacts: { label: 'Google Maps + Emails',        hint: 'Venue-level scrape (compass/google-maps-extractor). Best for finding local businesses.', costHint: '~$5 per 1,000 places' },
  google_search:  { label: 'Google Search (SERP)',        hint: 'URLs only — no emails. Feed into Email Extractor next.',                 costHint: '~$0.5 per 100 hits' },
  booking:        { label: 'Booking.com Hotels',          hint: 'Compset discovery — no emails.',                                          costHint: '~$2 per 100 hotels' },
  email_social:   { label: 'Website Email Extractor',     hint: 'Feed a list of URLs → returns emails + socials per site.',                costHint: '~$0.5 per 100 URLs' },
  leads_finder:   { label: 'B2B Leads Finder (Apollo alt)', hint: 'Best-value B2B lead source. Returns decision-makers by name + role + email at target companies. Ideal for tour operators/DMCs/luxury travel agents.', costHint: '~$1.50 per 1,000 leads · pay per event' },
  email_verifier: { label: 'Email Verifier (paid, deep)', hint: 'Mailbox-level verify. Updates email_verify_status on matching rows. Only run AFTER MX check trimmed obvious dead ones — save money.',                             costHint: '~$100 per 1,000 verified · $0.10 each' },
};

type Result = {
  ok: boolean;
  actor?: string;
  items_returned?: number;
  inserted?: number;
  skipped?: number;
  duration_ms?: number;
  error?: string;
  detail?: string;
  apify_status?: number;
};

export default function ScrapeForm() {
  const router = useRouter();
  const [actor, setActor] = useState<ActorId>('gmaps_contacts');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  // Actor slug override — paste from Apify Console when the default guess is wrong.
  const [slugOverride, setSlugOverride] = useState('');

  // Google Maps + Emails inputs
  const [gKeyword, setGKeyword]         = useState('eco resort');
  const [gLocation, setGLocation]       = useState('Luang Prabang, Laos');
  const [gMax, setGMax]                 = useState(30);

  // Google Search inputs
  const [sQueries, setSQueries]         = useState('tour operator Laos\nDMC Vietnam');
  const [sLang, setSLang]               = useState('en');
  const [sPages, setSPages]             = useState(2);

  // Booking inputs
  const [bDest, setBDest]               = useState('Luang Prabang');
  const [bMax, setBMax]                 = useState(50);

  // Email extractor inputs
  const [eUrls, setEUrls]               = useState('https://example-hotel.com\nhttps://tour-operator.com');
  const [eDepth, setEDepth]             = useState(2);

  // Leads Finder (B2B) inputs
  const [lRoles, setLRoles]             = useState('Marketing Director\nCEO\nCommercial Director\nHead of Sales');
  const [lKeywords, setLKeywords]       = useState('luxury travel\ntour operator\nDMC southeast asia');
  const [lCountry, setLCountry]         = useState('');
  const [lMax, setLMax]                 = useState(50);

  // Email Verifier inputs — paste emails to verify (or leave with a marker to verify DB unverified rows later)
  const [vEmails, setVEmails]           = useState('');

  const buildInput = (): Record<string, unknown> => {
    switch (actor) {
      case 'gmaps_contacts':
        return {
          searchStringsArray: [gKeyword],
          locationQuery: gLocation,
          maxCrawledPlacesPerSearch: gMax,
          scrapeContacts: true,
        };
      case 'google_search':
        return {
          queries: sQueries.split('\n').map(q => q.trim()).filter(Boolean).join('\n'),
          languageCode: sLang,
          maxPagesPerQuery: sPages,
        };
      case 'booking':
        return {
          search: bDest,
          maxItems: bMax,
          currency: 'USD',
        };
      case 'email_social': {
        const urls = eUrls.split('\n').map(u => u.trim()).filter(Boolean).map(u => ({ url: u }));
        return { startUrls: urls, maxDepth: eDepth };
      }
      case 'leads_finder':
        return {
          jobTitles:        lRoles.split('\n').map(x => x.trim()).filter(Boolean),
          searchKeywords:   lKeywords.split('\n').map(x => x.trim()).filter(Boolean),
          country:          lCountry.trim() || undefined,
          maxLeads:         lMax,
          verifiedEmailsOnly: true,
        };
      case 'email_verifier':
        return { emails: vEmails.split('\n').map(x => x.trim()).filter(Boolean) };
    }
  };

  const run = async () => {
    setRunning(true); setResult(null);
    try {
      const res = await fetch('/api/marketing/prospects/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor,
          input: buildInput(),
          ...(slugOverride.trim() ? { slug_override: slugOverride.trim() } : {}),
        }),
      });
      const j: Result = await res.json();
      setResult(j);
      if (j.ok && (j.inserted ?? 0) > 0) router.refresh();
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunning(false);
    }
  };

  const cfg = ACTORS[actor];

  return (
    <div style={{ border:'1px solid #E6DFCC', borderRadius:6, background:'#FFFFFF', padding:16, maxWidth:720 }}>
      <div style={row}>
        <label style={label}>Actor</label>
        <select value={actor} onChange={e => setActor(e.target.value as ActorId)} disabled={running} style={input}>
          {(Object.keys(ACTORS) as ActorId[]).map(k => (
            <option key={k} value={k}>{ACTORS[k].label}</option>
          ))}
        </select>
      </div>
      <div style={{ fontSize:11, color:'#5A5A5A', marginTop:-6, marginBottom:10 }}>
        {cfg.hint} · <span style={{ color:'#8B5A1C' }}>{cfg.costHint}</span>
      </div>

      <div style={row}>
        <label style={label}>Actor slug (optional)</label>
        <input value={slugOverride} onChange={e => setSlugOverride(e.target.value)} disabled={running}
          placeholder="e.g. lukaskrivka~google-maps-with-contact-details" style={input} />
      </div>
      <div style={{ fontSize:11, color:'#5A5A5A', marginTop:-6, marginBottom:10 }}>
        Copy from Apify Console URL: <code>https://console.apify.com/actors/<b>&lt;owner&gt;~&lt;name&gt;</b></code>. Leave blank to use the default guess (may not exist).
      </div>

      {actor === 'gmaps_contacts' && (
        <>
          <div style={row}><label style={label}>Search</label>
            <input value={gKeyword} onChange={e => setGKeyword(e.target.value)} disabled={running}
              placeholder="eco resort" style={input} /></div>
          <div style={row}><label style={label}>Location</label>
            <input value={gLocation} onChange={e => setGLocation(e.target.value)} disabled={running}
              placeholder="Luang Prabang, Laos" style={input} /></div>
          <div style={row}><label style={label}>Max results</label>
            <input type="number" min={1} max={200} value={gMax} onChange={e => setGMax(+e.target.value)} disabled={running} style={{ ...input, width:100 }} /></div>
        </>
      )}

      {actor === 'google_search' && (
        <>
          <div style={row}><label style={label}>Queries (one per line)</label>
            <textarea value={sQueries} onChange={e => setSQueries(e.target.value)} disabled={running}
              rows={4} style={{ ...input, fontFamily:'inherit' }} /></div>
          <div style={row}><label style={label}>Language</label>
            <input value={sLang} onChange={e => setSLang(e.target.value)} disabled={running}
              placeholder="en" style={{ ...input, width:80 }} /></div>
          <div style={row}><label style={label}>Max pages per query</label>
            <input type="number" min={1} max={10} value={sPages} onChange={e => setSPages(+e.target.value)} disabled={running} style={{ ...input, width:80 }} /></div>
        </>
      )}

      {actor === 'booking' && (
        <>
          <div style={row}><label style={label}>Destination</label>
            <input value={bDest} onChange={e => setBDest(e.target.value)} disabled={running}
              placeholder="Luang Prabang" style={input} /></div>
          <div style={row}><label style={label}>Max hotels</label>
            <input type="number" min={1} max={500} value={bMax} onChange={e => setBMax(+e.target.value)} disabled={running} style={{ ...input, width:100 }} /></div>
        </>
      )}

      {actor === 'email_social' && (
        <>
          <div style={row}><label style={label}>Start URLs (one per line)</label>
            <textarea value={eUrls} onChange={e => setEUrls(e.target.value)} disabled={running}
              rows={5} style={{ ...input, fontFamily:'inherit' }} /></div>
          <div style={row}><label style={label}>Max depth</label>
            <input type="number" min={1} max={4} value={eDepth} onChange={e => setEDepth(+e.target.value)} disabled={running} style={{ ...input, width:80 }} /></div>
        </>
      )}

      {actor === 'email_verifier' && (
        <>
          <div style={row}><label style={label}>Emails (one per line)</label>
            <textarea value={vEmails} onChange={e => setVEmails(e.target.value)} disabled={running}
              rows={8} placeholder="rick@ricksteves.com&#10;travel@kampatour.com&#10;info@kingfisherecolodge.com" style={{ ...input, fontFamily:'inherit' }} /></div>
          <div style={{ fontSize:11, color:'#5A5A5A', marginTop:-6, marginBottom:10 }}>
            Result updates <code>email_verify_status</code> on matching rows (valid / invalid / catch_all / disposable / role / unknown). Rows not in DB are silently ignored.
          </div>
        </>
      )}

      {actor === 'leads_finder' && (
        <>
          <div style={row}><label style={label}>Job titles (one per line)</label>
            <textarea value={lRoles} onChange={e => setLRoles(e.target.value)} disabled={running}
              rows={4} placeholder="Marketing Director&#10;CEO&#10;Head of Sales" style={{ ...input, fontFamily:'inherit' }} /></div>
          <div style={row}><label style={label}>Company keywords (one per line)</label>
            <textarea value={lKeywords} onChange={e => setLKeywords(e.target.value)} disabled={running}
              rows={4} placeholder="luxury travel&#10;tour operator&#10;DMC southeast asia" style={{ ...input, fontFamily:'inherit' }} /></div>
          <div style={row}><label style={label}>Country (optional, 2-letter code)</label>
            <input value={lCountry} onChange={e => setLCountry(e.target.value)} disabled={running}
              placeholder="US, GB, DE, TH…" style={{ ...input, width:120 }} /></div>
          <div style={row}><label style={label}>Max leads</label>
            <input type="number" min={1} max={2000} value={lMax} onChange={e => setLMax(+e.target.value)} disabled={running} style={{ ...input, width:100 }} /></div>
        </>
      )}

      <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:10 }}>
        <button onClick={run} disabled={running} style={btnRun}>
          {running ? 'Running… (up to 4 min)' : 'Run & Import'}
        </button>
        <span style={{ fontSize:11, color:'#5A5A5A' }}>
          Results insert directly to /marketing/prospects · MX check runs on next verify click
        </span>
      </div>

      {result && (
        <div style={{ marginTop:14, padding:12, background: result.ok ? '#F0F7F2' : '#FFF3F1', border:'1px solid ' + (result.ok ? '#0848380F' : '#B04A2F33'), borderRadius:4, fontSize:12 }}>
          {result.ok ? (
            <>
              <div><strong>✓ Done</strong> in {((result.duration_ms ?? 0)/1000).toFixed(1)}s</div>
              <div>Items returned by actor: <strong>{result.items_returned}</strong></div>
              {typeof (result as unknown as { updated?: number }).updated === 'number' ? (
                <div>Updated in DB: <strong style={{ color:'#084838' }}>{(result as unknown as { updated: number }).updated}</strong></div>
              ) : (
                <div>Inserted: <strong style={{ color:'#084838' }}>{result.inserted}</strong> · Skipped (dupes): {result.skipped}</div>
              )}
            </>
          ) : (
            <>
              <div><strong style={{ color:'#B04A2F' }}>Failed:</strong> {result.error}</div>
              {result.detail && <div style={{ fontFamily:'monospace', fontSize:10, marginTop:4 }}>{result.detail}</div>}
              {result.apify_status && <div>Apify status: {result.apify_status}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const row: React.CSSProperties = { display:'flex', alignItems:'center', gap:10, marginBottom:10 };
const label: React.CSSProperties = { fontSize:12, fontWeight:600, color:'#1B1B1B', minWidth:150 };
const input: React.CSSProperties = { flex:1, padding:'6px 10px', fontSize:13, border:'1px solid #E6DFCC', borderRadius:4, background:'#FFFFFF', color:'#1B1B1B' };
const btnRun: React.CSSProperties = { padding:'8px 20px', fontSize:12, fontWeight:600, background:'#084838', color:'#FFFFFF', border:'1px solid #084838', borderRadius:4, cursor:'pointer' };