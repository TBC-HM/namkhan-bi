// app/revenue/_redesign/chartReplace.ts
// Helper to swap the chart SVG inside a mockup section identified by its section-title text.
// Skips icon SVGs (those have viewBox "0 0 24 24"). Bounds search to the parent .section block
// so it doesn't bleed into the next section's chart. Returns html unchanged if not found.

export function replaceChartInSection(html: string, sectionTitleText: string, newSvg: string): string {
  if (!newSvg) return html;
  const titleIdx = html.indexOf(`>${sectionTitleText}<`);
  if (titleIdx < 0) return html;

  // walk backward from title to find the enclosing <div class="section"> opening tag
  const sectionOpenIdx = html.lastIndexOf('<div class="section"', titleIdx);
  if (sectionOpenIdx < 0) return html;

  // walk forward from sectionOpenIdx, tracking nested div depth, to find the matching </div>
  let depth = 0;
  let i = sectionOpenIdx;
  let sectionEnd = -1;
  while (i < html.length) {
    if (html.startsWith('<div', i)) {
      depth++;
      const close = html.indexOf('>', i);
      if (close < 0) break;
      i = close + 1;
    } else if (html.startsWith('</div>', i)) {
      depth--;
      i += 6;
      if (depth === 0) {
        sectionEnd = i;
        break;
      }
    } else {
      i++;
    }
  }
  if (sectionEnd < 0) sectionEnd = html.length;

  // search forward from titleIdx, but stop at sectionEnd, for the first non-icon <svg>
  let cursor = titleIdx;
  while (cursor < sectionEnd) {
    const svgStart = html.indexOf('<svg', cursor);
    if (svgStart < 0 || svgStart >= sectionEnd) return html;
    const tagEnd = html.indexOf('>', svgStart);
    if (tagEnd < 0) return html;
    const tag = html.slice(svgStart, tagEnd);
    const isIcon = /viewBox="0 0 24 24"/.test(tag);
    const closeTag = '</svg>';
    const svgEnd = html.indexOf(closeTag, tagEnd);
    if (svgEnd < 0 || svgEnd >= sectionEnd) return html;
    if (isIcon) {
      cursor = svgEnd + closeTag.length;
      continue;
    }
    return html.slice(0, svgStart) + newSvg + html.slice(svgEnd + closeTag.length);
  }
  return html;
}
