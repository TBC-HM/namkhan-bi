'use client';

// /sales/leads · LeadsPipelineWorkspace
//
// Five blocks (top → bottom):
//   1. KPI strip (raw / qualified / in-pipeline / won-30d / lost-30d)
//   2. CSV upload zone (drag-drop or click) → /api/sales/leads/upload
//   3. Two-column body
//      ├─ left:  leads queue (sortable, status flips inline)
//      └─ right: pipeline kanban (qualified → contacted → pipeline → won / lost)
//   4. Scraping queue panel (sales.scraping_jobs + Run scrape CTA)

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import { EMPTY } from '@/lib/format';
import type { LeadRow, ScrapingJob } from '../page';

type LeadStatus = LeadRow['status'];

const PIPELINE_LANES: Array<{ key: LeadStatus; label: string; tone: string }> = [
  { key: 'qualified', label: 'Qualified', tone: 'var(--brass)' },
  { key: 'contacted', label: 'Contacted', tone: 'var(--moss)' },
  { key: 'pipeline',  label: 'In pipeline', tone: 'var(--moss-glow)' },
  { key: 'won',       label: 'Won',       tone: 'var(--moss)' },
  { key: 'lost',      label: 'Lost',      tone: 'var(--st-bad)' },
];

const ALL_STATUSES: LeadStatus[] = ['raw','qualified','contacted','pipeline','won','lost','dropped'];

interface Props {
  leads: LeadRow[];
  scrapingJobs: ScrapingJob[];
}

export default function LeadsPipelineWorkspace({ leads, scrapingJobs }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; skipped_duplicates: number; valid: number; parsed: number; errors?: Array<{ row: number; reason: string }> } | null>(null);
  const [sortKey, setSortKey] = useState<'imported_at'|'priority'|'icp_score'|'company_name'>('imported_at');
  const [filterStatus, setFilterStatus] = useState<'all' | LeadStatus>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showScrape, setShowScrape] = useState(false);

  // ── KPI compute ────────────────────────────────────────────────────────
  const now = Date.now();
  const ms30d = 30 * 86400_000;
  const kpis = useMemo(() => {
    let raw = 0, qualified = 0, inPipeline = 0, won30 = 0, lost30 = 0;
    for (const l of leads) {
      const updated = l.updated_at ? new Date(l.updated_at).getTime() : new Date(l.imported_at).getTime();
      const within30 = (now - updated) < ms30d;
      if (l.status === 'raw') raw++;
      else if (l.status === 'qualified') qualified++;
      else if (l.status === 'contacted' || l.status === 'pipeline') inPipeline++;
      else if (l.status === 'won' && within30) won30++;
      else if (l.status === 'lost' && within30) lost30++;
    }
    return { raw, qualified, inPipeline, won30, lost30 };
  }, [leads, now, ms30d]);

  // ── filter + sort for the queue ────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    let out = leads.slice();
    if (filterStatus !== 'all') out = out.filter(l => l.status === filterStatus);
    if (q) {
      out = out.filter(l =>
        (l.company_name?.toLowerCase().includes(q)) ||
        (l.country?.toLowerCase().includes(q)) ||
        (l.city?.toLowerCase().includes(q)) ||
        (l.email?.toLowerCase().includes(q)) ||
        (l.category?.toLowerCase().includes(q))
      );
    }
    out.sort((a, b) => {
      if (sortKey === 'company_name') return a.company_name.localeCompare(b.company_name);
      if (sortKey === 'icp_score') return (b.icp_score ?? -1) - (a.icp_score ?? -1);
      if (sortKey === 'priority') {
        const order = ['A1','A2','B1','B2','C','drop'];
        const oa = order.indexOf(a.final_priority ?? 'C'); const ob = order.indexOf(b.final_priority ?? 'C');
        return (oa === -1 ? 99 : oa) - (ob === -1 ? 99 : ob);
      }
      return new Date(b.imported_at).getTime() - new Date(a.imported_at).getTime();
    });
    return out;
  }, [leads, filterStatus, filterQuery, sortKey]);

  const pipelineByStatus = useMemo(() => {
    const m: Record<LeadStatus, LeadRow[]> = {
      raw: [], qualified: [], contacted: [], pipeline: [], won: [], lost: [], dropped: [],
    };
    for (const l of leads) m[l.status].push(l);
    return m;
  }, [leads]);

  // ── handlers ───────────────────────────────────────────────────────────
  async function uploadCsv(text: string) {
    setBusy(true); setErr(null); setUploadResult(null);
    try {
      const res = await fetch('/api/sales/leads/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csv: text, source: 'csv' }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error ?? 'upload failed');
        if (j.errors) setUploadResult({ inserted: 0, skipped_duplicates: 0, valid: 0, parsed: 0, errors: j.errors });
      } else {
        setUploadResult({
          inserted: j.inserted ?? 0,
          skipped_duplicates: j.skipped_duplicates ?? 0,
          valid: j.valid ?? 0,
          parsed: j.parsed ?? 0,
          errors: j.errors,
        });
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  function handleFiles(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => uploadCsv(String(reader.result ?? ''));
    reader.readAsText(f);
  }

  async function patchLead(id: number, patch: Record<string, unknown>) {
    setBusy(true); setErr(null);
    try {
      // Inline status flip uses a direct patch via the upload-adjacent route.
      // No dedicated PATCH endpoint yet — falling back to a simple supabase
      // call would require service role on client; we ship a small RPC instead.
      const res = await fetch(`/api/sales/leads/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'patch failed');
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function enqueueScrape(query: string, target_category: string | null) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/sales/leads/scraping-jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, target_category }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'enqueue failed');
      setShowScrape(false);
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* 1. KPI STRIP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KpiBox value={kpis.raw}        unit="count" label="Raw leads"
                tooltip="sales.leads · status='raw' (just uploaded / scraped, not yet triaged)." />
        <KpiBox value={kpis.qualified}  unit="count" label="Qualified"
                tooltip="status='qualified' — passed manual ICP / score check." />
        <KpiBox value={kpis.inPipeline} unit="count" label="In pipeline"
                tooltip="status IN ('contacted','pipeline') — currently being worked." />
        <KpiBox value={kpis.won30}      unit="count" label="Won · 30d"
                tooltip="status='won' with imported_at or last update inside 30d." />
        <KpiBox value={kpis.lost30}     unit="count" label="Lost · 30d"
                tooltip="status='lost' with imported_at or last update inside 30d." />
      </div>

      {/* 2. CSV UPLOAD */}
      <Panel title="Upload leads · CSV" eyebrow={`schema: targeting.lead_scraping_fields (20 fields)`}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `1px dashed ${dragOver ? 'var(--brass)' : 'var(--paper-deep)'}`,
            borderRadius: 8, padding: '22px 16px', textAlign: 'center', cursor: 'pointer',
            background: dragOver ? 'rgba(168,133,74,0.06)' : 'transparent',
            transition: 'all 120ms ease',
          }}
        >
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden
                 onChange={(e) => handleFiles(e.target.files)} />
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase', color: 'var(--brass)', marginBottom: 6,
          }}>Drop a CSV here · or click to choose</div>
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>
            Required column: <code style={{ fontFamily: 'var(--mono)' }}>company_name</code>.
            Recognised: <code style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>
              lead_id, company_name, category, subcategory, country, city, language, website,
              instagram_url, decision_maker_name, decision_maker_role, email, phone_whatsapp,
              retreat_history, upcoming_retreat_signal, audience_size_proxy, price_level,
              icp_score, intent_score, final_priority
            </code>. Dedupe on lead_id + email.
          </div>
        </div>
        {uploadResult && (
          <div style={{
            marginTop: 10, padding: '8px 12px',
            background: uploadResult.inserted > 0 ? 'rgba(58,142,91,0.10)' : 'rgba(196,160,107,0.10)',
            border: `1px solid ${uploadResult.inserted > 0 ? 'var(--moss)' : 'var(--brass-soft)'}`,
            borderRadius: 6, fontSize: 'var(--t-sm)',
          }}>
            ✓ Parsed {uploadResult.parsed} · valid {uploadResult.valid} · inserted{' '}
            <strong>{uploadResult.inserted}</strong> · skipped {uploadResult.skipped_duplicates} duplicates.
            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                {uploadResult.errors.slice(0, 8).map((e, i) => (
                  <li key={i}>row {e.row}: {e.reason}</li>
                ))}
                {uploadResult.errors.length > 8 && <li>… and {uploadResult.errors.length - 8} more</li>}
              </ul>
            )}
          </div>
        )}
        {err && (
          <div style={{
            marginTop: 10, padding: '8px 12px', background: 'rgba(220,40,40,0.08)',
            border: '1px solid var(--st-bad)', borderRadius: 6,
            color: 'var(--st-bad)', fontSize: 'var(--t-sm)',
          }}>error: {err}</div>
        )}
      </Panel>

      {/* 3. TWO-COLUMN BODY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 5fr) minmax(420px, 7fr)', gap: 14 }}>
        {/* LEFT — leads queue */}
        <Panel title={`Leads queue · ${filteredLeads.length} of ${leads.length}`} eyebrow="sales.leads">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {(['all', ...ALL_STATUSES] as const).map(s => (
              <button key={s} type="button" onClick={() => setFilterStatus(s)}
                style={s === filterStatus ? S.chipActive : S.chip}>
                {s}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input type="search" placeholder="Search company / city / email…"
                   value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)}
                   style={S.input} />
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                    style={S.input}>
              <option value="imported_at">Newest first</option>
              <option value="priority">By priority</option>
              <option value="icp_score">By ICP score</option>
              <option value="company_name">By company</option>
            </select>
          </div>
          {filteredLeads.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
              No leads match. Upload a CSV above to seed.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 540, overflowY: 'auto' }}>
              {filteredLeads.map(l => (
                <li key={l.id} style={S.leadRow}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--t-sm)' }}>{l.company_name}</div>
                      <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                        {[l.city, l.country].filter(Boolean).join(' · ') || EMPTY}
                        {' · '}{l.category ?? EMPTY}
                      </div>
                      {(l.email || l.website) && (
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginTop: 2 }}>
                          {l.email ?? EMPTY}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 90 }}>
                      <select value={l.status}
                              onChange={(e) => patchLead(l.id, { status: e.target.value })}
                              disabled={busy}
                              style={{ ...S.input, padding: '2px 6px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: laneColor(l.status) }}>
                        {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {l.final_priority && (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--brass)', letterSpacing: 'var(--ls-loose)' }}>
                          {l.final_priority}
                        </span>
                      )}
                      {l.icp_score != null && (
                        <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                          fit {l.icp_score}{l.intent_score != null ? ` · int ${l.intent_score}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* RIGHT — pipeline kanban */}
        <Panel title="Pipeline · kanban-by-stage" eyebrow="qualified → won">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {PIPELINE_LANES.map(lane => {
              const items = pipelineByStatus[lane.key];
              return (
                <div key={lane.key} style={S.lane}>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                    letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                    color: lane.tone, fontWeight: 700, marginBottom: 6,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  }}>
                    <span>{lane.label}</span>
                    <span style={{ color: 'var(--ink-mute)' }}>{items.length}</span>
                  </div>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {items.length === 0 && (
                      <li style={{ fontStyle: 'italic', color: 'var(--ink-mute)', fontSize: 'var(--t-xs)' }}>{EMPTY}</li>
                    )}
                    {items.slice(0, 50).map(l => (
                      <li key={l.id} style={S.kanbanCard}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--t-sm)', lineHeight: 1.25 }}>{l.company_name}</div>
                        <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginTop: 2 }}>
                          {[l.city, l.country].filter(Boolean).join(' · ') || EMPTY}
                        </div>
                        {l.final_priority && (
                          <div style={{
                            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                            letterSpacing: 'var(--ls-loose)', color: 'var(--brass)', marginTop: 4,
                          }}>{l.final_priority}</div>
                        )}
                      </li>
                    ))}
                    {items.length > 50 && (
                      <li style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
                        +{items.length - 50} more
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* 4. SCRAPING QUEUE */}
      <Panel
        title="Scraping queue · sales.scraping_jobs"
        eyebrow={scrapingJobs.length === 0 ? 'no agent wired yet' : `${scrapingJobs.length} jobs`}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)', maxWidth: 640 }}>
            Pure scaffolding for the agent-runner. Enqueueing here writes a row to{' '}
            <code style={{ fontFamily: 'var(--mono)' }}>sales.scraping_jobs</code>; the runner
            picks it up out-of-band and writes leads back into{' '}
            <code style={{ fontFamily: 'var(--mono)' }}>sales.leads</code> with{' '}
            <code style={{ fontFamily: 'var(--mono)' }}>source=&apos;scrape&apos;</code>.
            Spec lives in <code style={{ fontFamily: 'var(--mono)' }}>cockpit_proposals</code>.
          </div>
          <button type="button" onClick={() => setShowScrape(true)} style={S.ctaPrimary}>
            ↻ Run scrape
          </button>
        </div>

        {scrapingJobs.length === 0 ? (
          <div style={{ padding: 18, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center', background: 'rgba(0,0,0,0.10)', borderRadius: 6 }}>
            No scraping jobs yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th className="num">Leads</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {scrapingJobs.map(j => (
                  <tr key={j.id}>
                    <td className="lbl">{j.query}</td>
                    <td className="lbl text-mute">{j.target_category ?? EMPTY}</td>
                    <td style={{ color: jobColor(j.status) }}>{j.status}</td>
                    <td className="num">{j.lead_count.toLocaleString()}</td>
                    <td className="lbl text-mute">{new Date(j.created_at).toISOString().slice(0,10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showScrape && <RunScrapeModal onClose={() => setShowScrape(false)} onRun={enqueueScrape} busy={busy} />}
    </div>
  );
}

function RunScrapeModal({ onClose, onRun, busy }: { onClose: () => void; onRun: (q: string, c: string | null) => void; busy: boolean }) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('');
  return (
    <div style={S.modalBackdrop}>
      <div style={S.modalBody}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', fontWeight: 500 }}>
            Run <em style={{ color: 'var(--brass)' }}>scrape</em>
          </h3>
          <button type="button" onClick={onClose} style={S.chip}>Close</button>
        </div>
        <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)', marginBottom: 8 }}>
          Enqueues a row in sales.scraping_jobs (status=&apos;queued&apos;).
          The agent-runner spec is in cockpit_proposals — once wired it will
          pick up queued rows automatically.
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)}
               placeholder='e.g. "yoga retreat hosts SEA 2026"'
               style={{ ...S.input, width: '100%', marginBottom: 8 }} />
        <input value={cat} onChange={(e) => setCat(e.target.value)}
               placeholder='Category (optional, e.g. "yoga_studio")'
               style={{ ...S.input, width: '100%', marginBottom: 12 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <button type="button" onClick={() => onRun(query, cat || null)} disabled={busy || !query.trim()}
                  style={S.ctaPrimary}>{busy ? 'Enqueueing…' : '↻ Enqueue'}</button>
        </div>
      </div>
    </div>
  );
}

function laneColor(s: LeadStatus): string {
  if (s === 'raw')        return 'var(--ink-mute)';
  if (s === 'qualified')  return 'var(--brass)';
  if (s === 'contacted')  return 'var(--moss)';
  if (s === 'pipeline')   return 'var(--moss-glow)';
  if (s === 'won')        return 'var(--moss)';
  if (s === 'lost')       return 'var(--st-bad)';
  return 'var(--ink-faint)';
}

function jobColor(s: ScrapingJob['status']): string {
  if (s === 'queued')  return 'var(--ink-mute)';
  if (s === 'running') return 'var(--brass)';
  if (s === 'done')    return 'var(--moss-glow)';
  return 'var(--st-bad)';
}

const S: Record<string, React.CSSProperties> = {
  chip: {
    padding: '4px 10px', borderRadius: 5,
    fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase',
    background: 'var(--paper)', border: '1px solid var(--paper-deep)',
    color: 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  chipActive: {
    padding: '4px 10px', borderRadius: 5,
    fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase',
    background: 'var(--moss)', color: 'var(--paper-warm)', borderColor: 'var(--moss)',
    border: '1px solid var(--moss)', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  input: {
    padding: '4px 10px', borderRadius: 5,
    border: '1px solid var(--paper-deep)', background: 'var(--paper-warm)',
    fontSize: 'var(--t-sm)', color: 'var(--ink)',
  },
  leadRow: {
    padding: '8px 0', borderBottom: '1px solid var(--line-soft)',
  },
  lane: {
    background: 'rgba(0,0,0,0.10)',
    border: '1px solid var(--paper-deep)',
    borderRadius: 6, padding: '8px 8px 10px',
    minHeight: 200,
  },
  kanbanCard: {
    background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
    borderRadius: 5, padding: '6px 8px',
  },
  ctaPrimary: {
    padding: '6px 14px', borderRadius: 4,
    fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', fontWeight: 700,
    background: 'var(--brass)', color: 'var(--ink)',
    border: '1px solid var(--brass)', cursor: 'pointer',
  },
  modalBackdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: 24,
  },
  modalBody: {
    background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
    borderRadius: 10, width: '100%', maxWidth: 520, padding: 18,
  },
};
