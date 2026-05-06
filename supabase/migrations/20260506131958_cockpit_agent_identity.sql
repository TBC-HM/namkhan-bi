-- Cockpit agent identity (funky names + avatars + taglines).
-- Purpose: give each agent a memorable display name + emoji avatar
--          that survives prompt version changes (identity is per-role,
--          not per-prompt).
-- Method:  separate cockpit_agent_identity table keyed by role; team
--          API JOINs to render the cockpit Team tab.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: cockpit_agent_identity).

CREATE TABLE IF NOT EXISTS public.cockpit_agent_identity (
  role         TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar       TEXT NOT NULL,
  tagline      TEXT,
  color        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.cockpit_agent_identity ENABLE ROW LEVEL SECURITY;

INSERT INTO public.cockpit_agent_identity (role, display_name, avatar, tagline, color) VALUES
('it_manager',       'Captain Kit',          '🧭', 'Routes everything · the chief',                         'var(--brass)'),
('lead',             'Foreman Felix',        '🛠️', 'Decomposes features into specialist work',              'var(--cyan)'),
('frontend',         'Pixel Pia',            '🎨', 'UI specialist — pages, components, styling',            'var(--pink)'),
('backend',          'Schema Sage',          '⚙️', 'Schema, API routes, RLS, cron',                          'var(--purple)'),
('designer',         'Brand Bea',            '✨', 'Brand & design-system enforcement',                      'var(--pink)'),
('researcher',       'Detective Data',       '🔍', 'Data, metrics, investigation',                           'var(--purple)'),
('reviewer',         'Sheriff Sigma',        '🛡️', 'Pre-build risk + must-have tests',                       'var(--yellow)'),
('tester',           'QA Quinn',             '🧪', 'Test plans (unit / integration / e2e)',                  'var(--yellow)'),
('documentarian',    'Scribe Scott',         '📚', 'Docs, ADRs, runbooks',                                    'var(--green)'),
('ops_lead',         'Operator Olive',       '📞', 'Out-of-IT-scope handoff (Cloudbeds, accounting)',         'var(--brass)'),
('code_spec_writer', 'Quill Quincy',         '✍️', 'GH-issue-ready specs from approved tickets',              'var(--brass)'),
('skill_creator',    'Forge Astra',          '🔨', 'Designs new tools and skills',                            'var(--cyan)'),
('none',             'Generalist Glen',      '🃏', 'Fallback dispatcher',                                     'var(--text-3)')
ON CONFLICT (role) DO UPDATE SET
  display_name=EXCLUDED.display_name,
  avatar=EXCLUDED.avatar,
  tagline=EXCLUDED.tagline,
  color=EXCLUDED.color;
