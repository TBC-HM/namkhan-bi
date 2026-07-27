// lib/tileSweep.ts — deterministic tile extraction for the nightly tile sweep
// (kpi-conformance-battery §8/A7, ADR-173 anti-hallucination guarantee).
//
// Consumed by /api/cron/tile-sweep. Pure functions, no I/O: takes repo file
// contents (from the GitHub tarball of main) and returns the numeric-tile
// inventory. Two authored patterns are covered deterministically:
//   A. <KpiTile … label=…>            (design-system atom, all cockpit pages)
//   B. lib/dept-cfg  { k: '…', v: … } (department KPI strips)
// Dynamic labels (label={expr}) register once per expression — the sweep's
// job is "no tile computes an undefined number silently", not instance
// enumeration. kpi.kpi_catalog matching happens in SQL
// (public.fn_tile_sweep_ingest), not here.

export type SweepTile = {
  label: string;
  slug: string;
  file: string;
  kind: 'kpitile' | 'kpitile_dynamic' | 'kpitile_spread' | 'deptcfg';
  source_hint: string;
};

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Is this repo path in scope for the sweep? (repo-relative, no tarball root) */
export function isSweepCandidate(path: string): boolean {
  if (path.startsWith('lib/dept-cfg/') && (path.endsWith('.ts') || path.endsWith('.tsx'))) return true;
  if (!path.startsWith('app/') || !path.endsWith('.tsx')) return false;
  // exclusions: design-system internals + dev showcase render no production numbers
  if (path.includes('/_design/') || path.startsWith('app/dev/')) return false;
  return true;
}

/** Extract the label prop from one <KpiTile …> open-tag chunk. */
function labelFromKpiTileChunk(chunk: string): { label: string; dynamic: boolean } | null {
  // literal forms: label="…" | label={'…'} | label={"…"} | label={`…`} (no ${})
  const lit = chunk.match(/label=\s*(?:"([^"]*)"|\{\s*'([^']*)'\s*\}|\{\s*"([^"]*)"\s*\}|\{\s*`([^`$]*)`\s*\})/);
  if (lit) {
    const label = lit[1] ?? lit[2] ?? lit[3] ?? lit[4] ?? '';
    if (label.trim()) return { label: label.trim(), dynamic: false };
    return null;
  }
  // dynamic form: label={expr}
  const dyn = chunk.match(/label=\s*\{([^}]{1,120})\}/);
  if (dyn && dyn[1].trim()) return { label: `[dyn] ${dyn[1].trim()}`, dynamic: true };
  return null;
}

export function extractTilesFromFile(path: string, text: string): SweepTile[] {
  const tiles: SweepTile[] = [];

  if (path.startsWith('lib/dept-cfg/')) {
    // pattern B — dept KPI strip entries: { k: 'AGENTS', v: '65', d: '…' }
    const re = /\{\s*k:\s*'([^']+)'\s*,\s*v:/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const label = m[1].trim();
      if (!label) continue;
      tiles.push({ label, slug: slugify(label), file: path, kind: 'deptcfg', source_hint: 'dept-cfg k/v strip' });
    }
    return tiles;
  }

  // pattern A — KpiTile atoms
  let idx = 0;
  let spreadSeen = false;
  while ((idx = text.indexOf('<KpiTile', idx)) !== -1) {
    const chunk = text.slice(idx, idx + 800); // open tag is well within this
    const got = labelFromKpiTileChunk(chunk);
    if (got) {
      tiles.push({
        label: got.label,
        slug: got.dynamic ? `dyn_${slugify(got.label)}` : slugify(got.label),
        file: path,
        kind: got.dynamic ? 'kpitile_dynamic' : 'kpitile',
        source_hint: 'KpiTile atom',
      });
    } else if (!spreadSeen) {
      // data-driven usage (<KpiTile {...t}/> in a map) — labels come from
      // data. Register ONE sentinel per file so a new data-driven strip
      // still auto-registers and gets a definition pass.
      spreadSeen = true;
      const base = path.replace(/\.tsx$/, '').split('/').slice(-2).join('/');
      tiles.push({
        label: `[spread] ${base}`,
        slug: `dyn_spread_${slugify(base)}`,
        file: path,
        kind: 'kpitile_spread',
        source_hint: 'KpiTile data-driven (spread props)',
      });
    }
    idx += 8;
  }
  return tiles;
}

// ── minimal tar reader (GitHub tarball of main, already gunzipped) ────────
// 512-byte headers; handles ustar prefix, pax 'x' path override and GNU 'L'
// long names. Returns only sweep-candidate text files.

function readOctal(buf: Uint8Array, off: number, len: number): number {
  const s = Buffer.from(buf.slice(off, off + len)).toString('ascii').replace(/\0.*$/, '').trim();
  return s ? parseInt(s, 8) || 0 : 0;
}

function readStr(buf: Uint8Array, off: number, len: number): string {
  return Buffer.from(buf.slice(off, off + len)).toString('utf8').replace(/\0.*$/, '');
}

export function tarEntries(tar: Buffer): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  let pos = 0;
  let paxPath: string | null = null;
  let gnuLongName: string | null = null;

  while (pos + 512 <= tar.length) {
    const header = tar.subarray(pos, pos + 512);
    if (header.every((b) => b === 0)) break; // end-of-archive
    const size = readOctal(header, 124, 12);
    const type = String.fromCharCode(header[156]);
    let name = readStr(header, 0, 100);
    const prefix = readStr(header, 345, 155);
    if (prefix) name = `${prefix}/${name}`;

    const body = tar.subarray(pos + 512, pos + 512 + size);
    pos += 512 + Math.ceil(size / 512) * 512;

    if (type === 'x') {
      // pax extended header: records "<len> path=<value>\n"
      const pax = body.toString('utf8');
      const m = pax.match(/\d+ path=([^\n]+)\n/);
      paxPath = m ? m[1] : null;
      continue;
    }
    if (type === 'L') {
      gnuLongName = body.toString('utf8').replace(/\0.*$/, '');
      continue;
    }
    if (type !== '0' && type !== '\0') { paxPath = null; gnuLongName = null; continue; }

    const fullName = paxPath ?? gnuLongName ?? name;
    paxPath = null;
    gnuLongName = null;

    // strip the tarball root dir ("TBC-HM-namkhan-bi-<sha>/")
    const rel = fullName.replace(/^[^/]+\//, '');
    if (!isSweepCandidate(rel)) continue;
    out.push({ path: rel, text: body.toString('utf8') });
  }
  return out;
}

export function extractAllTiles(tar: Buffer): { files_scanned: number; tiles: SweepTile[] } {
  const entries = tarEntries(tar);
  const tiles: SweepTile[] = [];
  for (const e of entries) tiles.push(...extractTilesFromFile(e.path, e.text));
  return { files_scanned: entries.length, tiles };
}
