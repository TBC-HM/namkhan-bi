'use client';

// UserDocsPanel — user document storage (brief §10.2 + §10.4).
// Upload to the private `user-docs` bucket, quota tile, list + download.
// Brain consent is asked ONCE per upload in plain language; default is
// NOT indexed (privacy-first) and the flag is reversible per document.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Container } from '@/app/(cockpit)/_design';
import type { StudioDocsUsage, StudioUserDocRow } from '@/lib/studio/types';
import { UI, fmtBytes, fmtTs } from './studioUi';

interface Props {
  level: 'holding' | 'property';
  propertyId: number | null;
}

export default function UserDocsPanel({ level, propertyId }: Props) {
  const [docs, setDocs] = useState<StudioUserDocRow[]>([]);
  const [usage, setUsage] = useState<StudioDocsUsage>({ doc_count: 0, total_bytes: 0 });
  const [tags, setTags] = useState('');
  const [brainOk, setBrainOk] = useState<'no' | 'yes'>('no');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const qs = level === 'holding' ? 'level=holding' : `property_id=${propertyId}`;
      const res = await fetch(`/api/reports/studio/userdocs?${qs}`);
      const json = (await res.json()) as { docs?: StudioUserDocRow[]; usage?: StudioDocsUsage; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? 'load failed');
      setDocs(json.docs ?? []);
      if (json.usage) setUsage(json.usage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    }
  }, [level, propertyId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const upload = useCallback(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Choose a file first.'); return; }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('level', level);
      if (level === 'property' && propertyId) form.set('property_id', String(propertyId));
      form.set('tags', tags);
      form.set('brain_ok', brainOk);
      const res = await fetch('/api/reports/studio/userdocs', { method: 'POST', body: form });
      const json = (await res.json()) as { uploaded?: boolean; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? 'upload failed');
      if (fileRef.current) fileRef.current.value = '';
      setTags('');
      setBrainOk('no');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'upload failed');
    } finally {
      setBusy(false);
    }
  }, [level, propertyId, tags, brainOk, refresh]);

  const download = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/reports/studio/userdocs?download=${id}`);
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'download failed');
      window.open(json.url, '_blank', 'noopener');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'download failed');
    }
  }, []);

  const toggleBrain = useCallback(async (doc: StudioUserDocRow) => {
    setError(null);
    try {
      const res = await fetch('/api/reports/studio/userdocs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, brain_excluded: !doc.brain_excluded }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? 'update failed');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'update failed');
    }
  }, [refresh]);

  return (
    <Container
      title="My documents"
      subtitle={`Private platform storage · ${usage.doc_count} document${usage.doc_count === 1 ? '' : 's'} · ${fmtBytes(usage.total_bytes)} used (all levels)`}
    >
      <div style={UI.row}>
        <span style={UI.label}>Upload</span>
        <input ref={fileRef} type="file" style={UI.input} />
        <input
          style={{ ...UI.input, minWidth: 160 }}
          value={tags}
          placeholder="tags, comma-separated"
          onChange={(e) => setTags(e.target.value)}
        />
      </div>
      <div style={UI.row}>
        <span style={UI.label}>Company brain</span>
        <span style={{ fontSize: 13, color: 'var(--ink)' }}>
          Should the company brain know about this document?
        </span>
        <button type="button" style={brainOk === 'no' ? UI.chipOn : UI.chip} onClick={() => setBrainOk('no')}>
          No — keep it private
        </button>
        <button type="button" style={brainOk === 'yes' ? UI.chipOn : UI.chip} onClick={() => setBrainOk('yes')}>
          Yes — let it be used in answers
        </button>
        <button type="button" style={UI.btn} disabled={busy} onClick={() => void upload()}>
          {busy ? '…' : 'Upload'}
        </button>
      </div>
      {error && <div style={UI.err}>{error}</div>}

      {docs.length === 0 && !error && <div style={UI.note}>No documents stored at this level yet.</div>}
      {docs.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={UI.th}>File</th>
                <th style={UI.th}>Size</th>
                <th style={UI.th}>Tags</th>
                <th style={UI.th}>Uploaded</th>
                <th style={UI.th}>Brain</th>
                <th style={UI.th}></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td style={UI.td}>{d.filename}</td>
                  <td style={UI.td}>{fmtBytes(d.size_bytes)}</td>
                  <td style={UI.td}>{d.tags.length ? d.tags.join(', ') : '—'}</td>
                  <td style={UI.td}>{fmtTs(d.uploaded_at)}</td>
                  <td style={UI.td}>
                    <button
                      type="button"
                      style={d.brain_excluded ? UI.chip : UI.chipOn}
                      title="Reversible — controls whether the company brain may use this document in answers"
                      onClick={() => void toggleBrain(d)}
                    >
                      {d.brain_excluded ? 'private' : 'shared with brain'}
                    </button>
                  </td>
                  <td style={UI.td}>
                    <button type="button" style={UI.btnGhost} onClick={() => void download(d.id)}>Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
