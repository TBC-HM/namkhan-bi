'use client';
// app/marketing/prospects/scrape/_components/ScrapeForm.tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ActorId = 'gmaps_contacts' | 'google_search' | 'booking' | 'email_social' | 'leads_finder' | 'email_verifier' | 'linkedin_email';

// User-friendly labels — PBS should never need to go to Apify to read slug names.
// The technical slug is shown as a subtitle line under each actor so the mapping is visible.
const ACTORS: Record<ActorId, { label: string; slug: string; hint: string; costHint: string }> = {
  gmaps_contacts: {
    label:    '1 · Find businesses on Google Maps (with emails)',
    slug:     'compass~google-maps-extractor',
    hint:     'Search a keyword + city → get real businesses with website, phone, address, category, and (when available) email. Best first step for local B2B discovery.',
    costHint: '~$5 per 1,000 places',
  },
  google_search: {
    label:    '2 · Google Search (URLs only, no emails)',
    slug:     'apify~google-search-scraper',
    hint:     'Feed keywords → get SERP result URLs. Use as a URL list to feed into "Extract emails from URLs" next.',
    costHint: '~$0.50 per 100 hits',
  },
  booking: {
    label:    '3 · Find hotels on Booking.com (compset only, no emails)',
    slug:     'voyager~booking-scraper',
    hint:     'Destination → list of hotels with prices, ratings, URLs. Used earlier to build the 218-hotel compset. No emails.',
    costHint: '~$5 per 1,000 hotels',
  },
  email_social: {
    label:    '4 · Extract emails from a list of website URLs',
    slug:     'poidata~email-and-social-scraper',
    hint:     'You give it a list of company websites → it crawls contact/about pages → returns emails + social handles per site.',
    costHint: '~$0.50 per 100 URLs',
  },
  leads_finder: {
    label:    '5 · Find B2B decision-makers by role (Apollo alternative)',
    slug:     'code_crafter~leads-finder',
    hint:     'Best-value action. Search by role (Marketing Director, CEO, etc.) + industry keyword → returns real named people with company + email + phone. Ideal for tour operators / DMCs / luxury travel agents.',
    costHint: '~$1.50 per 1,000 leads · pay-per-event',
  },
  linkedin_email: {
    label:    '6 · Scrape LinkedIn profiles → emails',
    slug:     'dev_fusion~Linkedin-Profile-Scraper',
    hint:     'Feed LinkedIn profile URLs or LinkedIn search URLs → returns person + email + role + company. Unlocks contacts where you only have a company website: search LinkedIn for "manager at <hotel>" and paste the search URL.',
    costHint: '~$10 per 1,000 profiles',
  },
  email_verifier: {
    label:    '7 · Verify email addresses (paid, deep mailbox check)',
    slug:     'michael.g~email-verifier-validator',
    hint:     'Paste emails to check whether each mailbox actually accepts mail. Updates email_verify_status on matching rows (valid / invalid / catch_all / role / disposable). Only run AFTER free MX check has trimmed dead domains.',
    costHint: '~$100 per 1,000 · $0.10 each',
  },
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

  // LinkedIn scraper inputs — either profile URLs or search URLs
  const [liUrls, setLiUrls]             = useState('https://www.linkedin.com/in/example\nhttps://www.linkedin.com/search/results/people/?keywords=manager%20Villa%20Maly');
  const [liMax, setLiMax]               = useState(20);

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
      case 'linkedin_email': {
        const urls = liUrls.split('\n').map(x => x.trim()).filter(Boolean);
        return { profileUrls: urls, searchUrls: urls, maxItems: liMax, scrapeEmails: true };
      }
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
      <div style={{ fontSize:11, color:'#5A5A5A', marginTop:-6, marginBottom:6, lineHeight:1.5 }}>
        {cfg.hint}
      </div>
      <div style={{ fontSize:10, color:'#8B5A1C', marginBottom:12 }}>
        Cost: {cfg.costHint} · Apify actor: <code style={{ fontFamily:'monospace', background:'#F5EEDF', padding:'1px 5px', borderRadius:3 }}>{cfg.slug}</code>
      </div>

      <details style={{ marginBottom:12, fontSize:11 }}>
        <summary style={{ cursor:'pointer', color:'#5A5A5A' }}>Advanced: override actor slug</summary>
        <div style={{ marginTop:8 }}>
          <input value={slugOverride} onChange={e => setSlugOverride(e.target.value)} disabled={running}
            placeholder="e.g. lukaskrivka~google-maps-with-contact-details" style={{ ...input, width:'100%' }} />
          <div style={{ fontSize:10, color:'#5A5A5A', marginTop:4 }}>
            Leave blank to use the actor above. Fill only if you want to try a different Apify actor for this slot.
          </div>
        </div>
      </details>

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

      {actor === 'linkedin_email' && (
        <>
          <div style={row}><label style={label}>LinkedIn URLs (one per line)</label>
            <textarea value={liUrls} onChange={e => setLiUrls(e.target.value)} disabled={running}
              rows={6} placeholder="https://www.linkedin.com/in/somename&#10;https://www.linkedin.com/search/results/people/?keywords=manager%20Villa%20Maly" style={{ ...input, fontFamily:'inherit' }} /></div>
          <div style={row}><label style={label}>Max results per URL</label>
            <input type="number" min={1} max={200} value={liMax} onChange={e => setLiMax(+e.target.value)} disabled={running} style={{ ...input, width:100 }} /></div>
          <div style={{ fontSize:11, color:'#5A5A5A', marginTop:-6, marginBottom:10 }}>
            Two input modes: paste direct profile URLs (fastest), or paste LinkedIn search-result URLs (broader — will scrape all profiles on that search page).
          </div>
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