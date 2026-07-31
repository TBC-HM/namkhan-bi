// lib/studio/scheduleTypes.ts
// Spreadsheet Studio — scheduled-exports types (brief §8 option a).
// Kept OUT of lib/studio/types.ts on purpose: PR #367 (r2 surfaces) also
// touches types.ts, and this file must merge conflict-free either way.

export interface StudioScheduleRow {
  id: string;
  template_id: string;
  template_name: string;
  property_id: number | null;
  recipients: string[];
  cadence: 'daily' | 'weekly' | 'monthly';
  send_hour_utc: number;
  weekly_dow: number | null;
  monthly_dom: number | null;
  active: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
}
