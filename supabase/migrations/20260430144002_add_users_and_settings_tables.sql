-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260430144002
-- Name:    add_users_and_settings_tables
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- v1.3: User profiles + settings backend
-- Mock auth — single property today, expandable to real auth in Phase 2.
-- The dashboard reads from these tables but does NOT enforce RLS yet
-- (single password gate is the real auth boundary today).

CREATE TABLE IF NOT EXISTS public.app_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  display_name    text NOT NULL,
  role            text NOT NULL CHECK (role IN ('owner','gm','finance','staff')),
  property_id     bigint NOT NULL DEFAULT 260955,
  initials        text,                              -- precomputed for avatar
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz
);

-- Seed: the owner account (you).
INSERT INTO public.app_users (email, display_name, role, initials)
VALUES ('paul@thenamkhan.com', 'Paul Bauer', 'owner', 'PB')
ON CONFLICT (email) DO NOTHING;

-- Settings: arbitrary key/value owned by property + role-restricted
CREATE TABLE IF NOT EXISTS public.app_settings (
  property_id     bigint NOT NULL,
  key             text NOT NULL,
  value           jsonb NOT NULL DEFAULT '{}'::jsonb,
  required_role   text NOT NULL DEFAULT 'staff' CHECK (required_role IN ('owner','gm','finance','staff')),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES public.app_users(id),
  PRIMARY KEY (property_id, key)
);

-- Seed a few settings so /settings/* has something to show
INSERT INTO public.app_settings (property_id, key, value, required_role) VALUES
  (260955, 'property.name',           '"The Namkhan"'::jsonb,                   'owner'),
  (260955, 'property.fx_lak_usd',     '21800'::jsonb,                            'owner'),
  (260955, 'property.timezone',       '"Asia/Vientiane"'::jsonb,                 'owner'),
  (260955, 'property.active_rooms',   '19'::jsonb,                               'owner'),
  (260955, 'notifications.daily_digest_email',  'true'::jsonb,                   'staff'),
  (260955, 'notifications.review_alerts_email', 'true'::jsonb,                   'staff'),
  (260955, 'notifications.dq_alerts_email',     'true'::jsonb,                   'staff'),
  (260955, 'reports.daily_pickup_recipients',   '["paul@thenamkhan.com"]'::jsonb, 'owner'),
  (260955, 'reports.weekly_revenue_day',        '"monday"'::jsonb,                'owner')
ON CONFLICT (property_id, key) DO NOTHING;

-- Decision log (foundation for action card audit trail in Phase 4)
CREATE TABLE IF NOT EXISTS public.action_decisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     bigint NOT NULL,
  user_id         uuid REFERENCES public.app_users(id),
  card_pillar     text NOT NULL,
  card_key        text NOT NULL,         -- e.g. "rev.ota_mix_high"
  decision        text NOT NULL CHECK (decision IN ('approved','adjusted','deferred','dismissed')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_decisions_card ON public.action_decisions (property_id, card_pillar, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_decisions_user ON public.action_decisions (user_id, created_at DESC);
