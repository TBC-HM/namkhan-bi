'use client';

// app/holding/it/cockpit/specs/new/SpecBuilderClient.tsx
// PBS 2026-07-24: Goal-driven spec builder.
// Guides you through 7 sections to produce a complete, testable build brief
// that an autonomous agent can act on without needing further clarification.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MultiItem { id: string; value: string }
function mkItem(v = ''): MultiItem { return { id: Math.random().toString(36).slice(2), value: v } }

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = {
  section: { marginBottom: 32 } as React.CSSProperties,
  h: { fontSize: 16, fontWeight: 700, color: '#1B1B1B', margin: '0 0 4px' } as React.CSSProperties,
  sub: { fontSize: 12, color: '#5A5A5A', margin: '0 0 16px' } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: '#5A5A5A', display: 'block', marginBottom: 5 },
  input: { fontSize: 13, padding: '8px 10px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B', width: '100%', boxSizing: 'border-box' as const },
  textarea: { fontSize: 13, padding: '8px 10px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B', width: '100%', boxSizing: 'border-box' as const, minHeight: 88, resize: 'vertical' as const, lineHeight: 1.5 },
  select: { fontSize: 13, padding: '8px 10px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B', cursor: 'pointer' },
  addBtn: { fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 3, background: 'transparent', color: '#1F3A2E', border: '1px solid #1F3A2E', cursor: 'pointer', marginTop: 6 },
  removeBtn: { fontSize: 11, padding: '4px 8px', borderRadius: 3, background: 'transparent', color: '#B8542A', border: '1px solid #B8542A', cursor: 'pointer', flexShrink: 0 },
  row: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 } as React.CSSProperties,
  submitBtn: { fontSize: 13, fontWeight: 700, padding: '10px 28px', borderRadius: 4, background: '#1F3A2E', color: '#FFFFFF', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' },
  pill: (active: boolean): React.CSSProperties => ({ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 99, cursor: 'pointer', border: '1px solid', borderColor: active ? '#1F3A2E' : '#E6DFCC', background: active ? '#1F3A2E' : '#FFFFFF', color: active ? '#FFFFFF' : '#5A5A5A', marginRight: 6, marginBottom: 6 }),
  fieldGroup: { marginBottom: 18 } as React.CSSProperties,
  divider: { borderTop: '1px solid #E6DFCC', margin: '28px 0' } as React.CSSProperties,
};

const DATA_SOURCES = ['PMS / Cloudbeds', 'POS / Poster', 'Google APIs', 'QuickBooks GL', 'Supabase custom tables', 'Manual entry by staff', 'External scrape', 'Other'];
const PRIORITIES = ['P1 — Critical (blocks operations)', 'P2 — Important (needed this week)', 'P3 — Enhancement (nice to have)'];

// ─── Multi-item input helper ──────────────────────────────────────────────────
function MultiInput({ items, onChange, placeholder }: { items: MultiItem[]; onChange: (v: MultiItem[]) => void; placeholder: string }) {
  return (
    <>
      {items.map((item, i) => (
        <div key={item.id} style={S.row}>
          <input style={S.input} value={item.value} placeholder={`${placeholder} ${i + 1}`}
            onChange={e => onChange(items.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
          {items.length > 1 && (
            <button type="button" style={S.removeBtn} onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
          )}
        </div>
      ))}
      <button type="button" style={S.addBtn} onClick={() => onChange([...items, mkItem()])}>+ Add another</button>
    </>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────
export default function SpecBuilderClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Section 1 — Identity
  const [moduleName, setModuleName] = useState('');
  const [appPath, setAppPath] = useState('');
  const [priority, setPriority] = useState(PRIORITIES[1]);

  // Section 2 — Goal
  const [goalStatement, setGoalStatement] = useState('');
  const [doneMetric, setDoneMetric] = useState('');

  // Section 3 — Current state
  const [whatWorks, setWhatWorks] = useState('');
  const [bugs, setBugs] = useState([mkItem()]);
  const [missing, setMissing] = useState([mkItem()]);

  // Section 4 — Data
  const [dataSources, setDataSources] = useState<string[]>([]);
  const [dataDetails, setDataDetails] = useState('');

  // Section 5 — UI
  const [pages, setPages] = useState([mkItem()]);
  const [mainView, setMainView] = useState('');
  const [columns, setColumns] = useState([mkItem()]);
  const [filters, setFilters] = useState([mkItem()]);

  // Section 6 — Acceptance
  const [acceptanceCriteria, setAcceptanceCriteria] = useState([mkItem(), mkItem(), mkItem()]);

  // Section 7 — Out of scope
  const [outOfScope, setOutOfScope] = useState([mkItem()]);

  function buildContentMd(): string {
    const bugsClean = bugs.map(b => b.value).filter(Boolean);
    const missingClean = missing.map(m => m.value).filter(Boolean);
    const pagesClean = pages.map(p => p.value).filter(Boolean);
    const colsClean = columns.map(c => c.value).filter(Boolean);
    const filtersClean = filters.map(f => f.value).filter(Boolean);
    const acClean = acceptanceCriteria.map(a => a.value).filter(Boolean);
    const oosClean = outOfScope.map(o => o.value).filter(Boolean);

    return `# Spec: ${moduleName}
*Generated via Spec Builder · ${new Date().toISOString().slice(0, 10)} · Priority: ${priority.split(' — ')[0]}*

## §1 Goal
> ${goalStatement}

**Done-metric:** ${doneMetric}

**App path:** \`${appPath}\`

## §2 Current state
**What works:**
${whatWorks || '(not specified)'}

**Bugs / things I don't like:**
${bugsClean.map(b => `- ${b}`).join('\n') || '- None listed'}

**Missing entirely:**
${missingClean.map(m => `- ${m}`).join('\n') || '- None listed'}

## §3 Data sources
**Sources:** ${dataSources.join(', ') || 'Not specified'}

**Details:**
${dataDetails || '(not specified)'}

## §4 Expected UI

**Pages / sub-pages:**
${pagesClean.map(p => `- ${p}`).join('\n') || '- (not specified)'}

**Main view description:**
${mainView || '(not specified)'}

**Columns / tiles needed:**
${colsClean.map(c => `- ${c}`).join('\n') || '- (not specified)'}

**Filters needed:**
${filtersClean.map(f => `- ${f}`).join('\n') || '- None'}

## §5 Acceptance criteria (testable)
${acClean.map((a, i) => `${i + 1}. ${a}`).join('\n') || '1. (not specified)'}

## §6 Out of scope (this iteration)
${oosClean.map(o => `- ${o}`).join('\n') || '- None specified'}
`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!moduleName.trim() || !goalStatement.trim()) {
      setErr('Module name and goal statement are required.');
      return;
    }
    setErr(null);
    startTransition(async () => {
      const res = await fetch('/api/specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: `spec-${moduleName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          title: `Spec: ${moduleName}`,
          content_md: buildContentMd(),
          tags: ['spec', 'questionnaire', moduleName.toLowerCase().replace(/\s+/g, '-')],
          status: 'ready',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json.error ?? 'Save failed'); return; }
      setSaved(json.slug);
    });
  }

  if (saved) {
    return (
      <div style={{ padding: '32px 24px', maxWidth: 720 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2E7D32', marginBottom: 8 }}>✓ Spec saved</div>
        <p style={{ fontSize: 13, color: '#5A5A5A', marginBottom: 20 }}>
          Slug: <code style={{ background: '#F4EFE2', padding: '2px 6px', borderRadius: 3 }}>{saved}</code>
          <br />The build brief is in <code>documentation.build_briefs</code> · status: ready.
          An agent can now run the goal-loop against this spec.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.submitBtn} onClick={() => { setSaved(null); setModuleName(''); setGoalStatement(''); }}>New spec</button>
          <button style={{ ...S.submitBtn, background: '#5A5A5A' }} onClick={() => router.push('/holding/it/cockpit/specs')}>View all specs</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 760, padding: '24px 0' }}>

      {/* §1 Identity */}
      <div style={S.section}>
        <h2 style={S.h}>1 · What are we building?</h2>
        <p style={S.sub}>Name the module and tell me where it lives in the app.</p>
        <div style={S.fieldGroup}>
          <label style={S.label}>Module name *</label>
          <input style={S.input} value={moduleName} onChange={e => setModuleName(e.target.value)} placeholder="e.g. Social Media Posting Module" required />
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>App path(s)</label>
          <input style={S.input} value={appPath} onChange={e => setAppPath(e.target.value)} placeholder="e.g. /marketing/social, /marketing/channels" />
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>Priority</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 4 }}>
            {PRIORITIES.map(p => (
              <button key={p} type="button" style={S.pill(priority === p)} onClick={() => setPriority(p)}>{p.split(' — ')[0]}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={S.divider} />

      {/* §2 Goal */}
      <div style={S.section}>
        <h2 style={S.h}>2 · What's the goal?</h2>
        <p style={S.sub}>Describe what a user can do when this is done that they can't do today. Be specific.</p>
        <div style={S.fieldGroup}>
          <label style={S.label}>Goal statement *</label>
          <textarea style={S.textarea} value={goalStatement} onChange={e => setGoalStatement(e.target.value)}
            placeholder="e.g. Staff can compose a social post for Instagram/Facebook/LinkedIn, schedule it with a date+time, and see it go live — all from one page without leaving the BI app." required />
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>How will we know it's working? (one clear metric)</label>
          <input style={S.input} value={doneMetric} onChange={e => setDoneMetric(e.target.value)}
            placeholder="e.g. A post scheduled here actually publishes on the channel at the set time" />
        </div>
      </div>

      <div style={S.divider} />

      {/* §3 Current state */}
      <div style={S.section}>
        <h2 style={S.h}>3 · Where are we now?</h2>
        <p style={S.sub}>Be honest about what works, what's broken, and what doesn't exist yet.</p>
        <div style={S.fieldGroup}>
          <label style={S.label}>What's working right now?</label>
          <textarea style={S.textarea} value={whatWorks} onChange={e => setWhatWorks(e.target.value)}
            placeholder="e.g. The sub-menu tab exists. The page loads. Basic post form renders." />
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>Bugs / things I don't like (be specific)</label>
          <MultiInput items={bugs} onChange={setBugs} placeholder="Bug" />
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>What's completely missing?</label>
          <MultiInput items={missing} onChange={setMissing} placeholder="Missing feature" />
        </div>
      </div>

      <div style={S.divider} />

      {/* §4 Data */}
      <div style={S.section}>
        <h2 style={S.h}>4 · Where does the data come from?</h2>
        <p style={S.sub}>Select all sources that feed this module. Then describe exactly what you need from each.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 12 }}>
          {DATA_SOURCES.map(src => {
            const active = dataSources.includes(src);
            return (
              <button key={src} type="button" style={S.pill(active)}
                onClick={() => setDataSources(active ? dataSources.filter(s => s !== src) : [...dataSources, src])}>
                {src}
              </button>
            );
          })}
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>What specifically from each source? Which tables/fields/APIs?</label>
          <textarea style={{ ...S.textarea, minHeight: 72 }} value={dataDetails} onChange={e => setDataDetails(e.target.value)}
            placeholder="e.g. From Supabase: marketing.social_posts table. From Instagram Graph API: publish endpoint. Post content, image URL, scheduled_at field." />
        </div>
      </div>

      <div style={S.divider} />

      {/* §5 UI */}
      <div style={S.section}>
        <h2 style={S.h}>5 · What should the UI look like?</h2>
        <p style={S.sub}>List the pages, describe what you expect to see, columns, and filters. Don't worry about design — just function.</p>
        <div style={S.fieldGroup}>
          <label style={S.label}>Pages / sub-pages that should exist</label>
          <MultiInput items={pages} onChange={setPages} placeholder="Page" />
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>Describe the main view (what do you see when you land on it?)</label>
          <textarea style={S.textarea} value={mainView} onChange={e => setMainView(e.target.value)}
            placeholder="e.g. A scheduled posts calendar. Below it, a compose form: channel picker, image upload, caption, date+time picker, publish button. Right panel: past posts with status." />
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>Columns / tiles / data fields you need visible</label>
          <MultiInput items={columns} onChange={setColumns} placeholder="Column or tile" />
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>Filters needed</label>
          <MultiInput items={filters} onChange={setFilters} placeholder="Filter" />
        </div>
      </div>

      <div style={S.divider} />

      {/* §6 Acceptance */}
      <div style={S.section}>
        <h2 style={S.h}>6 · How do we know it's done?</h2>
        <p style={S.sub}>Write 3–5 statements that can be checked as pass/fail. Start with "When I…" or "The page shows…"</p>
        <MultiInput items={acceptanceCriteria} onChange={setAcceptanceCriteria} placeholder="Acceptance criterion" />
      </div>

      <div style={S.divider} />

      {/* §7 Out of scope */}
      <div style={S.section}>
        <h2 style={S.h}>7 · What's out of scope for now?</h2>
        <p style={S.sub}>Explicitly list what NOT to build in this iteration. This prevents scope creep and helps the agent stay focused.</p>
        <MultiInput items={outOfScope} onChange={setOutOfScope} placeholder="Out of scope item" />
      </div>

      {err && <div style={{ fontSize: 12, color: '#B8542A', padding: '8px 12px', background: '#F7E2DC', borderRadius: 3, marginBottom: 16 }}>{err}</div>}

      <button type="submit" disabled={isPending} style={{ ...S.submitBtn, opacity: isPending ? 0.6 : 1 }}>
        {isPending ? 'Saving spec…' : 'Save spec → build brief'}
      </button>
      <span style={{ fontSize: 12, color: '#5A5A5A', marginLeft: 14 }}>Saves to documentation.build_briefs · status: ready</span>
    </form>
  );
}
