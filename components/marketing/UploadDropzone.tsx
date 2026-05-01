'use client';

// components/marketing/UploadDropzone.tsx
// Drag-drop upload widget with processing queue.
// Phase 2.5 (2026-05-01): real upload via POST /api/marketing/upload.
// Bytes go to media-raw bucket; row inserted into marketing.media_assets.
// Requires SUPABASE_SERVICE_ROLE_KEY env var on the deployment.

import { useCallback, useState, useRef } from 'react';

type Status = 'queued' | 'uploading' | 'ingested' | 'qc' | 'enhancing' | 'rendering' | 'tagging' | 'ready' | 'rejected';

interface QueueItem {
  id: string;
  name: string;
  size: number;
  status: Status;
  reason?: string;
  asset_id?: string;
  file?: File;
}

const STATUS_LABEL: Record<Status, string> = {
  queued:     'queued',
  uploading:  'uploading',
  ingested:   'ingested',
  qc:         'qc check',
  enhancing:  'enhancing',
  rendering:  'rendering',
  tagging:    'tagging',
  ready:      'ready',
  rejected:   'rejected',
};

const STATUS_COLOR: Record<Status, string> = {
  queued:     'var(--ink-mute)',
  uploading:  'var(--brass)',
  ingested:   'var(--brass)',
  qc:         'var(--brass)',
  enhancing:  'var(--brass)',
  rendering:  'var(--brass)',
  tagging:    'var(--brass)',
  ready:      'var(--moss)',
  rejected:   'var(--oxblood)',
};

export default function UploadDropzone() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const photographerRef = useRef<HTMLInputElement>(null);
  const licenseRef = useRef<HTMLSelectElement>(null);
  const campaignRef = useRef<HTMLInputElement>(null);

  async function uploadOne(item: QueueItem, file: File) {
    setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'uploading' } : p));
    try {
      const fd = new FormData();
      fd.append('file', file);
      const photographer = photographerRef.current?.value ?? '';
      const license = licenseRef.current?.value ?? 'owned';
      const campaign = campaignRef.current?.value ?? '';
      if (photographer) fd.append('photographer', photographer);
      fd.append('license', license);
      if (campaign) fd.append('campaign_tag', campaign);

      const resp = await fetch('/api/marketing/upload', { method: 'POST', body: fd });
      const json: any = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'rejected', reason: json?.error ?? `HTTP ${resp.status}` } : p));
        return;
      }
      const result = (json?.results ?? [])[0] ?? {};
      if (result.ok) {
        setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'ready', asset_id: result.asset_id } : p));
      } else {
        setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'rejected', reason: result.error ?? 'Upload failed' } : p));
      }
    } catch (e: any) {
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'rejected', reason: e?.message ?? 'Network error' } : p));
    }
  }

  const onFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const now = Date.now();
    const next: QueueItem[] = arr.map((f, i) => ({
      id: `${now}-${i}-${f.name}`,
      name: f.name,
      size: f.size,
      status: 'queued',
      file: f,
    }));
    setItems(prev => [...prev, ...next]);

    // Real upload — sequential to avoid hammering the route. For 200-file
    // batches this is fine; switch to parallel-with-limit if it gets slow.
    (async () => {
      for (const item of next) {
        if (!item.file) continue;
        await uploadOne(item, item.file);
      }
    })();
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) onFiles(e.dataTransfer.files);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) onFiles(e.target.files);
  }

  const counts = {
    ready:    items.filter(i => i.status === 'ready').length,
    proc:     items.filter(i => !['ready', 'rejected', 'queued'].includes(i.status)).length,
    rejected: items.filter(i => i.status === 'rejected').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Dropzone */}
      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragOver(false)}
        style={{
          display: 'block',
          padding: '60px 20px',
          border: `2px dashed ${dragOver ? 'var(--moss)' : 'var(--line)'}`,
          background: dragOver ? 'rgba(31,53,40,0.04)' : 'var(--paper-warm)',
          borderRadius: 6,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 120ms ease',
        }}
      >
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={onPick}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: 28, color: 'var(--brass)' }}>⤴</div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 18, color: 'var(--ink)', marginTop: 10 }}>drop files here</div>
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 6 }}>or click to browse</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-mute)', marginTop: 14, letterSpacing: 0.4 }}>
          photos · videos · reels — up to 200 files · max 5 GB per file
        </div>
      </label>

      {/* Assign-before-upload form */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Assign <em>before upload</em></div>
            <div className="card-sub">optional · helps the AI tagger</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, fontSize: 12 }}>
          <Field label="Photographer">
            <input ref={photographerRef} style={fieldStyle} placeholder="select staff or type name" />
          </Field>
          <Field label="License">
            <select ref={licenseRef} style={fieldStyle} defaultValue="owned">
              <option value="owned">Owned</option>
              <option value="licensed">Licensed</option>
              <option value="editorial">Editorial only</option>
              <option value="press_release">Press release</option>
              <option value="partner_provided">Partner-provided</option>
            </select>
          </Field>
          <Field label="Suggested tier">
            <select style={fieldStyle} defaultValue="auto">
              <option value="auto">Let AI decide</option>
              <option value="tier_ota_profile">OTA profile</option>
              <option value="tier_website_hero">Website hero</option>
              <option value="tier_social_pool">Social pool</option>
              <option value="tier_internal">Internal</option>
            </select>
          </Field>
          <Field label="Campaign tag (optional)">
            <input ref={campaignRef} style={fieldStyle} placeholder="e.g. pi_mai_2026" />
          </Field>
        </div>
      </div>

      {/* Processing queue */}
      {items.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Processing <em>queue</em></div>
              <div className="card-sub">{items.length} file{items.length === 1 ? '' : 's'}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <span className="pill" style={{ background: 'var(--moss)', color: '#fff' }}>{counts.ready} ready</span>
              {counts.proc > 0 && <span className="pill" style={{ background: 'var(--brass)', color: '#fff' }}>{counts.proc} processing</span>}
              {counts.rejected > 0 && <span className="pill" style={{ background: 'var(--oxblood)', color: '#fff' }}>{counts.rejected} rejected</span>}
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Filename</th>
                <th className="num">Size</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id}>
                  <td className="lbl">
                    <strong>{i.name}</strong>
                    {i.reason && <div style={{ fontSize: 10, color: 'var(--oxblood)', marginTop: 2 }}>{i.reason}</div>}
                  </td>
                  <td className="num" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{(i.size / 1_000_000).toFixed(1)} MB</td>
                  <td>
                    <span className="pill" style={{ background: STATUS_COLOR[i.status], color: '#fff' }}>
                      {STATUS_LABEL[i.status]}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {i.status === 'ready' && <a href="/marketing/library" style={{ fontSize: 11, color: 'var(--moss)' }}>view ↗</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {counts.ready > 0 && counts.proc === 0 && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(31,53,40,0.06)', borderLeft: '3px solid var(--moss)', fontSize: 12 }}>
              <strong>{counts.ready} asset{counts.ready === 1 ? '' : 's'} added to your library.</strong>{' '}
              <a href="/marketing/library" style={{ color: 'var(--moss)', fontWeight: 600 }}>view in library →</a>
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--ink-mute)', textAlign: 'center', padding: 12 }}>
        Live — files upload to <code>media-raw</code> bucket via <code>/api/marketing/upload</code>.
        AI-tagging and tier-routing pipeline still deferred (status stays at <strong>ingested</strong>).
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 12,
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 4,
  background: '#fff',
  fontFamily: 'var(--sans)',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--ink-mute)', marginBottom: 5, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}
