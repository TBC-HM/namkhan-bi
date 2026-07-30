// lib/forecast/index.ts
// Forecasting capability v1 — public entry point.
// runMonthlyForecast() = fetch inputs (public bridge views only) + run the
// pure deterministic engine. Statistics only — no LLM in the prediction path
// (BINDING rule 1, brief forecasting-module-v1).

import { fetchEngineInputs } from './data';
import { runEngine } from './engine';
import type { EngineRun } from './types';

export * from './types';
export {
  runEngine,
  forecastMonth,
  bookingWindowShare,
  computePaceRatio,
  addMonths,
  stlyMonth,
  monthStartIso,
  monthEndIso,
} from './engine';
export { fetchEngineInputs, fetchActualsByMonth, fetchOtbByMonth, fetchPaceSignal } from './data';

/**
 * Run the v1 statistical engine: Occupancy %, ADR, RevPAR and Rooms Revenue
 * forecast for the next 12 months (USALI names; Namkhan = PMS-layer USD).
 * Server-only (reads via service-role client). Returns null on total data
 * failure so surfaces can render an honest empty state instead of zeros.
 */
export async function runMonthlyForecast(
  propertyId: number,
  runDate: string,
  horizonMonths = 12,
): Promise<EngineRun | null> {
  try {
    const inputs = await fetchEngineInputs(propertyId, runDate, horizonMonths);
    if (inputs.actualsByMonth.size === 0 && inputs.otbByMonth.size === 0) return null;
    return runEngine(inputs, horizonMonths);
  } catch (e) {
    console.error('[lib/forecast] runMonthlyForecast failed', e);
    return null;
  }
}
