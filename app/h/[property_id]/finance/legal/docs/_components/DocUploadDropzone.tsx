'use client';
// Document upload dropzone — uses the correct DMS pipeline (not media).
// Flow: POST /api/docs/upload-sign → PUT to Storage → POST /api/docs/ingest
// Accepts: PDF, DOCX, DOC, XLSX, XLS, PPTX, TXT, CSV, ODS
import { useRef, useState } from 'react';

const FOREST = '#084838'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const RED = '#B03826'; const OK = '#0E7A4B';
const AMBER = '#B48A3A'; const WHITE = '#FFFFFF'; const BG = '#F4EFE2';

const ACCEPTED = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  'application/vnd.oasis.opendocument.spreadsheet',
];
const ACCEPT_EXT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.ods';

type FileState = { name: string; status: 'pending' | 'signing' | 'uploading' | 'ingesting' | 'done' | 'error'; progress: number; error?: string };

async function uploadOne(file: File, propertyId: number): Promise<void> {
  // 1. Get signed URL
  const signRes = await fetch('/api/docs/upload-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: file.name, file_size: file.size, mime: file.type, property_id: propertyId }),
  });
  const sign = await signRes.json();
  if (!signRes.ok || !sign.signed_url) throw new Error(sign.error ?? 'sign failed');

  // 2. PUT file directly to storage
  const putRes = await fetch(sign.signed_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  if (!putRes.ok) throw new Error('Storage upload failed: ' + putRes.status);

  // 3. Trigger ingest (brain pipeline)
  const ingestRes = await fetch('/api/docs/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staging_bucket: sign.staging_bucket, staging_path: sign.staging_path, file_name: file.name, property_id: propertyId, ...(defaultDocType ? { doc_type: defaultDocType } : {}) }),
  });
  const ingest = await ingestRes.json();
  if (!ingestRes.ok || !ingest.ok) throw new Error(ingest.error ?? 'ingest failed');
}

export default function DocUploadDropzone({ propertyId, onComplete, defaultDocType }: { propertyId: number; onComplete?: () => void; defaultDocType?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<FileState[]>([]);
  const [busy, setBusy] = useState(false);

  function updateFile(name: string, patch: Partial<FileState>) {
    setFiles(prev => prev.map(f => f.name === name ? { ...f, ...patch } : f));
  }

  async function processFiles(rawFiles: File[]) {
    const valid = rawFiles.filter(f => ACCEPTED.includes(f.type) || ACCEPT_EXT.split(',').some(ext => f.name.toLowerCase().endsWith(ext.replace('.', ''))));
    if (!valid.length) return;
    const newEntries: FileState[] = valid.map(f => ({ name: f.name, status: 'pending', progress: 0 }));
    setFiles(prev => [...prev, ...newEntries]);
    setBusy(true);
    for (const file of valid) {
      try {
        updateFile(file.name, { status: 'signing' });
        await uploadOne(file, propertyId);
        updateFile(file.name, { status: 'done', progress: 100 });
      } catch (e) {
        updateFile(file.name, { status: 'error', error: e instanceof Error ? e.message : 'upload failed' });
      }
    }
    setBusy(false);
    if (valid.length > 0 && onComplete) setTimeout(onComplete, 1200);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  }

  const statusIcon: Record<string, string> = { pending: '⏳', signing: '🔑', uploading: '⬆️', ingesting: '🧠', done: '✓', error: '✗' };
  const statusColor: Record<string, string> = { done: OK, error: RED, signing: AMBER, uploading: AMBER, ingesting: AMBER, pending: INK_M };

  return (
    <div>
      <div
        onDragEnter={e => { e.preventDefault(); dragCounter.current++; setDragging(true); }}
        onDragOver={e => e.preventDefault()}
        onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setDragging(false); }}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? FOREST : HAIR}`, borderRadius: 6, padding: '28px 20px',
          textAlign: 'center', cursor: 'pointer', background: dragging ? '#E8F1EE' : BG,
          transition: 'all .15s',
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 4 }}>
          Drag & drop documents here, or click to browse
        </div>
        <div style={{ fontSize: 11, color: INK_M }}>
          PDF · DOCX · DOC · XLSX · XLS · PPTX · TXT · CSV · ODS
        </div>
        <div style={{ fontSize: 10, color: INK_M, marginTop: 4 }}>
          Files enter the brain pipeline: extraction → classification → needs_review status
        </div>
        <input ref={inputRef} type="file" accept={ACCEPT_EXT} multiple style={{ display: 'none' }}
          onChange={e => processFiles(Array.from(e.target.files ?? []))} />
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map(f => (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, fontSize: 12 }}>
              <span style={{ fontSize: 14 }}>{statusIcon[f.status]}</span>
              <span style={{ flex: 1, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span style={{ color: statusColor[f.status], fontWeight: 600, fontSize: 10.5, whiteSpace: 'nowrap' }}>
                {f.status === 'done' ? 'In brain pipeline' : f.status === 'error' ? (f.error ?? 'error') : f.status}
              </span>
            </div>
          ))}
          {files.some(f => f.status === 'done') && (
            <div style={{ fontSize: 11, color: INK_M, padding: '4px 0' }}>
              Uploaded files are in <b>needs_review</b> status in the Document Register. Classify the family + subtype to activate brain indexing.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
