// components/inbox/AgentDeliveriesPanel.tsx
//
// Self-contained renderer for the agent-deliveries surface.
// Used by `/h/[property_id]/reports` as the primary content; previously
// embedded in `/h/[property_id]/inbox` and now extracted so the sales
// inbox stays sales-only and the reports surface is agent-only.
//
// PBS 2026-05-15: split agent-deliveries out of the sales inbox; new home
// is /h/[property_id]/reports surfaced via the Finance sub-menu "Reports".

import Link from 'next/link';
import {
  deliveryRelativeTime,
  type AgentDelivery,
} from '@/lib/inbox/agent-deliveries';

// ─── Agent → chat-persona mapping for the inline reply button ───────────
// `from_agent` display name (e.g. "Sherlock") → cockpit-chat persona row.
// Keep in sync with NICKNAME_BY_ROLE in app/cockpit/chat/page.tsx.
const AGENT_CHAT_PERSONA: Record<
  string,
  { role: string; name: string; emoji: string; dept: string; label: string }
> = {
  Sherlock: { role: 'forensic_detective',     name: 'Sherlock', emoji: '🔍', dept: 'legal',     label: 'Legal'   },
  Carla:    { role: 'legal_specialist_donna', name: 'Carla',    emoji: '⚖️', dept: 'legal',     label: 'Legal'   },
  Vera:     { role: 'legal_local_donna',      name: 'Vera',     emoji: '⚖',  dept: 'finance',   label: 'Finance' },
  Intel:    { role: 'finance_hod',            name: 'Intel',    emoji: '$',  dept: 'finance',   label: 'Finance' },
  Cifra:    { role: 'finance_hod_donna',      name: 'Cifra',    emoji: '$',  dept: 'finance',   label: 'Finance' },
  Kit:      { role: 'it_manager',             name: 'Captain Kit', emoji: '⌬', dept: 'it',       label: 'IT'      },
  Felix:    { role: 'lead',                   name: 'Felix',    emoji: '🏛',  dept: 'architect', label: 'Architect' },
};

function ReplyToAgentLink({ delivery }: { delivery: AgentDelivery }) {
  const fromName = delivery.from_agent ?? '';
  const persona  = AGENT_CHAT_PERSONA[fromName];
  if (!persona) return null;
  const subject = delivery.subject ?? 'memo';
  const seed    = `Re: ${subject}\n\n[Replying to report · ${delivery.case_ref ?? `id #${delivery.id}`} · ${new Date(delivery.created_at).toISOString().slice(0, 10)}]\n\n`;
  const qs = new URLSearchParams({
    dept:  persona.dept,
    role:  persona.role,
    name:  persona.name,
    emoji: persona.emoji,
    label: persona.label,
    q:     seed,
  });
  const href = `/cockpit/chat?${qs.toString()}`;
  return (
    <div style={{ marginTop: 10 }}>
      <Link
        href={href}
        style={{
          display: 'inline-block',
          padding: '5px 12px',
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          textDecoration: 'none',
          background: 'var(--brass)',
          color: 'var(--paper-deep, #1a1a1a)',
          borderRadius: 4,
          fontWeight: 700,
        }}
      >
        💬 Reply / new request → {persona.name}
      </Link>
    </div>
  );
}

interface Props {
  deliveries: AgentDelivery[];
  propertyId: number;
  selectedIdParam?: string;
  /** Route the delivery list links into. Defaults to /h/<id>/reports. */
  basePath?: string;
}

export default function AgentDeliveriesPanel({
  deliveries,
  propertyId,
  selectedIdParam,
  basePath,
}: Props) {
  if (deliveries.length === 0) {
    return (
      <section style={{ marginTop: 14, padding: 24, color: 'var(--ink-mute)' }}>
        No reports yet. Agent deliveries (memos, briefs, case files, dossiers)
        from Carla / Vera / Sherlock / Kit / HoDs will land here.
      </section>
    );
  }
  const selectedId = selectedIdParam ? Number(selectedIdParam) : deliveries[0].id;
  const selected = deliveries.find((d) => d.id === selectedId) ?? deliveries[0];
  const base = basePath ?? `/h/${propertyId}/reports`;

  return (
    <section style={{ marginTop: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        padding: '10px 12px',
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderRadius: 8,
        borderLeft: '3px solid var(--brass)',
        marginBottom: 6,
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
          color: 'var(--brass)', fontWeight: 700,
        }}>
          Agent reports · {deliveries.length} in queue
        </div>
        <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
          memos · briefs · case files · dossiers · routed from Carla / Vera / Sherlock / Kit / HoDs
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 12 }}>
        {/* LEFT: report list */}
        <aside style={{
          background: 'var(--paper-warm)',
          border: '1px solid var(--paper-deep)',
          borderRadius: 8,
          overflow: 'hidden',
          maxHeight: 540,
          overflowY: 'auto',
        }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {deliveries.map((d) => {
              const isActive = d.id === selectedId;
              const href = `${base}?delivery=${d.id}`;
              return (
                <li key={d.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                  <Link href={href} style={{
                    display: 'block', padding: '10px 12px',
                    textDecoration: 'none', color: 'var(--ink)',
                    background: isActive ? 'var(--paper-deep)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--brass)' : '3px solid transparent',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{
                        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                        color: 'var(--brass)', fontWeight: 700,
                      }}>
                        {d.memo_type ?? 'Memo'}{d.priority && d.priority !== 'normal' ? ` · ${d.priority.toUpperCase()}` : ''}
                      </span>
                      <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
                        {deliveryRelativeTime(d.created_at)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 'var(--t-sm)', fontWeight: isActive ? 600 : 500,
                      marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {d.subject}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
                      <span>↗ {d.from_agent ?? '?'}</span>
                      {d.to_hod && <span style={{ marginLeft: 4 }}>→ {d.to_hod}</span>}
                      {d.case_ref && <span style={{ marginLeft: 4, color: 'var(--brass)' }}>{d.case_ref}</span>}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span style={{
                        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                        background: d.status === 'awaits_user' ? 'var(--brass-soft)' : 'var(--paper)',
                        color: d.status === 'awaits_user' ? 'var(--brass)' : 'var(--ink-mute)',
                        padding: '1px 6px', borderRadius: 3,
                      }}>
                        {d.status}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* RIGHT: selected memo */}
        <article style={{
          background: 'var(--paper-warm)',
          border: '1px solid var(--paper-deep)',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          {!selected && (
            <div style={{ padding: 40, color: 'var(--ink-mute)' }}>Select a report to view.</div>
          )}
          {selected && (
            <>
              <div style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--paper-deep)',
              }}>
                <h3 style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 'var(--t-lg)', fontWeight: 500 }}>
                  {selected.subject}
                </h3>
                <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontFamily: 'var(--mono)', marginTop: 4 }}>
                  {selected.from_agent ?? '?'} → {selected.to_hod ?? '?'} ·{' '}
                  {selected.memo_type ?? 'memo'} ·{' '}
                  {new Date(selected.created_at).toLocaleString('en-CA', { dateStyle: 'short', timeStyle: 'short' })}
                  {selected.case_ref && <> · <span style={{ color: 'var(--brass)' }}>{selected.case_ref}</span></>}
                </div>
                <ReplyToAgentLink delivery={selected} />
              </div>
              <pre style={{
                margin: 0,
                padding: 18,
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-sm)',
                lineHeight: 1.55,
                color: 'var(--ink-soft)',
                background: 'transparent',
                whiteSpace: 'pre-wrap',
                maxHeight: 640,
                overflowY: 'auto',
              }}>
                {selected.memo_md}
              </pre>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
