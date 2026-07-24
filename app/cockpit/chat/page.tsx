// app/cockpit/chat/page.tsx
// Persona-routed chat surface. ChatShell stays the same; chrome moved from
// legacy <Page> onto <DashboardPage> + <Container> primitives so the
// "Ask Mira → / Ask Vector →" buttons land on the new design.
// (cockpit ticket task #68 · 2026-05-21)

import Script from 'next/script';
import ChatShell from '@/components/chat/ChatShell';
import BrainDeptChat from '@/components/brain/BrainDeptChat';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import ThemeInjector from '@/components/ThemeInjector';
import { createClient } from '@/lib/supabase/server';

// ─── Property-scope resolver for chat theming ──────────────────────────
// Rule (PBS 2026-05-15):
//   1. HOLDING_ROLES → BC peach palette via data-property=holding.
//   2. role ends "_donna" → Donna palette via ThemeInjector + brand_palette.
//   3. else → Namkhan default dark globals.
const HOLDING_ROLES = new Set<string>([
  'lead', 'it_manager',
  'legal_specialist_donna', 'forensic_detective', 'legal_holding',
  'architect', 'designer', 'backend', 'frontend', 'security', 'tester',
  'documentarian', 'api_specialist', 'skill_creator', 'researcher',
  'reviewer', 'code_spec_writer', 'code_writer',
  'ops_lead', 'b2b_account_manager', 'channel_analyst', 'copy_lead',
  'housekeeping_supervisor', 'incident_coordinator', 'inquiry_triager',
  'intake_runner',
]);

const DONNA_PROPERTY_ID = 1000001;

function resolveChatTheme(role: string): 'holding' | 'donna' | 'namkhan' {
  if (HOLDING_ROLES.has(role)) return 'holding';
  if (role.endsWith('_donna')) return 'donna';
  return 'namkhan';
}

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

const NICKNAME_BY_ROLE: Record<string, string> = {
  lead:                    'felix',
  it_manager:              'kit',
  revenue_hod:             'vector',
  revenue_hod_donna:       'mira',
  sales_hod:               'mercer',
  marketing_hod:           'lumen',
  operations_hod:          'forge',
  finance_hod:             'intel',
  legal_specialist_donna:  'carla',
  legal_local_donna:       'vera',
  forensic_detective:      'sherlock',
};

interface Props {
  searchParams?: {
    dept?:  string;
    role?:  string;
    name?:  string;
    emoji?: string;
    label?: string;
    q?:     string;
    project?: string;
  };
}

export default async function CockpitChatPage({ searchParams }: Props) {
  const deptKey  = (searchParams?.dept ?? 'architect').toLowerCase();
  const fallback = PERSONAS[deptKey] ?? DEFAULT;
  const initial  = (searchParams?.q ?? '').trim();

  const explicitRole = (searchParams?.role ?? '').trim();
  const persona: Persona = explicitRole
    ? {
        role:                 explicitRole,
        displayName:          (searchParams?.name  ?? fallback.displayName).trim(),
        dept:                 (searchParams?.label ?? fallback.dept).trim(),
        emoji:                (searchParams?.emoji ?? fallback.emoji).trim(),
        mentionNickname:      NICKNAME_BY_ROLE[explicitRole] ?? explicitRole,
        storageKey:           `chat_thread_start_${explicitRole}`,
        taskStorageKeyPrefix: fallback.taskStorageKeyPrefix,
      }
    : fallback;

  const themeScope = resolveChatTheme(persona.role);
  let donnaPalette: unknown[] | null = null;
  if (themeScope === 'donna') {
    const supabase = createClient();
    const { data } = await supabase
      .schema('property')
      .from('brand')
      .select('brand_palette')
      .eq('property_id', DONNA_PROPERTY_ID)
      .maybeSingle();
    donnaPalette = (data?.brand_palette as unknown[] | undefined) ?? null;
  }

  const title = `Talk to ${persona.displayName}`;
  const subtitle = `${persona.dept} · open chat thread`;

  // BRAIN v6 (PBS 2026-07-24): the brain is the default ANSWER layer per
  // department — SQL-bordered scope; the agent below stays for ACTIONS.
  const BRAIN_SCOPE_BY_DEPT: Record<string, string> = {
    revenue: 'revenue', sales: 'revenue', marketing: 'marketing',
    operations: 'operations', finance: 'admin', guest: 'operations',
  };
  const brainScope = explicitRole ? undefined : BRAIN_SCOPE_BY_DEPT[deptKey];

  // PBS 2026-07-24 (2nd decision): dept HoD chats REPLACED by the brain — the
  // agent threads neither worked reliably nor executed beyond what the brain
  // does. Platform agents with real execution (architect/Felix, it/Kit) and
  // explicit ?role= links keep the agent thread. Reversal = delete this block.
  const chatBody = brainScope ? (
    <DashboardPage
      title={`Ask the brain · ${fallback.dept}`}
      subtitle={`${fallback.dept} · department-bordered knowledge window`}
    >
      <div style={fullRow}>
        <BrainDeptChat scope={brainScope} standalone />
      </div>
    </DashboardPage>
  ) : (
    <DashboardPage title={title} subtitle={subtitle}>
      <div style={fullRow}>
        <Container
          title={`${persona.emoji} ${persona.displayName}`}
          subtitle={persona.dept}
          density="compact"
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
        </Container>
      </div>
    </DashboardPage>
  );

  // Wrap per theme scope:
  //   holding → data-property=holding gives BC peach palette
  //   donna   → ThemeInjector emits Donna's cream/peach CSS vars from brand
  //   namkhan → default dark globals (no wrapper)
  if (themeScope === 'holding') {
    return (
      <>
        <Script id="cockpit-chat-holding-theme" strategy="beforeInteractive">
          {`document.documentElement.setAttribute('data-property','holding');`}
        </Script>
        {chatBody}
      </>
    );
  }
  if (themeScope === 'donna') {
    return <ThemeInjector palette={donnaPalette as any}>{chatBody}</ThemeInjector>;
  }
  return chatBody;
}

// Children of DashboardPage body sit in a 360px auto-fit grid cell. Spanning
// 1/-1 makes the chat block fill the full row.
const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
