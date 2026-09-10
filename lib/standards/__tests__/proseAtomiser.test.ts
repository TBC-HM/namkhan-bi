import { atomiseChunk, parseAtomiserReply } from '../proseAtomiser';

const GOOD = JSON.stringify({ requirements: [
  { text: 'The hotel implements a linen and towel re-use programme.', section: '3.2 Water', dept_hint: 'housekeeping', category: 'sustainability' },
  { text: 'Guests are informed of the re-use programme in the room.', section: '3.2 Water', dept_hint: 'housekeeping', category: 'sustainability' },
]});

describe('parseAtomiserReply', () => {
  it('parses a well-formed reply', () => {
    expect(parseAtomiserReply(GOOD)).toHaveLength(2);
  });
  it('strips ```json fences the model adds despite instructions', () => {
    expect(parseAtomiserReply('```json\n' + GOOD + '\n```')).toHaveLength(2);
  });
  it('returns [] rather than throwing on unparseable output', () => {
    expect(parseAtomiserReply('I could not find any requirements.')).toEqual([]);
  });
  it('drops entries with no text instead of emitting empty requirements', () => {
    const bad = JSON.stringify({ requirements: [{ text: '' }, { text: '   ' }, { text: 'Real one.' }] });
    expect(parseAtomiserReply(bad)).toHaveLength(1);
  });
  it('caps runaway output at 40 requirements per chunk', () => {
    const many = JSON.stringify({ requirements: Array.from({ length: 200 }, (_, i) => ({ text: `Requirement ${i}` })) });
    expect(parseAtomiserReply(many).length).toBeLessThanOrEqual(40);
  });
});

describe('atomiseChunk', () => {
  it('never throws when the model call fails', async () => {
    const r = await atomiseChunk({ text: 'x', heading: null, authority: 'ASEAN',
      _call: async () => { throw new Error('Anthropic 400: credit balance is too low'); } });
    expect(r.degraded).toBe(true);
    expect(r.requirements).toEqual([]);
    expect(r.error).toContain('credit balance');
  });
  it('returns requirements and degraded=false on success', async () => {
    const r = await atomiseChunk({ text: 'x', heading: '3.2 Water', authority: 'ASEAN', _call: async () => GOOD });
    expect(r.degraded).toBe(false);
    expect(r.requirements).toHaveLength(2);
  });
  it('falls back to the chunk heading when the model omits a section', async () => {
    const noSection = JSON.stringify({ requirements: [{ text: 'A rule.' }] });
    const r = await atomiseChunk({ text: 'x', heading: '3.2 Water', authority: 'ASEAN', _call: async () => noSection });
    expect(r.requirements[0].section).toBe('3.2 Water');
  });
  it('never emits a requirement longer than 600 chars', async () => {
    const long = JSON.stringify({ requirements: [{ text: 'y'.repeat(2000) }] });
    const r = await atomiseChunk({ text: 'x', heading: null, authority: 'GSTC', _call: async () => long });
    expect(r.requirements[0].text.length).toBeLessThanOrEqual(600);
  });
});
