// Parses the SLH Mystery Inspection body already stored in
// dms.documents.extracted_md. Deterministic and AI-free on purpose: the SLH
// report is a numbered questionnaire, so parsing it with a model would add cost,
// latency and non-determinism for no gain.

export interface SlhRequirement {
  section: string;
  subsection: string | null;
  question_no: number;
  text: string;
  verdict: 'Yes' | 'No' | 'NA' | null;
  missed: boolean;
}

const HEADER = /^##\s+(.+?)\s+([\d.]+)\/([\d.]+)\s+\(\s*([\d.]+)\s*%\s*\)/;
const QUESTION = /^\s*(\d{1,3})\s+(.+)$/;
const TRAILING_VERDICT = /\s+(Yes|No|NA)\s*$/;

export function parseSectionHeader(
  line: string,
): { section: string; got: number; max: number; pct: number } | null {
  // Strip the human annotation (*** … ***) before matching so it cannot be
  // mistaken for part of the section name.
  const m = HEADER.exec(line.replace(/\s*\*\*\*.*$/, ''));
  if (!m) return null;
  return { section: m[1].trim(), got: Number(m[2]), max: Number(m[3]), pct: Number(m[4]) };
}

export function parseSlhInspection(md: string): SlhRequirement[] {
  const out: SlhRequirement[] = [];
  let section = 'Unsectioned';

  for (const rawLine of (md || '').split('\n')) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    const header = parseSectionHeader(line);
    if (header) { section = header.section; continue; }

    const q = QUESTION.exec(line);
    if (!q) continue;

    let text = q[2];
    const missed = text.includes('[MISS]');
    text = text.replace(/\s*\[MISS\]\s*/g, ' ').trimEnd();

    const v = TRAILING_VERDICT.exec(text);
    const verdict = (v ? v[1] : null) as SlhRequirement['verdict'];
    if (v) text = text.slice(0, v.index).trimEnd();

    // A section name like "In Room Dining - Delivery" carries its own subsection.
    const dash = section.indexOf(' - ');
    out.push({
      section: dash === -1 ? section : section,
      subsection: dash === -1 ? null : section.slice(dash + 3),
      question_no: Number(q[1]),
      text,
      verdict,
      missed,
    });
  }
  return out;
}
