'use client';
// app/h/[property_id]/finance/legal/docs/_components/SettingsDrawerButton.tsx
// Gear button mounted in Container's `action` slot (directly left of the
// expand-to-fullscreen toggle). Opens a right-side drawer with 6 tabs to
// manage the master vocabulary of the document register:
//
//   Families     — distinct doc_type values currently in use + bulk rename.
//                  Adding a new family without a doc to assign isn't
//                  meaningful; surface as a hint.
//   Subtypes     — full CRUD against dms.doc_subtype_vocab (per-family slug
//                  + label + time_model + active flag).
//   Matters      — distinct project values; rename via fn_doc_project_rename.
//                  Note: matter = COALESCE(case_ref, project) (ADR-145).
//   Cases        — legal.cases for this property; upsert via fn_doc_case_upsert.
//   Collections  — dms.collections for this property; upsert / delete RPCs.
//   Tags         — distinct tags across documents; rename (merges across docs)
//                  + delete (removes from every doc). RPCs live globally.

import { useEffect, useMemo, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface VocabRow   { doc_type: string; subtype_slug: string; label: string | null; time_model: string | null; active?: boolean; sort_order?: number | null }
interface CaseRow    { case_ref: string; title: string | null; matter_type: string | null; status: string | null }
interface CollRow    { name: string; description: string | null; is_smart?: boolean }
interface FamilyRow  { doc_type: string; n: number }
interface ProjectRow { project: string; n: number }
interface TagRow     { tag: string; n: number }
interface AuthorRow  { author: string; n: number }

interface Props {
  propertyId: number;
  families:    FamilyRow[];
  subtypeVocab: VocabRow[];
  projects:    ProjectRow[];
  cases:       CaseRow[];
  collections: CollRow[];
  tags:        TagRow[];
  authors:     AuthorRow[];
}

const INK      = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const HAIRLINE = '#E0E0E0';
const PAPER    = '#FFFFFF';

const TABS = ['Families', 'Subtypes', 'Matters', 'Cases', 'Collections', 'Tags', 'Authors'] as const;
type Tab = typeof TABS[number];

export default function SettingsDrawerButton(props: Props) {
  // Render is identical; props pass through to Drawer.
  const [open, setOpen]   = useState(false);
  const [mounted, setM]   = useState(false);
  useEffect(() => setM(true), []);

  return (
    <>
      <button
        type="button"
        aria-label="Document register settings"
        title="Document register settings"
        onClick={() => setOpen(true)}
        style={gearStyle}
      >
        {/* Inline SVG gear so it inherits currentColor without an icon library. */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      {mounted && open && createPortal(<Drawer {...props} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Drawer({ propertyId, families, subtypeVocab, projects, cases, collections, tags, authors, onClose }:
  Props & { onClose: () => void }) {
  const [tab, setTab]     = useState<Tab>('Families');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Esc to close — small QoL.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  async function rpc(name: string, args: Record<string, unknown>): Promise<boolean> {
    setError(null);
    const { error: e } = await supabase.rpc(name, args);
    if (e) { setError(`${name}: ${e.message}`); return false; }
    startTransition(() => router.refresh());
    return true;
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Document register settings" style={overlay} onClick={onClose}>
      <aside style={panel} onClick={(e) => e.stopPropagation()}>
        <header style={panelHeader}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: INK }}>Document register · settings</h2>
          <button aria-label="Close" onClick={onClose} style={closeBtn}>✕</button>
        </header>

        <nav style={tabBar}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>{t}</button>
          ))}
        </nav>

        {error && (
          <div style={{ background: '#FBEAEA', color: '#C62828', padding: '6px 10px',
            border: '1px solid #C62828', borderRadius: 3, margin: '8px 16px', fontSize: 11 }}>
            {error}
          </div>
        )}

        <section style={panelBody}>
          {tab === 'Families'    && <FamiliesTab    propertyId={propertyId} families={families} rpc={rpc} />}
          {tab === 'Subtypes'    && <SubtypesTab    propertyId={propertyId} families={families} vocab={subtypeVocab} rpc={rpc} />}
          {tab === 'Matters'     && <MattersTab     propertyId={propertyId} projects={projects} rpc={rpc} />}
          {tab === 'Cases'       && <CasesTab       propertyId={propertyId} cases={cases} rpc={rpc} />}
          {tab === 'Collections' && <CollectionsTab propertyId={propertyId} collections={collections} rpc={rpc} />}
          {tab === 'Tags'        && <TagsTab        propertyId={propertyId} tags={tags} rpc={rpc} />}
          {tab === 'Authors'     && <AuthorsTab     propertyId={propertyId} authors={authors} rpc={rpc} />}
          {pending && <div style={{ color: INK_SOFT, fontSize: 11, padding: 8 }}>refreshing…</div>}
        </section>
      </aside>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────

function FamiliesTab({ propertyId, families, rpc }:
  { propertyId: number; families: FamilyRow[]; rpc: (n: string, a: Record<string, unknown>) => Promise<boolean> }) {
  return (
    <>
      <Hint>
        Families are free-text on every doc (no master enum). Adding a family without a doc to
        assign is a no-op — to introduce a new family, set it on any row via Edit. Rename here
        bulk-updates every doc in the family at once.
      </Hint>
      <Table cols={['Family', 'Docs', 'Rename to', '']}>
        {families.length === 0 && <EmptyRow cols={4} />}
        {families.map((f) => (
          <RenameRow
            key={f.doc_type} value={f.doc_type} count={f.n} colsCount={4}
            onRename={(next) => rpc('fn_doc_family_rename', { p_property_id: propertyId, p_old: f.doc_type, p_new: next })}
          />
        ))}
      </Table>
    </>
  );
}

function SubtypesTab({ propertyId, families, vocab, rpc }:
  { propertyId: number; families: FamilyRow[]; vocab: VocabRow[]; rpc: (n: string, a: Record<string, unknown>) => Promise<boolean> }) {
  const familyOpts = useMemo(() => Array.from(new Set([...families.map((f) => f.doc_type), ...vocab.map((v) => v.doc_type)])).sort(), [families, vocab]);
  const [filter, setFilter] = useState<string>(familyOpts[0] ?? '');
  const filtered = useMemo(() => vocab.filter((v) => !filter || v.doc_type === filter), [vocab, filter]);
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <label style={lblStyle}>Filter by family</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={selStyle}>
          <option value="">— all —</option>
          {familyOpts.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <AddSubtypeForm familyOpts={familyOpts} defaultFamily={filter}
        onAdd={(args) => rpc('fn_doc_vocab_upsert', args)} />
      <Table cols={['Family', 'Slug', 'Label', 'Time', 'Active', '']}>
        {filtered.length === 0 && <EmptyRow cols={6} />}
        {filtered.map((v) => (
          <tr key={v.doc_type + '·' + v.subtype_slug} style={trStyle}>
            <td style={tdStyle}>{v.doc_type}</td>
            <td style={tdStyle}><code>{v.subtype_slug}</code></td>
            <td style={tdStyle}>
              <InlineEdit value={v.label ?? ''} placeholder="label"
                onCommit={(next) => rpc('fn_doc_vocab_upsert', {
                  p_doc_type: v.doc_type, p_subtype_slug: v.subtype_slug,
                  p_label: next, p_time_model: v.time_model ?? 'N', p_sort_order: v.sort_order ?? 100,
                })} />
            </td>
            <td style={tdStyle}>
              <select defaultValue={v.time_model ?? 'N'}
                onChange={(e) => rpc('fn_doc_vocab_upsert', {
                  p_doc_type: v.doc_type, p_subtype_slug: v.subtype_slug,
                  p_label: v.label ?? v.subtype_slug, p_time_model: e.target.value,
                  p_sort_order: v.sort_order ?? 100,
                })} style={selStyle}>
                <option value="A">A · expiry</option>
                <option value="B">B · review</option>
                <option value="C">C · period</option>
                <option value="N">N · none</option>
              </select>
            </td>
            <td style={tdStyle}>
              <input type="checkbox" defaultChecked={v.active !== false}
                onChange={(e) => rpc('fn_doc_vocab_set_active', {
                  p_doc_type: v.doc_type, p_subtype_slug: v.subtype_slug, p_active: e.target.checked,
                })} />
            </td>
            <td style={tdStyle}>—</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function MattersTab({ propertyId, projects, rpc }:
  { propertyId: number; projects: ProjectRow[]; rpc: (n: string, a: Record<string, unknown>) => Promise<boolean> }) {
  return (
    <>
      <Hint>
        Matter = case_ref (if linked) ELSE project. This tab manages the <em>project</em> side —
        for the case side, switch to the Cases tab. Projects with 0 docs are vocab-only entries
        seeded here; they show up in the Matter editor dropdown immediately so you can pre-create
        a project before assigning docs.
      </Hint>
      <AddRowForm placeholder="New project name"
        onAdd={(v) => rpc('fn_doc_project_seed', { p_property_id: propertyId, p_project: v, p_description: null })} />
      <Table cols={['Project', 'Docs', 'Rename to', '']}>
        {projects.length === 0 && <EmptyRow cols={4} />}
        {projects.map((p) => (
          <tr key={p.project} style={trStyle}>
            <td style={tdStyle}>{p.project}</td>
            <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: p.n === 0 ? INK_SOFT : INK }}>
              {p.n}
            </td>
            <td style={tdStyle}>
              <InlineEdit value="" placeholder={`rename "${p.project}"`} commitOnEnter
                onCommit={(next) => rpc('fn_doc_project_rename', { p_property_id: propertyId, p_old: p.project, p_new: next })} />
            </td>
            <td style={tdStyle}>
              <button onClick={() => {
                if (!window.confirm(`Delete project "${p.project}"? Refuses if any document is still using it.`)) return;
                rpc('fn_doc_project_delete', { p_property_id: propertyId, p_project: p.project });
              }} style={delBtn}>Delete</button>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function CasesTab({ propertyId, cases, rpc }:
  { propertyId: number; cases: CaseRow[]; rpc: (n: string, a: Record<string, unknown>) => Promise<boolean> }) {
  return (
    <>
      <AddCaseForm onAdd={(args) => rpc('fn_doc_case_upsert', { p_property_id: propertyId, ...args })} />
      <Table cols={['Case ref', 'Title', 'Type', 'Status', '']}>
        {cases.length === 0 && <EmptyRow cols={5} />}
        {cases.map((c) => (
          <tr key={c.case_ref} style={trStyle}>
            <td style={tdStyle}><code>{c.case_ref}</code></td>
            <td style={tdStyle}>
              <InlineEdit value={c.title ?? ''} placeholder="title"
                onCommit={(next) => rpc('fn_doc_case_upsert', { p_property_id: propertyId,
                  p_case_ref: c.case_ref, p_title: next })} />
            </td>
            <td style={tdStyle}>
              <InlineEdit value={c.matter_type ?? ''} placeholder="matter_type"
                onCommit={(next) => rpc('fn_doc_case_upsert', { p_property_id: propertyId,
                  p_case_ref: c.case_ref, p_title: c.title ?? c.case_ref, p_matter_type: next })} />
            </td>
            <td style={tdStyle}>
              <select defaultValue={c.status ?? 'active'}
                onChange={(e) => rpc('fn_doc_case_upsert', { p_property_id: propertyId,
                  p_case_ref: c.case_ref, p_title: c.title ?? c.case_ref, p_status: e.target.value })}
                style={selStyle}>
                {['active', 'closed', 'on_hold', 'settled', 'archived'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </td>
            <td style={tdStyle}>—</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function CollectionsTab({ propertyId, collections, rpc }:
  { propertyId: number; collections: CollRow[]; rpc: (n: string, a: Record<string, unknown>) => Promise<boolean> }) {
  return (
    <>
      <AddCollectionForm onAdd={(args) => rpc('fn_doc_collection_upsert', { p_property_id: propertyId, ...args })} />
      <Table cols={['Name', 'Description', '']}>
        {collections.length === 0 && <EmptyRow cols={3} />}
        {collections.map((c) => (
          <tr key={c.name} style={trStyle}>
            <td style={tdStyle}>{c.name}</td>
            <td style={tdStyle}>
              <InlineEdit value={c.description ?? ''} placeholder="description"
                onCommit={(next) => rpc('fn_doc_collection_upsert', { p_property_id: propertyId, p_name: c.name, p_description: next })} />
            </td>
            <td style={tdStyle}>
              <button onClick={() => {
                if (!window.confirm(`Delete collection "${c.name}"? Refuses if any document is still linked.`)) return;
                rpc('fn_doc_collection_delete', { p_property_id: propertyId, p_name: c.name });
              }} style={delBtn}>Delete</button>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function TagsTab({ propertyId, tags, rpc }:
  { propertyId: number; tags: TagRow[]; rpc: (n: string, a: Record<string, unknown>) => Promise<boolean> }) {
  return (
    <>
      <Hint>
        Tags live as <code>text[]</code> on every doc — adding one requires choosing a row.
        Rename here merges every doc that carries the old tag into the new one. Delete removes
        the tag from every doc on this property.
      </Hint>
      <Table cols={['Tag', 'Docs', 'Rename to', '']}>
        {tags.length === 0 && <EmptyRow cols={4} />}
        {tags.map((t) => (
          <tr key={t.tag} style={trStyle}>
            <td style={tdStyle}>{t.tag}</td>
            <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.n}</td>
            <td style={tdStyle}>
              <InlineEdit value="" placeholder={`rename "${t.tag}"`} commitOnEnter
                onCommit={(next) => rpc('fn_doc_tag_rename', { p_property_id: propertyId, p_old: t.tag, p_new: next })} />
            </td>
            <td style={tdStyle}>
              <button onClick={() => {
                if (!window.confirm(`Delete tag "${t.tag}" from every doc?`)) return;
                rpc('fn_doc_tag_delete', { p_property_id: propertyId, p_tag: t.tag });
              }} style={delBtn}>Delete</button>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function AuthorsTab({ propertyId, authors, rpc }:
  { propertyId: number; authors: AuthorRow[]; rpc: (n: string, a: Record<string, unknown>) => Promise<boolean> }) {
  return (
    <>
      <Hint>
        Authors = who issued / authored the doc (person, company, ministry, department, …).
        Adding an author here makes it appear immediately in the Author column's autocomplete,
        even before any doc references it. Rename merges every doc that carries the old name
        into the new one. Delete refuses if any doc still uses the author.
      </Hint>
      <AddRowForm placeholder="New author / company / ministry"
        onAdd={(v) => rpc('fn_doc_author_seed', { p_property_id: propertyId, p_author: v, p_kind: null, p_description: null })} />
      <Table cols={['Author', 'Docs', 'Rename to', '']}>
        {authors.length === 0 && <EmptyRow cols={4} />}
        {authors.map((a) => (
          <tr key={a.author} style={trStyle}>
            <td style={tdStyle}>{a.author}</td>
            <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: a.n === 0 ? INK_SOFT : INK }}>
              {a.n}
            </td>
            <td style={tdStyle}>
              <InlineEdit value="" placeholder={`rename "${a.author}"`} commitOnEnter
                onCommit={(next) => rpc('fn_doc_author_rename', { p_property_id: propertyId, p_old: a.author, p_new: next })} />
            </td>
            <td style={tdStyle}>
              <button onClick={() => {
                if (!window.confirm(`Delete author "${a.author}"? Refuses if any document is still using it.`)) return;
                rpc('fn_doc_author_delete', { p_property_id: propertyId, p_author: a.author });
              }} style={delBtn}>Delete</button>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

// ─── Small primitives ─────────────────────────────────────────────────────

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, color: INK_SOFT, margin: '0 0 8px 0', lineHeight: 1.4 }}>{children}</p>
  );
}

function Table({ cols, children }: { cols: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${HAIRLINE}`, borderRadius: 3 }}>
      <table className="data-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 11, background: PAPER }}>
        <thead><tr>
          {cols.map((c, i) => (
            <th key={c + i} style={{
              padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase', color: INK,
              background: PAPER, borderBottom: '2px solid #000', whiteSpace: 'nowrap',
            }}>{c}</th>
          ))}
        </tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} style={{ ...tdStyle, color: INK_SOFT, fontStyle: 'italic', textAlign: 'center' }}>No rows yet.</td></tr>;
}

function RenameRow({ value, count, onRename }:
  { value: string; count: number; colsCount: number; onRename: (next: string) => Promise<boolean> }) {
  return (
    <tr style={trStyle}>
      <td style={tdStyle}>{value}</td>
      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{count}</td>
      <td style={tdStyle}>
        <InlineEdit value="" placeholder={`rename "${value}"`} commitOnEnter
          onCommit={(next) => onRename(next)} />
      </td>
      <td style={tdStyle}>—</td>
    </tr>
  );
}

function InlineEdit({ value, placeholder, onCommit, commitOnEnter = false }:
  { value: string; placeholder?: string; onCommit: (next: string) => Promise<boolean>; commitOnEnter?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  async function commit() {
    const next = v.trim();
    if (!next || next === value) return;
    const ok = await onCommit(next);
    if (ok && commitOnEnter) setV('');
  }
  return (
    <input
      type="text"
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={commitOnEnter ? undefined : commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); commit(); } }}
      style={inputStyle}
    />
  );
}

function AddRowForm({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => Promise<boolean> }) {
  const [v, setV] = useState('');
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (!v.trim()) return; const ok = await onAdd(v.trim()); if (ok) setV(''); }}
      style={addFormRow}>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, flex: 1 }} />
      <button type="submit" style={addBtn}>+ Add</button>
    </form>
  );
}

function AddSubtypeForm({ familyOpts, defaultFamily, onAdd }:
  { familyOpts: string[]; defaultFamily: string; onAdd: (args: { p_doc_type: string; p_subtype_slug: string; p_label: string; p_time_model: string; p_sort_order: number }) => Promise<boolean> }) {
  const [family, setFamily] = useState(defaultFamily);
  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [tm, setTm] = useState('N');
  useEffect(() => setFamily(defaultFamily), [defaultFamily]);
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (!family || !slug.trim() || !label.trim()) return;
      const ok = await onAdd({ p_doc_type: family, p_subtype_slug: slug.trim().toLowerCase().replace(/\s+/g, '_'),
                               p_label: label.trim(), p_time_model: tm, p_sort_order: 100 });
      if (ok) { setSlug(''); setLabel(''); }
    }} style={addFormRow}>
      <select value={family} onChange={(e) => setFamily(e.target.value)} style={selStyle}>
        <option value="">(family)</option>
        {familyOpts.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug" style={{ ...inputStyle, width: 120 }} />
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" style={{ ...inputStyle, flex: 1 }} />
      <select value={tm} onChange={(e) => setTm(e.target.value)} style={selStyle}>
        <option value="A">A · expiry</option>
        <option value="B">B · review</option>
        <option value="C">C · period</option>
        <option value="N">N · none</option>
      </select>
      <button type="submit" style={addBtn}>+ Add subtype</button>
    </form>
  );
}

function AddCaseForm({ onAdd }: { onAdd: (args: { p_case_ref: string; p_title: string; p_matter_type: string; p_status: string }) => Promise<boolean> }) {
  const [ref, setRef] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('active');
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (!ref.trim()) return;
      const ok = await onAdd({ p_case_ref: ref.trim(), p_title: title.trim() || ref.trim(), p_matter_type: type.trim(), p_status: status });
      if (ok) { setRef(''); setTitle(''); setType(''); }
    }} style={addFormRow}>
      <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="case_ref (e.g. Khoa)" style={{ ...inputStyle, width: 150 }} />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="title" style={{ ...inputStyle, flex: 1 }} />
      <input value={type} onChange={(e) => setType(e.target.value)} placeholder="matter_type" style={{ ...inputStyle, width: 140 }} />
      <select value={status} onChange={(e) => setStatus(e.target.value)} style={selStyle}>
        {['active', 'closed', 'on_hold', 'settled', 'archived'].map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button type="submit" style={addBtn}>+ Add case</button>
    </form>
  );
}

function AddCollectionForm({ onAdd }: { onAdd: (args: { p_name: string; p_description: string }) => Promise<boolean> }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (!name.trim()) return;
      const ok = await onAdd({ p_name: name.trim(), p_description: desc.trim() });
      if (ok) { setName(''); setDesc(''); }
    }} style={addFormRow}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="collection name" style={{ ...inputStyle, width: 200 }} />
      <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="description (optional)" style={{ ...inputStyle, flex: 1 }} />
      <button type="submit" style={addBtn}>+ Add collection</button>
    </form>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────

const gearStyle: React.CSSProperties = {
  appearance: 'none', background: 'transparent', border: 'none',
  cursor: 'pointer', padding: 4, color: INK, lineHeight: 0,
};
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)',
  display: 'flex', justifyContent: 'flex-end', zIndex: 1000,
};
const panel: React.CSSProperties = {
  width: 'min(720px, 96vw)', height: '100vh', background: PAPER,
  display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
};
const panelHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '12px 16px', borderBottom: `1px solid ${HAIRLINE}`,
};
const closeBtn: React.CSSProperties = {
  appearance: 'none', background: 'transparent', border: 'none',
  color: INK, fontSize: 16, cursor: 'pointer',
};
const tabBar: React.CSSProperties = {
  display: 'flex', gap: 4, padding: '8px 16px 0 16px',
  borderBottom: `1px solid ${HAIRLINE}`,
};
function tabBtn(active: boolean): React.CSSProperties {
  return {
    appearance: 'none', background: PAPER,
    border: `1px solid ${active ? INK : HAIRLINE}`,
    borderBottom: active ? `2px solid ${INK}` : `1px solid ${HAIRLINE}`,
    color: INK, fontWeight: active ? 700 : 500,
    padding: '6px 12px', fontSize: 11, cursor: 'pointer', borderRadius: 3,
  };
}
const panelBody: React.CSSProperties = { padding: 16, overflowY: 'auto', flex: 1 };
const addFormRow: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 };
const inputStyle: React.CSSProperties = {
  padding: '4px 8px', border: `1px solid ${HAIRLINE}`, borderRadius: 3,
  fontSize: 11, color: INK, background: PAPER,
};
const selStyle: React.CSSProperties = { ...inputStyle, padding: '4px 6px' };
const lblStyle: React.CSSProperties = { fontSize: 11, color: INK_SOFT };
const addBtn: React.CSSProperties = {
  padding: '4px 10px', border: `1px solid ${INK}`, borderRadius: 3,
  background: INK, color: PAPER, fontSize: 11, cursor: 'pointer',
};
const delBtn: React.CSSProperties = {
  padding: '3px 8px', border: `1px solid #C62828`, borderRadius: 3,
  background: PAPER, color: '#C62828', fontSize: 10, cursor: 'pointer',
};
const trStyle: React.CSSProperties = { borderBottom: `1px solid ${HAIRLINE}` };
const tdStyle: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'top', color: INK };
