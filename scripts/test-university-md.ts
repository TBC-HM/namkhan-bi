// scripts/test-university-md.ts
// TBC University · parser render test. Run: npx tsx scripts/test-university-md.ts
// Feeds three representative article shapes (incl. syntax edge cases) through
// parseUniversityMd and asserts block structure. Exits non-zero on failure.

import { parseUniversityMd, parseInline, type Block } from '../app/university/_lib/parseMd';

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { console.log(`  ok  ${name}`); }
  else { failures++; console.error(`FAIL  ${name}`, detail !== undefined ? JSON.stringify(detail, null, 2) : ''); }
}
function types(blocks: Block[]): string[] { return blocks.map((b) => b.t); }

// ── 1. How-to shape: lead + steps + callouts + shot + outcome ────────────────
const howTo = `Accepting a slot turns it into a draft campaign and queues the AI to write the full email.

## Accept one slot
1. On the Director page, click a slot title to open its drawer.
2. Click **Accept**. The slot updates instantly.
3. Wait 2–4 minutes.
   The email writes in the background.

![shot:director-accept.png|arrow:72,18|label:Click Accept here]

:::tip
If you do not want to wait, open the draft and click [Write email now](/university/newsletter/newsletter-write-email-now).
:::

Expected outcome: accepted slots turn into full drafts within a few minutes.`;

const b1 = parseUniversityMd(howTo);
check('how-to: block sequence', JSON.stringify(types(b1)) === JSON.stringify(['lead', 'h2', 'steps', 'shot', 'callout', 'outcome']), types(b1));
const steps1 = b1[2];
check('how-to: 3 steps with hanging continuation folded in', steps1.t === 'steps' && steps1.items.length === 3
  && steps1.items[2].some((n) => n.t === 'text' && n.v.includes('The email writes')), steps1);
const shot1 = b1[3];
check('how-to: shot file + arrow + label', shot1.t === 'shot' && shot1.file === 'director-accept.png'
  && shot1.arrows.length === 1 && shot1.arrows[0].x === 72 && shot1.arrows[0].y === 18
  && shot1.arrows[0].label === 'Click Accept here', shot1);
const co1 = b1[4];
check('how-to: tip callout contains university link chip', co1.t === 'callout' && co1.kind === 'tip'
  && co1.blocks.some((cb) => cb.t === 'p' && cb.inline.some((n) => n.t === 'link' && n.university)), co1);
check('how-to: outcome strips prefix', b1[5].t === 'outcome'
  && (b1[5] as { inline: { t: string; v?: string }[] }).inline.some((n) => n.t === 'text' && !/^Expected outcome/i.test(n.v ?? '')), b1[5]);

// ── 2. Reference shape: table + never-callout with list + custom title ───────
const reference = `Lifecycle emails fire by themselves around every reservation.

| Email | When |
|---|---|
| Booking confirmation | Day of booking, 10:00 |
| Pre-arrival welcome | 7 days before check-in, 09:00 |

:::never What staff must never do here
- Never edit the lifecycle email texts directly.
- Never change the timing rules.
:::

## If a guest says they got nothing
Check their spam folder first.`;

const b2 = parseUniversityMd(reference);
check('reference: block sequence', JSON.stringify(types(b2)) === JSON.stringify(['lead', 'table', 'callout', 'h2', 'p']), types(b2));
const tbl2 = b2[1];
check('reference: table 2 cols, 2 rows, separator dropped', tbl2.t === 'table' && tbl2.head.length === 2 && tbl2.rows.length === 2, tbl2);
const co2 = b2[2];
check('reference: never callout custom title + ul inside', co2.t === 'callout' && co2.kind === 'never'
  && co2.title === 'What staff must never do here'
  && co2.blocks.length === 1 && co2.blocks[0].t === 'ul' && co2.blocks[0].items.length === 2, co2);

// ── 3. Edge cases ────────────────────────────────────────────────────────────
const edge = `:::warning
Unclosed fences are tolerated — this article starts with a callout, so no lead.

![shot:multi.png|arrow:10,20|label:First|arrow:90,85|label:Second one]

![shot:bare.png]

1. Step with \`code\` and **bold** and a [normal link](https://example.com).

| lonely |
|---|

Paragraph after everything. Not a lead (callout came first).`;

const b3 = parseUniversityMd(edge);
const co3 = b3[0];
check('edge: unclosed warning fence swallows rest, parses inner blocks', co3.t === 'callout' && co3.kind === 'warning'
  && JSON.stringify(types(co3.blocks)) === JSON.stringify(['p', 'shot', 'shot', 'steps', 'table', 'p']), co3.t === 'callout' ? types(co3.blocks) : b3);
if (co3.t === 'callout') {
  const multi = co3.blocks[1];
  check('edge: two arrow/label pairs', multi.t === 'shot' && multi.arrows.length === 2
    && multi.arrows[1].x === 90 && multi.arrows[1].label === 'Second one', multi);
  const bare = co3.blocks[2];
  check('edge: bare shot, no arrows', bare.t === 'shot' && bare.file === 'bare.png' && bare.arrows.length === 0, bare);
  const st = co3.blocks[3];
  check('edge: step inline mix code/bold/external link', st.t === 'steps'
    && st.items[0].some((n) => n.t === 'code' && n.v === 'code')
    && st.items[0].some((n) => n.t === 'bold' && n.v === 'bold')
    && st.items[0].some((n) => n.t === 'link' && !n.university), st);
  const lone = co3.blocks[4];
  check('edge: single-col table, no rows', lone.t === 'table' && lone.head.length === 1 && lone.rows.length === 0, lone);
}
check('edge: arrow coords clamped to 0..100', (() => {
  const s = parseUniversityMd('![shot:x.png|arrow:150,-5|label:Clamped]')[0];
  return s.t === 'shot' && s.arrows[0].x === 100 && s.arrows[0].y === 0;
})());
check('edge: inline bold/code not confused', (() => {
  const inl = parseInline('**a** and `b` and [c](/university/newsletter/x)');
  return inl.some((n) => n.t === 'bold' && n.v === 'a') && inl.some((n) => n.t === 'code' && n.v === 'b')
    && inl.some((n) => n.t === 'link' && n.university && n.href === '/university/newsletter/x');
})());

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nAll parser tests passed.');

// ── 4. Real retrofitted articles (fixtures are md5-verified against the DB) ──
import { readFileSync } from 'fs';
import { join } from 'path';

const FIX = join(__dirname, '__fixtures__');
const load = (f: string) => readFileSync(join(FIX, f), 'utf8').replace(/\n$/, '');

const art1 = parseUniversityMd(load('newsletter-accept-slots.md'));
check('fixture accept-slots: lead first, 2 tips, 1 shot, outcome last',
  art1[0].t === 'lead'
  && art1.filter((b) => b.t === 'callout' && b.kind === 'tip').length === 2
  && art1.filter((b) => b.t === 'shot').length === 1
  && art1[art1.length - 1].t === 'outcome', types(art1));
check('fixture accept-slots: two step blocks of 3',
  art1.filter((b) => b.t === 'steps' && b.items.length === 3).length === 2, types(art1));

const art2 = parseUniversityMd(load('newsletter-ota-traveller-rules.md'));
const never = art2.find((b) => b.t === 'callout' && b.kind === 'never');
check('fixture ota-rules: never callout with title, ul + trailing p inside',
  !!never && never.t === 'callout' && never.title === 'What staff must NEVER change'
  && never.blocks.some((cb) => cb.t === 'ul') && never.blocks.some((cb) => cb.t === 'p'), never);
check('fixture ota-rules: warning callout + university link in ul',
  art2.some((b) => b.t === 'callout' && b.kind === 'warning')
  && art2.some((b) => b.t === 'ul' && b.items.some((it) => it.some((n) => n.t === 'link' && n.university))), types(art2));

const art3 = parseUniversityMd(load('newsletter-set-cadence.md'));
const t3 = art3.find((b) => b.t === 'table');
check('fixture set-cadence: 3-col table with 4 rows',
  !!t3 && t3.t === 'table' && t3.head.length === 3 && t3.rows.length === 4, t3);
check('fixture set-cadence: titled tip + outcome + 2 university links',
  art3.some((b) => b.t === 'callout' && b.kind === 'tip' && b.title === 'Why cadence matters')
  && art3[art3.length - 1].t === 'outcome'
  && art3.some((b) => b.t === 'ul' && b.items.flat().filter((n) => n.t === 'link' && n.university).length === 2), types(art3));

if (failures > 0) { console.error(`\n${failures} failure(s) incl. fixtures`); process.exit(1); }
console.log('Fixture render checks passed.');
