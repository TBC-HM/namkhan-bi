'use client';
import { useState } from 'react';

const FOREST = '#084838'; const RED = '#B03826'; const AMBER = '#B48A3A';
const OK = '#0E7A4B'; const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC';
const INK = '#1B1B1B'; const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1';

interface Scores { thumbnail: number; title: number; description: number; tags: number; engagement: number; composite: number }
interface Props {
  videoId: string; videoTitle?: string | null;
  existingScore?: Scores | null;
  existingFeedback?: string | null;
  existingFlags?: string[] | null;
}

function scoreColor(s: number) { return s >= 75 ? OK : s >= 55 ? AMBER : RED; }

const DIMS: Array<{ key: keyof Scores; label: string; weight: string }> = [
  { key: 'thumbnail',   label: 'Thumbnail',      weight: '30%' },
  { key: 'title',       label: 'Title',           weight: '25%' },
  { key: 'description', label: 'Description',     weight: '20%' },
  { key: 'tags',        label: 'Tags & Playlist', weight: '15%' },
  { key: 'engagement',  label: 'Engagement',      weight: '10%' },
];

export default function ScoreVideoButton({ videoId, videoTitle, existingScore, existingFeedback, existingFlags }: Props) {
  const [state, setState] = useState<'idle' | 'scoring' | 'done' | 'error'>(existingScore ? 'done' : 'idle');
  const [scores, setScores] = useState<Scores | null>(existingScore ?? null);
  const [feedback, setFeedback] = useState(existingFeedback ?? '');
  const [flags, setFlags] = useState<string[]>(existingFlags ?? []);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');

  async function doScore() {
    setState('scoring'); setOpen(false);
    try {
      const res = await fetch('/api/marketing/youtube/score-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      const j = await res.json();
      if (j.ok) { setScores(j.scores); setFeedback(j.feedback ?? ''); setFlags(j.flags ?? []); setState('done'); setOpen(true); }
      else { setErr(j.error ?? 'error'); setState('error'); }
    } catch (e) { setErr(String(e)); setState('error'); }
  }

  const composite = scores?.composite ?? 0;

  if (state === 'scoring') return <div style={{ fontSize: 10, color: INK_M, padding: '3px 8px', border: '1px solid ' + HAIR, borderRadius: 3, textAlign: 'center' }}>Scoring…</div>;
  if (state === 'error')   return <div style={{ fontSize: 10, color: RED }}>{err.slice(0, 40)}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
      {state === 'done' && scores && (
        <div onClick={() => setOpen(o => !o)}
          style={{ cursor: 'pointer', textAlign: 'center', padding: '4px 10px',
            background: scoreColor(composite) + '18', border: '1px solid ' + scoreColor(composite) + '44',
            borderRadius: 3, minWidth: 52 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor(composite), lineHeight: 1 }}>{composite}%</div>
          <div style={{ fontSize: 8, color: scoreColor(composite), textTransform: 'uppercase', letterSpacing: '.05em' }}>Quality</div>
        </div>
      )}
      <button onClick={doScore} style={{
        fontSize: 10, padding: '2px 8px', border: '1px solid ' + HAIR,
        borderRadius: 3, background: WHITE, cursor: 'pointer',
        color: state === 'done' ? INK_M : FOREST, fontWeight: state === 'done' ? 400 : 600 }}>
        {state === 'done' ? '↺ Rescore' : '★ Score'}
      </button>

      {state === 'done' && open && scores && (
        <div style={{
          position: 'fixed', right: 20, top: '50%', transform: 'translateY(-50%)',
          zIndex: 500, width: 340, background: WHITE,
          border: '1px solid ' + HAIR, borderRadius: 8,
          boxShadow: '0 12px 40px rgba(0,0,0,.18)', fontSize: 12,
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid ' + HAIR, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, color: INK, fontSize: 14 }}>Quality score</div>
              <div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>{videoTitle?.slice(0, 50)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: scoreColor(composite) }}>{composite}%</div>
              <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: INK_M, lineHeight: 1 }}>×</button>
            </div>
          </div>

          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Overall bar */}
            <div style={{ height: 6, background: CREAM, borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${composite}%`, height: '100%', background: scoreColor(composite), borderRadius: 3 }} />
            </div>

            {DIMS.map(({ key, label, weight }) => {
              const val = scores[key];
              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: INK_M, fontSize: 11 }}>{label} <span style={{ color: HAIR, fontSize: 9 }}>{weight}</span></span>
                    <span style={{ fontWeight: 700, color: scoreColor(val), fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                  </div>
                  <div style={{ height: 5, background: CREAM, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${val}%`, height: '100%', background: scoreColor(val), borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}

            {feedback && (
              <div style={{ marginTop: 4, padding: '8px 10px', background: CREAM, borderRadius: 4, fontSize: 11, color: INK_M, lineHeight: 1.6 }}>
                {feedback}
              </div>
            )}

            {flags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                {flags.map((f, i) => (
                  <span key={i} style={{ fontSize: 9, padding: '2px 7px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: RED }}>{f}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
