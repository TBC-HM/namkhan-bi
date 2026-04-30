// app/revenue/_redesign/chartReplace.ts
// Helper to swap the chart SVG inside a mockup section identified by its section-title text.
// Skips icon SVGs (those have viewBox "0 0 24 24"). Returns html unchanged if not found.

export function replaceChartInSection(html: string, sectionTitleText: string, newSvg: string): string {
  if (!newSvg) return html;
  // find the section header containing the title
  const titleIdx = html.indexOf(`>${sectionTitleText}<`);
  if (titleIdx < 0) return html;

  // search forward for the first non-icon <svg>
  let i = titleIdx;
  const max = html.length;
  while (i < max) {
    const svgStart = html.indexOf('<svg', i);
    if (svgStart < 0) return html;
    const tagEnd = html.indexOf('>', svgStart);
    if (tagEnd < 0) return html;
    const tag = html.slice(svgStart, tagEnd);
    const isIcon = /viewBox="0 0 24 24"/.test(tag);
    const closeTag = '</svg>';
    const svgEnd = html.indexOf(closeTag, tagEnd);
    if (svgEnd < 0) return html;
    if (isIcon) {
      i = svgEnd + closeTag.length;
      continue;
    }
    // replace this chart svg with newSvg
    return html.slice(0, svgStart) + newSvg + html.slice(svgEnd + closeTag.length);
  }
  return html;
}
