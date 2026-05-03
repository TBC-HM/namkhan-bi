'use client';

// components/settings/SectionEditor.tsx
// Client orchestrator: renders one form per row, posts to /api/settings/upsert
// (and /api/settings/delete for multi-row sections). Single-row sections
// (property_profile / booking_policies) hide the delete + add-row buttons.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import FieldRenderer from './FieldRenderer';
import type { FieldSchemaRow } from '@/lib/settings';

interface Props {
  sectionCode: string;
  table: string;            // physical table name in marketing schema
  pk: string;
  multiRow: boolean;
  hasPropertyId: boolean;
  fields: FieldSchemaRow[]; // already filtered (no audit/hidden, whitelist applied)
  rows: any[];
}

export default function SectionEditor({
  sectionCode, table, pk, multiRow, hasPropertyId, fields, rows: initialRows,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<any[]>(initialRows);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  function rowKey(row: any, idx: number): string {
    return row[pk] != null ? String(row[pk]) : `new-${idx}`;
  }

  function updateField(idx: number, col: string, v: unknown) {
    setRows((rs) => {
      const next = [...rs];
      next[idx] = { ...next[idx], [col]: v };
      return next;
    });
  }

  async function saveRow(row: any, idx: number) {
    setError(null);
    const key = rowKey(row, idx);
    setSavingKey(key);
    try {
      const res = await fetch('/api/settings/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: sectionCode, table, pk, row }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `Save failed (${res.status})`);
      }
      // Replace local row with server-returned row (picks up generated IDs / updated_at).
      setRows((rs) => {
        const next = [...rs];
        next[idx] = json.row;
        return next;
      });
      setSavedKey(key);
      setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1800);
      // Refresh server data so sidebar last_edited / counts update.
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    } finally {
      setSavingKey(null);
    }
  }

  async function deleteRow(row: any, idx: number) {
    if (!multiRow) return;
    if (row[pk] == null) {
      // unsaved row — drop locally
      setRows((rs) => rs.filter((_, j) => j !== idx));
      return;
    }
    if (!confirm('Delete this row? This cannot be undone.')) return;
    setError(null);
    setSavingKey(rowKey(row, idx));
    try {
      const res = await fetch('/api/settings/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: sectionCode, table, pk, id: row[pk] }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `Delete failed (${res.status})`);
      setRows((rs) => rs.filter((_, j) => j !== idx));
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e?.message ?? 'Delete failed');
    } finally {
      setSavingKey(null);
    }
  }

  function addRow() {
    const blank: any = {};
    if (hasPropertyId) blank.property_id = 260955;
    fields.forEach((f) => {
      if (!(f.column_name in blank)) blank[f.column_name] = null;
    });
    setRows((rs) => [...rs, blank]);
  }

  return (
    <div className="settings-editor">
      {error && (
        <div className="insight alert" style={{ marginBottom: 14 }}>
          <span className="insight-eye">save error</span>
          {error}
        </div>
      )}

      {rows.length === 0 && (
        <div className="settings-empty text-mono">
          No rows yet.{' '}
          {multiRow && (
            <button type="button" className="btn btn-ghost" onClick={addRow}>
              + Add the first one
            </button>
          )}
        </div>
      )}

      {rows.map((row, idx) => {
        const key = rowKey(row, idx);
        const isSaving = savingKey === key;
        const justSaved = savedKey === key;
        return (
          <div key={key} className="settings-row-card">
            <div className="settings-row-grid">
              {fields.map((f) => (
                <FieldRenderer
                  key={f.column_name}
                  field={f}
                  value={row[f.column_name]}
                  onChange={(v) => updateField(idx, f.column_name, v)}
                />
              ))}
            </div>
            <div className="settings-row-actions">
              <button
                type="button"
                className="btn"
                onClick={() => saveRow(row, idx)}
                disabled={isSaving || pending}
              >
                {isSaving ? 'Saving…' : justSaved ? 'Saved ✓' : 'Save'}
              </button>
              {multiRow && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => deleteRow(row, idx)}
                  disabled={isSaving || pending}
                  style={{ color: 'var(--bad, #c93b3b)' }}
                >
                  {row[pk] == null ? 'Discard' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {multiRow && rows.length > 0 && (
        <button
          type="button"
          className="btn btn-ghost settings-add-row"
          onClick={addRow}
        >
          + Add new
        </button>
      )}
    </div>
  );
}
