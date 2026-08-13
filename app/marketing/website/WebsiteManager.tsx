/* eslint-disable @next/next/no-html-link-for-pages */
'use client';
// app/marketing/website/WebsiteManager.tsx
// website-module-v1 P3+CMS-2+CMS-3b+CMS-4 — client manager for the Website capability.
// Pages table + page editor drawer (title/status/meta/note/BLOCKS/versions) + settings + publish + translation + footer menu.
// All writes go through /api/website/*.
import { useMemo, useState } from 'react';
import BlockEditor from './_components/BlockEditor';
import TranslationEditor from './_components/TranslationEditor';

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
export interface WebsitePageVersionRow {
  id: number; page_id: number; property_id: number; version: number;
  snapshot: Record<string, unknown>; sections_snapshot: unknown[];
  created_at: string; created_by: string | null; restore_note: string | null;
}
export interface WebsiteFooterLinkRow {
  id: number; property_id: number; label: string; path: string;
  column_group: string | null; sort_order: number | null;
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
const taStyle: React.CSSProperties = { ...inputStyle, minHeight: 60, fontFamily: 'inherit', resize: 'vertical' };

export default function WebsiteManager({ initial }: { initial: WebsiteInitialData }) {
  const [pages, setPages] = useState<WebsitePageRow[]>(initial.pages);
  const [settings, setSettings] = useState<WebsiteSettingRow[]>(initial.settings);
  const [artifacts, setArtifacts] = useState<WebsiteArtifactRow[]>(initial.artifacts);
  const [selected, setSelected] = useState<WebsitePageRow | null>(null);
  const [translating, setTranslating] = useState<WebsitePageRow | null>(null);
  const [translatingSections, setTranslatingSections] = useState<WebsiteSectionRow[] | null>(null);
  const [sections, setSections] = useState<WebsiteSectionRow[] | null>(null);
  const [versions, setVersions] = useState<WebsitePageVersionRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'meta' | 'blocks' | 'versions'>('meta');

  const [dTitle, setDTitle] = useState('');
  const [dStatus, setDStatus] = useState('');
  const [dNote, setDNote] = useState('');
  const [dMetaTitle, setDMetaTitle] = useState('');
  const [dMetaDesc, setDMetaDesc] = useState('');

  const [footerLinks, setFooterLinks] = useState<WebsiteFooterLinkRow[] | null>(null);
  const [flLabel, setFlLabel] = useState('');
  const [flPath, setFlPath] = useState('');
  const [flGroup, setFlGroup] = useState('Stay');

  const lastPublish = useMemo(
    () => artifacts.find((a) => a.kind === 'sitedata') ?? null,
    [artifacts],
  );

  async function loadSections(pageId: number) {
    try {
      const r = await fetch(`/api/website/sections?page_id=${pageId}`);
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      setSections(j.sections ?? []);
    } catch (e) {
      setMsg({ kind: 'err', text: `Load sections failed: ${e}` });
      setSections([]);
    }
  }

  async function loadVersions(pageId: number) {
    try {
      const r = await fetch(`/api/website/pages/versions?page_id=${pageId}`);
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      setVersions(j.versions ?? []);
    } catch (e) {
      setMsg({ kind: 'err', text: `Load versions failed: ${e}` });
      setVersions([]);
    }
  }

  async function loadFooterLinks() {
    try {
      const r = await fetch('/api/website/footer-links');
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      setFooterLinks(j.links ?? []);
    } catch (e) {
      setMsg({ kind: 'err', text: `Load footer links failed: ${e}` });
      setFooterLinks([]);
    }
  }

  async function upsertFooterLink(body: { id?: number; label: string; path: string; column_group: string | null; sort_order: number | null }) {
    const r = await fetch('/api/website/footer-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${r.status}`);
  }

  async function addFooterLink() {
    if (!flLabel.trim() || !flPath.trim()) {
      setMsg({ kind: 'err', text: 'Footer link needs a label and a path' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const group = flGroup.trim() || 'Links';
      const inGroup = (footerLinks ?? []).filter((l) => (l.column_group ?? '') === group);
      const nextSort = inGroup.reduce((m, l) => Math.max(m, l.sort_order ?? 0), 0) + 1;
      await upsertFooterLink({ label: flLabel.trim(), path: flPath.trim(), column_group: group, sort_order: nextSort });
      setFlLabel('');
      setFlPath('');
      await loadFooterLinks();
      setMsg({ kind: 'ok', text: 'Footer link added' });
    } catch (e) {
      setMsg({ kind: 'err', text: `Add footer link failed: ${e}` });
    } finally {
      setBusy(false);
    }
  }

  async function removeFooterLink(id: number) {
    if (!confirm('Remove this footer link?')) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/website/footer-links?id=${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`${r.status}`);
      await loadFooterLinks();
      setMsg({ kind: 'ok', text: 'Footer link removed' });
    } catch (e) {
      setMsg({ kind: 'err', text: `Remove footer link failed: ${e}` });
    } finally {
      setBusy(false);
    }
  }

  async function moveFooterLink(link: WebsiteFooterLinkRow, dir: -1 | 1) {
    const group = (footerLinks ?? [])
      .filter((l) => (l.column_group ?? '') === (link.column_group ?? ''))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = group.findIndex((l) => l.id === link.id);
    const swapWith = group[idx + dir];
    if (!swapWith) return;
    setBusy(true);
    setMsg(null);
    try {
      const aSort = link.sort_order ?? idx + 1;
      const bSort = swapWith.sort_order ?? idx + dir + 1;
      await upsertFooterLink({ id: link.id, label: link.label, path: link.path, column_group: link.column_group, sort_order: bSort === aSort ? aSort + dir : bSort });
      await upsertFooterLink({ id: swapWith.id, label: swapWith.label, path: swapWith.path, column_group: swapWith.column_group, sort_order: aSort });
      await loadFooterLinks();
    } catch (e) {
      setMsg({ kind: 'err', text: `Reorder failed: ${e}` });
    } finally {
      setBusy(false);
    }
  }

  function openEditor(p: WebsitePageRow) {
    setSelected(p);
    setDTitle(p.title ?? '');
    setDStatus(p.status ?? 'draft');
    setDNote(p.note ?? '');
    setDMetaTitle(String((p.meta as any)?.title ?? ''));
    setDMetaDesc(String((p.meta as any)?.description ?? ''));
    setSections(null);
    setVersions(null);
    setActiveTab('meta');
    void loadSections(p.id);
    void loadVersions(p.id);
  }

  function closeEditor() {
    setSelected(null);
    setSections(null);
    setVersions(null);
    setMsg(null);
  }

  async function openTranslator(p: WebsitePageRow) {
    setTranslating(p);
    setTranslatingSections(null);
    try {
      const r = await fetch(`/api/website/sections?page_id=${p.id}`);
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      setTranslatingSections(j.sections ?? []);
    } catch (e) {
      setMsg({ kind: 'err', text: `Load sections for translation failed: ${e}` });
      setTranslatingSections([]);
    }
  }

  function closeTranslator() {
    setTranslating(null);
    setTranslatingSections(null);
  }

  async function savePage() {
    if (!selected) return;
    setBusy(true);
    setMsg(null);
    const patch: Partial<WebsitePageRow> = { title: dTitle, status: dStatus as any, note: dNote };
    if (dMetaTitle || dMetaDesc) {
      patch.meta = { ...selected.meta, title: dMetaTitle, description: dMetaDesc };
    }
    try {
      const r = await fetch('/api/website/pages/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: selected.id, patch }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      const updated = j.page;
      setPages((prev) => prev.map((p) => (p.id === selected.id ? { ...p, ...patch, updated_at: updated.updated_at } : p)));
      setSelected((p) => (p ? { ...p, ...patch, updated_at: updated.updated_at } : null));
      setMsg({ kind: 'ok', text: 'Page saved' });
    } catch (e) {
      setMsg({ kind: 'err', text: `Save failed: ${e}` });
    } finally {
      setBusy(false);
    }
  }

  async function createVersion() {
    if (!selected) return;
    if (!confirm('Create a new version snapshot of this page?')) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/website/pages/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: selected.id }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      setMsg({ kind: 'ok', text: `Version ${j.version.version} created` });
      await loadVersions(selected.id);
    } catch (e) {
      setMsg({ kind: 'err', text: `Version create failed: ${e}` });
    } finally {
      setBusy(false);
    }
  }

  async function restoreVersion(versionId: number, versionNum: number) {
    if (!selected) return;
    if (!confirm(`Restore page to version ${versionNum}? This will overwrite current page and sections.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/website/pages/versions/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: versionId }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      setMsg({ kind: 'ok', text: `Restored to version ${versionNum}` });
      await loadSections(selected.id);
      await loadVersions(selected.id);
    } catch (e) {
      setMsg({ kind: 'err', text: `Restore failed: ${e}` });
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!confirm('Publish the current site content? This will create a new versioned sitedata artifact.')) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/website/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: initial.propertyId }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      setArtifacts([...artifacts, j.artifact]);
      setMsg({ kind: 'ok', text: `Published sitedata v${j.artifact.version}` });
    } catch (e) {
      setMsg({ kind: 'err', text: `Publish failed: ${e}` });
    } finally {
      setBusy(false);
    }
  }

  const sectionsCount = useMemo(() => {
    const c: Record<number, number> = {};
    pages.forEach((p) => { c[p.id] = initial.sectionsByPage[p.id] ?? 0; });
    return c;
  }, [pages, initial.sectionsByPage]);

  const sortedFooterLinks = useMemo(() => {
    if (!footerLinks) return [];
    return [...footerLinks].sort((a, b) => {
      const g = (a.column_group ?? '').localeCompare(b.column_group ?? '');
      if (g !== 0) return g;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [footerLinks]);

  return (
    <div style={{ padding: 20, color: INK, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: INK }}>Website</h2>
          <div style={{ fontSize: 12.5, color: INK_M, marginTop: 4 }}>
            {initial.site?.domain ?? 'thenamkhan.com'} · {pages.length} pages · {Object.values(sectionsCount).reduce((s, n) => s + n, 0)} sections
            {lastPublish && <> · siteData v{lastPublish.version} {fmtTs(lastPublish.created_at)}</>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href={PREVIEW_BASE} target="_blank" rel="noopener" style={{ ...btnStyle, background: PREVIEW_GREEN, color: '#FFFFFF', borderColor: PREVIEW_GREEN, textDecoration: 'none', display: 'inline-block' }}>
            Preview Site
          </a>
          <button onClick={publish} disabled={busy} style={{ ...btnStyle, background: GREEN, color: '#FFFFFF', borderColor: GREEN }}>
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: 10, marginBottom: 15, fontSize: 13, borderRadius: 4, background: msg.kind === 'ok' ? '#E8F5E9' : '#FFEBEE', color: msg.kind === 'ok' ? GREEN : RED }}>
          {msg.text}
        </div>
      )}

      {initial.loadError && (
        <div style={{ padding: 10, marginBottom: 15, fontSize: 13, borderRadius: 4, background: '#FFEBEE', color: RED }}>
          {initial.loadError}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 30 }}>
        <thead>
          <tr>
            <th style={headStyle}>Slug</th>
            <th style={headStyle}>Title</th>
            <th style={headStyle}>Kind</th>
            <th style={headStyle}>Status</th>
            <th style={headStyle}>Blocks</th>
            <th style={headStyle}>Updated</th>
            <th style={headStyle}></th>
          </tr>
        </thead>
        <tbody>
          {pages.map((p) => (
            <tr key={p.id} style={{ background: '#FFFFFF' }}>
              <td style={cellStyle}>
                <code style={{ fontSize: 11.5, color: INK }}>{p.slug}</code>
              </td>
              <td style={cellStyle}>{p.title ?? '—'}</td>
              <td style={cellStyle}>{p.page_kind ?? '—'}</td>
              <td style={cellStyle}>
                <span style={{ color: statusColor(p.status), fontWeight: 600, fontSize: 11.5 }}>
                  {p.status?.toUpperCase() ?? 'DRAFT'}
                </span>
              </td>
              <td style={cellStyle}>{sectionsCount[p.id] ?? 0}</td>
              <td style={cellStyle}>{fmtTs(p.updated_at)}</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>
                <button onClick={() => openEditor(p)} style={{ ...btnStyle, fontSize: 11.5, padding: '4px 10px' }}>
                  Edit
                </button>
                <button onClick={() => openTranslator(p)} style={{ ...btnStyle, fontSize: 11.5, padding: '4px 10px', marginLeft: 6 }}>
                  Translate
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <details style={{ marginBottom: 30 }}>
        <summary style={{ fontSize: 14, fontWeight: 600, color: INK_M, cursor: 'pointer', marginBottom: 10 }}>
          Settings ({settings.length})
        </summary>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={headStyle}>Key</th>
              <th style={headStyle}>Value</th>
              <th style={headStyle}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((s, i) => (
              <tr key={i} style={{ background: '#FFFFFF' }}>
                <td style={cellStyle}>
                  <code style={{ fontSize: 11.5 }}>{s.key}</code>
                </td>
                <td style={cellStyle}>
                  <code style={{ fontSize: 11.5, wordBreak: 'break-all' }}>{JSON.stringify(s.value)}</code>
                </td>
                <td style={cellStyle}>{fmtTs(s.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <details
        style={{ marginBottom: 30 }}
        onToggle={(e) => {
          if ((e.target as HTMLDetailsElement).open && footerLinks === null) void loadFooterLinks();
        }}
      >
        <summary style={{ fontSize: 14, fontWeight: 600, color: INK_M, cursor: 'pointer', marginBottom: 10 }}>
          Footer Menu {footerLinks !== null ? `(${footerLinks.length})` : ''}
        </summary>
        {footerLinks === null ? (
          <div style={{ fontSize: 13, color: INK_M }}>Loading footer links…</div>
        ) : (
          <div>
            {footerLinks.length === 0 && (
              <div style={{ fontSize: 13, color: INK_M, marginBottom: 12 }}>
                No footer links yet — the live footer falls back to the built-in defaults. Add links to take over the footer columns.
              </div>
            )}
            {footerLinks.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th style={headStyle}>Column</th>
                    <th style={headStyle}>Label</th>
                    <th style={headStyle}>Path</th>
                    <th style={headStyle}>Order</th>
                    <th style={headStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFooterLinks.map((l) => (
                    <tr key={l.id} style={{ background: '#FFFFFF' }}>
                      <td style={cellStyle}>{l.column_group ?? '—'}</td>
                      <td style={cellStyle}>{l.label}</td>
                      <td style={cellStyle}>
                        <code style={{ fontSize: 11.5 }}>{l.path}</code>
                      </td>
                      <td style={cellStyle}>{l.sort_order ?? '—'}</td>
                      <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => moveFooterLink(l, -1)} disabled={busy} title="Move up" style={{ ...btnStyle, fontSize: 11.5, padding: '3px 8px' }}>
                          ↑
                        </button>
                        <button onClick={() => moveFooterLink(l, 1)} disabled={busy} title="Move down" style={{ ...btnStyle, fontSize: 11.5, padding: '3px 8px', marginLeft: 4 }}>
                          ↓
                        </button>
                        <button onClick={() => removeFooterLink(l.id)} disabled={busy} style={{ ...btnStyle, fontSize: 11.5, padding: '3px 8px', marginLeft: 4, color: RED }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', maxWidth: 760 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 4 }}>Column</label>
                <input type="text" value={flGroup} onChange={(e) => setFlGroup(e.target.value)} placeholder="Stay / Wellness / Discover / Info" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 4 }}>Label</label>
                <input type="text" value={flLabel} onChange={(e) => setFlLabel(e.target.value)} placeholder="Accommodation" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 4 }}>Path</label>
                <input type="text" value={flPath} onChange={(e) => setFlPath(e.target.value)} placeholder="/accommodation" style={inputStyle} />
              </div>
              <button onClick={addFooterLink} disabled={busy} style={{ ...btnStyle, background: GREEN, color: '#FFFFFF', borderColor: GREEN, whiteSpace: 'nowrap' }}>
                Add Link
              </button>
            </div>
          </div>
        )}
      </details>

      <details>
        <summary style={{ fontSize: 14, fontWeight: 600, color: INK_M, cursor: 'pointer', marginBottom: 10 }}>
          Publish History ({artifacts.filter((a) => a.kind === 'sitedata').length})
        </summary>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={headStyle}>Version</th>
              <th style={headStyle}>Kind</th>
              <th style={headStyle}>Created</th>
              <th style={headStyle}>By</th>
            </tr>
          </thead>
          <tbody>
            {artifacts
              .filter((a) => a.kind === 'sitedata')
              .sort((a, b) => b.version - a.version)
              .map((a) => (
                <tr key={a.id} style={{ background: '#FFFFFF' }}>
                  <td style={cellStyle}>{a.version}</td>
                  <td style={cellStyle}>
                    <code style={{ fontSize: 11.5 }}>{a.kind}</code>
                  </td>
                  <td style={cellStyle}>{fmtTs(a.created_at)}</td>
                  <td style={cellStyle}>{a.created_by ?? '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>

      {selected && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: '70%', maxWidth: 900, height: '100%', background: '#FFFFFF', boxShadow: '-2px 0 10px rgba(0,0,0,0.2)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: `2px solid ${HAIR}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: BG }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: INK }}>
                <code>{selected.slug}</code>
              </h3>
            </div>
            <button onClick={closeEditor} style={{ ...btnStyle, fontSize: 13, padding: '5px 12px' }}>
              Close
            </button>
          </div>

          {msg && (
            <div style={{ padding: 10, margin: 16, marginBottom: 0, fontSize: 13, borderRadius: 4, background: msg.kind === 'ok' ? '#E8F5E9' : '#FFEBEE', color: msg.kind === 'ok' ? GREEN : RED }}>
              {msg.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${HAIR}`, padding: '0 16px' }}>
            {(['meta', 'blocks', 'versions'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 16px', fontSize: 12.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: activeTab === tab ? GREEN : INK_M,
                  borderBottom: activeTab === tab ? `2px solid ${GREEN}` : '2px solid transparent',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {activeTab === 'meta' && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 4 }}>Title</label>
                  <input type="text" value={dTitle} onChange={(e) => setDTitle(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 4 }}>Status</label>
                  <select value={dStatus} onChange={(e) => setDStatus(e.target.value)} style={inputStyle}>
                    {PAGE_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 4 }}>Note (internal)</label>
                  <textarea value={dNote} onChange={(e) => setDNote(e.target.value)} style={taStyle} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 4 }}>Meta Title (SEO)</label>
                  <input type="text" value={dMetaTitle} onChange={(e) => setDMetaTitle(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 4 }}>Meta Description (SEO)</label>
                  <textarea value={dMetaDesc} onChange={(e) => setDMetaDesc(e.target.value)} style={taStyle} />
                </div>
                <button onClick={savePage} disabled={busy} style={{ ...btnStyle, background: GREEN, color: '#FFFFFF', borderColor: GREEN }}>
                  {busy ? 'Saving…' : 'Save Page'}
                </button>
              </div>
            )}

            {activeTab === 'blocks' && (
              <div>
                {sections === null ? (
                  <div style={{ fontSize: 13, color: INK_M }}>Loading sections…</div>
                ) : sections.length === 0 ? (
                  <div style={{ fontSize: 13, color: INK_M }}>No sections yet.</div>
                ) : (
                  <BlockEditor
                    pageId={selected.id}
                    propertyId={selected.property_id}
                    blocks={sections}
                    onBlocksChange={(updated) => {
                      setSections(updated);
                      setPages((prev) =>
                        prev.map((p) => (p.id === selected.id ? { ...p, updated_at: new Date().toISOString() } : p))
                      );
                    }}
                    onMessage={setMsg}
                  />
                )}
              </div>
            )}

            {activeTab === 'versions' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: INK }}>
                    Version History ({versions?.length ?? 0})
                  </h4>
                  <button onClick={createVersion} disabled={busy} style={btnStyle}>
                    Create Snapshot
                  </button>
                </div>
                {versions === null ? (
                  <div style={{ fontSize: 13, color: INK_M }}>Loading versions…</div>
                ) : versions.length === 0 ? (
                  <div style={{ fontSize: 13, color: INK_M }}>No versions yet.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr>
                        <th style={headStyle}>V</th>
                        <th style={headStyle}>Created</th>
                        <th style={headStyle}>By</th>
                        <th style={headStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((v) => (
                        <tr key={v.id} style={{ background: '#FFFFFF' }}>
                          <td style={cellStyle}>{v.version}</td>
                          <td style={cellStyle}>{fmtTs(v.created_at)}</td>
                          <td style={cellStyle}>{v.created_by ?? '—'}</td>
                          <td style={{ ...cellStyle, textAlign: 'right' }}>
                            <button
                              onClick={() => restoreVersion(v.id, v.version)}
                              disabled={busy}
                              style={{ ...btnStyle, fontSize: 11.5, padding: '3px 8px' }}
                            >
                              Restore
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {selected && <div onClick={closeEditor} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 999 }} />}

      {translating && translatingSections && (
        <TranslationEditor
          propertyId={initial.propertyId}
          page={translating}
          sections={translatingSections}
          locale="lo"
          onClose={closeTranslator}
          onSaved={() => {
            setMsg({ kind: 'ok', text: 'Translation saved. Run Publish to update sitedata.json.' });
          }}
        />
      )}
    </div>
  );
}
