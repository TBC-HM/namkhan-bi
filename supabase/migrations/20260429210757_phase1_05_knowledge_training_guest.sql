-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429210757
-- Name:    phase1_05_knowledge_training_guest
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =====================================================================
-- Phase 1.5 — `knowledge`, `training`, `guest` schemas
-- SOPs/QA/brand corpus, training/onboarding, guest journey/reviews/recovery
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS knowledge;
CREATE SCHEMA IF NOT EXISTS training;
CREATE SCHEMA IF NOT EXISTS guest;
COMMENT ON SCHEMA knowledge IS 'Operational metadata over docs.documents (sop, brand) + QA + agent corpora';
COMMENT ON SCHEMA training  IS 'Training modules, sessions, attendance, certifications, competencies';
COMMENT ON SCHEMA guest     IS 'Guest reviews replies, NPS, recovery, journey events';

-- =====================================================================
-- KNOWLEDGE — sop_meta sits on top of docs.documents WHERE doc_type='sop'
-- =====================================================================

CREATE TABLE IF NOT EXISTS knowledge.sop_meta (
  doc_id            uuid PRIMARY KEY REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  property_id       bigint REFERENCES public.hotels(property_id),
  dept_code         text,
  sop_kind          text,                                 -- procedure | checklist | flowchart | playbook
  agent_consumers   text[],                                -- agent codes that read this SOP
  review_cadence_days int DEFAULT 90,
  last_reviewed_at  timestamptz,
  next_review_at    timestamptz,
  is_below_mandate  boolean DEFAULT false,
  qa_score          numeric,
  drive_doc_id      text,
  markdown_url      text,
  visual_pack_media_ids uuid[] DEFAULT '{}'::uuid[],       -- pictograms for low-literacy staff
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sop_meta_dept ON knowledge.sop_meta(dept_code);
CREATE INDEX IF NOT EXISTS idx_sop_meta_review ON knowledge.sop_meta(next_review_at);

-- QA AUDITS
CREATE TABLE IF NOT EXISTS knowledge.qa_audits (
  audit_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     bigint REFERENCES public.hotels(property_id),
  dept_code       text,
  audit_type      text,                                  -- mystery_diner | stayover_quality | mystery_checkin | treatment_protocol | preventive_compliance | food_safety | other
  audited_at      date NOT NULL,
  auditor_user_id uuid REFERENCES auth.users(id),
  external_auditor text,
  total_score     numeric,
  max_score       numeric,
  pct_score       numeric,
  mandate_pct     numeric,
  is_below_mandate boolean DEFAULT false,
  top_miss        text,
  status          text DEFAULT 'open' CHECK (status IN ('open','remediation','closed')),
  evidence_doc_ids uuid[] DEFAULT '{}'::uuid[],
  notes           text,
  raw             jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qa_dept_date ON knowledge.qa_audits(dept_code, audited_at DESC);

CREATE TABLE IF NOT EXISTS knowledge.qa_findings (
  id              bigserial PRIMARY KEY,
  audit_id        uuid NOT NULL REFERENCES knowledge.qa_audits(audit_id) ON DELETE CASCADE,
  category        text,
  description     text,
  weight          numeric,
  scored          numeric,
  is_critical     boolean DEFAULT false,
  remediation_action text,
  remediation_owner uuid REFERENCES auth.users(id),
  remediation_due_at date,
  remediation_status text DEFAULT 'open' CHECK (remediation_status IN ('open','in_progress','done','waived')),
  task_id         uuid REFERENCES app.tasks(task_id),
  evidence_doc_id uuid REFERENCES docs.documents(doc_id)
);

CREATE TABLE IF NOT EXISTS knowledge.brand_voice_corpus (
  id              bigserial PRIMARY KEY,
  property_id     bigint REFERENCES public.hotels(property_id),
  source          text,                                 -- past_review_reply | marketing_copy | brand_book | training | other
  source_doc_id   uuid REFERENCES docs.documents(doc_id),
  language        text,
  text_excerpt    text NOT NULL,
  embedding_model text,
  is_active       boolean DEFAULT true,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

-- =====================================================================
-- TRAINING — empty, fill on the go
-- =====================================================================

CREATE TABLE IF NOT EXISTS training.modules (
  module_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     bigint REFERENCES public.hotels(property_id),
  code            text,
  title           text NOT NULL,
  title_lo        text,
  description     text,
  dept_code       text,
  level           text,                                 -- onboarding | foundational | intermediate | advanced | refresher
  duration_min    int,
  is_mandatory    boolean DEFAULT false,
  prerequisites   uuid[] DEFAULT '{}'::uuid[],
  source_doc_id   uuid REFERENCES docs.documents(doc_id),
  cover_media_id  uuid REFERENCES app.media(media_id),
  is_active       boolean DEFAULT true,
  raw             jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training.sessions (
  session_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     bigint REFERENCES public.hotels(property_id),
  module_id       uuid REFERENCES training.modules(module_id),
  scheduled_at    timestamptz,
  duration_min    int,
  trainer_user_id uuid REFERENCES auth.users(id),
  external_trainer text,
  location        text,
  capacity        int,
  status          text DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training.attendance (
  id            bigserial PRIMARY KEY,
  session_id    uuid NOT NULL REFERENCES training.sessions(session_id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        text DEFAULT 'invited' CHECK (status IN ('invited','confirmed','attended','absent','partial','exempt')),
  score         numeric,
  passed        boolean,
  feedback      text,
  certificate_doc_id uuid REFERENCES docs.documents(doc_id),
  attended_at   timestamptz,
  UNIQUE (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS training.certifications (
  cert_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       bigint REFERENCES public.hotels(property_id),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              text NOT NULL,
  issuing_authority text,
  cert_number       text,
  issued_on         date,
  expires_on        date,
  doc_id            uuid REFERENCES docs.documents(doc_id),
  is_active         boolean DEFAULT true,
  notes             text,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_certs_expiry ON training.certifications(expires_on) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS training.competencies (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency    text NOT NULL,                          -- e.g. 'wine_service', 'turndown', 'kayak_safety'
  level         text,                                   -- novice | competent | proficient | expert | trainer
  evidence_doc_ids uuid[] DEFAULT '{}'::uuid[],
  assessed_by   uuid REFERENCES auth.users(id),
  assessed_at   timestamptz,
  expires_at    timestamptz,
  notes         text,
  UNIQUE (user_id, competency)
);

-- =====================================================================
-- GUEST — extends marketing.reviews; adds replies, themes, NPS, recovery, journey
-- =====================================================================

CREATE TABLE IF NOT EXISTS guest.review_replies (
  id              bigserial PRIMARY KEY,
  review_id       bigint,                               -- soft FK to marketing.reviews.id (added next)
  agent_draft     text,
  draft_by_agent_id uuid REFERENCES governance.agents(agent_id),
  draft_proposal_id uuid REFERENCES governance.proposals(proposal_id),
  edited_by       uuid REFERENCES auth.users(id),
  final_text      text,
  comp_offered    numeric,
  comp_currency   text,
  sent_at         timestamptz,
  sent_by         uuid REFERENCES auth.users(id),
  external_post_url text,
  status          text DEFAULT 'draft' CHECK (status IN ('draft','approved','sent','withdrawn')),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_replies_review ON guest.review_replies(review_id);

CREATE TABLE IF NOT EXISTS guest.review_themes (
  id          bigserial PRIMARY KEY,
  review_id   bigint,
  theme       text NOT NULL,                            -- cleanliness | food | staff_friendliness | location | value | wifi | ...
  sentiment   text CHECK (sentiment IN ('positive','neutral','negative','mixed')),
  named_staff text[],                                    -- staff names mentioned
  weight      numeric,
  detected_by text,                                      -- agent code
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_themes_theme ON guest.review_themes(theme);

CREATE TABLE IF NOT EXISTS guest.nps_responses (
  id            bigserial PRIMARY KEY,
  property_id   bigint REFERENCES public.hotels(property_id),
  reservation_id text REFERENCES public.reservations(reservation_id),
  guest_id      text REFERENCES public.guests(guest_id),
  guest_email   text,
  score         int CHECK (score BETWEEN 0 AND 10),
  category      text GENERATED ALWAYS AS (
                  CASE WHEN score >= 9 THEN 'promoter'
                       WHEN score >= 7 THEN 'passive'
                       WHEN score IS NULL THEN NULL
                       ELSE 'detractor' END) STORED,
  drivers       text[],
  comment       text,
  language      text,
  source        text,                                    -- email | post_stay_form | qr | manual
  follow_up_required boolean DEFAULT false,
  follow_up_task_id uuid REFERENCES app.tasks(task_id),
  responded_at  timestamptz,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nps_score ON guest.nps_responses(score);
CREATE INDEX IF NOT EXISTS idx_nps_res ON guest.nps_responses(reservation_id);

CREATE TABLE IF NOT EXISTS guest.recovery_cases (
  case_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      bigint REFERENCES public.hotels(property_id),
  reservation_id   text REFERENCES public.reservations(reservation_id),
  guest_id         text REFERENCES public.guests(guest_id),
  origin           text,                                -- review | nps | front_desk | manager_log | email | whatsapp
  origin_ref       text,                                -- review id, email msg id
  category         text,                                -- room | f_b | service | facility | billing | safety | other
  severity         text DEFAULT 'med' CHECK (severity IN ('low','med','high','critical')),
  description      text NOT NULL,
  opened_by        uuid REFERENCES auth.users(id),
  opened_at        timestamptz DEFAULT now(),
  owner_user_id    uuid REFERENCES auth.users(id),
  status           text DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed','escalated')),
  comp_amount      numeric,
  comp_currency    text,
  comp_authority_used text,                             -- role code
  resolution       text,
  resolved_at      timestamptz,
  closed_at        timestamptz,
  guest_satisfied  boolean,
  task_ids         uuid[] DEFAULT '{}'::uuid[],
  evidence_doc_ids uuid[] DEFAULT '{}'::uuid[],
  notes            text,
  raw              jsonb DEFAULT '{}'::jsonb,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recovery_open ON guest.recovery_cases(status) WHERE status NOT IN ('closed','resolved');

CREATE TABLE IF NOT EXISTS guest.journey_events (
  id              bigserial PRIMARY KEY,
  property_id     bigint REFERENCES public.hotels(property_id),
  reservation_id  text REFERENCES public.reservations(reservation_id),
  guest_id        text REFERENCES public.guests(guest_id),
  stage           text,                                 -- inquiry | booked | pre_arrival | check_in | in_house | check_out | post_stay | loyalty
  event_type      text,                                 -- email_sent | sms_sent | wa_sent | survey_dispatched | upsell_offered | request_made | feedback_logged
  channel         text,
  template_doc_id uuid REFERENCES docs.documents(doc_id),
  payload         jsonb,
  occurred_at     timestamptz DEFAULT now(),
  triggered_by    text                                   -- agent code | user uuid | system
);
CREATE INDEX IF NOT EXISTS idx_journey_res ON guest.journey_events(reservation_id, occurred_at);

CREATE TABLE IF NOT EXISTS guest.loyalty_members (
  id              bigserial PRIMARY KEY,
  property_id     bigint REFERENCES public.hotels(property_id),
  guest_id        text REFERENCES public.guests(guest_id),
  program         text,                                 -- slh | hilton_honors | namkhan_internal | other
  external_id     text,
  tier            text,
  points_balance  int,
  enrolled_at     timestamptz,
  notes           text,
  raw             jsonb DEFAULT '{}'::jsonb,
  UNIQUE (guest_id, program, external_id)
);

-- =====================================================================
-- RLS + grants + triggers
-- =====================================================================

ALTER TABLE knowledge.sop_meta            ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.qa_audits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.qa_findings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.brand_voice_corpus  ENABLE ROW LEVEL SECURITY;

ALTER TABLE training.modules              ENABLE ROW LEVEL SECURITY;
ALTER TABLE training.sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE training.attendance           ENABLE ROW LEVEL SECURITY;
ALTER TABLE training.certifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE training.competencies         ENABLE ROW LEVEL SECURITY;

ALTER TABLE guest.review_replies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest.review_themes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest.nps_responses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest.recovery_cases          ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest.journey_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest.loyalty_members         ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_sop_meta_updated ON knowledge.sop_meta;
CREATE TRIGGER trg_sop_meta_updated BEFORE UPDATE ON knowledge.sop_meta FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_qa_audits_updated ON knowledge.qa_audits;
CREATE TRIGGER trg_qa_audits_updated BEFORE UPDATE ON knowledge.qa_audits FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_modules_updated ON training.modules;
CREATE TRIGGER trg_modules_updated BEFORE UPDATE ON training.modules FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_sessions_updated ON training.sessions;
CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON training.sessions FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_review_replies_updated ON guest.review_replies;
CREATE TRIGGER trg_review_replies_updated BEFORE UPDATE ON guest.review_replies FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_recovery_updated ON guest.recovery_cases;
CREATE TRIGGER trg_recovery_updated BEFORE UPDATE ON guest.recovery_cases FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

GRANT USAGE ON SCHEMA knowledge, training, guest TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA knowledge TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA training TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA guest TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA knowledge TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA training TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA guest TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA knowledge TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA training TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA guest TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA knowledge GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA knowledge GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA knowledge GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA training GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA training GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA training GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA guest GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA guest GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA guest GRANT ALL ON SEQUENCES TO service_role;
