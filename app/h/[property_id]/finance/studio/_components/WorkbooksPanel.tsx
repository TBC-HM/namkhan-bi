'use client';

// WorkbooksPanel — the workbook registry surface (brief §9.2).
// Every generated artifact (xlsx export, scratch sheet, later Google Sheet)
// is a row in reports.workbooks: who / why / where-from / how-fresh.
// Derivatives (§10.1) show their lineage badge. Read-only listing.

import { useCallback, useEffect, useState } from 'react';
import { Container } from '@/app/(cockpit)/_design';
import type { StudioWorkbookRow } from '@/lib/studio/types';
import { UI, fmtTs } from './studioUi';

interface Props {
  scope: 'holding' | 'property';
  propertyId: number | null;
}

const TYPE_LABEL: Record<string, string> = {
  xlsx_export: 'Excel export',
  custom_scratch: 'Scratch sheet',
  gsheet: 'Google Sheet',
};

export default function WorkbooksPanel({ scope, propertyId }: Props) {
  const [workbooks, setWorkbooks] = useState<StudioWorkbookRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const qs = scope === 'holding' ? 'scope=holding' : `property_id=${propertyId}`;
      const res = await fetch(`/api/reports/studio/scratch?${qs}`);
      const json = (await res.json()) as { workbooks?: StudioWorkbookRow[]; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? 'load failed');
      setWorkbooks(json.workbooks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    } finally {
      setBusy(false);
    }
  }, [scope, propertyId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <Container
      title="Workbook registry"
      subtitle="Every generated workbook: type · owner · source · freshness · lineage"
      action={
        <button type="button" style={UI.btnGhost} disabled={busy} onClick={() => void refresh()}>
          {busy ? '…' : 'Refresh'}
        </button>
      }
    >
      {error && <div style={UI.err}>{error}</div>}
      {workbooks.length === 0 && !error && (
        <div style={UI.note}>No workbooks registered yet. Exports and scratch sheets appear here automatically.</div>
      )}
      {workbooks.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={UI.th}>Name</th>
                <th style={UI.th}>Type</th>
                <th style={UI.th}>Owner</th>
                <th style={UI.th}>Source modules</th>
                <th style={UI.th}>Created</th>
                <th style={UI.th}>Data as of</th>
                <th style={UI.th}>Last refresh</th>
                <th style={UI.th}>Lineage</th>
              </tr>
            </thead>
            <tbody>
              {workbooks.map((w) => (
                <tr key={w.id}>
                  <td style={UI.td}>{w.display_name ?? '—'}</td>
                  <td style={UI.td}>{TYPE_LABEL[w.type] ?? w.type}</td>
                  <td style={UI.td}>{w.owner}</td>
                  <td style={UI.td}>{w.source_modules.length ? w.source_modules.join(', ') : '—'}</td>
                  <td style={UI.td}>{fmtTs(w.created_at)}</td>
                  <td style={UI.td}>{fmtTs(w.data_timestamp)}</td>
                  <td style={UI.td}>{fmtTs(w.last_refresh)}</td>
                  <td style={UI.td}>
                    {w.parent_workbook_id
                      ? `derivative of ${w.parent_workbook_id.slice(0, 8)}… by ${w.derived_by ?? '—'}`
                      : 'original'}
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
