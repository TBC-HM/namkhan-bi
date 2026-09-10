import { parseSlhInspection, parseSectionHeader } from '../slhParser';

// Verbatim shape of dms.documents.extracted_md for doc a1c2e6d0-…-2026081900aa.
const SAMPLE = `## Turndown Service 0/14 (0 %)  *** HARD ZERO - LARGEST SINGLE POINT LOSS IN THE REPORT ***
116 Turndown was completed at a convenient time. No  [MISS]
117 The bed was turned down. No  [MISS]
119 The lighting level was adjusted. Yes

## In Room Dining - Delivery 18.2/30.4 (59.9 %)  *** DRIVER OF THE 72.7% IRD SCORE ***
222 Staff member knocked on door and announced themselves and/or department. Yes
224 You were respectfully addressed by your name or title (sir/madam). NA
`;

describe('parseSectionHeader', () => {
  it('reads name, score and percentage, discarding the *** annotation', () => {
    const h = parseSectionHeader('## Turndown Service 0/14 (0 %)  *** HARD ZERO ***');
    expect(h).toEqual({ section: 'Turndown Service', got: 0, max: 14, pct: 0 });
  });

  it('keeps hyphens that are part of the section name', () => {
    const h = parseSectionHeader('## In Room Dining - Delivery 18.2/30.4 (59.9 %)');
    expect(h!.section).toBe('In Room Dining - Delivery');
    expect(h!.max).toBe(30.4);
  });

  it('returns null for a non-header line', () => {
    expect(parseSectionHeader('116 Turndown was completed at a convenient time. No')).toBeNull();
  });
});

describe('parseSlhInspection', () => {
  it('extracts every numbered question', () => {
    expect(parseSlhInspection(SAMPLE).map(r => r.question_no)).toEqual([116, 117, 119, 222, 224]);
  });

  it('attributes each question to the section it appears under', () => {
    const r = parseSlhInspection(SAMPLE);
    expect(r.find(x => x.question_no === 117)!.section).toBe('Turndown Service');
    expect(r.find(x => x.question_no === 222)!.section).toBe('In Room Dining - Delivery');
  });

  it('captures the verdict and strips it from the question text', () => {
    const q = parseSlhInspection(SAMPLE).find(x => x.question_no === 117)!;
    expect(q.verdict).toBe('No');
    expect(q.text).toBe('The bed was turned down.');
    expect(q.text).not.toMatch(/\b(Yes|No|NA)\s*$/);
  });

  it('flags [MISS] separately from the verdict and keeps it out of the text', () => {
    const rows = parseSlhInspection(SAMPLE);
    expect(rows.find(x => x.question_no === 116)!.missed).toBe(true);
    expect(rows.find(x => x.question_no === 119)!.missed).toBe(false);
    expect(rows.find(x => x.question_no === 116)!.text).not.toContain('[MISS]');
  });

  it('treats NA as a verdict, not a miss', () => {
    const q = parseSlhInspection(SAMPLE).find(x => x.question_no === 224)!;
    expect(q.verdict).toBe('NA');
    expect(q.missed).toBe(false);
  });

  it('returns an empty array for text with no questions, rather than throwing', () => {
    expect(parseSlhInspection('## Some Section 1/1 (100 %)\nno numbered lines here')).toEqual([]);
  });
});
