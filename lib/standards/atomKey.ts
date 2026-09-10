import { createHash } from 'crypto';

// Department-scoped, normalised key. Two source requirements that say the same
// thing to the same department collapse into one atom; the citation back to each
// source is kept in standards.atom_sources, so a merge is always reversible.
export function atomKeyFor(dept: string, text: string): string {
  const norm = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  const hash = createHash('sha256').update(`${dept}::${norm}`).digest('hex').slice(0, 16);
  const slug = norm.split(' ').slice(0, 8).join('-').slice(0, 60);
  return `${dept}:${slug}:${hash}`;
}
