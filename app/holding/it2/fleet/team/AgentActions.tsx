'use client';

// app/holding/it2/fleet/team/AgentActions.tsx
// PBS 2026-08-07 (ADR-268): the fleet-page CTAs, live.
//
// Every control posts to /api/cockpit/agent-write, which calls an audited
// public.fn_* SECURITY DEFINER function. No table writes from the browser.
// Validation lives in SQL — this file renders whatever the function returns and
// never second-guesses it, so there is exactly one copy of every rule.
//
// Layout deliberately inline: the panel is already open, a modal would hide the
// numbers the operator is deciding against.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Op =
  | 'set_prompt'
  | 'grant_skill'
  | 'revoke_skill'
  | 'add_memory'
  | 'set_budget'
  | 'set_status';

async function call(op: Op, payload: Record<string, unknown>) {
  const res = await fetch('/api/cockpit/agent-write', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op, ...payload }),
  });
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok && !j?.error) return { ok: false, error: `http_${res.status}` };
  return j;
}

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(op: Op, payload: Record<string, unknown>, okText: string, after?: () => void) {
    setMsg(null);
    const j = await call(op, payload);
    if (j?.ok) {
      setMsg({ ok: true, text: okText });
      after?.();
      start(() => router.refresh()); // re-read v_agent_pillars, no full reload
    } else {
      setMsg({ ok: false, text: j?.error ?? 'failed' });
    }
    setTimeout(() => setMsg(null), 6000);
  }

  return { run, pending, msg };
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <div style={{ ...s.msg, color: msg.ok ? '#1E7A4A' : '#B4231F' }}>{msg.text}</div>
  );
}

/* ── 1 · Identity ─────────────────────────────────────────────── */

export function IdentityActions({ role, status }: { role: string; status: string | null }) {
  const { run, pending, msg } = useAction();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const disabled = status === 'disabled';

  return (
    <div>
      <div style={s.row}>
        <button style={s.btn} disabled={pending} onClick={() => setOpen((v) => !v)}>
          {open ? 'Cancel' : 'Edit prompt'}
        </button>
        <button
          style={s.btn}
          disabled={pending}
          onClick={() =>
            run('set_status', { role, status: disabled ? 'active' : 'disabled' },
              disabled ? 'Enabled' : 'Disabled')
          }
        >
          {disabled ? 'Enable' : 'Disable'}
        </button>
      </div>
      {open && (
        <div style={s.form}>
          <textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="New system prompt. Saved as a NEW version — the previous one is kept and marked not-current. Model, limits, input sources and guardrails carry forward."
            style={s.textarea}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Change note (why)"
            style={s.input}
          />
          <button
            style={s.btnPrimary}
            disabled={pending || text.trim().length === 0}
            onClick={() =>
              run('set_prompt', { role, system_prompt: text, note: note || null },
                'Prompt saved as a new version', () => { setText(''); setNote(''); setOpen(false); })
            }
          >
            Save new version
          </button>
        </div>
      )}
      <Msg msg={msg} />
    </div>
  );
}

/* ── 2 · Skills ───────────────────────────────────────────────── */

export function SkillActions({ role }: { role: string }) {
  const { run, pending, msg } = useAction();
  const [skillId, setSkillId] = useState('');
  const id = Number(skillId);
  const valid = Number.isFinite(id) && id > 0;

  return (
    <div>
      <div style={s.row}>
        <input
          value={skillId}
          onChange={(e) => setSkillId(e.target.value)}
          placeholder="skill id"
          inputMode="numeric"
          style={{ ...s.input, width: 92, marginBottom: 0 }}
        />
        <button
          style={s.btn}
          disabled={pending || !valid}
          onClick={() => run('grant_skill', { role, skill_id: id }, `Skill ${id} granted`, () => setSkillId(''))}
        >
          Grant
        </button>
        <button
          style={s.btn}
          disabled={pending || !valid}
          onClick={() => run('revoke_skill', { role, skill_id: id }, `Skill ${id} revoked`, () => setSkillId(''))}
        >
          Revoke
        </button>
      </div>
      <Msg msg={msg} />
    </div>
  );
}

/* ── 3 · Memory ───────────────────────────────────────────────── */

export function MemoryActions({ role }: { role: string }) {
  const { run, pending, msg } = useAction();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [importance, setImportance] = useState(9);

  return (
    <div>
      <div style={s.row}>
        <button style={s.btn} disabled={pending} onClick={() => setOpen((v) => !v)}>
          {open ? 'Cancel' : 'Add memory'}
        </button>
      </div>
      {open && (
        <div style={s.form}>
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="A standing rule, stated as an instruction. Importance ≥ 8 makes it a hard rule."
            style={s.textarea}
          />
          <label style={s.label}>
            Importance
            <input
              type="number"
              min={1}
              max={10}
              value={importance}
              onChange={(e) => setImportance(Number(e.target.value))}
              style={{ ...s.input, width: 64, marginBottom: 0, marginLeft: 8 }}
            />
          </label>
          <button
            style={s.btnPrimary}
            disabled={pending || content.trim().length === 0}
            onClick={() =>
              run('add_memory', { role, content, importance },
                importance >= 8 ? 'Hard rule added' : 'Memory added',
                () => { setContent(''); setOpen(false); })
            }
          >
            Save
          </button>
          <div style={s.hint}>
            Memories are retired forward, never deleted — archiving happens on the agent
            detail page so a reason can be recorded.
          </div>
        </div>
      )}
      <Msg msg={msg} />
    </div>
  );
}

/* ── 4 · Budget ───────────────────────────────────────────────── */

export function BudgetActions({
  role, daily, monthly, enforced,
}: { role: string; daily: number | null; monthly: number | null; enforced: boolean | null }) {
  const { run, pending, msg } = useAction();
  const [d, setD] = useState(daily != null ? String(daily) : '');
  const [m, setM] = useState(monthly != null ? String(monthly) : '');
  const [enf, setEnf] = useState(enforced !== false);
  const nd = Number(d), nm = Number(m);
  const valid = Number.isFinite(nd) && Number.isFinite(nm) && nd >= 0 && nm >= 0 && d !== '' && m !== '';

  return (
    <div>
      <div style={s.row}>
        <label style={s.label}>
          $/day
          <input value={d} onChange={(e) => setD(e.target.value)} inputMode="decimal"
            style={{ ...s.input, width: 72, marginBottom: 0, marginLeft: 6 }} />
        </label>
        <label style={s.label}>
          $/mo
          <input value={m} onChange={(e) => setM(e.target.value)} inputMode="decimal"
            style={{ ...s.input, width: 72, marginBottom: 0, marginLeft: 6 }} />
        </label>
        <label style={{ ...s.label, gap: 4 }}>
          <input type="checkbox" checked={enf} onChange={(e) => setEnf(e.target.checked)} />
          enforce
        </label>
        <button
          style={s.btnPrimary}
          disabled={pending || !valid}
          onClick={() => run('set_budget', { role, daily: nd, monthly: nm, enforced: enf }, 'Budget saved')}
        >
          Save
        </button>
      </div>
      <Msg msg={msg} />
      <div style={s.hint}>
        A ceiling only bites once spend is recorded. Agent spend is not yet written
        (`engine.ts` discards its agent_trace) — until then this is a declared limit,
        not a policed one.
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  row: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 },
  form: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 },
  btn: {
    fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
    border: '1px solid #D8CDB4', background: '#FFFDF7', color: '#3A3226',
  },
  btnPrimary: {
    fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
    border: '1px solid #8A5A2B', background: '#8A5A2B', color: '#fff', alignSelf: 'flex-start',
  },
  input: {
    fontSize: 12, padding: '4px 8px', borderRadius: 6,
    border: '1px solid #D8CDB4', background: '#fff', marginBottom: 4,
  },
  textarea: {
    fontSize: 12, padding: '6px 8px', borderRadius: 6, width: '100%',
    border: '1px solid #D8CDB4', background: '#fff', fontFamily: 'inherit', resize: 'vertical',
  },
  label: { display: 'flex', alignItems: 'center', fontSize: 11, color: '#6B625A' },
  msg: { fontSize: 11, marginTop: 6, fontWeight: 600 },
  hint: { fontSize: 10.5, color: '#8A7A66', marginTop: 6, lineHeight: 1.4 },
};
