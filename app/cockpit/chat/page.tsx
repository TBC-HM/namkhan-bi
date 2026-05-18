// app/cockpit/chat/page.tsx
// PBS 2026-05-09 #15: every dept landing routes its chat box to /cockpit/chat
// (DeptEntry.tsx submitChat / askVectorAbout). The route reads ?dept=…&q=…
// and renders the right HoD's ChatShell.
//
// 2026-05-14 fix: DeptEntry now passes the resolved persona explicitly
// (role + name + emoji + label). If those are present we use them
// directly — that lets non-canonical dept surfaces like /holding/legal
// (Carla) and /holding/it (Kit) route to the correct chat persona
// instead of falling back to Felix.

import Script from 'next/script';
import ChatShell from '@/components/chat/ChatShell';
import Page from '@/components/page/Page';
import ThemeInjector from '@/components/ThemeInjector';
import { createClient } from '@/lib/supabase/server';

// ─── Property-scope resolver for chat theming ───────────────────────────
// PBS rule 2026-05-15: "vera works for donna but her chat window has the
// colour of the namkhan". Every chat persona must render under the palette
// of the property/holding where the agent actually works.
//
// Rule:
//   1. If role is in HOLDING_ROLES → BC peach palette (data-property=holding).
//   2. Else if role ends with "_donna" → Donna palette (ThemeInjector + fetched brand_palette).
//   3. Else → Namkhan (default dark globals).
//
// HOLDING_ROLES holds all platform/architect/legal/IT roles whose work spans
// properties. Note: `legal_specialist_donna` is misleadingly named but is
// the holding legal lead (Carla) per claude_md §1.
const HOLDING_ROLES = new Set<string>([
  // C-suite / platform
  'lead',                    // Felix
  'it_manager',              // Kit
  // Legal (holding-scoped)
  'legal_specialist_donna',  // Carla — holding generalist counsel
  'forensic_detective',      // Sherlock
  'legal_holding',           // future
  // Holding dev team
  'architect', 'designer', 'backend', 'frontend', 'security', 'tester',
  'documentarian', 'api_specialist', 'skill_creator', 'researcher',
  'reviewer', 'code_spec_writer', 'code_writer',
  // Holding ops/sales support
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

// Some agents have well-known chat nicknames that the chat router uses
// to map @<name> → role. Keep this in sync with NICKNAME_TO_ROLE in
// app/api/cockpit/chat/route.ts. When DeptEntry passes ?role= we can
// reverse-lookup the nickname here for the ChatShell mention pill.
const NICKNAME_BY_ROLE: Record<string, string> = {
  lead:                    'felix',
  it_manager:              'kit',
  revenue_hod:             'vector',
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
    role?:  string;   // explicit persona override (PBS 2026-05-14)
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

  // When DeptEntry passes an explicit role, use it. Otherwise fall back to
  // the dept-keyed PERSONAS table.
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

  const eyebrow = `Cockpit · Chat · ${persona.dept}`;
  const title = (
    <>
      Talk to <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{persona.displayName}</em>
    </>
  );

  const themeScope = resolveChatTheme(persona.role);
  // Fetch Donna brand palette only when needed (Namkhan & holding don't use it).
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

  // hideWeather: temp + AQI pills only make sense on a property surface.
  // Holding contexts (Carla / Felix / Sherlock / Kit) suppress them.
  // PBS rule 2026-05-15: "in holding no temp and no air".
  const chatBody = (
    <Page eyebrow={eyebrow} title={title} hideWeather={themeScope === 'holding'}>
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

  // Wrap per theme scope:
  //   holding → Script sets <html data-property="holding"> for the BC palette
  //   donna   → ThemeInjector emits Donna's cream/peach CSS vars from brand
  //   namkhan → no wrapper, falls through to default dark globals
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
