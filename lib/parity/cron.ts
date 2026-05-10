/**
 * Cron registration for the parity scraping agent — ticket #596
 *
 * Assumption: the project uses a cron-jobs.ts / scheduler pattern where
 * named slots are registered. Slot 44 in "parity-check-daily" is claimed here.
 * If your scheduler uses a different API, adapt the registerCronJob call.
 *
 * Slot 44 is interpreted as 04:44 UTC (HH:MM matching slot number convention
 * seen in similar boutique-hotel BI stacks). Adjust CRON_EXPRESSION if needed.
 */

import { runParityAgent } from './agent';

const CRON_EXPRESSION = '44 4 * * *'; // 04:44 UTC daily — slot 44
const JOB_NAME = 'parity-check-daily-slot44';

/**
 * Call this function from your app's scheduler bootstrap
 * (e.g. lib/cron/index.ts or pages/api/cron/index.ts).
 */
export function registerParityCron(
  scheduler: {
    register: (name: string, cron: string, fn: () => Promise<void>) => void;
  }
): void {
  scheduler.register(JOB_NAME, CRON_EXPRESSION, async () => {
    console.info(`[${JOB_NAME}] Starting scheduled parity agent run`);
    try {
      const result = await runParityAgent();
      console.info(`[${JOB_NAME}] Completed`, result);
    } catch (err) {
      console.error(`[${JOB_NAME}] Fatal error:`, (err as Error).message);
      // Do not rethrow — cron runner should not crash on agent failure
    }
  });
  console.info(`[${JOB_NAME}] Registered at cron '${CRON_EXPRESSION}'`);
}
