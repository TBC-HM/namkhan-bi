// lib/dmc-match.ts
// Client-safe extract of the DMC fuzzy matcher.
//
// PBS 2026-06-29: lib/dmc.ts imports getSupabaseAdmin at module load, which
// pulls server-only env into any client bundle that touches it. The fuzzy
// matcher itself is a pure string function — moved here so 'use client'
// components (e.g., ChannelDrillDrawer) can import it without dragging the
// admin client into the browser.

export interface DmcContractMatch {
  contract_id: string;
  partner_short_name: string;
}

const SOURCE_ALIASES: Record<string, string> = {
  // booking source_name (lowercase) → canonical contract partner_short_name match key
  'exo travel': 'exotissimo',
  'exo': 'exotissimo',
  'arza travel (lao challenger travel)': 'arza',
  'discover laos.today': 'discoverlaostoday',
  'discoverlaos.today': 'discoverlaostoday',
};

const STOPWORDS = new Set([
  'travel', 'tours', 'tour', 'co', 'ltd', 'limited', 'inc', 'sole', 'company',
  'the', 'and', 'group', 'agency', 'agencies', 'lao', 'laos',
  'sarl', 'sa', 'pte', 'llc', 'llp', 'gmbh',
]);

function stem(t: string): string {
  if (!t) return '';
  if (t === 'laos') return 'lao';
  if (t.endsWith('s') && t.length > 4) return t.slice(0, -1);
  return t;
}

function tokens(s: string | null | undefined): string[] {
  if (!s) return [];
  const cleaned = s.toLowerCase().replace(/[.,()/\\]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned
    .split(' ')
    .map((w) => stem(w.replace(/[^a-z0-9]/g, '')))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function matchSourceToContract(
  sourceName: string | null,
  contracts: DmcContractMatch[],
): { contract_id: string | null; partner_short_name: string | null } {
  if (!sourceName) return { contract_id: null, partner_short_name: null };

  const aliasKey = sourceName.toLowerCase().trim();
  const aliasTarget = SOURCE_ALIASES[aliasKey];

  const srcTokens = aliasTarget ? [aliasTarget] : tokens(sourceName);
  if (srcTokens.length === 0) return { contract_id: null, partner_short_name: null };
  const srcSet = new Set(srcTokens);

  let best: { score: number; c: DmcContractMatch } | null = null;
  for (const c of contracts) {
    const contractTokens = tokens(c.partner_short_name);
    const stripped = c.partner_short_name
      .toLowerCase()
      .replace(/[.,()/\\]/g, ' ')
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ''))
      .filter((w) => w && !STOPWORDS.has(w))
      .join('');
    const contractFull = c.partner_short_name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const candidateSet = new Set([...contractTokens, contractFull, stripped].filter(Boolean));
    if (candidateSet.size === 0) continue;
    const overlap = [...candidateSet].filter((t) => srcSet.has(t)).length;
    if (overlap === 0) continue;
    const denom = contractTokens.length || 1;
    const minLen = Math.min(srcTokens.length, denom);
    if (overlap >= 2 || overlap === minLen) {
      const score = overlap / Math.max(srcTokens.length, denom);
      if (!best || score > best.score) best = { score, c };
    }
  }
  if (best) return { contract_id: best.c.contract_id, partner_short_name: best.c.partner_short_name };
  return { contract_id: null, partner_short_name: null };
}
