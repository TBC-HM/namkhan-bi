'use client';

// components/marketing/UploadDropzone.tsx
// Drag-drop upload widget with processing queue.
// Phase 2.6 (2026-05-01 PM): signed-URL flow — bytes go directly browser → Supabase
// Storage, bypassing Vercel's 4.5 MB function body limit. Only metadata (a few
// hundred bytes) flows through /api/marketing/upload-sign.

import { useCallback, useState, useRef } from 'react';

type Status = 'queued' | 'hashing' | 'signing' | 'uploading' | 'finalizing' | 'ingested' | 'ready' | 'rejected' | 'duplicate';

interface QueueItem {
  id: string;
  name: string;
  size: number;
  status: Status;
  progress?: number;     // 0-100 during upload
  reason?: string;
  asset_id?: string;
  file?: File;
}

const STATUS_LABEL: Record<Status, string> = {
  queued:     'queued',
  hashing:    'hashing',
  signing:    'signing',
  uploading:  'uploading',
  finalizing: 'finalising',
  ingested:   'ingested',
  ready:      'ready',
  rejected:   'rejected',
  duplicate:  'duplicate',
};

const STATUS_COLOR: Record<Status, string> = {
  queued:     'var(--ink-mute)',
  hashing:    'var(--ink-mute)',
  signing:    'var(--brass)',
  uploading:  'var(--brass)',
  finalizing: 'var(--brass)',
  ingested:   'var(--moss)',
  ready:      'var(--moss)',
  rejected:   'var(--oxblood)',
  duplicate:  'var(--brass)',
};

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp',
  'image/x-canon-cr2', 'image/x-nikon-nef', 'image/x-sony-arw', 'image/x-adobe-dng',
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif',
  cr2: 'image/x-canon-cr2', nef: 'image/x-nikon-nef',
  arw: 'image/x-sony-arw', dng: 'image/x-adobe-dng',
};

function inferMime(file: File): string {
  if (file.type && ALLOWED_MIME.has(file.type)) return file.type;
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  return EXT_TO_MIME[ext] ?? file.type ?? 'application/octet-stream';
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function UploadDropzone() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const photographerRef = useRef<HTMLInputElement>(null);
  const licenseRef = useRef<HTMLSelectElement>(null);
  const campaignRef = useRef<HTMLInputElement>(null);

  function patch(id: string, p: Partial<QueueItem>) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...p } : it));
  }

  async function uploadOne(item: QueueItem, file: File) {
    try {
      const mime = inferMime(file);
      if (!ALLOWED_MIME.has(mime)) {
        patch(item.id, { status: 'rejected', reason: `Unsupported type: ${file.type || mime}` });
        return;
      }

      patch(item.id, { status: 'hashing' });
      const sha = await sha256Hex(file);

      patch(item.id, { status: 'signing' });
      const photographer = photographerRef.current?.value ?? '';
      const license = licenseRef.current?.value ?? 'owned';
      const campaign = campaignRef.current?.value ?? '';

      const signRes = await fetch('/api/marketing/upload-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          content_type: mime,
          size: file.size,
          sha256: sha,
          photographer: photographer || undefined,
          license: license || undefined,
        }),
      });
      const signJson: any = await signRes.json().catch(() => ({}));

      if (!signRes.ok) {
        patch(item.id, { status: 'rejected', reason: signJson?.error ?? `HTTP ${signRes.status}` });
        return;
      }
      if (signJson.duplicate) {
        patch(item.id, { status: 'duplicate', asset_id: signJson.asset_id, reason: 'already in library' });
        return;
      }

      const { upload_url, asset_id } = signJson;
      patch(item.id, { status: 'uploading', asset_id, progress: 0 });

      // PUT bytes directly to Supabase Storage via signed URL
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', upload_url);
        xhr.setRequestHeader('Content-Type', mime);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            patch(item.id, { progress: Math.round((e.loaded / e.total) * 100) });
          }
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`upload_${xhr.status}: ${xhr.responseText?.slice(0, 200) ?? ''}`)));
        xhr.onerror = () => reject(new Error('upload_network_error'));
        xhr.send(file);
      });

      patch(item.id, { status: 'finalizing', progress: 100 });

      const finRes = await fetch('/api/marketing/upload-finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id, campaign_tag: campaign || undefined }),
      });
      const finJson: any = await finRes.json().catch(() => ({}));

      if (!finRes.ok || !finJson.ok) {
        patch(item.id, { status: 'rejected', reason: finJson?.error ?? `finalize ${finRes.status}` });
        return;
      }
      patch(item.id, { status: 'ingested' });
    } catch (e: any) {
      patch(item.id, { status: 'rejected', reason: e?.message ?? 'Network error' });
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
    setItems(prev => [...next, ...prev]);

    // Parallel-3 lane queue
    let cursor = 0;
    const lane = async () => {
      while (cursor < next.length) {
        const idx = cursor++;
        const it = next[idx];
        if (it.file) await uploadOne(it, it.file);
      }
    };
    Promise.all([lane(), lane(), lane()]);
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
    ready:    items.filter(i => i.status === 'ingested' || i.status === 'ready').length,
    proc:     items.filter(i => ['queued','hashing','signing','uploading','finalizing'].includes(i.status)).length,
    rejected: items.filter(i => i.status === 'rejected').length,
    duplicate: items.filter(i => i.status === 'duplicate').length,
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
          accept="image/jpeg,image/png,image/heic,image/heif,image/webp,.cr2,.nef,.arw,.dng"
          onChange={onPick}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: 28, color: 'var(--brass)' }}>⤴</div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 18, color: 'var(--ink)', marginTop: 10 }}>drop files here</div>
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 6 }}>or click to browse</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-mute)', marginTop: 14, letterSpacing: 0.4 }}>
          photos · up to 200 files · max 500 MB per file · direct upload (signed URL)
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
              <option value="editorial_only">Editorial only</option>
              <option value="influencer_ugc">Influencer UGC</option>
              <option value="guest_ugc">Guest UGC</option>
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
              {counts.ready > 0 && <span className="pill" style={{ background: 'var(--moss)', color: 'var(--paper-warm)' }}>{counts.ready} ingested</span>}
              {counts.duplicate > 0 && <span className="pill" style={{ background: 'var(--brass)', color: 'var(--paper-warm)' }}>{counts.duplicate} duplicate</span>}
              {counts.proc > 0 && <span className="pill" style={{ background: 'var(--brass)', color: 'var(--paper-warm)' }}>{counts.proc} processing</span>}
              {counts.rejected > 0 && <span className="pill" style={{ background: 'var(--oxblood)', color: 'var(--paper-warm)' }}>{counts.rejected} rejected</span>}
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Filename</th>
                <th className="num">Size</th>
                <th className="num">Progress</th>
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
                  <td className="num" style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)' }}>
                    {i.status === 'uploading' ? `${i.progress ?? 0}%` : ''}
                  </td>
                  <td>
                    <span className="pill" style={{ background: STATUS_COLOR[i.status], color: 'var(--paper-warm)' }}>
                      {STATUS_LABEL[i.status]}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {(i.status === 'ingested' || i.status === 'ready' || i.status === 'duplicate') && (
                      <a href="/marketing/library" style={{ fontSize: 11, color: 'var(--moss)' }}>view ↗</a>
                    )}
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
        Live — files upload direct to <code>media-raw</code> via signed URL.
        Bytes never traverse Vercel function bodies (no 4.5 MB cap).
        Status stays at <strong>ingested</strong> until tagging pipeline runs.
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
  background: 'var(--paper-warm)',
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
