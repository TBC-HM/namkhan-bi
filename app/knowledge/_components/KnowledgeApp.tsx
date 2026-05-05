'use client';

// app/knowledge/_components/KnowledgeApp.tsx
// 3-tab knowledge workspace: 🔎 Search · 💬 Ask · ⬆ Upload
// All API calls go to /api/docs/* server routes (which use admin client).

import { useCallback, useEffect, useMemo, useState } from 'react';

type DocResult = {
  doc_id: string;
  title: string;
  doc_type: string;
  doc_subtype: string | null;
  importance: string;
  sensitivity: string;
  external_party: string | null;
  valid_from: string | null;
  valid_until: string | null;
  summary: string | null;
  tags: string[] | null;
  storage_bucket: string | null;
  storage_path: string | null;
  rank: number;
};

type Citation = {
  ref: string;
  doc_id: string;
  title: string;
  doc_type: string;
  external_party: string | null;
  valid_from: string | null;
  valid_until: string | null;
  importance: string;
};

type AskResponse = {
  ok: boolean;
  answer: string;
  citations: Citation[];
  chunks_used: { ref: string; doc_id: string; title: string; doc_type: string; rank: number }[];
  confidence: number;
  error?: string;
};

type DataAskResponse = {
  ok: boolean;
  answer: string;
  sql: string;
  rows: Record<string, any>[];
  columns: string[];
  row_count: number;
  error?: string;
  generated_sql?: string;
};

// Heuristic: does this question look like data (KPI/budget/supplier/inventory/
// property settings) or doc content (procedure/policy/contract clause)?
function looksLikeDataQuestion(q: string): boolean {
  const t = q.toLowerCase();
  const dataWords = [
    // Financial / KPI
    'budget','variance','revenue','cost','expense','suppliers','supplier','vendor',
    'invoice','adr','revpar','occupancy','occ','room nights','gop','margin','flow-through',
    // Inventory
    'inventory','stock','par','slow movers','below par','expiring',
    // Aggregations
    'how much','how many','total','sum','count','average','avg','top ',
    // Time
    'this month','last month','this year','last year','january','february','march','april',
    'may ','june','july','august','september','october','november','december',
    'jan','feb','mar','apr','jun','jul','aug','sep','oct','nov','dec',
    'q1','q2','q3','q4','ytd','mtd','ly','lyy',
    // P&L variants
    'p/l','p&l','pnl','p & l','income statement','profit and loss','profit & loss',
    'gross profit','net income','margin','flow-through','flowthrough',
    // Contracts/dept
    'contract','contracts expir','hilton finance','channel mix','usali','dept','department',
    // Property / owner / legal entity (NEW — were going to DOCS by mistake)
    'tax number','tax id','tax nbr','tax no','tax #','vat','vat number',
    'license','license number','license no','business license','enterprise registration',
    'legal name','legal entity','trading name','company name','registered name',
    'property name','hotel name','property id','our name',
    'address','street','postal code','zip','village','district','province',
    'country','timezone','time zone',
    'gm','general manager','owner','contact email','contact phone','phone number',
    'email','website','booking engine','star rating',
    'green tea','namkhan group','sole company','sole co',
    'check-in time','checkout','check out','check in','check-in','star rating',
    'languages spoken','primary language','affiliations',
    'usp','unique selling','iata','icao','airport distance',
  ];
  return dataWords.some(w => t.includes(w));
}

// Detect live-data questions (weather / air quality / news / flights).
function looksLikeLiveQuestion(q: string): 'weather' | 'airquality' | 'news' | 'flights' | null {
  const t = q.toLowerCase();
  if (/\b(weather|forecast|rain|temperature|hot|cold|sunny|cloudy)\b/.test(t)) return 'weather';
  if (/\b(air quality|aqi|pm2\.?5|pm10|pollution|smog|haze|burning season)\b/.test(t)) return 'airquality';
  if (/\b(flights?|arrivals?|departures?|lpq|airport)\b/.test(t)) return 'flights';
  if (/\b(news|laos news|laotian times|vientiane times|happening|today.{0,15}news|latest)\b/.test(t)) return 'news';
  return null;
}

/* ============================================================
 *  MarkdownLite — paragraphs, **bold**, and | tables |
 *  Tiny purpose-built renderer for AI answers (no full md lib needed).
 * ============================================================ */
function renderInline(text: string): React.ReactNode[] {
  // Split on **bold** while preserving the markers
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = p.match(/^\*\*(.+)\*\*$/);
    if (m) return <strong key={i} style={{ color: 'var(--ink)' }}>{m[1]}</strong>;
    return <span key={i}>{p}</span>;
  });
}

function MarkdownLite({ text }: { text: string }) {
  if (!text) return null;
  // Split into blocks: tables (consecutive `|...|` lines) vs paragraphs
  const lines = text.split('\n');
  const blocks: { kind: 'table' | 'p'; lines: string[] }[] = [];
  let cur: { kind: 'table' | 'p'; lines: string[] } = { kind: 'p', lines: [] };
  const flush = () => { if (cur.lines.length) blocks.push(cur); cur = { kind: 'p', lines: [] }; };
  for (const ln of lines) {
    const isRow = /^\s*\|.*\|\s*$/.test(ln);
    if (isRow) {
      if (cur.kind !== 'table') { flush(); cur = { kind: 'table', lines: [] }; }
      cur.lines.push(ln);
    } else {
      if (cur.kind === 'table') { flush(); }
      cur.lines.push(ln);
    }
  }
  flush();

  return (
    <div style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-lg)', color: 'var(--ink)',
                  lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {blocks.map((b, bi) => {
        if (b.kind === 'table') {
          // Parse rows as | a | b | c |
          const rows = b.lines.map(l =>
            l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
          );
          // Detect divider row (---|---|---) and split header
          const dividerIdx = rows.findIndex(r => r.every(c => /^-+:?$|^:?-+:?$/.test(c)));
          const header = dividerIdx > 0 ? rows[0] : null;
          const body = dividerIdx > 0 ? rows.slice(dividerIdx + 1) : rows;
          return (
            <table key={bi} style={{ width: '100%', borderCollapse: 'collapse',
                                     fontFamily: 'var(--sans)', fontSize: 'var(--t-sm)' }}>
              {header && (
                <thead style={{ background: 'var(--paper-warm)' }}>
                  <tr>
                    {header.map((h, hi) => (
                      <th key={hi} style={{
                        padding: '6px 10px', textAlign: hi === 0 ? 'left' : 'right',
                        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                        color: 'var(--brass)', borderBottom: '1px solid var(--line)',
                      }}>{renderInline(h)}</th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {body.map((r, ri) => (
                  <tr key={ri} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    {r.map((c, ci) => (
                      <td key={ci} style={{
                        padding: '4px 10px',
                        textAlign: ci === 0 ? 'left' : 'right',
                        fontFamily: ci === 0 ? 'var(--sans)' : 'var(--mono)',
                        color: 'var(--ink-soft)',
                      }}>{renderInline(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        // paragraph block — render lines, ignore empty leading/trailing
        const para = b.lines.join('\n').trim();
        if (!para) return null;
        return (
          <div key={bi} style={{ whiteSpace: 'pre-wrap' }}>
            {renderInline(para)}
          </div>
        );
      })}
    </div>
  );
}

function aqiBandColor(band: string): string {
  switch (band) {
    case 'good':                 return 'var(--st-good)';
    case 'moderate':             return 'var(--st-warn)';
    case 'unhealthy_sensitive':  return '#d97706';
    case 'unhealthy':            return 'var(--st-bad)';
    case 'very_unhealthy':       return '#7c2d12';
    case 'hazardous':            return '#450a0a';
    default:                     return 'var(--ink-mute)';
  }
}

type IngestResult = {
  ok: boolean;
  doc?: DocResult;
  classification?: any;
  extracted_chars?: number;
  error?: string;
  stage?: string;
};

const DOC_TYPES = ['partner','legal','audit','insurance','financial','hr_doc','sop','template','presentation','research','kb_article','compliance','note','marketing'];
const IMPORTANCE_TIERS = ['critical','standard','note','research','reference'];

const IMP_COLOR: Record<string, { bg: string; bd: string; tx: string }> = {
  critical:  { bg: 'var(--st-bad-bg)',  bd: 'var(--st-bad-bd)',  tx: 'var(--st-bad)'  },
  standard:  { bg: 'var(--st-info-bg)', bd: 'var(--st-info-bd)', tx: 'var(--st-info-tx)' },
  note:      { bg: 'var(--paper-warm)', bd: 'var(--line-soft)',  tx: 'var(--ink-soft)' },
  research:  { bg: 'var(--paper-deep)', bd: 'var(--line)',       tx: 'var(--ink-soft)' },
  reference: { bg: 'var(--paper-warm)', bd: 'var(--line-soft)',  tx: 'var(--ink-mute)' },
};

function ImportanceBadge({ tier }: { tier: string }) {
  const c = IMP_COLOR[tier] || IMP_COLOR.standard;
  return (
    <span style={{
      fontFamily: 'var(--mono)',
      fontSize: 'var(--t-xs)',
      letterSpacing: 'var(--ls-extra)',
      textTransform: 'uppercase',
      padding: '2px 8px',
      borderRadius: 3,
      background: c.bg,
      border: `1px solid ${c.bd}`,
      color: c.tx,
    }}>{tier}</span>
  );
}

async function openDoc(bucket: string | null, path: string | null) {
  if (!bucket || !path) return;
  const r = await fetch(`/api/docs/signed-url?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`);
  const j = await r.json();
  if (j.ok && j.url) window.open(j.url, '_blank');
  else alert('Could not open: ' + (j.error || 'unknown'));
}

export default function KnowledgeApp() {
  const [tab, setTab] = useState<'search'|'ask'|'upload'|'links'>('search');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tab strip */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--line-soft)' }}>
        {([
          ['search', '🔎  Search'],
          ['ask',    '💬  Ask'],
          ['upload', '⬆   Upload'],
          ['links',  '🔗  Links'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-sm)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: tab === key ? '2px solid var(--moss)' : '2px solid transparent',
              color: tab === key ? 'var(--moss)' : 'var(--ink-mute)',
              cursor: 'pointer',
            }}
          >{label}</button>
        ))}
      </div>

      {tab === 'search' && <SearchPanel />}
      {tab === 'ask'    && <AskPanel />}
      {tab === 'upload' && <UploadPanel />}
      {tab === 'links'  && <LinksPanel />}
    </div>
  );
}

/* ============================================================
 *  LINKS / BOOKMARKS PANEL
 * ============================================================ */
type Bookmark = {
  bookmark_id: string;
  url: string;
  title: string | null;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  importance: string;
  created_at: string;
};

const BOOKMARK_CATEGORIES = ['pms','partner','reference','industry','tools','admin','news','training','other'];

function LinksPanel() {
  const [items, setItems] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Add-form state
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState('reference');
  const [newTags, setNewTags] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    try {
      const r = await fetch('/api/bookmarks?' + params.toString());
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'load failed');
      setItems(j.bookmarks);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, category]);

  // Initial load + reload when category changes
  useEffect(() => { load(); }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = useCallback(async () => {
    if (!newUrl.trim()) return;
    setAdding(true); setError(null);
    try {
      const r = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: newUrl.trim(),
          title: newTitle.trim() || undefined,
          description: newDesc.trim() || undefined,
          category: newCat,
          tags: newTags.split(',').map(s => s.trim()).filter(Boolean),
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'add failed');
      setNewUrl(''); setNewTitle(''); setNewDesc(''); setNewTags('');
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }, [newUrl, newTitle, newDesc, newCat, newTags, load]);

  const remove = useCallback(async (id: string) => {
    if (!confirm('Remove this bookmark?')) return;
    await fetch('/api/bookmarks?id=' + encodeURIComponent(id), { method: 'DELETE' });
    load();
  }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Add bar */}
      <div style={{
        border: '1px solid var(--line-soft)', background: 'var(--paper-pure)',
        borderRadius: 4, padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
                      textTransform: 'uppercase', color: 'var(--brass)' }}>Add link</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={newUrl} onChange={(e)=>setNewUrl(e.target.value)} placeholder="https://…"
                 style={{ ...chipInput, flex: '1 1 280px', padding: '8px 12px' }} />
          <input value={newTitle} onChange={(e)=>setNewTitle(e.target.value)} placeholder="Title (optional)"
                 style={{ ...chipInput, flex: '1 1 200px', padding: '8px 12px' }} />
          <select value={newCat} onChange={(e)=>setNewCat(e.target.value)} style={chipInput}>
            {BOOKMARK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newDesc} onChange={(e)=>setNewDesc(e.target.value)} placeholder="Description (optional)"
                 style={{ ...chipInput, flex: 1, padding: '8px 12px' }} />
          <input value={newTags} onChange={(e)=>setNewTags(e.target.value)} placeholder="tags, comma, separated"
                 style={{ ...chipInput, flex: 1, padding: '8px 12px' }} />
          <button onClick={add} disabled={adding || !newUrl.trim()} style={primaryBtn}>
            {adding ? '…' : 'Add'}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search bookmarks…"
               onKeyDown={(e)=>{ if (e.key === 'Enter') load(); }}
               style={{ ...chipInput, flex: '1 1 240px', padding: '8px 12px' }} />
        <select value={category} onChange={(e)=>setCategory(e.target.value)} style={chipInput}>
          <option value="">all categories</option>
          {BOOKMARK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={load} style={ghostBtn}>Refresh</button>
      </div>

      {error && <div style={errorBox}>{error}</div>}
      {loading && <div style={mutedNote}>Loading…</div>}

      {items.length === 0 && !loading && (
        <div style={mutedNote}>No bookmarks yet. Add one above.</div>
      )}

      {items.map(b => (
        <div key={b.bookmark_id} style={{
          border: '1px solid var(--line-soft)', background: 'var(--paper-pure)',
          borderRadius: 4, padding: 12,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <a href={b.url} target="_blank" rel="noopener noreferrer" style={{
              fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)',
              color: 'var(--moss)', textDecoration: 'none',
            }}>
              {b.title || b.url}
            </a>
            <ImportanceBadge tier={b.importance} />
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>
            {[b.category, b.tags?.length ? `${b.tags.length} tags` : null]
              .filter(Boolean).join(' · ')}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)',
                        wordBreak: 'break-all' }}>{b.url}</div>
          {b.description && (
            <div style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-md)', color: 'var(--ink-soft)' }}>
              {b.description}
            </div>
          )}
          {b.tags && b.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {b.tags.map(t => (
                <span key={t} style={{
                  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)',
                  padding: '1px 5px', background: 'var(--paper-warm)', borderRadius: 2,
                }}>{t}</span>
              ))}
            </div>
          )}
          <div>
            <button onClick={() => remove(b.bookmark_id)} style={{ ...ghostBtn, padding: '4px 8px' }}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
 *  SEARCH PANEL
 * ============================================================ */
function SearchPanel() {
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>('');
  const [importance, setImportance] = useState<string>('');
  const [party, setParty] = useState('');
  const [year, setYear] = useState('');
  const [results, setResults] = useState<DocResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type) params.set('type', type);
    if (importance) params.set('importance', importance);
    if (party) params.set('party', party);
    if (year) params.set('year', year);
    params.set('lim', '50');
    try {
      const r = await fetch('/api/docs/search?' + params.toString());
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'search failed');
      setResults(j.results);
    } catch (e: any) {
      setError(e.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [q, type, importance, party, year]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Search box */}
      <form
        onSubmit={(e) => { e.preventDefault(); runSearch(); }}
        style={{ display: 'flex', gap: 8 }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search documents — e.g. SLH contract, audit 2024, fire safety"
          style={{
            flex: 1, padding: '12px 16px',
            border: '1px solid var(--line)',
            borderRadius: 4,
            fontFamily: 'var(--sans)', fontSize: 'var(--t-md)',
            background: 'var(--paper-pure)',
          }}
        />
        <button type="submit" style={primaryBtn}>Search</button>
      </form>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip label="Type" value={type} options={['', ...DOC_TYPES]} onChange={setType} />
        <Chip label="Importance" value={importance} options={['', ...IMPORTANCE_TIERS]} onChange={setImportance} />
        <input
          value={party}
          onChange={(e) => setParty(e.target.value)}
          placeholder="Party (e.g. SLH)"
          style={chipInput}
        />
        <input
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g,''))}
          placeholder="Year"
          style={{ ...chipInput, width: 80 }}
        />
        {(q || type || importance || party || year) && (
          <button onClick={() => { setQ(''); setType(''); setImportance(''); setParty(''); setYear(''); setResults([]); }}
                  style={ghostBtn}>Clear</button>
        )}
      </div>

      {error && <div style={errorBox}>{error}</div>}
      {loading && <div style={mutedNote}>Searching…</div>}

      {!loading && results.length > 0 && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
                      textTransform: 'uppercase', color: 'var(--brass)' }}>
          {results.length} result{results.length === 1 ? '' : 's'}
        </div>
      )}

      {results.map(r => <ResultCard key={r.doc_id} doc={r} />)}

      {!loading && results.length === 0 && (q || type || importance || party || year) && !error && (
        <div style={mutedNote}>No matches. Try fewer filters or different keywords.</div>
      )}
    </div>
  );
}

function ResultCard({ doc }: { doc: DocResult }) {
  return (
    <div style={{
      border: '1px solid var(--line-soft)',
      background: 'var(--paper-pure)',
      borderRadius: 4,
      padding: 16,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', fontStyle: 'italic', color: 'var(--ink)' }}>
          {doc.title}
        </div>
        <ImportanceBadge tier={doc.importance} />
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
                    textTransform: 'uppercase', color: 'var(--brass)' }}>
        {[doc.doc_type, doc.doc_subtype, doc.external_party, doc.valid_from, doc.sensitivity]
          .filter(Boolean).join('  ·  ')}
      </div>
      {doc.summary && (
        <div style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-md)', color: 'var(--ink-soft)' }}>
          {doc.summary}
        </div>
      )}
      {doc.tags && doc.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {doc.tags.map(t => (
            <span key={t} style={{
              fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)',
              padding: '2px 6px', background: 'var(--paper-warm)', borderRadius: 2,
            }}>{t}</span>
          ))}
        </div>
      )}
      {doc.storage_path && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={() => openDoc(doc.storage_bucket, doc.storage_path)} style={smallBtn}>Open</button>
          {doc.valid_until && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)',
                           padding: '4px 8px' }}>
              expires {doc.valid_until}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 *  ASK PANEL
 * ============================================================ */
function AskPanel() {
  const [q, setQ] = useState('');
  const [resp, setResp] = useState<AskResponse | null>(null);
  const [dataResp, setDataResp] = useState<DataAskResponse | null>(null);
  const [liveResp, setLiveResp] = useState<any>(null);
  const [route, setRoute] = useState<'auto'|'doc'|'data'|'live'>('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async () => {
    if (q.trim().length < 3) return;
    setLoading(true); setError(null); setResp(null); setDataResp(null); setLiveResp(null);

    // Routing precedence: live > data > doc
    const liveKind = route === 'live'
      ? (looksLikeLiveQuestion(q) || 'weather')
      : (route === 'auto' ? looksLikeLiveQuestion(q) : null);
    const useData = !liveKind && (route === 'data' || (route === 'auto' && looksLikeDataQuestion(q)));

    try {
      if (liveKind === 'weather') {
        const r = await fetch('/api/live/weather');
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'weather failed');
        setLiveResp({ kind: 'weather', ...j });
      } else if (liveKind === 'airquality') {
        const r = await fetch('/api/live/airquality');
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'air quality failed');
        setLiveResp({ kind: 'airquality', ...j });
      } else if (liveKind === 'news') {
        const r = await fetch('/api/live/news?lim=15');
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'news failed');
        setLiveResp({ kind: 'news', ...j });
      } else if (liveKind === 'flights') {
        const r = await fetch('/api/live/flights?direction=both&hours=24');
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'flights failed');
        setLiveResp({ kind: 'flights', ...j });
      } else if (useData) {
        const r = await fetch('/api/data/ask', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-user-role': 'owner' },
          body: JSON.stringify({ question: q }),
        });
        const j = await r.json() as DataAskResponse;
        if (!j.ok) throw new Error(j.error || 'data ask failed');
        setDataResp(j);
      } else {
        const r = await fetch('/api/docs/ask', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-user-role': 'owner' },
          body: JSON.stringify({ question: q }),
        });
        const j = await r.json() as AskResponse;
        if (!j.ok) throw new Error(j.error || 'ask failed');

        // Auto-fallback: weak doc answer (<0.10 conf) in Auto mode → retry as DATA
        if (route === 'auto' && (j.confidence ?? 0) < 0.10) {
          const r2 = await fetch('/api/data/ask', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ question: q }),
          });
          const j2 = await r2.json() as DataAskResponse;
          if (j2.ok && j2.row_count > 0) {
            setDataResp(j2);  // show data result
            return;
          }
        }
        setResp(j);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, route]);

  // Render the answer with [#N] tokens turned into clickable chips
  const answerEl = useMemo(() => {
    if (!resp?.answer) return null;
    const parts = resp.answer.split(/(\[#\d+\])/);
    return parts.map((part, i) => {
      const m = part.match(/\[#(\d+)\]/);
      if (!m) return <span key={i}>{part}</span>;
      const n = parseInt(m[1]);
      const cit = resp.citations.find(c => c.ref === `#${n}`);
      const doc = cit
        ? resp.chunks_used.find(c => c.ref === `#${n}`)
        : resp.chunks_used.find(c => c.ref === `#${n}`);
      return (
        <button
          key={i}
          onClick={() => alert(cit ? `${cit.title}\n\n${cit.doc_type} · ${cit.external_party || '—'} · ${cit.valid_from || '—'}` : 'Citation not found')}
          style={{
            display: 'inline', padding: '0 4px', margin: '0 2px',
            border: '1px solid var(--brass)', borderRadius: 2,
            background: 'var(--paper-warm)', color: 'var(--brass)',
            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', cursor: 'pointer',
          }}
          title={cit?.title || ''}
        >#{n}</button>
      );
    });
  }, [resp]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask anything — e.g. how do I clean a red wine stain on the lobby carpet?  ·  what are SLH audit requirements?  ·  when does the Travelife cert expire?"
          rows={3}
          style={{
            padding: '12px 16px',
            border: '1px solid var(--line)', borderRadius: 4,
            fontFamily: 'var(--sans)', fontSize: 'var(--t-md)',
            background: 'var(--paper-pure)', resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="submit" style={primaryBtn} disabled={loading}>
            {loading ? 'Thinking…' : 'Ask'}
          </button>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
            AI routes to docs (procedures, contracts) · data (KPIs, suppliers, tax, property) ·
            live (weather, AQ, news, flights) automatically. Falls back to data when doc confidence is low.
          </span>
        </div>
      </form>

      {error && <div style={errorBox}>{error}</div>}

      {liveResp && liveResp.kind === 'weather' && (
        <div style={{
          border: '1px solid var(--moss-glow)', background: 'var(--paper-pure)',
          borderRadius: 4, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
                        textTransform: 'uppercase', color: 'var(--moss)' }}>
            📡 Live · weather · {liveResp.location?.name}
          </div>
          {liveResp.current && (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-3xl)', color: 'var(--ink)' }}>
                  {Math.round(liveResp.current.temperature_2m)}°C
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                  feels {Math.round(liveResp.current.apparent_temperature)}°C · humidity {liveResp.current.relative_humidity_2m}%
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
                  wind {Math.round(liveResp.current.wind_speed_10m)} km/h
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
                  precip {liveResp.current.precipitation} mm
                </div>
              </div>
            </div>
          )}
          {liveResp.daily && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 'var(--t-sm)' }}>
                <thead style={{ background: 'var(--paper-warm)' }}>
                  <tr>
                    <th style={{ padding: '4px 8px', textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                                 color: 'var(--brass)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase' }}>Day</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                                 color: 'var(--brass)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase' }}>Min</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                                 color: 'var(--brass)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase' }}>Max</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                                 color: 'var(--brass)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase' }}>Rain mm</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                                 color: 'var(--brass)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase' }}>Rain %</th>
                  </tr>
                </thead>
                <tbody>
                  {liveResp.daily.time?.map((d: string, i: number) => (
                    <tr key={d} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '4px 8px', color: 'var(--ink-soft)' }}>{d}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>{Math.round(liveResp.daily.temperature_2m_min[i])}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink)' }}>{Math.round(liveResp.daily.temperature_2m_max[i])}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>{liveResp.daily.precipitation_sum[i]}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>{liveResp.daily.precipitation_probability_max[i]}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
            Source: {liveResp.source} · fetched {new Date(liveResp.fetched_at).toLocaleString()}
          </div>
        </div>
      )}

      {liveResp && liveResp.kind === 'news' && (
        <div style={{
          border: '1px solid var(--moss-glow)', background: 'var(--paper-pure)',
          borderRadius: 4, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
                        textTransform: 'uppercase', color: 'var(--moss)' }}>
            📡 Live · news · {liveResp.count} item{liveResp.count===1?'':'s'} from {liveResp.sources?.join(' + ')}
          </div>
          {liveResp.items?.map((it: any, i: number) => (
            <div key={i} style={{
              borderTop: i === 0 ? 'none' : '1px solid var(--line-soft)',
              paddingTop: i === 0 ? 0 : 12,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <a href={it.link} target="_blank" rel="noopener noreferrer"
                 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic',
                          fontSize: 'var(--t-lg)', color: 'var(--moss)', textDecoration: 'none' }}>
                {it.title}
              </a>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                            color: 'var(--brass)' }}>
                {[it.source, it.pub_date ? new Date(it.pub_date).toLocaleDateString() : null,
                  ...(it.categories||[]).slice(0,3)].filter(Boolean).join(' · ')}
              </div>
              {it.excerpt && (
                <div style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-md)', color: 'var(--ink-soft)' }}>
                  {it.excerpt}…
                </div>
              )}
            </div>
          ))}
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
            fetched {new Date(liveResp.fetched_at).toLocaleString()}
          </div>
        </div>
      )}

      {liveResp && liveResp.kind === 'flights' && (
        <div style={{
          border: '1px solid var(--moss-glow)', background: 'var(--paper-pure)',
          borderRadius: 4, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
                        textTransform: 'uppercase', color: 'var(--moss)' }}>
            📡 Live · flights · {liveResp.airport?.iata} ({liveResp.airport?.name}) · last {liveResp.window_hours}h
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
            {liveResp.summary?.arrivals ?? 0} arrivals · {liveResp.summary?.departures ?? 0} departures
          </div>
          {liveResp.arrivals && liveResp.arrivals.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                            color: 'var(--brass)', letterSpacing: 'var(--ls-extra)',
                            textTransform: 'uppercase', marginBottom: 6 }}>↓ Arrivals</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 'var(--t-sm)' }}>
                <thead style={{ background: 'var(--paper-warm)' }}>
                  <tr>
                    <th style={{ padding: '4px 8px', textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--brass)' }}>Callsign</th>
                    <th style={{ padding: '4px 8px', textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--brass)' }}>From</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--brass)' }}>Landed</th>
                  </tr>
                </thead>
                <tbody>
                  {liveResp.arrivals.slice(0, 20).map((f: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '4px 8px', fontFamily: 'var(--mono)', color: 'var(--ink)' }}>{f.callsign || '—'}</td>
                      <td style={{ padding: '4px 8px', fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>{f.origin_airport || '—'}</td>
                      <td style={{ padding: '4px 8px', fontFamily: 'var(--mono)', color: 'var(--ink-soft)', textAlign: 'right' }}>
                        {f.last_seen ? new Date(f.last_seen).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {liveResp.departures && liveResp.departures.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                            color: 'var(--brass)', letterSpacing: 'var(--ls-extra)',
                            textTransform: 'uppercase', marginBottom: 6 }}>↑ Departures</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 'var(--t-sm)' }}>
                <thead style={{ background: 'var(--paper-warm)' }}>
                  <tr>
                    <th style={{ padding: '4px 8px', textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--brass)' }}>Callsign</th>
                    <th style={{ padding: '4px 8px', textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--brass)' }}>To</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--brass)' }}>Off</th>
                  </tr>
                </thead>
                <tbody>
                  {liveResp.departures.slice(0, 20).map((f: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '4px 8px', fontFamily: 'var(--mono)', color: 'var(--ink)' }}>{f.callsign || '—'}</td>
                      <td style={{ padding: '4px 8px', fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>{f.dest_airport || '—'}</td>
                      <td style={{ padding: '4px 8px', fontFamily: 'var(--mono)', color: 'var(--ink-soft)', textAlign: 'right' }}>
                        {f.first_seen ? new Date(f.first_seen).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(!liveResp.arrivals?.length && !liveResp.departures?.length) && (
            <div style={mutedNote}>
              No flights in the OpenSky data window. (LPQ has light traffic — try a longer window.)
            </div>
          )}
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
            Source: {liveResp.source} · ICAO codes only (no IATA mapping). Fetched {new Date(liveResp.fetched_at).toLocaleString()}
          </div>
        </div>
      )}

      {liveResp && liveResp.kind === 'airquality' && (
        <div style={{
          border: '1px solid var(--moss-glow)', background: 'var(--paper-pure)',
          borderRadius: 4, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
                        textTransform: 'uppercase', color: 'var(--moss)' }}>
            📡 Live · air quality · {liveResp.location?.name}
          </div>
          {liveResp.current && (
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-3xl)',
                              color: aqiBandColor(liveResp.band) }}>
                  AQI {Math.round(liveResp.current.us_aqi)}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                              textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)',
                              color: aqiBandColor(liveResp.band) }}>
                  {liveResp.band.replace('_', ' ')}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
                  PM2.5: <strong>{liveResp.current.pm2_5} µg/m³</strong>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
                  PM10: {liveResp.current.pm10} µg/m³
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
                  Ozone: {liveResp.current.ozone} µg/m³
                </div>
              </div>
            </div>
          )}
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
            Source: {liveResp.source} · fetched {new Date(liveResp.fetched_at).toLocaleString()}
          </div>
        </div>
      )}

      {dataResp && (
        <div style={{
          border: '1px solid var(--moss-glow)',
          background: 'var(--paper-pure)',
          borderRadius: 4, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase', color: 'var(--moss)',
          }}>📊 Data answer · {dataResp.row_count} row{dataResp.row_count===1?'':'s'}</div>
          <MarkdownLite text={dataResp.answer} />

          {dataResp.rows.length > 0 && (
            <div style={{ overflowX: 'auto', border: '1px solid var(--line-soft)', borderRadius: 3 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 'var(--t-sm)' }}>
                <thead style={{ background: 'var(--paper-warm)' }}>
                  <tr>
                    {dataResp.columns.map(c => (
                      <th key={c} style={{
                        padding: '6px 10px', textAlign: 'left',
                        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                        color: 'var(--brass)', borderBottom: '1px solid var(--line)',
                      }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataResp.rows.slice(0, 50).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      {dataResp.columns.map(c => {
                        const v = row[c];
                        const isNum = typeof v === 'number';
                        return (
                          <td key={c} style={{
                            padding: '5px 10px',
                            fontFamily: isNum ? 'var(--mono)' : 'var(--sans)',
                            textAlign: isNum ? 'right' : 'left',
                            color: 'var(--ink-soft)',
                          }}>
                            {v === null || v === undefined ? '—' : isNum ? Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {dataResp.rows.length > 50 && (
                <div style={{ padding: 8, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                  …and {dataResp.rows.length - 50} more rows
                </div>
              )}
            </div>
          )}
          <details>
            <summary style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', cursor: 'pointer' }}>
              Show generated SQL
            </summary>
            <pre style={{
              fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
              background: 'var(--paper-warm)', padding: 8, borderRadius: 3,
              overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--ink-soft)',
            }}>{dataResp.sql}</pre>
          </details>
        </div>
      )}

      {resp && (
        <div style={{
          border: '1px solid var(--moss-glow)',
          background: 'var(--paper-pure)',
          borderRadius: 4, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase', color: 'var(--moss)',
          }}>Answer · confidence {(resp.confidence * 100).toFixed(0)}%</div>
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 'var(--t-lg)', color: 'var(--ink)',
            lineHeight: 1.5, whiteSpace: 'pre-wrap',
          }}>
            {answerEl}
          </div>

          {resp.citations.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
                textTransform: 'uppercase', color: 'var(--brass)', marginBottom: 8,
              }}>Sources</div>
              {resp.citations.map(c => (
                <div key={c.ref} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '4px 0' }}>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--brass)',
                    padding: '2px 6px', border: '1px solid var(--brass)', borderRadius: 2,
                  }}>{c.ref}</span>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-md)', color: 'var(--ink)' }}>
                    {c.title}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                    {[c.doc_type, c.external_party, c.valid_from].filter(Boolean).join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 *  UPLOAD PANEL
 * ============================================================ */
type UploadItem = {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'classifying' | 'done' | 'failed';
  result?: IngestResult;
  startedAt?: number;
  durationMs?: number;
};

function UploadPanel() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [pasteUrl, setPasteUrl] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasting, setPasting] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);

  const ingestUrl = useCallback(async () => {
    if (!pasteUrl.trim()) return;
    setPasting(true); setPasteError(null);
    const id = pasteUrl + '-' + Date.now();
    // Render a placeholder card immediately
    const fakeFile = new File([''], pasteUrl.slice(0, 60), { type: 'text/uri-list' });
    setItems(prev => [{ id, file: fakeFile, status: 'classifying',
                        startedAt: Date.now() } as UploadItem, ...prev]);
    try {
      const r = await fetch('/api/docs/ingest-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: pasteUrl.trim(),
          title: pasteTitle.trim() || undefined,
        }),
      });
      const j = await r.json() as IngestResult;
      setItems(prev => prev.map(x => x.id === id
        ? { ...x, status: j.ok ? 'done' : 'failed', result: j,
            durationMs: Date.now() - (x.startedAt ?? Date.now()) }
        : x));
      if (j.ok) {
        setPasteUrl('');
        setPasteTitle('');
      }
    } catch (e: any) {
      setPasteError(e.message);
      setItems(prev => prev.map(x => x.id === id
        ? { ...x, status: 'failed', result: { ok: false, error: e.message } }
        : x));
    } finally {
      setPasting(false);
    }
  }, [pasteUrl, pasteTitle]);

  const processItem = useCallback(async (id: string, file: File) => {
    const startedAt = Date.now();
    setItems(prev => prev.map(it => it.id === id
      ? { ...it, status: 'uploading', startedAt }
      : it));

    const LARGE = 4 * 1024 * 1024; // 4 MB → use signed-URL path (Vercel body limit is 4.5)

    try {
      let r: Response;

      if (file.size <= LARGE) {
        // Small files — direct multipart upload
        setItems(prev => prev.map(x => x.id === id ? { ...x, status: 'classifying' } : x));
        const fd = new FormData();
        fd.append('file', file);
        fd.append('file_name', file.name);
        r = await fetch('/api/docs/ingest', { method: 'POST', body: fd });
      } else {
        // Large files — get signed URL, PUT directly to Supabase, then ingest by reference
        const sig = await fetch('/api/docs/upload-sign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            file_name: file.name,
            file_size: file.size,
            mime: file.type,
          }),
        }).then(x => x.json());
        if (!sig.ok) throw new Error(sig.error || 'sign failed');

        const put = await fetch(sig.signed_url, {
          method: 'PUT',
          headers: { 'content-type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!put.ok) throw new Error(`storage PUT ${put.status}`);

        setItems(prev => prev.map(x => x.id === id ? { ...x, status: 'classifying' } : x));
        r = await fetch('/api/docs/ingest', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            staging_bucket: sig.staging_bucket,
            staging_path: sig.staging_path,
            file_name: file.name,
            mime: file.type,
          }),
        });
      }

      const j = await r.json() as IngestResult;
      const dur = Date.now() - startedAt;
      setItems(prev => prev.map(x => x.id === id
        ? { ...x, status: j.ok ? 'done' : 'failed', result: j, durationMs: dur }
        : x));
    } catch (e: any) {
      setItems(prev => prev.map(x => x.id === id
        ? { ...x, status: 'failed', result: { ok: false, error: e.message } }
        : x));
    }
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const newItems: UploadItem[] = arr.map(f => ({
      id: f.name + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      file: f, status: 'queued',
    }));
    setItems(prev => [...newItems, ...prev]);
    // Process sequentially — pass the File directly (no stale-state lookup)
    newItems.reduce(async (chain, item) => {
      await chain;
      await processItem(item.id, item.file);
    }, Promise.resolve());
  }, [processItem]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        style={{
          border: `2px dashed ${dragOver ? 'var(--moss)' : 'var(--line)'}`,
          background: dragOver ? 'var(--paper-warm)' : 'var(--paper-pure)',
          borderRadius: 4,
          padding: 40,
          textAlign: 'center',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-2xl)', color: 'var(--ink)', marginBottom: 8 }}>
          Drop files here
        </div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-md)', color: 'var(--ink-mute)', marginBottom: 16 }}>
          PDF · DOCX · XLSX · PPTX · MD · TXT · CSV. AI classifies type, importance, party, dates, keywords automatically.
        </div>
        <label style={{ ...primaryBtn, display: 'inline-block', cursor: 'pointer' }}>
          Choose files
          <input
            type="file" multiple style={{ display: 'none' }}
            accept=".pdf,.docx,.xlsx,.xls,.pptx,.md,.txt,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,text/markdown,text/plain,text/csv"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          />
        </label>
      </div>

      {/* Paste-URL form (Google Sheets / Docs / web pages) */}
      <div style={{
        border: '1px solid var(--line-soft)', background: 'var(--paper-pure)',
        borderRadius: 4, padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                      letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                      color: 'var(--brass)' }}>
          🔗  Or paste a URL (Google Sheets / Docs / web page)
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/...  or any URL"
            style={{ ...chipInput, flex: '1 1 320px', padding: '8px 12px' }}
            onKeyDown={(e) => { if (e.key === 'Enter') ingestUrl(); }}
          />
          <input
            value={pasteTitle}
            onChange={(e) => setPasteTitle(e.target.value)}
            placeholder="Title (optional)"
            style={{ ...chipInput, flex: '1 1 200px', padding: '8px 12px' }}
          />
          <button onClick={ingestUrl} disabled={pasting || !pasteUrl.trim()} style={primaryBtn}>
            {pasting ? '…' : 'Ingest URL'}
          </button>
        </div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
          For Google Sheets/Docs: must be shared "Anyone with link can view".
          Sheets → CSV export of the visible tab. Docs → plain text.
        </div>
        {pasteError && <div style={errorBox}>{pasteError}</div>}
      </div>

      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase', color: 'var(--brass)', display: 'flex', justifyContent: 'space-between',
          }}>
            <span>{items.length} file{items.length === 1 ? '' : 's'}</span>
            <span>
              {items.filter(i => i.status === 'done').length} done ·{' '}
              {items.filter(i => i.status === 'failed').length} failed ·{' '}
              {items.filter(i => i.status !== 'done' && i.status !== 'failed').length} pending
            </span>
          </div>
          {items.map(it => <UploadRow key={it.id} item={it} />)}
        </div>
      )}
    </div>
  );
}

function UploadRow({ item }: { item: UploadItem }) {
  const r = item.result;
  const doc = r?.doc;
  const cls = r?.classification;
  return (
    <div style={{
      border: '1px solid var(--line-soft)',
      background: 'var(--paper-pure)',
      borderRadius: 4, padding: 12,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.file.name} · {(item.file.size / 1024).toFixed(0)} KB
        </div>
        <StatusChip status={item.status} />
      </div>

      {item.status === 'done' && doc && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)', color: 'var(--ink)' }}>
              {doc.title}
            </div>
            <ImportanceBadge tier={doc.importance} />
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
                        textTransform: 'uppercase', color: 'var(--brass)' }}>
            {[doc.doc_type, doc.doc_subtype, doc.external_party, doc.sensitivity, doc.valid_from]
              .filter(Boolean).join(' · ')}
            {item.durationMs && ` · ${(item.durationMs / 1000).toFixed(1)}s`}
            {r?.extracted_chars !== undefined && ` · ${r.extracted_chars.toLocaleString()} chars`}
          </div>
          {doc.summary && (
            <div style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
              {doc.summary}
            </div>
          )}
          {cls?.keywords && cls.keywords.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {cls.keywords.slice(0, 12).map((k: string) => (
                <span key={k} style={{
                  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)',
                  padding: '1px 5px', background: 'var(--paper-warm)', borderRadius: 2,
                }}>{k}</span>
              ))}
            </div>
          )}
        </>
      )}

      {item.status === 'failed' && r && (
        <div style={errorBox}>
          {r.stage ? `[${r.stage}] ` : ''}{r.error || 'unknown error'}
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: UploadItem['status'] }) {
  const map: Record<string, { bg: string; tx: string; label: string }> = {
    queued:      { bg: 'var(--paper-warm)', tx: 'var(--ink-mute)', label: 'queued' },
    uploading:   { bg: 'var(--st-info-bg)', tx: 'var(--st-info-tx)', label: 'uploading' },
    classifying: { bg: 'var(--st-info-bg)', tx: 'var(--st-info-tx)', label: 'classifying…' },
    done:        { bg: 'var(--st-good-bg)', tx: 'var(--st-good)', label: '✓ classified' },
    failed:      { bg: 'var(--st-bad-bg)',  tx: 'var(--st-bad)', label: '✗ failed' },
  };
  const c = map[status];
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
      textTransform: 'uppercase', padding: '3px 8px', borderRadius: 2,
      background: c.bg, color: c.tx,
    }}>{c.label}</span>
  );
}

/* ============================================================
 *  Reusable bits
 * ============================================================ */
function Chip({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={chipInput} aria-label={label}>
      <option value="">{label}: any</option>
      {options.filter(Boolean).map(o => <option key={o} value={o}>{label}: {o}</option>)}
    </select>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '12px 20px',
  background: 'var(--moss)',
  color: 'var(--paper)',
  border: 'none', borderRadius: 4,
  fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)',
  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  padding: '8px 12px',
  background: 'transparent',
  color: 'var(--ink-mute)',
  border: '1px solid var(--line)', borderRadius: 4,
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
  cursor: 'pointer',
};

const smallBtn: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--moss)',
  color: 'var(--paper)',
  border: 'none', borderRadius: 3,
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
  cursor: 'pointer',
};

const chipInput: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid var(--line)',
  borderRadius: 3,
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)',
  background: 'var(--paper-pure)',
  color: 'var(--ink-soft)',
};

const errorBox: React.CSSProperties = {
  padding: 12,
  background: 'var(--st-bad-bg)',
  border: '1px solid var(--st-bad-bd)',
  color: 'var(--st-bad)',
  borderRadius: 3,
  fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)',
};

const mutedNote: React.CSSProperties = {
  padding: 12,
  color: 'var(--ink-mute)',
  fontFamily: 'var(--sans)', fontSize: 'var(--t-md)',
  fontStyle: 'italic',
};
