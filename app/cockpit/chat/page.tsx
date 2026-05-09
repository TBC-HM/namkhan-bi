// app/cockpit/chat/page.tsx
// PBS 2026-05-09 #15: every dept landing routes its chat box to /cockpit/chat
// (DeptEntry.tsx submitChat / askVectorAbout). The route did not exist —
// pages 404'd. This page reads ?dept=…&q=… and renders the right HoD's
// ChatShell.

import ChatShell from '@/components/chat/ChatShell';
import Page from '@/components/page/Page';

export const dynamic = 'force-dynamic';

type Persona = {
  role: string;
  displayName: string;
  dept: string;
  emoji: string;
  mentionNickname: string;
  storageKey: string;
  /** dept-entry storage prefix — used for "Create task" button to push into the right Tasks box. */
  taskStorageKeyPrefix: string;
};

const PERSONAS: Record<string, Persona> = {
  architect:  { role: 'lead',          displayName: 'Felix',       dept: 'Architect',   emoji: '🏛',  mentionNickname: 'felix',  storageKey: 'chat_thread_start_architect',  taskStorageKeyPrefix: 'arch' },
  revenue:    { role: 'revenue_hod',   displayName: 'Vector',      dept: 'Revenue',     emoji: '📈', mentionNickname: 'vector', storageKey: 'chat_thread_start_revenue',    taskStorageKeyPrefix: 'rev'  },
  sales:      { role: 'sales_hod',     displayName: 'Mercer',      dept: 'Sales',       emoji: '📞', mentionNickname: 'mercer', storageKey: 'chat_thread_start_sales',      taskStorageKeyPrefix: 'sal'  },
  marketing:  { role: 'marketing_hod', displayName: 'Lumen',       dept: 'Marketing',   emoji: '✦',  mentionNickname: 'lumen',  storageKey: 'chat_thread_start_marketing',  taskStorageKeyPrefix: 'mkt'  },
  operations: { role: 'operations_hod',displayName: 'Forge',       dept: 'Operations',  emoji: '⚙', mentionNickname: 'forge',  storageKey: 'chat_thread_start_operations', taskStorageKeyPrefix: 'ops'  },
  guest:      { role: 'lead',          displayName: 'Felix',       dept: 'Guest',       emoji: '🏛',  mentionNickname: 'felix',  storageKey: 'chat_thread_start_guest',      taskStorageKeyPrefix: 'gst'  },
  finance:    { role: 'finance_hod',   displayName: 'Intel',       dept: 'Finance',     emoji: '$',  mentionNickname: 'intel',  storageKey: 'chat_thread_start_finance',    taskStorageKeyPrefix: 'fin'  },
  it:         { role: 'it_manager',    displayName: 'Captain Kit', dept: 'IT',          emoji: '⌬',  mentionNickname: 'kit',    storageKey: 'chat_thread_start_it',         taskStorageKeyPrefix: 'it'   },
};

const DEFAULT: Persona = PERSONAS.architect;

interface Props {
  searchParams?: { dept?: string; q?: string; project?: string };
}

export default function CockpitChatPage({ searchParams }: Props) {
  const deptKey = (searchParams?.dept ?? 'architect').toLowerCase();
  const persona = PERSONAS[deptKey] ?? DEFAULT;
  const initial = (searchParams?.q ?? '').trim();

  const eyebrow = `Cockpit · Chat · ${persona.dept}`;
  const title = (
    <>
      Talk to <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{persona.displayName}</em>
    </>
  );

  return (
    <Page eyebrow={eyebrow} title={title}>
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
    </Page>
  );
}
