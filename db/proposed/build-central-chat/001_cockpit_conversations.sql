-- PROPOSAL — NOT APPLIED. brief central-chat-v1 · build/central-chat.
-- Proper conversation store for Central Chat v2. v1 persists via the
-- existing cockpit_tickets thread (/api/cockpit/chat); these tables replace
-- that as the single conversation store underneath every CentralChat
-- instance site-wide (global /chat, cockpit chat, brain ask-windows,
-- university ask), per the PBS end-state clarification 2026-07-29.
--
-- Design notes:
--   * Anthropic-only per ADR-169 (owner answer 2026-07-30) — but provider /
--     model_id columns are kept per-message so later multi-provider is a
--     zero-migration change.
--   * Per-message tokens / latency / cost feed tenant-token-metering
--     (ADR-169 cost-to-serve).
--   * property-scoped from day one (multi-tenant; Phase-2 public funnel).
--   * mode is the context scope: 'second-brain' never leaks into 'general'
--     and vice versa (isolation both directions).
--   * cockpit schema is NOT exposed via PostgREST — public.v_* bridge views
--     below are the read path (project law §5). Writes go through server
--     routes with the service role (supabaseAdmin), which CAN address
--     non-public schemas server-side.
--
-- Apply path (after PBS approval): mcp apply_migration, then log the ADR.

-- ── conversations ─────────────────────────────────────────────────────────
create table if not exists cockpit.conversations (
  id            uuid primary key default gen_random_uuid(),
  org_id        bigint,                      -- holding scope (nullable v1)
  property_id   bigint,                      -- 260955 | 1000001 | null = holding
  mode          text not null check (mode in ('second-brain','general')),
  module_scope  text,                        -- 'revenue', 'it', ... null = global
  title         text,                        -- first-turn derived, editable
  summary_md    text,                        -- rolling summary (doc: Summary)
  decisions     jsonb not null default '[]'::jsonb,  -- doc: Decisions
  sources       jsonb not null default '[]'::jsonb,  -- doc: Sources
  created_by    text not null default 'pbs',
  status        text not null default 'active'
                check (status in ('active','archived')),
  started_at    timestamptz not null default now(),
  last_turn_at  timestamptz not null default now(),
  -- v1 → v2 migration aid: tickets that formed the legacy thread
  legacy_ticket_ids bigint[] not null default '{}'
);

create index if not exists conversations_scope_idx
  on cockpit.conversations (property_id, mode, module_scope, last_turn_at desc);

-- ── messages ──────────────────────────────────────────────────────────────
create table if not exists cockpit.messages (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references cockpit.conversations(id) on delete cascade,
  turn_role        text not null check (turn_role in ('user','assistant','tool')),
  agent_role       text,                     -- 'lead' (Felix) for assistant turns
  content_md       text not null,
  tool_calls       jsonb not null default '[]'::jsonb,  -- doc: Tool Calls
  -- per-message metering (ADR-169 cost-to-serve; provider kept for
  -- zero-migration abstraction later — Anthropic-only today)
  provider         text not null default 'anthropic',
  model_id         text,                     -- e.g. claude-sonnet-4-5
  model_tier       text,                     -- 'fast' | 'reasoning' | 'long-context'
  input_tokens     integer,
  output_tokens    integer,
  latency_ms       integer,
  cost_usd         numeric(10,6),
  -- owner-class question surfaced in this turn → Decision Inbox link
  owner_question_id bigint,
  created_at       timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on cockpit.messages (conversation_id, id);

-- ── PostgREST bridge (public schema law §5) ───────────────────────────────
create or replace view public.v_chat_conversations as
select id, org_id, property_id, mode, module_scope, title, summary_md,
       decisions, sources, status, started_at, last_turn_at
from cockpit.conversations;

create or replace view public.v_chat_messages as
select m.id, m.conversation_id, m.turn_role, m.agent_role, m.content_md,
       m.tool_calls, m.provider, m.model_id, m.model_tier,
       m.input_tokens, m.output_tokens, m.latency_ms, m.cost_usd,
       m.owner_question_id, m.created_at
from cockpit.messages m;

grant select on public.v_chat_conversations to anon, authenticated, service_role;
grant select on public.v_chat_messages       to anon, authenticated, service_role;
