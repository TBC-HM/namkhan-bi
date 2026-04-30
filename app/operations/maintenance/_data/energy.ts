// app/operations/maintenance/_data/energy.ts
// Gap-M4 — ops.energy_meters + ops.energy_readings (manual v0; IoT later).
// Returns weather-normalised kWh/occ-rm and m³/occ-rm series.

import { supabase, PROPERTY_ID } from '@/lib/supabase';

export interface EnergyReadingRow {
  date: string;             // ISO
  kwh_per_occ_rm: number;
  m3_per_occ_rm: number;
  hdd?: number | null;       // heating degree days (weather-norm)
  cdd?: number | null;       // cooling degree days
  anomaly_flag?: boolean;
}

export async function fetchEnergyNormalised(): Promise<EnergyReadingRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('v_energy_normalised')
      .select('date, kwh_per_occ_rm, m3_per_occ_rm, hdd, cdd, anomaly_flag')
      .eq('property_id', PROPERTY_ID)
      .order('date', { ascending: false })
      .limit(60);
    if (error || !data || data.length === 0) return null;
    return data as EnergyReadingRow[];
  } catch {
    return null;
  }
}
