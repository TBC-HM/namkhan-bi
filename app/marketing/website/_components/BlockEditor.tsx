'use client';
// app/marketing/website/_components/BlockEditor.tsx
// CMS-2: Block editor for website.sections — add/edit/reorder/delete blocks
// Each block kind has constrained fields per the block_catalog contract
import { useState, useEffect } from 'react';

const HAIR = '#E6DFCC'; const INK = '#1B1B1B'; const INK_M = '#5A5A5A'; const INK_F = '#8A8A8A';
const GREEN = '#2E7D32'; const AMBER = '#B8A878'; const RED = '#B8542A';

interface Block {
  id: number;
  page_id: number;
  property_id: number;
  sort_order: number | null;
  kind: string | null;
  heading: string | null;
  body_md: string | null;
  data: Record<string, unknown> | null;
  updated_at: string | null;
}

const BLOCK_KINDS = [
  { value: 'hero', label: 'Hero', desc: 'Page opening with H1 + intro' },
  { value: 'text', label: 'Text', desc: 'Editorial prose' },
  { value: 'image', label: 'Image', desc: 'Single image with caption' },
  { value: 'gallery', label: 'Gallery', desc: 'Image grid (3+)' },
  { value: 'cards', label: 'Cards', desc: 'Feature grid with icons' },
  { value: 'list', label: 'List', desc: 'Bullets or numbered list' },
  { value: 'cta', label: 'Call-to-Action', desc: 'Short copy + button' },
  { value: 'quote', label: 'Quote', desc: 'Testimonial or pull-quote' },
  { value: 'faq', label: 'FAQ', desc: 'Q&A group' },
  { value: 'form', label: 'Form', desc: 'Lead/contact form' },
  { value: 'embed', label: 'Embed', desc: 'Map, video iframe' },
  { value: 'contact', label: 'Contact', desc: 'Address, phone, hours' },
] as const;

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 13, border: `1px solid ${HAIR}`,
  borderRadius: 4, color: INK, background: '#FFFFFF', boxSizing: 'border-box'
};
const btnStyle: React.CSSProperties = {
  padding: '7px 14px', fontSize: 12.5, fontWeight: 600, border: `1px solid ${HAIR}`,
  borderRadius: 4, background: '#FFFFFF', color: INK, cursor: 'pointer'
};
const btnPrimaryStyle: React.CSSProperties = { ...btnStyle, background: GREEN, color: '#FFFFFF', border: 'none' };

interface BlockEditorProps {
  pageId: number;
  propertyId: number;
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
  onMessage: (msg: { kind: 'ok' | 'err'; text: string }) => void;
}

export default function BlockEditor({ pageId, blocks, onBlocksChange, onMessage }: BlockEditorProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form state for editing
  const [eKind, setEKind] = useState('text');
  const [eHeading, setEHeading] = useState('');
  const [eBody, setEBody] = useState('');
  const [eLabel, setELabel] = useState('');
  const [eImages, setEImages] = useState('');
  const [eCtas, setECtas] = useState('');

  const editing = blocks.find(b => b.id === editingId);

  useEffect(() => {
    if (editing) {
      setEKind(editing.kind ?? 'text');
      setEHeading(editing.heading ?? '');
      setEBody(editing.body_md ?? '');
      const data = editing.data ?? {};
      setELabel((data.label as string) ?? '');
      setEImages(((data.images ?? []) as string[]).join('\n'));
      const ctas = (data.ctas ?? []) as Array<{text: string; url: string}>;
      setECtas(ctas.map((c) => `${c.text} | ${c.url}`).join('\n'));
    }
  }, [editing]);

  function startAdd() {
    setEditingId(null);
    setAdding(true);
    setEKind('text');
    setEHeading('');
    setEBody('');
    setELabel('');
    setEImages('');
    setECtas('');
  }

  function cancelEdit() {
    setEditingId(null);
    setAdding(false);
  }

  async function saveBlock() {
    setBusy(true);
    try {
      const data: Record<string, unknown> = {};
      if (eLabel.trim()) data.label = eLabel.trim();
      if (eImages.trim()) data.images = eImages.split('\n').map(s => s.trim()).filter(Boolean);
      if (eCtas.trim()) {
        data.ctas = eCtas.split('\n').map(line => {
          const [text, url] = line.split('|').map(s => s.trim());
          return { text: text ?? '', url: url ?? '' };
        }).filter(c => c.text || c.url);
      }

      const payload = {
        page_id: pageId,
        kind: eKind,
        heading: eHeading.trim() || null,
        body_md: eBody.trim() || null,
        data: Object.keys(data).length > 0 ? data : null,
        sort_order: adding ? (Math.max(0, ...blocks.map(b => b.sort_order ?? 0)) + 1) : (editing?.sort_order ?? 0)
      };

      const url = adding ? '/api/website/sections' : `/api/website/sections?id=${editingId}`;
      const method = adding ? 'POST' : 'PATCH';
      
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await r.json();

      if (j.ok) {
        onMessage({ kind: 'ok', text: adding ? 'Block added' : 'Block saved' });
        // Reload blocks
        const rr = await fetch(`/api/website/sections?page_id=${pageId}`, { cache: 'no-store' });
        const jj = await rr.json();
        if (jj.ok) onBlocksChange(jj.sections);
        cancelEdit();
      } else {
        onMessage({ kind: 'err', text: j.error ?? 'Save failed' });
      }
    } catch (err) {
      onMessage({ kind: 'err', text: String(err) });
    } finally {
      setBusy(false);
    }
  }

  async function deleteBlock(id: number) {
    if (!confirm('Delete this block?')) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/website/sections?id=${id}`, { method: 'DELETE' });
      const j = await r.json();
      if (j.ok) {
        onMessage({ kind: 'ok', text: 'Block deleted' });
        const rr = await fetch(`/api/website/sections?page_id=${pageId}`, { cache: 'no-store' });
        const jj = await rr.json();
        if (jj.ok) onBlocksChange(jj.sections);
      } else {
        onMessage({ kind: 'err', text: j.error ?? 'Delete failed' });
      }
    } catch (err) {
      onMessage({ kind: 'err', text: String(err) });
    } finally {
      setBusy(false);
    }
  }

  async function reorder(id: number, direction: 'up' | 'down') {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === blocks.length - 1) return;

    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newBlocks = [...blocks];
    [newBlocks[idx], newBlocks[newIdx]] = [newBlocks[newIdx], newBlocks[idx]];
    
    // Update sort_order
    const updates = newBlocks.map((b, i) => ({ id: b.id, sort_order: i }));
    
    setBusy(true);
    try {
      const r = await fetch('/api/website/sections/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: pageId, blocks: updates })
      });
      const j = await r.json();
      if (j.ok) {
        onBlocksChange(newBlocks);
      } else {
        onMessage({ kind: 'err', text: j.error ?? 'Reorder failed' });
      }
    } catch (err) {
      onMessage({ kind: 'err', text: String(err) });
    } finally {
      setBusy(false);
    }
  }

  const needsLabel = ['hero', 'gallery', 'cta'].includes(eKind);
  const needsImages = ['image', 'gallery'].includes(eKind);
  const needsCtas = eKind === 'cta';

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: INK }}>
          Blocks ({blocks.filter(b => b.kind !== 'nav' && b.kind !== 'footer').length})
        </h3>
        <button onClick={startAdd} disabled={busy} style={btnPrimaryStyle}>+ Add Block</button>
      </div>

      {(editingId !== null || adding) && (
        <div style={{ 
          border: `2px solid ${AMBER}`, borderRadius: 6, padding: 16, marginBottom: 16, background: '#FFFDF5'
        }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 600, color: INK }}>
            {adding ? 'New Block' : 'Edit Block'}
          </h4>
          
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 4 }}>
              Block Type
            </span>
            <select value={eKind} onChange={e => setEKind(e.target.value)} style={inputStyle}>
              {BLOCK_KINDS.map(k => (
                <option key={k.value} value={k.value}>{k.label} — {k.desc}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 4 }}>
              Heading (optional)
            </span>
            <input 
              type="text" 
              value={eHeading} 
              onChange={e => setEHeading(e.target.value)}
              placeholder="Section heading..."
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 4 }}>
              Body (Markdown)
            </span>
            <textarea 
              value={eBody}
              onChange={e => setEBody(e.target.value)}
              rows={8}
              placeholder="Markdown content..."
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
            />
          </label>

          {needsLabel && (
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 4 }}>
                Label (optional)
              </span>
              <input 
                type="text"
                value={eLabel}
                onChange={e => setELabel(e.target.value)}
                placeholder="Section label..."
                style={inputStyle}
              />
            </label>
          )}

          {needsImages && (
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 4 }}>
                Images (one URL per line)
              </span>
              <textarea
                value={eImages}
                onChange={e => setEImages(e.target.value)}
                rows={4}
                placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11 }}
              />
              <span style={{ fontSize: 11, color: INK_F, marginTop: 2, display: 'block' }}>
                Tip: Use the media picker below to select from library
              </span>
            </label>
          )}

          {needsCtas && (
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK_M, marginBottom: 4 }}>
                CTAs (text | url, one per line)
              </span>
              <textarea
                value={eCtas}
                onChange={e => setECtas(e.target.value)}
                rows={3}
                placeholder="Book Now | https://thenamkhan.com/book&#10;Learn More | /about"
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11 }}
              />
            </label>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveBlock} disabled={busy} style={btnPrimaryStyle}>
              {busy ? 'Saving...' : 'Save'}
            </button>
            <button onClick={cancelEdit} disabled={busy} style={btnStyle}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ border: `1px solid ${HAIR}`, borderRadius: 4 }}>
        {blocks.filter(b => b.kind !== 'nav' && b.kind !== 'footer').map((block, idx, arr) => (
          <div 
            key={block.id}
            style={{
              padding: 12,
              borderBottom: idx < arr.length - 1 ? `1px solid ${HAIR}` : 'none',
              background: editingId === block.id ? '#FFFDF5' : '#FFFFFF'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ 
                    fontSize: 10, fontWeight: 700, color: '#FFFFFF', background: INK, 
                    padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase'
                  }}>
                    {block.kind}
                  </span>
                  {block.heading && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{block.heading}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: INK_F, marginTop: 4 }}>
                  {block.body_md?.slice(0, 120)}
                  {(block.body_md?.length ?? 0) > 120 ? '…' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
                <button 
                  onClick={() => reorder(block.id, 'up')}
                  disabled={busy || idx === 0}
                  style={{ ...btnStyle, padding: '4px 8px', fontSize: 11 }}
                  title="Move up"
                >
                  ↑
                </button>
                <button 
                  onClick={() => reorder(block.id, 'down')}
                  disabled={busy || idx === arr.length - 1}
                  style={{ ...btnStyle, padding: '4px 8px', fontSize: 11 }}
                  title="Move down"
                >
                  ↓
                </button>
                <button 
                  onClick={() => setEditingId(block.id)}
                  disabled={busy}
                  style={{ ...btnStyle, padding: '4px 10px', fontSize: 11 }}
                >
                  Edit
                </button>
                <button 
                  onClick={() => deleteBlock(block.id)}
                  disabled={busy}
                  style={{ ...btnStyle, padding: '4px 10px', fontSize: 11, color: RED }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {blocks.filter(b => b.kind !== 'nav' && b.kind !== 'footer').length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: INK_F, fontSize: 13 }}>
            No blocks yet. Click "+ Add Block" to start.
          </div>
        )}
      </div>
    </div>
  );
}
