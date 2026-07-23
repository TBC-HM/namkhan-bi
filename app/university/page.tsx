// app/university/page.tsx
// TBC University · landing. THE ASK WINDOW sits on top (owner mandate:
// "prompt window on top"), module cards below. Newsletter is the first live
// module; Media / Director / Socials render as coming-soon cards.
// Paper-white house design, no property scoping (help is platform-wide).

import type { CSSProperties } from 'react';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import AskWindow from './_components/AskWindow';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const HAIR = '#E6DFCC';
const GREEN = '#084838';
const GOLD = '#B48A3A';

const card: CSSProperties = {
  background: '#FFFFFF', border: `1px solid ${HAIR}`, borderRadius: 6,
  padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
};

export default async function UniversityPage() {
  let liveCount = 0;
  try {
    const sb = getSupabaseAdmin();
    const { count } = await sb.from('v_university_articles')
      .select('slug', { count: 'exact', head: true })
      .eq('module', 'newsletter');
    liveCount = count ?? 0;
  } catch { /* landing still renders */ }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '20px 24px 60px', fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: INK }}>TBC University</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: INK_SOFT }}>
          How everything works — ask a question, or open a module guide.
        </p>
      </header>

      <AskWindow />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginTop: 18 }}>
        <a href="/university/newsletter" style={{ ...card, borderTop: `3px solid ${GREEN}`, textDecoration: 'none' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>Newsletter</div>
          <div style={{ fontSize: 12.5, color: INK_SOFT, lineHeight: 1.5 }}>
            Planning the calendar, accepting slots, reviewing drafts, photos, test sends, scheduling — and the automatic lifecycle emails.
          </div>
          <div style={{ marginTop: 'auto', fontSize: 11, fontWeight: 600, color: GREEN }}>
            {liveCount} articles · open the guide →
          </div>
        </a>

        {[
          { name: 'Media', blurb: 'The photo library, tiers and coverage.' },
          { name: 'Director', blurb: 'The planning calendar in depth.' },
          { name: 'Socials', blurb: 'Social posting and scheduling.' },
        ].map((m) => (
          <div key={m.name} style={{ ...card, opacity: 0.6 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{m.name}</div>
            <div style={{ fontSize: 12.5, color: INK_SOFT, lineHeight: 1.5 }}>{m.blurb}</div>
            <div style={{ marginTop: 'auto', fontSize: 11, fontWeight: 600, color: GOLD }}>Coming soon</div>
          </div>
        ))}
      </div>
    </div>
  );
}
