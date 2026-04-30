// app/operations/maintenance/_data/assets.ts
// Gap-M2 — ops.assets (initial census ~140 assets, manual one-time effort).

import { supabase, PROPERTY_ID } from '@/lib/supabase';

export type AssetHealth = 'green' | 'amber' | 'red';

export interface AssetHealthCell {
  asset_code: string;
  category: string;        // 'AC', 'Plumbing', 'Electric', ...
  location: string;        // 'R12', 'Lobby', ...
  health: AssetHealth;
  last_intervention?: string | null;
  mtbf_days?: number | null;
}

export async function fetchAssetHealth(): Promise<AssetHealthCell[] | null> {
  try {
    const { data, error } = await supabase
      .from('v_asset_health')
      .select('asset_code, category, location, health, last_intervention, mtbf_days')
      .eq('property_id', PROPERTY_ID);
    if (error || !data || data.length === 0) return null;
    return data as AssetHealthCell[];
  } catch {
    return null;
  }
}
