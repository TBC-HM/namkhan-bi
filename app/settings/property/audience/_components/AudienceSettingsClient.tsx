'use client';
// app/settings/property/audience/_components/AudienceSettingsClient.tsx
// PBS 2026-07-21 · 5 stacked panels for the Audience settings tab.
//   (v2 2026-07-21 pm — added EmailChromePanel below the 4 existing panels.)
// Design tokens: paper white #FFFFFF · hairline #E6DFCC · ink #1B1B1B · forest #084838.
// All writes go through /api/marketing/audience/* thin routes → public.fn_* RPCs.

import { useCallback, useState, useTransition } from 'react';
import EmailChromePanel, { type EmailChromeSettings } from './EmailChromePanel';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_S  = '#5A5A5A';
const BRAND  = '#084838';
const WARM   = '#F5F0E1';
const RED    = '#B03826';

// ---------- types ----------
export interface BlocklistRow {
  id: number;
  property_id: number | null;
  pattern: string;
  pattern_type: 'email' | 'domain' | 'prefix';
  reason: string | null;
  source: string;
  created_by: string | null;
  created_at: string;
}
export interface GroupRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string;
  is_system: boolean;
  sort_order: number;
  member_count: number;
}
export interface GroupRuleRow {
  id: number;
  group_id: string;
  group_slug: string | null;
  group_name: string | null;
  field: string;
  operator: string;
  value: string | null;
  created_at: string;
}
export interface EmailSettingsRow {
  property_id: number;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  footer_text: string | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  rate_limit_per_sec: number | null;
  unsubscribe_url: string | null;
  updated_at: string | null;
}
export interface RoutingRuleRow {
  id: number;
  property_id: number | null;
  rule_type: 'include_folder' | 'exclude_label' | 'auto_tag' | 'auto_group';
  pattern: string;
  target_value: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

interface Props {
  propertyId: number;
  initialBlocklist: BlocklistRow[];
  initialGroups: GroupRow[];
  initialGroupRules: GroupRuleRow[];
  initialEmailSettings: EmailSettingsRow | null;
  initialRoutingRules: RoutingRuleRow[];
}

export default function AudienceSettingsClient(props: Props & { initialEmailChrome?: EmailChromeSettings | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SenderIdentityPanel
        propertyId={props.propertyId}
        initial={props.initialEmailSettings}
      />
      <BlocklistPanel
        propertyId={props.propertyId}
        initial={props.initialBlocklist}
      />
      <GroupsRulesPanel
        groups={props.initialGroups}
        initialRules={props.initialGroupRules}
      />
      <ImportRoutingRulesPanel
        propertyId={props.propertyId}
        groups={props.initialGroups}
        initial={props.initialRoutingRules}
      />
      <EmailChromePanel
        propertyId={props.propertyId}
        initial={props.initialEmailChrome ?? null}
      />
    </div>
  );
}

// ==============================================================
// 1. SenderIdentityPanel
// ==============================================================
function SenderIdentityPanel({ propertyId, initial }: { propertyId: number; initial: EmailSettingsRow | null }) {
  const [fromName, setFromName]         = useState(initial?.from_name ?? '');
  const [fromEmail, setFromEmail]       = useState(initial?.from_email ?? '');
  const [replyTo, setReplyTo]           = useState(initial?.reply_to ?? '');
  const [footerText, setFooterText]     = useState(initial?.footer_text ?? '');
  const [unsubUrl, setUnsubUrl]         = useState(initial?.unsubscribe_url ?? '');
  const [msg, setMsg]                   = useState<{ok:boolean;text:string} | null>(null);
  const [busy, startTransition]         = useTransition();

  const onSave = useCallback(() => {
    startTransition(async () => {
      const r = await fetch('/api/marketing/audience/email-settings-save', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          payload: {
            from_name: fromName,
            from_email: fromEmail,
            reply_to: replyTo,
            footer_text: footerText,
            unsubscribe_url: unsubUrl,
          },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok) setMsg({ ok: true, text: 'Sender identity saved.' });
      else      setMsg({ ok: false, text: 'Save failed: ' + (j.error ?? 'unknown') });
    });
  }, [propertyId, fromName, fromEmail, replyTo, footerText, unsubUrl]);

  return (
    <PanelShell title="Sender identity" sub="Applied to every newsletter sent from this property.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <LabelField label="From name">
          <input value={fromName} onChange={(e) => setFromName(e.target.value)} style={inputStyle} placeholder="The Namkhan" />
        </LabelField>
        <LabelField label="From email">
          <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} style={inputStyle} placeholder="newsletter@thenamkhan.com" />
        </LabelField>
        <LabelField label="Reply-to">
          <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} style={inputStyle} placeholder="gm@thenamkhan.com" />
        </LabelField>
        <LabelField label="Unsubscribe URL">
          <input value={unsubUrl} onChange={(e) => setUnsubUrl(e.target.value)} style={inputStyle} placeholder="https://thenamkhan.com/unsubscribe" />
        </LabelField>
        <LabelField label="Footer text" span={2}>
          <textarea value={footerText} onChange={(e) => setFooterText(e.target.value)} style={{ ...inputStyle, minHeight: 64 }} placeholder="© The Namkhan · Luang Prabang" />
        </LabelField>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <button onClick={onSave} disabled={busy} style={primaryBtnStyle}>
          {busy ? 'Saving…' : 'Save sender identity'}
        </button>
        {msg && (
          <span style={{ fontSize: 12, color: msg.ok ? BRAND : RED }}>{msg.text}</span>
        )}
      </div>
    </PanelShell>
  );
}

// ==============================================================
// 2. BlocklistPanel — preview + confirm apply flow
// ==============================================================
function BlocklistPanel({ propertyId, initial }: { propertyId: number; initial: BlocklistRow[] }) {
  const [rows, setRows]               = useState<BlocklistRow[]>(initial);
  const [pattern, setPattern]         = useState('');
  const [ptype, setPtype]             = useState<'email'|'domain'|'prefix'>('email');
  const [reason, setReason]           = useState('');
  const [preview, setPreview]         = useState<{ id: number; matched: number } | null>(null);
  const [msg, setMsg]                 = useState<{ok:boolean;text:string} | null>(null);
  const [busy, startTransition]       = useTransition();

  const onPreviewAdd = useCallback(() => {
    if (!pattern.trim()) { setMsg({ ok:false, text:'Pattern required.' }); return; }
    startTransition(async () => {
      const r = await fetch('/api/marketing/audience/blocklist-add', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, pattern: pattern.trim(), pattern_type: ptype, reason: reason || null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setMsg({ ok:false, text: 'Add failed: ' + (j.error ?? 'unknown') }); return; }
      setPreview({ id: j.id, matched: j.matched_count ?? 0 });
      setMsg(null);
      // refresh list
      const g = await fetch('/api/marketing/audience/blocklist-add?list=1', { cache: 'no-store' }).catch(() => null);
      if (g && g.ok) {
        const j2 = await g.json();
        if (Array.isArray(j2.rows)) setRows(j2.rows);
      } else {
        // fallback: prepend synthetic row
        setRows((prev) => [{ id: j.id, property_id: propertyId, pattern: pattern.trim(), pattern_type: ptype, reason: reason || null, source: 'manual', created_by: null, created_at: new Date().toISOString() }, ...prev]);
      }
    });
  }, [propertyId, pattern, ptype, reason]);

  const onConfirmApply = useCallback(() => {
    if (!preview) return;
    if (!confirm(`This will remove ${preview.matched} subscriber(s). Confirm?`)) return;
    startTransition(async () => {
      const r = await fetch('/api/marketing/audience/blocklist-apply', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: preview.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setMsg({ ok:false, text: 'Apply failed: ' + (j.error ?? 'unknown') }); return; }
      setMsg({ ok:true, text: `Removed ${j.deleted ?? 0} subscribers.` });
      setPreview(null);
      setPattern(''); setReason('');
    });
  }, [preview]);

  const onRemove = useCallback((id: number) => {
    if (!confirm('Delete this blocklist rule? (Subscribers already removed will not come back.)')) return;
    startTransition(async () => {
      const r = await fetch('/api/marketing/audience/blocklist-remove', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setMsg({ ok:false, text: 'Remove failed: ' + (j.error ?? 'unknown') }); return; }
      setRows((prev) => prev.filter((r) => r.id !== id));
    });
  }, []);

  return (
    <PanelShell title="Blocklist" sub="Emails matching these rules cannot be inserted; deleting an audience row auto-adds an entry.">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
        <LabelField label="Type" inline>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['email','domain','prefix'] as const).map((k) => (
              <label key={k} style={{ fontSize: 11, color: INK, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                <input type="radio" checked={ptype === k} onChange={() => setPtype(k)} /> {k}
              </label>
            ))}
          </div>
        </LabelField>
        <LabelField label="Pattern" inline>
          <input value={pattern} onChange={(e) => setPattern(e.target.value)} style={inputStyle}
            placeholder={ptype === 'email' ? 'x@y.com' : ptype === 'domain' ? 'y.com' : 'noreply'} />
        </LabelField>
        <LabelField label="Reason" inline>
          <input value={reason} onChange={(e) => setReason(e.target.value)} style={inputStyle} placeholder="spam trap" />
        </LabelField>
        <button onClick={onPreviewAdd} disabled={busy} style={secondaryBtnStyle}>
          {busy ? '…' : 'Preview matches + Add rule'}
        </button>
      </div>

      {preview && (
        <div style={{
          padding: 10, marginBottom: 12, background: WARM, border: `1px solid ${HAIR}`, borderRadius: 3,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 12, color: INK }}>
            This rule will remove <strong>{preview.matched}</strong> subscriber(s).
          </span>
          <button onClick={onConfirmApply} disabled={busy} style={primaryBtnStyle}>Confirm removal</button>
          <button onClick={() => setPreview(null)} disabled={busy} style={secondaryBtnStyle}>Cancel</button>
        </div>
      )}

      {msg && (
        <div style={{ padding: 8, marginBottom: 12, fontSize: 12, color: msg.ok ? BRAND : RED, background: WARM, border: `1px solid ${HAIR}`, borderRadius: 3 }}>
          {msg.text}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: WARM }}>
              <th style={thStyle}>Pattern</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Reason</th>
              <th style={thStyle}>Added</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${HAIR}` }}>
                <td style={tdStyle}>{r.pattern}</td>
                <td style={tdStyle}>{r.pattern_type}</td>
                <td style={tdStyle}>{r.source}</td>
                <td style={tdStyle}>{r.reason ?? '—'}</td>
                <td style={tdStyle}>{fmtDate(r.created_at)}</td>
                <td style={tdStyle}>
                  <button onClick={() => onRemove(r.id)} disabled={busy} style={dangerBtnStyle}>Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: INK_S, padding: 20 }}>No blocklist rules yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </PanelShell>
  );
}

// ==============================================================
// 3. GroupsRulesPanel — inline rule editor per group
// ==============================================================
const FIELDS   = ['source','country','domain','last_opened_days','tag'] as const;
const OPS      = ['is','is_not','contains','older_than','newer_than'] as const;

function GroupsRulesPanel({ groups, initialRules }: { groups: GroupRow[]; initialRules: GroupRuleRow[] }) {
  const [rules, setRules] = useState<GroupRuleRow[]>(initialRules);
  const [busy, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const addRule = useCallback((groupId: string, field: string, operator: string, value: string) => {
    if (!field || !operator) { setMsg('Field + operator required.'); return; }
    startTransition(async () => {
      const r = await fetch('/api/marketing/audience/group-rule-add', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, field, operator, value }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setMsg('Add rule failed: ' + (j.error ?? 'unknown')); return; }
      const g = groups.find((x) => x.id === groupId);
      setRules((prev) => [...prev, {
        id: j.id, group_id: groupId, group_slug: g?.slug ?? null, group_name: g?.name ?? null,
        field, operator, value, created_at: new Date().toISOString(),
      }]);
      setMsg(null);
    });
  }, [groups]);

  const removeRule = useCallback((id: number) => {
    startTransition(async () => {
      const r = await fetch('/api/marketing/audience/group-rule-remove', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setMsg('Remove failed: ' + (j.error ?? 'unknown')); return; }
      setRules((prev) => prev.filter((r) => r.id !== id));
    });
  }, []);

  return (
    <PanelShell title="Group rules" sub="Each rule matches subscribers into the group automatically at import/refresh time.">
      {msg && <div style={{ padding: 8, marginBottom: 12, fontSize: 12, color: RED }}>{msg}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groups.map((g) => (
          <GroupRulesRow
            key={g.id}
            group={g}
            rules={rules.filter((r) => r.group_id === g.id)}
            onAdd={addRule}
            onRemove={removeRule}
            busy={busy}
          />
        ))}
        {groups.length === 0 && (
          <div style={{ fontSize: 12, color: INK_S }}>No groups defined yet.</div>
        )}
      </div>
    </PanelShell>
  );
}

function GroupRulesRow({
  group, rules, onAdd, onRemove, busy,
}: {
  group: GroupRow; rules: GroupRuleRow[];
  onAdd: (gid: string, field: string, op: string, value: string) => void;
  onRemove: (id: number) => void;
  busy: boolean;
}) {
  const [field, setField]   = useState<string>(FIELDS[0]);
  const [op, setOp]         = useState<string>(OPS[0]);
  const [value, setValue]   = useState<string>('');

  return (
    <div style={{ border: `1px solid ${HAIR}`, borderRadius: 4, padding: 12, background: WHITE }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: group.color, display: 'inline-block' }} />
        <strong style={{ fontSize: 13, color: INK }}>{group.name}</strong>
        <span style={{ fontSize: 11, color: INK_S }}>· {group.member_count} members · {rules.length} rules</span>
      </div>

      {rules.length > 0 && (
        <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rules.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: INK }}>
              <code style={{ background: WARM, padding: '1px 6px', borderRadius: 3 }}>{r.field}</code>
              <code style={{ background: WARM, padding: '1px 6px', borderRadius: 3 }}>{r.operator}</code>
              <span>{r.value ?? '—'}</span>
              <button onClick={() => onRemove(r.id)} disabled={busy} style={{ ...dangerBtnStyle, padding: '2px 8px', fontSize: 10 }}>Delete</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <select value={field} onChange={(e) => setField(e.target.value)} style={selectStyle}>
          {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={op} onChange={(e) => setOp(e.target.value)} style={selectStyle}>
          {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="value" style={{ ...inputStyle, maxWidth: 200 }} />
        <button
          onClick={() => { onAdd(group.id, field, op, value); setValue(''); }}
          disabled={busy}
          style={secondaryBtnStyle}
        >Add rule</button>
      </div>
    </div>
  );
}

// ==============================================================
// 4. ImportRoutingRulesPanel
// ==============================================================
const RULE_TYPES = [
  { key: 'include_folder', label: 'Include folder' },
  { key: 'exclude_label',  label: 'Exclude label' },
  { key: 'auto_tag',       label: 'Auto-tag (domain → tag)' },
  { key: 'auto_group',     label: 'Auto-group (domain → group)' },
] as const;

const FIXED_FOLDERS = ['INBOX', 'Sent', '[Namkhan]'];

function ImportRoutingRulesPanel({
  propertyId, groups, initial,
}: {
  propertyId: number; groups: GroupRow[]; initial: RoutingRuleRow[];
}) {
  const [rows, setRows] = useState<RoutingRuleRow[]>(initial);
  const [msg, setMsg]   = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const [newType, setNewType]     = useState<typeof RULE_TYPES[number]['key']>('auto_tag');
  const [newPattern, setNewPattern] = useState('');
  const [newTarget, setNewTarget] = useState('');

  const addRule = useCallback(() => {
    if (!newPattern.trim()) { setMsg('Pattern required.'); return; }
    startTransition(async () => {
      const r = await fetch('/api/marketing/audience/routing-rule-add', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          rule_type: newType,
          pattern: newPattern.trim(),
          target_value: newTarget || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setMsg('Add failed: ' + (j.error ?? 'unknown')); return; }
      setRows((prev) => [...prev, {
        id: j.id, property_id: propertyId, rule_type: newType,
        pattern: newPattern.trim(), target_value: newTarget || null,
        active: true, created_by: null, created_at: new Date().toISOString(),
      }]);
      setNewPattern(''); setNewTarget('');
      setMsg(null);
    });
  }, [propertyId, newType, newPattern, newTarget]);

  const removeRule = useCallback((id: number) => {
    startTransition(async () => {
      const r = await fetch('/api/marketing/audience/routing-rule-remove', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setMsg('Remove failed: ' + (j.error ?? 'unknown')); return; }
      setRows((prev) => prev.filter((r) => r.id !== id));
    });
  }, []);

  const includeFolders = rows.filter((r) => r.rule_type === 'include_folder');
  const excludeLabels  = rows.filter((r) => r.rule_type === 'exclude_label');
  const autoTags       = rows.filter((r) => r.rule_type === 'auto_tag');
  const autoGroups     = rows.filter((r) => r.rule_type === 'auto_group');

  return (
    <PanelShell title="Import routing rules" sub="Applied when Gmail extract / bulk import writes to the audience table.">
      {msg && <div style={{ padding: 8, marginBottom: 12, fontSize: 12, color: RED }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <RoutingList
          title="Include folders (Gmail)"
          rows={includeFolders}
          fixedOptions={FIXED_FOLDERS}
          onAdd={(pattern) => {
            setNewType('include_folder'); setNewPattern(pattern); setNewTarget('');
            setTimeout(addRule, 0);
          }}
          onRemove={removeRule}
          renderRow={(r) => r.pattern}
        />
        <RoutingList
          title="Exclude labels"
          rows={excludeLabels}
          onRemove={removeRule}
          renderRow={(r) => r.pattern}
        />
        <RoutingList
          title="Auto-tag rules (domain → tag)"
          rows={autoTags}
          onRemove={removeRule}
          renderRow={(r) => `${r.pattern} → #${r.target_value ?? '—'}`}
        />
        <RoutingList
          title="Auto-group rules (domain → group)"
          rows={autoGroups}
          onRemove={removeRule}
          renderRow={(r) => {
            const g = groups.find((g) => g.id === r.target_value);
            return `${r.pattern} → ${g?.name ?? r.target_value ?? '—'}`;
          }}
        />
      </div>

      <div style={{ marginTop: 16, padding: 12, background: WARM, border: `1px solid ${HAIR}`, borderRadius: 3, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
        <LabelField label="Rule type" inline>
          <select value={newType} onChange={(e) => setNewType(e.target.value as any)} style={selectStyle}>
            {RULE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </LabelField>
        <LabelField label="Pattern" inline>
          <input value={newPattern} onChange={(e) => setNewPattern(e.target.value)} style={inputStyle}
            placeholder={newType === 'include_folder' ? 'INBOX' : newType === 'exclude_label' ? 'Promotions' : 'example.com'} />
        </LabelField>
        {(newType === 'auto_tag' || newType === 'auto_group') && (
          <LabelField label={newType === 'auto_tag' ? 'Tag' : 'Group'} inline>
            {newType === 'auto_group' ? (
              <select value={newTarget} onChange={(e) => setNewTarget(e.target.value)} style={selectStyle}>
                <option value="">—</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            ) : (
              <input value={newTarget} onChange={(e) => setNewTarget(e.target.value)} style={inputStyle} placeholder="vip" />
            )}
          </LabelField>
        )}
        <button onClick={addRule} disabled={busy} style={primaryBtnStyle}>
          {busy ? '…' : 'Add rule'}
        </button>
      </div>
    </PanelShell>
  );
}

function RoutingList({
  title, rows, fixedOptions, onAdd, onRemove, renderRow,
}: {
  title: string;
  rows: RoutingRuleRow[];
  fixedOptions?: string[];
  onAdd?: (pattern: string) => void;
  onRemove: (id: number) => void;
  renderRow: (r: RoutingRuleRow) => string;
}) {
  const activeSet = new Set(rows.map((r) => r.pattern));
  return (
    <div style={{ border: `1px solid ${HAIR}`, borderRadius: 4, padding: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: INK, marginBottom: 6 }}>{title}</div>
      {fixedOptions && onAdd && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {fixedOptions.map((f) => (
            <button
              key={f}
              onClick={() => { if (!activeSet.has(f)) onAdd(f); }}
              disabled={activeSet.has(f)}
              style={{
                padding: '3px 8px', fontSize: 11, borderRadius: 3, cursor: activeSet.has(f) ? 'default' : 'pointer',
                background: activeSet.has(f) ? BRAND : WHITE,
                color: activeSet.has(f) ? WHITE : INK,
                border: `1px solid ${activeSet.has(f) ? BRAND : HAIR}`,
              }}
            >{activeSet.has(f) ? '✓ ' : '+ '}{f}</button>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <div style={{ fontSize: 11, color: INK_S }}>None yet.</div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: INK }}>
              <span style={{ flex: 1 }}>{renderRow(r)}</span>
              <button onClick={() => onRemove(r.id)} style={{ ...dangerBtnStyle, padding: '2px 6px', fontSize: 10 }}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ==============================================================
// Shared UI
// ==============================================================
function PanelShell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: INK_S, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </section>
  );
}

function LabelField({ label, span, inline, children }: {
  label: string; span?: number; inline?: boolean; children: React.ReactNode;
}) {
  return (
    <label style={{
      fontSize: 11, color: INK_S, display: inline ? 'inline-flex' : 'block',
      flexDirection: inline ? 'column' : undefined,
      gridColumn: span ? `span ${span}` : undefined,
    }}>
      <span style={{ display: 'block', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

const inputStyle: React.CSSProperties = {
  padding: '6px 8px', border: `1px solid ${HAIR}`, borderRadius: 3,
  background: WHITE, color: INK, fontSize: 12, minWidth: 160,
};
const selectStyle: React.CSSProperties = { ...inputStyle };
const primaryBtnStyle: React.CSSProperties = {
  padding: '6px 14px', background: BRAND, color: WHITE, border: 'none',
  borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: '6px 12px', background: WHITE, color: INK, border: `1px solid ${HAIR}`,
  borderRadius: 3, fontSize: 12, cursor: 'pointer',
};
const dangerBtnStyle: React.CSSProperties = {
  padding: '4px 10px', background: WHITE, color: RED, border: `1px solid ${RED}`,
  borderRadius: 3, fontSize: 11, cursor: 'pointer',
};
const thStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: INK_S, borderBottom: `1px solid ${HAIR}` };
const tdStyle: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'top' };
