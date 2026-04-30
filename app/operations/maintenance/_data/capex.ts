// app/operations/maintenance/_data/capex.ts
// Gap-M9 — governance.maintenance_budget linked to /finance/budget proposals.

import { supabase, PROPERTY_ID } from '@/lib/supabase';

export interface CapExItemRow {
  id: string;
  title: string;
  category: 'must-do' | 'should-do' | 'could-do';
  est_cost: number;
  payback_months?: number | null;
  status: 'draft' | 'promoted' | 'approved' | 'rejected';
}

export async function fetchCapExPipeline(): Promise<CapExItemRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('maintenance_capex_pipeline')
      .select('id, title, category, est_cost, payback_months, status')
      .eq('property_id', PROPERTY_ID)
      .neq('status', 'rejected')
      .order('est_cost', { ascending: false })
      .limit(20);
    if (error || !data || data.length === 0) return null;
    return data as CapExItemRow[];
  } catch {
    return null;
  }
}
