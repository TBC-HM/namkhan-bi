'use client';

// app/holding/it/cockpit/specs/new/SpecBuilderClient.tsx
// v2 2026-07-24: added References section (URLs + screenshots)
// + auto-injected agent context footer in generated brief

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface MultiItem { id: string; value: string }
interface RefItem { id: string; url: string; label: string }
interface ScreenshotItem { id: string; url: string; name: string }

function mkId() { return Math.random().toString(36).slice(2) }
function mkItem(v = ''): MultiItem { return { id: mkId(), value: v } }
function mkRef(): RefItem { return { id: mkId(), url: '', label: '' } }

const S = {
  section: { marginBottom: 32 } as React.CSSProperties,
  h: { fontSize: 16, fontWeight: 700, color: '#1B1B1B', margin: '0 0 4px' } as React.CSSProperties,
  sub: { fontSize: 12, color: '#5A5A5A', margin: '0 0 16px', lineHeight: 1.5 } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: '#5A5A5A', display: 'block', marginBottom: 5 },
  input: { fontSize: 13, padding: '8px 10px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B', width: '100%', boxSizing: 'border-box' as const },
  textarea: { fontSize: 13, padding: '8px 10px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B', width: '100%', boxSizing: 'border-box' as const, minHeight: 88, resize: 'vertical' as const, lineHeight: 1.5 },
  addBtn: { fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 3, background: 'transparent', color: '#1F3A2E', border: '1px solid #1F3A2E', cursor: 'pointer', marginTop: 6 },
  removeBtn: { fontSize: 11, padding: '4px 8px', borderRadius: 3, background: 'transparent', color: '#B8542A', border: '1px solid #B8542A', cursor: 'pointer', flexShrink: 0 },
  row: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 } as React.CSSProperties,
  submitBtn: { fontSize: 13, fontWeight: 700, padding: '10px 28px', borderRadius: 4, background: '#1F3A2E', color: '#FFFFFF', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' },
  pill: (active: boolean): React.CSSProperties => ({ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 99, cursor: 'pointer', border: '1px solid', borderColor: active ? '#1F3A2E' : '#E6DFCC', background: active ? '#1F3A2E' : '#FFFFFF', color: active ? '#FFFFFF' : '#5A5A5A', marginRight: 6, marginBottom: 6 }),
  fieldGroup: { marginBottom: 18 } as React.CSSProperties,
  divider: { borderTop: '1px solid #E6DFCC', margin: '28px 0' } as React.CSSProperties,
  imgThumb: { width: 80, height: 60, objectFit: 'cover' as const, borderRadius: 4, border: '1px solid #E6DFCC' },
};

const DATA_SOURCES = ['PMS / Cloudbeds', 'POS / Poster', 'Google APIs', 'QuickBooks GL', 'Supabase custom tables', 'Manual entry by staff', 'External scrape', 'Other'];
const PRIORITIES = ['P1 — Critical (blocks operations)', 'P2 — Important (needed this week)', 'P3 — Enhancement (nice to have)'];

const AGENT_CONTEXT = `
## §8 Agent context (auto-injected — do not edit)

### Design system
- Read \`documentation.documents\` where \`doc_type='design_system'\` before touching any UI
- Primitives: \`@/app/(cockpit)/_design\` → \`DashboardPage\`, \`Container\`, \`KpiTile\`, \`MetricRow\`, \`ListContainer\`, \`SplitContainer\`
- Page background: white (#FFFFFF hardcoded) · Hairline: #E6DFCC · Ink: #1B1B1B · Primary: #1F3A2E
- Tab strip: thin sans-serif, active = primary underline. NO custom tab components.
- var(--paper-warm) resolves DARK on Namkhan — always hardcode #FFFFFF for backgrounds

### Architecture
- Read \`documentation.documents\` where \`doc_type='architecture'\` for full system map
- Read \`documentation.documents\` where \`doc_type='claude_md'\` for operating rules
- Read \`documentation.documents\` where \`doc_type='data_model'\` for schema reference

### Properties
- Namkhan: property_id=260955 · The Namkhan Luang Prabang · USD
- Donna: property_id=1000001 · Donna Mallorca · EUR
- Holding: property_id=0 · Beyond Circle HQ

### Deploy rules
- GitHub push → main → Vercel auto-deploys. NO vercel CLI. NO /tmp staging.
- Push via \`gh api PUT /repos/TBC-HM/namkhan-bi/contents/{path}\` with base64 content.
- Guard every PUT: check CONTENT not empty before pushing.

### Schema access rules
- PostgREST exposes ONLY public schema. Non-public schemas (inv, procurement, ops, media, marketing, documentation): use \`getSupabaseAdmin()\` or SECURITY DEFINER RPC.
- New tables need GRANT to service_role or they 500 silently.
- \`sb.schema('non_public').update()\` silently no-ops — use RPC for writes.

### Quality bar
- All 10 acceptance criteria in §6 must pass before marking done.
- tsc --noEmit must pass. No any[] in new code without explicit justification.
- Test on both Namkhan + Donna routes if the feature is multi-property.
`.trim();

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

export default function SpecBuilderClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // §1 Identity
  const [moduleName, setModuleName] = useState('');
  const [appPath, setAppPath] = useState('');
  const [priority, setPriority] = useState(PRIORITIES[1]);
  // §2 Goal
  const [goalStatement, setGoalStatement] = useState('');
  const [doneMetric, setDoneMetric] = useState('');
  // §3 Current state
  const [whatWorks, setWhatWorks] = useState('');
  const [bugs, setBugs] = useState([mkItem()]);
  const [missing, setMissing] = useState([mkItem()]);
  // §4 Data
  const [dataSources, setDataSources] = useState<string[]>([]);
  const [dataDetails, setDataDetails] = useState('');
  // §5 UI
  const [pages, setPages] = useState([mkItem()]);
  const [mainView, setMainView] = useState('');
  const [columns, setColumns] = useState([mkItem()]);
  const [filters, setFilters] = useState([mkItem()]);
  // §6 Acceptance
  const [acceptance, setAcceptance] = useState([mkItem(), mkItem(), mkItem()]);
  // §7 Out of scope
  const [outOfScope, setOutOfScope] = useState([mkItem()]);
  // §8 References
  const [refs, setRefs] = useState<RefItem[]>([mkRef()]);
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);

  // ── Upload screenshot ────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('module', moduleName || 'spec');
      const res = await fetch('/api/specs/attachments', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.url) {
        setScreenshots(prev => [...prev, { id: mkId(), url: json.url, name: file.name }]);
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  // ── Build content_md ─────────────────────────────────────────────────────
  function buildContentMd(): string {
    const fmt = (items: MultiItem[]) => items.map(i => i.value).filter(Boolean).map(v => `- ${v}`).join('\n') || '- (none specified)';
    const refsClean = refs.filter(r => r.url);
    const ssClean = screenshots;

    return `# Spec: ${moduleName}
*Generated via Spec Builder · ${new Date().toISOString().slice(0, 10)} · Priority: ${priority.split(' — ')[0]}*

## §1 Goal
> ${goalStatement}

**Done-metric:** ${doneMetric || '(not specified)'}
**App path:** \`${appPath || '(not specified)'}\`

## §2 Current state
**What works:**
${whatWorks || '(not specified)'}

**Bugs / things I don't like:**
${fmt(bugs)}

**Missing entirely:**
${fmt(missing)}

## §3 Data sources
**Sources:** ${dataSources.join(', ') || 'Not specified'}

**Details:**
${dataDetails || '(not specified)'}

## §4 Expected UI

**Pages / sub-pages:**
${fmt(pages)}

**Main view description:**
${mainView || '(not specified)'}

**Columns / tiles needed:**
${fmt(columns)}

**Filters needed:**
${fmt(filters)}

## §5 Acceptance criteria (testable)
${acceptance.map((a, i) => a.value ? `${i + 1}. ${a.value}` : '').filter(Boolean).join('\n') || '1. (not specified)'}

## §6 Out of scope (this iteration)
${fmt(outOfScope)}

## §7 References & Inspiration
${refsClean.length ? refsClean.map(r => `- [${r.label || r.url}](${r.url})`).join('\n') : '- None provided'}

${ssClean.length ? `### Screenshots\n${ssClean.map(s => `![${s.name}](${s.url})`).join('\n')}` : ''}

${AGENT_CONTEXT}
`;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!moduleName.trim() || !goalStatement.trim()) { setErr('Module name and goal statement are required.'); return; }
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
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2E7D32', marginBottom: 8 }}>✓ Spec saved · agent context auto-injected</div>
        <p style={{ fontSize: 13, color: '#5A5A5A', marginBottom: 6 }}>
          Slug: <code style={{ background: '#F4EFE2', padding: '2px 6px', borderRadius: 3 }}>{saved}</code>
        </p>
        <p style={{ fontSize: 12, color: '#5A5A5A', marginBottom: 20 }}>
          The brief includes your spec + full design-system context + architecture rules + property setup.
          An agent can now run the goal-loop against this brief without further clarification.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.submitBtn} onClick={() => { setSaved(null); setModuleName(''); setGoalStatement(''); setRefs([mkRef()]); setScreenshots([]); }}>New spec</button>
          <button style={{ ...S.submitBtn, background: '#5A5A5A' }} onClick={() => router.push('/holding/it/cockpit/specs')}>View all specs</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 760, padding: '24px 0' }}>

      {/* §1 */}
      <div style={S.section}>
        <h2 style={S.h}>1 · What are we building?</h2>
        <p style={S.sub}>Name the module and where it lives in the app.</p>
        <div style={S.fieldGroup}><label style={S.label}>Module name *</label><input style={S.input} value={moduleName} onChange={e => setModuleName(e.target.value)} placeholder="e.g. Social Media Posting Module" required /></div>
        <div style={S.fieldGroup}><label style={S.label}>App path(s)</label><input style={S.input} value={appPath} onChange={e => setAppPath(e.target.value)} placeholder="e.g. /marketing/social" /></div>
        <div style={S.fieldGroup}>
          <label style={S.label}>Priority</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 4 }}>
            {PRIORITIES.map(p => <button key={p} type="button" style={S.pill(priority === p)} onClick={() => setPriority(p)}>{p.split(' — ')[0]}</button>)}
          </div>
        </div>
      </div>
      <div style={S.divider} />

      {/* §2 */}
      <div style={S.section}>
        <h2 style={S.h}>2 · What's the goal?</h2>
        <p style={S.sub}>What can a user do when done that they can't do today? Be specific.</p>
        <div style={S.fieldGroup}><label style={S.label}>Goal statement *</label><textarea style={S.textarea} value={goalStatement} onChange={e => setGoalStatement(e.target.value)} placeholder="e.g. Staff can compose a post for Instagram/Facebook, schedule it, and see it publish — all from one page." required /></div>
        <div style={S.fieldGroup}><label style={S.label}>The one metric that proves it works</label><input style={S.input} value={doneMetric} onChange={e => setDoneMetric(e.target.value)} placeholder="e.g. A post scheduled here actually publishes at the set time" /></div>
      </div>
      <div style={S.divider} />

      {/* §3 */}
      <div style={S.section}>
        <h2 style={S.h}>3 · Where are we now?</h2>
        <div style={S.fieldGroup}><label style={S.label}>What's working right now?</label><textarea style={S.textarea} value={whatWorks} onChange={e => setWhatWorks(e.target.value)} placeholder="e.g. The page loads. Basic form renders. Tab exists in nav." /></div>
        <div style={S.fieldGroup}><label style={S.label}>Bugs / things I don't like (be specific)</label><MultiInput items={bugs} onChange={setBugs} placeholder="Bug" /></div>
        <div style={S.fieldGroup}><label style={S.label}>What's completely missing?</label><MultiInput items={missing} onChange={setMissing} placeholder="Missing" /></div>
      </div>
      <div style={S.divider} />

      {/* §4 */}
      <div style={S.section}>
        <h2 style={S.h}>4 · Where does the data come from?</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 12 }}>
          {DATA_SOURCES.map(src => { const active = dataSources.includes(src); return <button key={src} type="button" style={S.pill(active)} onClick={() => setDataSources(active ? dataSources.filter(s => s !== src) : [...dataSources, src])}>{src}</button>; })}
        </div>
        <div style={S.fieldGroup}><label style={S.label}>Specifically which tables / APIs / fields?</label><textarea style={{ ...S.textarea, minHeight: 72 }} value={dataDetails} onChange={e => setDataDetails(e.target.value)} placeholder="e.g. marketing.social_posts table · Instagram Graph API publish endpoint · post content, image URL, scheduled_at" /></div>
      </div>
      <div style={S.divider} />

      {/* §5 */}
      <div style={S.section}>
        <h2 style={S.h}>5 · What should the UI look like?</h2>
        <div style={S.fieldGroup}><label style={S.label}>Pages / sub-pages that should exist</label><MultiInput items={pages} onChange={setPages} placeholder="Page" /></div>
        <div style={S.fieldGroup}><label style={S.label}>Describe the main view</label><textarea style={S.textarea} value={mainView} onChange={e => setMainView(e.target.value)} placeholder="e.g. Calendar of scheduled posts. Below: compose form — channel picker, image upload, caption, date/time, publish button." /></div>
        <div style={S.fieldGroup}><label style={S.label}>Columns / tiles / fields needed</label><MultiInput items={columns} onChange={setColumns} placeholder="Column or tile" /></div>
        <div style={S.fieldGroup}><label style={S.label}>Filters needed</label><MultiInput items={filters} onChange={setFilters} placeholder="Filter" /></div>
      </div>
      <div style={S.divider} />

      {/* §6 */}
      <div style={S.section}>
        <h2 style={S.h}>6 · How do we know it's done?</h2>
        <p style={S.sub}>Write 3–5 testable pass/fail statements. Start with "When I…" or "The page shows…"</p>
        <MultiInput items={acceptance} onChange={setAcceptance} placeholder="Acceptance criterion" />
      </div>
      <div style={S.divider} />

      {/* §7 */}
      <div style={S.section}>
        <h2 style={S.h}>7 · What's out of scope for now?</h2>
        <MultiInput items={outOfScope} onChange={setOutOfScope} placeholder="Out of scope item" />
      </div>
      <div style={S.divider} />

      {/* §8 References — NEW */}
      <div style={S.section}>
        <h2 style={S.h}>8 · References & Inspiration</h2>
        <p style={S.sub}>
          Paste competitor URLs, design references, docs, anything the agent should look at.
          Upload screenshots of what you like, what you don't, or what you want to match.
          These are embedded in the brief so the agent has full visual context.
        </p>

        <div style={S.fieldGroup}>
          <label style={S.label}>Links (competitor pages, design refs, docs)</label>
          {refs.map((ref, i) => (
            <div key={ref.id} style={{ ...S.row, alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input style={S.input} value={ref.url} placeholder="https://..." onChange={e => setRefs(rs => rs.map((r, j) => j === i ? { ...r, url: e.target.value } : r))} />
                <input style={{ ...S.input, fontSize: 11, padding: '5px 8px' }} value={ref.label} placeholder="Label / note (e.g. 'competitor dashboard I like')" onChange={e => setRefs(rs => rs.map((r, j) => j === i ? { ...r, label: e.target.value } : r))} />
              </div>
              {refs.length > 1 && <button type="button" style={S.removeBtn} onClick={() => setRefs(rs => rs.filter((_, j) => j !== i))}>✕</button>}
            </div>
          ))}
          <button type="button" style={S.addBtn} onClick={() => setRefs(rs => [...rs, mkRef()])}>+ Add link</button>
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>Screenshots (upload images — stored & embedded in brief)</label>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {screenshots.map(ss => (
              <div key={ss.id} style={{ position: 'relative' }}>
                <img src={ss.url} alt={ss.name} style={S.imgThumb} />
                <button type="button" onClick={() => setScreenshots(s => s.filter(x => x.id !== ss.id))}
                  style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#B8542A', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ))}
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ width: 80, height: 60, border: '1px dashed #E6DFCC', borderRadius: 4, background: '#FAFAF7', color: '#5A5A5A', fontSize: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              {uploading ? '…' : <>📎<span style={{ fontSize: 10 }}>Upload</span></>}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#8A8A8A' }}>Uploaded images are stored in Supabase and linked in the brief. Agent can see them.</div>
        </div>
      </div>

      <div style={{ padding: '12px 14px', background: '#F4EFE2', borderRadius: 4, marginBottom: 20, fontSize: 12, color: '#5A5A5A' }}>
        <strong style={{ color: '#1B1B1B' }}>Auto-injected for agents:</strong> design system · architecture · primitives · property setup · deploy rules · schema access rules. You don't need to explain these.
      </div>

      {err && <div style={{ fontSize: 12, color: '#B8542A', padding: '8px 12px', background: '#F7E2DC', borderRadius: 3, marginBottom: 16 }}>{err}</div>}
      <button type="submit" disabled={isPending} style={{ ...S.submitBtn, opacity: isPending ? 0.6 : 1 }}>
        {isPending ? 'Saving…' : 'Save spec → build brief'}
      </button>
      <span style={{ fontSize: 12, color: '#5A5A5A', marginLeft: 14 }}>Saves to documentation.build_briefs · status: ready</span>
    </form>
  );
}
