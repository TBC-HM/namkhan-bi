// app/operations/maintenance/_data/ppm.ts
// Gap-M5 — ops.ppm_templates + ops.ppm_tasks.

import { supabase, PROPERTY_ID } from '@/lib/supabase';

export interface PpmTaskRow {
  id: string;
  asset_code: string;
  template_name: string;
  due_date: string;        // ISO
  status: 'scheduled' | 'in_progress' | 'completed' | 'overdue';
  est_minutes: number;
}

export async function fetchPpmTasks(): Promise<PpmTaskRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('ppm_tasks')
      .select('id, asset_code, template_name, due_date, status, est_minutes')
      .eq('property_id', PROPERTY_ID)
      .order('due_date', { ascending: true })
      .limit(60);
    if (error || !data || data.length === 0) return null;
    return data as PpmTaskRow[];
  } catch {
    return null;
  }
}
