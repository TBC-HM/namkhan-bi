// dateParams.test.ts — plain assertions, no test runner globals needed by tsc
import { resolveWindow, resolveCompare } from './dateParams';

// These run as a plain script; swap for jest/vitest when the test runner is configured.
function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
}

// resolveWindow
(() => {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const w = resolveWindow('today');
  assert(w.from === todayStr, `today.from expected ${todayStr}, got ${w.from}`);
  assert(w.to === todayStr, `today.to expected ${todayStr}, got ${w.to}`);

  const w7 = resolveWindow('7d');
  const expected7 = new Date(today);
  expected7.setDate(expected7.getDate() - 6);
  assert(w7.from === expected7.toISOString().slice(0, 10), '7d.from');
  assert(w7.to === todayStr, '7d.to');

  const w30 = resolveWindow('30d');
  const expected30 = new Date(today);
  expected30.setDate(expected30.getDate() - 29);
  assert(w30.from === expected30.toISOString().slice(0, 10), '30d.from');

  const w90 = resolveWindow('90d');
  const expected90 = new Date(today);
  expected90.setDate(expected90.getDate() - 89);
  assert(w90.from === expected90.toISOString().slice(0, 10), '90d.from');

  const wYtd = resolveWindow('ytd');
  assert(wYtd.from === `${today.getFullYear()}-01-01`, 'ytd.from');
  assert(wYtd.to === todayStr, 'ytd.to');

  // unknown slug falls back to today
  const wUnk = resolveWindow('' as never);
  assert(wUnk.from === todayStr, 'unknown slug from');
  assert(wUnk.to === todayStr, 'unknown slug to');

  console.log('resolveWindow: all assertions passed');
})();

// resolveCompare
(() => {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // none — resolveCompare with null range returns null
  const none = resolveCompare('none', { from: todayStr, to: todayStr });
  assert(none === null, 'none should return null');

  // stly — same time last year
  const stlyFrom = new Date(today);
  stlyFrom.setFullYear(stlyFrom.getFullYear() - 1);
  const stlyTo = new Date(today);
  stlyTo.setFullYear(stlyTo.getFullYear() - 1);
  const stly = resolveCompare('stly', { from: todayStr, to: todayStr });
  assert(stly !== null, 'stly not null');
  assert(stly!.from === stlyFrom.toISOString().slice(0, 10), 'stly.from');
  assert(stly!.to === stlyTo.toISOString().slice(0, 10), 'stly.to');

  // prior — period of same length immediately before the window
  const sevenFrom = new Date(today);
  sevenFrom.setDate(sevenFrom.getDate() - 6);
  const sevenFromStr = sevenFrom.toISOString().slice(0, 10);
  const prior = resolveCompare('prior', { from: sevenFromStr, to: todayStr });
  assert(prior !== null, 'prior not null');
  const priorTo = new Date(sevenFrom);
  priorTo.setDate(priorTo.getDate() - 1);
  const priorFrom = new Date(priorTo);
  priorFrom.setDate(priorFrom.getDate() - 6);
  assert(prior!.from === priorFrom.toISOString().slice(0, 10), `prior.from expected ${priorFrom.toISOString().slice(0, 10)} got ${prior!.from}`);
  assert(prior!.to === priorTo.toISOString().slice(0, 10), 'prior.to');

  console.log('resolveCompare: all assertions passed');
})();

export {};
