// app/revenue/_redesign/render.tsx
// Server-side helper: read a tab HTML chunk extracted from Federico's mockup,
// inject `active` class so it actually shows (mockup CSS hides .tab-content without it),
// and render via dangerouslySetInnerHTML.
// All `_redesign` files are colocated; the leading underscore keeps Next.js from routing them.

import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'app/revenue/_redesign');

export function MockupTab({ slug }: { slug: 'pulse' | 'pace' | 'channels' | 'rateplans' | 'pricing' | 'compset' | 'agentsettings' }) {
  let html = '';
  try {
    html = fs.readFileSync(path.join(DIR, `tab-${slug}.html`), 'utf8');
  } catch (e) {
    html = `<div style="padding:24px;color:#dc2626">Mockup section <code>tab-${slug}.html</code> not found.</div>`;
  }
  // Mockup CSS hides .tab-content unless .active is present. Force-show this slug.
  html = html.replace(/class="tab-content"/, 'class="tab-content active"');
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
