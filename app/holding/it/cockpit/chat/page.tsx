// app/holding/it/cockpit/chat/page.tsx
// Chat tab — V2 port of /cockpit/chat. Reads ?dept= and routes to the
// matching HoD persona. Reuses existing ChatShell (no fork). Lives inside
// the V2 layout (which wraps in <Page>) for design parity.
//
// Author: IT-team agent · 2026-05-13 · #58.

import ChatShell from '@/components/chat/ChatShell';
import { TOKENS, SERIF, MONO } from '../_components/tokens';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type Persona = {
  role: string;
  displayName: string;
  dept: string;
  emoji: string;
  mentionNickname: string;
  storageKey: string;
  taskStorageKeyPrefix: string;
};

const PERSONAS: Record<string, Persona> = {
  architect: {
    role: 'lead',
    displayName: 'Felix',
    dept: 'Architect',
    emoji: '🏛',
    mentionNickname: 'felix',
    storageKey: 'chat_thread_start_architect_v2',
    taskStorageKeyPrefix: 'arch',
  },
  revenue: {
    role: 'revenue_hod',
    displayName: 'Vector',
    dept: 'Revenue',
    emoji: '📈',
    mentionNickname: 'vector',
    storageKey: 'chat_thread_start_revenue_v2',
    taskStorageKeyPrefix: 'rev',
  },
  sales: {
    role: 'sales_hod',
    displayName: 'Mercer',
    dept: 'Sales',
    emoji: '📞',
    mentionNickname: 'mercer',
    storageKey: 'chat_thread_start_sales_v2',
    taskStorageKeyPrefix: 'sal',
  },
  marketing: {
    role: 'marketing_hod',
    displayName: 'Lumen',
    dept: 'Marketing',
    emoji: '✦',
    mentionNickname: 'lumen',
    storageKey: 'chat_thread_start_marketing_v2',
    taskStorageKeyPrefix: 'mkt',
  },
  operations: {
    role: 'operations_hod',
    displayName: 'Forge',
    dept: 'Operations',
    emoji: '⚙',
    mentionNickname: 'forge',
    storageKey: 'chat_thread_start_operations_v2',
    taskStorageKeyPrefix: 'ops',
  },
  finance: {
    role: 'finance_hod',
    displayName: 'Intel',
    dept: 'Finance',
    emoji: '$',
    mentionNickname: 'intel',
    storageKey: 'chat_thread_start_finance_v2',
    taskStorageKeyPrefix: 'fin',
  },
  it: {
    role: 'it_manager',
    displayName: 'Captain Kit',
    dept: 'IT',
    emoji: '⌬',
    mentionNickname: 'kit',
    storageKey: 'chat_thread_start_it_v2',
    taskStorageKeyPrefix: 'it',
  },
};

const DEPT_ORDER = [
  'architect',
  'revenue',
  'sales',
  'marketing',
  'operations',
  'finance',
  'it',
];

const DEFAULT_KEY = 'architect';

export default function CockpitV2ChatPage({
  searchParams,
}: {
  searchParams?: { dept?: string; q?: string };
}) {
  const deptKey = (searchParams?.dept ?? DEFAULT_KEY).toLowerCase();
  const persona = PERSONAS[deptKey] ?? PERSONAS[DEFAULT_KEY];
  const initial = (searchParams?.q ?? '').trim();

  return (
    <div style={{ color: TOKENS.ink, fontFamily: 'var(--sans)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 18,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>
          Chat · <em style={{ color: TOKENS.brass }}>{persona.displayName}</em>
        </h2>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
          {persona.dept} · @{persona.mentionNickname}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 6,
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        {DEPT_ORDER.map((k) => {
          const p = PERSONAS[k];
          const active = k === deptKey;
          return (
            <Link
              key={k}
              href={`/holding/it/cockpit/chat?dept=${k}`}
              style={{
                padding: '5px 12px',
                borderRadius: 2,
                border: `1px solid ${active ? TOKENS.terracotta : TOKENS.borderSoft}`,
                background: active ? 'rgba(184,95,78,0.16)' : 'transparent',
                color: active ? TOKENS.terracotta : TOKENS.text3,
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: 0.5,
                textDecoration: 'none',
              }}
            >
              {p.emoji} {p.dept}
            </Link>
          );
        })}
      </div>

      <div
        style={{
          border: `1px solid ${TOKENS.border}`,
          background: TOKENS.bgRaised,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <ChatShell
          role={persona.role}
          displayName={persona.displayName}
          dept={persona.dept}
          emoji={persona.emoji}
          mentionNickname={persona.mentionNickname}
          storageKey={persona.storageKey}
          taskStorageKeyPrefix={persona.taskStorageKeyPrefix}
          initialInput={initial}
          placeholder={`Ask ${persona.displayName}…`}
        />
      </div>
    </div>
  );
}
