'use client';
// app/marketing/website/WebsiteManager.tsx
// website-module-v1 P3 — client manager for the Website capability.
// Pages table + page editor drawer (title/status/meta/note) + sections editor
// + settings list + publish action. All writes go through /api/website/*.
import { useMemo, useState } from 'react';

const HAIR = '#E6DFCC'; const INK = '#1B1B1B'; const INK_M = '#5A5A5A'; const INK_F = '#8A8A8A';
const GREEN = '#2E7D32'; const AMBER = '#B8A878'; const RED = '#B8542A'; const BG = '#F4EFE2';
const PREVIEW_GREEN = '#2C4A3E';
const PREVIEW_BASE = '/marketing/website/preview';

export interface WebsitePageRow {
  id: number; property_id: number; slug: string; title: string | null;
  page_kind: string | null; status: string | null; meta: Record<string, unknown> | null;
  room_type_id: number | null; retreat_ref: string | null; nav_order: number | null;
  in_main_nav: boolean | null; note: string | null; updated_at: string | null;
}
export interface WebsiteSectionRow {
  id: number; page_id: number; property_id: number; sort_order: number | null;
  kind: string | null; heading: string | null; body_md: string | null;
  data: Record<string, unknown> | null; updated_at: string | null;
}
export interface WebsiteSettingRow { property_id: number; key: string; value: unknown; updated_at: string | null }
export interface WebsiteArtifactRow { id: number; property_id: number; kind: string; version: number; created_at: string; created_by: string | null }
export interface WebsiteSiteRow {
  property_id: number; domain: string | null; base_url: string | null;
  platform_source: string | null; status: string | null; theme: Record<string, unknown> | null; updated_at: string | null;
}
export interface WebsiteInitialData {
  propertyId: number;
  site: WebsiteSiteRow | null;
  pages: WebsitePageRow[];
  settings: WebsiteSettingRow[];
  artifacts: WebsiteArtifactRow[];
  sectionsByPage: Record<number, number>;
  loadError: string | null;
}

const PAGE_STATUSES = ['inventory', 'draft', 'ready', 'live'] as const;

function statusColor(s: string | null | undefined): string {
  if (s === 'live' || s === 'ready') return GREEN;
  if (s === 'draft') return AMBER;
  if (s === 'inventory') return INK_F;
  return INK_F;
}

function fmtTs(ts: string | null | undefined): string {
  if (!ts) return '—';
  return String(ts).replace('T', ' ').slice(0, 16);
}

const cellStyle: React.CSSProperties = { padding: '8px 10px', fontSize: 12.5, color: INK, borderBottom: `1px solid ${HAIR}`, verticalAlign: 'top' };
const headStyle: React.CSSProperties = { ...cellStyle, color: INK_M, fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.4, background: BG };
const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', fontSize: 13, border: `1px solid ${HAIR}`, borderRadius: 4, color: INK, background: '#FFFFFF', boxSizing: 'border-box' };
const btnStyle: React.CSSProperties = { padding: '7px 14px', fontSize: 12.5, fontWeight: 600, border: `1px solid ${HAIR}`, borderRadius: 4, background: '#FFFFFF', color: INK, cursor: 'pointer' };

export default function WebsiteManager({ initial }: { initial: WebsiteInitialData }) {
  const [pages, setPages] = useState<WebsitePageRow[]>(initial.pages);
  const [settings, setSettings] = useState<WebsiteSettingRow[]>(initial.settings);
  const [artifacts, setArtifacts] = useState<WebsiteArtifactRow[]>(initial.artifacts);
  const [selected, setSelected] = useState<WebsitePageRow | null>(null);
  const [sections, setSections] = useState<WebsiteSectionRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [dTitle, setDTitle] = useState('');
  const [dStatus, setDStatus] = useState('');
  const [dNote, setDNote] = useState('');
  const [dMetaTitle, setDMetaTitle] = useState('');
  const [dMetaDesc, setDMetaDesc] = useState('');

  const lastPublish = useMemo(
    () => artifacts.find((a) => a.kind === 'sitedata') ?? null,
    [artifacts],
  );

  function openEditor(p: WebsitePageRow) {
    setSelected(p);
    setDTitle(p.title ?? '');
    setDStatus(p.status ?? 'inventory');
    setDNote(p.note ?? '');
    const meta = (p.meta ?? {}) as Record<string, unknown>;
    setDMetaTitle(typeof meta.title === 'string' ? meta.title : '');
    setDMetaDesc(typeof meta.description === 'string' ? meta.description : '');
    setSections(null);
    void loadSections(p.id);
  }

  async function loadSections(pageId: number) {
    try {
      const r = await fetch(`/api/website/sections?page_id=${pageId}`, { cache: 'no-store' });
      const j = await r.json();
      setSections(j.ok ? (j.sections as WebsiteSectionRow[]) : []);
    } catch {
      setSections([]);
    }
  }

  async function savePage() {
    if (!selected) return;
    setBusy(true); setMsg(null);
    try {
      const meta = { ...(selected.meta ?? {}), title: dMetaTitle || undefined, description: dMetaDesc || undefined };
      const patch = { title: dTitle, status: dStatus, note: dNote, meta };
      const r = await fetch('/api/website/pages', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: selected.id, patch }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'save failed');
      setPages((prev) => prev.map((p) => p.id === selected.id
        ? { ...p, title: dTitle, status: dStatus, note: dNote, meta, updated_at: j.updated_at ?? p.updated_at }
        : p));
      setMsg({ kind: 'ok', text: `Saved /${selected.slug}` });
      setSelected(null);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'save failed' });
    } finally {
      setBusy(false);
    }
  }

  async function saveSection(s: WebsiteSectionRow, heading: string, body: string) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/website/sections', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: s.id, patch: { heading, body_md: body } }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'section save failed');
      setSections((prev) => (prev ?? []).map((x) => x.id === s.id ? { ...x, heading, body_md: body } : x));
      setMsg({ kind: 'ok', text: 'Section saved' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'section save failed' });
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/website/publish', { method: 'POST' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'publish failed');
      setMsg({
        kind: 'ok',
        text: `Published siteData v${j.version} (${j.pages} pages)` +
          (j.deploy_hook_fired ? ' · deploy hook fired' : ' · no deploy hook configured yet (site repo pending)'),
      });
      setArtifacts((prev) => [
        { id: j.artifact_id, property_id: initial.propertyId, kind: 'sitedata', version: j.version, created_at: new Date().toISOString(), created_by: 'website-editor' },
        ...prev,
      ]);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'publish failed' });
    } finally {
      setBusy(false);
    }
  }

  const summaryTiles: { label: string; value: string; sub?: string }[] = [
    { label: 'Domain', value: initial.site?.domain ?? '—', sub: initial.site?.platform_source ? `source: ${initial.site.platform_source}` : undefined },
    { label: 'Pages', value: String(pages.length), sub: `${pages.filter((p) => p.status === 'live' || p.status === 'ready').length} ready/live` },
    { label: 'Sections seeded', value: String(Object.values(initial.sectionsByPage).reduce((a, b) => a + b, 0)), sub: 'P1 crawl fills content' },
    { label: 'Last siteData', value: lastPublish ? `v${lastPublish.version}` : '—', sub: lastPublish ? fmtTs(lastPublish.created_at) : 'never published' },
  ];

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {initial.loadError && (
        <div style={{ padding: '10px 14px', background: '#FDECEA', border: `1px solid ${RED}`, borderRadius: 4, fontSize: 12.5, color: INK }}>
          Load error: {initial.loadError}
        </div>
      )}

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        {summaryTiles.map((t) => (
          <div key={t.label} style={{ background: '#FFFFFF', border: `1px solid ${HAIR}`, borderRadius: 6, padding: '12px 14px' }}>
            <div style={{ fontSize: 11.5, color: INK_M, textTransform: 'uppercase', letterSpacing: 0.4 }}>{t.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{t.value}</div>
            {t.sub && <div style={{ fontSize: 11.5, color: INK_F, marginTop: 2 }}>{t.sub}</div>}
          </div>
        ))}
        {/* Publish tile */}
        <div style={{ background: '#FFFFFF', border: `1px solid ${HAIR}`, borderRadius: 6, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          <button onClick={publish} disabled={busy} style={{ ...btnStyle, background: '#1F3A2E', color: '#FFFFFF', border: '1px solid #1F3A2E', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Working…' : 'Publish siteData'}
          </button>
          <div style={{ fontSize: 10.5, color: INK_F, lineHeight: 1.4 }}>
            Regenerates siteData from rows, versions it, fires the deploy hook when configured.
          </div>
        </div>
        {/* Preview tile */}
        <div style={{ background: '#FFFFFF', border: `1px solid ${PREVIEW_GREEN}`, borderRadius: 6, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          <a href={PREVIEW_BASE + '/'} target="_blank" rel="noopener noreferrer"
             style={{ ...btnStyle, background: PREVIEW_GREEN, color: '#FFFFFF', border: `1px solid ${PREVIEW_GREEN}`, textDecoration: 'none', textAlign: 'center', display: 'block' }}>
            Preview site →
          </a>
          <div style={{ fontSize: 10.5, color: INK_F, lineHeight: 1.4 }}>
            Opens the full site clone · all {pages.length} pages
          </div>
        </div>
      </div>

      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: 4, fontSize: 12.5, color: INK, background: msg.kind === 'ok' ? '#EAF4EA' : '#FDECEA', border: `1px solid ${msg.kind === 'ok' ? GREEN : RED}` }}>
          {msg.text}
        </div>
      )}

      {/* Pages table */}
      <div style={{ background: '#FFFFFF', border: `1px solid ${HAIR}`, borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${HAIR}`, fontSize: 13.5, fontWeight: 600, color: INK }}>
          Pages <span style={{ color: INK_F, fontWeight: 400 }}>· click to edit · ↗ to preview</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...headStyle, textAlign: 'left' }}>Slug</th>
                <th style={{ ...headStyle, textAlign: 'left' }}>Title</th>
                <th style={{ ...headStyle, textAlign: 'left' }}>Kind</th>
                <th style={{ ...headStyle, textAlign: 'left' }}>Status</th>
                <th style={{ ...headStyle, textAlign: 'right' }}>Sections</th>
                <th style={{ ...headStyle, textAlign: 'left' }}>Updated</th>
                <th style={{ ...headStyle, textAlign: 'center' }}>Preview</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.id} onClick={() => openEditor(p)} style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = BG; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}>
                  <td style={{ ...cellStyle, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{p.slug}</td>
                  <td style={cellStyle}>{p.title ?? <span style={{ color: INK_F }}>—</span>}</td>
                  <td style={cellStyle}>{p.page_kind ?? '—'}</td>
                  <td style={cellStyle}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: statusColor(p.status), display: 'inline-block' }} />
                      {p.status ?? '—'}
                    </span>
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{initial.sectionsByPage[p.id] ?? 0}</td>
                  <td style={{ ...cellStyle, color: INK_M }}>{fmtTs(p.updated_at)}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <a href={PREVIEW_BASE + p.slug} target="_blank" rel="noopener noreferrer"
                       style={{ fontSize: 14, color: PREVIEW_GREEN, textDecoration: 'none', fontWeight: 700 }}
                       title={'Preview ' + p.slug}>↗</a>
                  </td>
                </tr>
              ))}
              {pages.length === 0 && (
                <tr><td style={{ ...cellStyle, color: INK_F }} colSpan={7}>No pages seeded for this property yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings + publish history */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div style={{ background: '#FFFFFF', border: `1px solid ${HAIR}`, borderRadius: 6 }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${HAIR}`, fontSize: 13.5, fontWeight: 600, color: INK }}>Site settings</div>
          <div style={{ padding: '6px 0' }}>
            {settings.map((s) => (
              <div key={s.key} style={{ padding: '7px 14px', display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, borderBottom: `1px solid ${HAIR}` }}>
                <span style={{ color: INK_M, whiteSpace: 'nowrap' }}>{s.key}</span>
                <span style={{ color: INK, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 420 }}>
                  {typeof s.value === 'string' ? s.value : JSON.stringify(s.value)}
                </span>
              </div>
            ))}
            {settings.length === 0 && <div style={{ padding: '10px 14px', fontSize: 12.5, color: INK_F }}>No settings.</div>}
          </div>
        </div>
        <div style={{ background: '#FFFFFF', border: `1px solid ${HAIR}`, borderRadius: 6 }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${HAIR}`, fontSize: 13.5, fontWeight: 600, color: INK }}>Publish history</div>
          <div style={{ padding: '6px 0' }}>
            {artifacts.map((a) => (
              <div key={a.id} style={{ padding: '7px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 12.5, borderBottom: `1px solid ${HAIR}` }}>
                <span style={{ color: INK }}>{a.kind} <strong>v{a.version}</strong></span>
                <span style={{ color: INK_M, fontVariantNumeric: 'tabular-nums' }}>{fmtTs(a.created_at)}</span>
              </div>
            ))}
            {artifacts.length === 0 && <div style={{ padding: '10px 14px', fontSize: 12.5, color: INK_F }}>Never published.</div>}
          </div>
        </div>
      </div>

      {/* Editor drawer */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(27,27,27,0.35)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}
             onClick={() => setSelected(null)}>
          <div style={{ width: 'min(560px, 94vw)', height: '100%', background: '#FFFFFF', borderLeft: `1px solid ${HAIR}`, padding: 20, overflowY: 'auto', boxShadow: '-8px 0 24px rgba(0,0,0,0.12)' }}
               onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>{selected.slug}</div>
                <div style={{ fontSize: 11.5, color: INK_F }}>{selected.page_kind ?? 'page'} · id {selected.id}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a href={PREVIEW_BASE + selected.slug} target="_blank" rel="noopener noreferrer"
                   style={{ ...btnStyle, textDecoration: 'none', color: PREVIEW_GREEN, borderColor: PREVIEW_GREEN, display: 'inline-block' }}>
                  Preview ↗
                </a>
                <button onClick={() => setSelected(null)} style={btnStyle}>Close</button>
              </div>
            </div>

            <label style={{ display: 'block', fontSize: 11.5, color: INK_M, marginBottom: 4 }}>Title</label>
            <input value={dTitle} onChange={(e) => setDTitle(e.target.value)} style={inputStyle} />

            <label style={{ display: 'block', fontSize: 11.5, color: INK_M, margin: '12px 0 4px' }}>Status</label>
            <select value={dStatus} onChange={(e) => setDStatus(e.target.value)} style={inputStyle}>
              {PAGE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              {!PAGE_STATUSES.includes(dStatus as typeof PAGE_STATUSES[number]) && dStatus && <option value={dStatus}>{dStatus}</option>}
            </select>

            <label style={{ display: 'block', fontSize: 11.5, color: INK_M, margin: '12px 0 4px' }}>Meta title (SEO)</label>
            <input value={dMetaTitle} onChange={(e) => setDMetaTitle(e.target.value)} style={inputStyle} placeholder="Carried over 1:1 from the live site by the P1 crawl" />

            <label style={{ display: 'block', fontSize: 11.5, color: INK_M, margin: '12px 0 4px' }}>Meta description (SEO)</label>
            <textarea value={dMetaDesc} onChange={(e) => setDMetaDesc(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />

            <label style={{ display: 'block', fontSize: 11.5, color: INK_M, margin: '12px 0 4px' }}>Internal note</label>
            <textarea value={dNote} onChange={(e) => setDNote(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />

            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button onClick={savePage} disabled={busy} style={{ ...btnStyle, background: '#1F3A2E', color: '#FFFFFF', border: '1px solid #1F3A2E', opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Saving…' : 'Save page'}
              </button>
            </div>

            <div style={{ marginTop: 22, borderTop: `1px solid ${HAIR}`, paddingTop: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: INK, marginBottom: 8 }}>Sections</div>
              {sections === null && <div style={{ fontSize: 12.5, color: INK_F }}>Loading…</div>}
              {sections !== null && sections.length === 0 && (
                <div style={{ fontSize: 12.5, color: INK_F, lineHeight: 1.5 }}>
                  No sections yet — the P1 deep crawl (interactive session) fills copy, styles and media per page.
                </div>
              )}
              {(sections ?? []).map((s) => (
                <SectionEditor key={s.id} section={s} busy={busy} onSave={saveSection} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionEditor({ section, busy, onSave }: {
  section: WebsiteSectionRow; busy: boolean;
  onSave: (s: WebsiteSectionRow, heading: string, body: string) => void | Promise<void>;
}) {
  const [heading, setHeading] = useState(section.heading ?? '');
  const [body, setBody] = useState(section.body_md ?? '');
  const dirty = heading !== (section.heading ?? '') || body !== (section.body_md ?? '');
  return (
    <div style={{ border: `1px solid ${HAIR}`, borderRadius: 6, padding: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: INK_F, marginBottom: 6 }}>#{section.sort_order ?? '—'} · {section.kind ?? 'section'}</div>
      <input value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="Heading" style={inputStyle} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Body (markdown)" style={{ ...inputStyle, marginTop: 8, resize: 'vertical' }} />
      <div style={{ marginTop: 8 }}>
        <button onClick={() => onSave(section, heading, body)} disabled={busy || !dirty} style={{ ...btnStyle, opacity: busy || !dirty ? 0.5 : 1 }}>
          Save section
        </button>
      </div>
    </div>
  );
}
