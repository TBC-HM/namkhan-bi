-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429210507
-- Name:    phase1_03_ops
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =====================================================================
-- Phase 1.3 — `ops` schema
-- Departments, staff (extends app.profiles), shifts, maintenance,
-- assets, vendors, purchase orders, connectors
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS ops;
COMMENT ON SCHEMA ops IS 'Cross-department operations: departments, staff, shifts, maintenance, assets, vendors, POs, connectors';

-- ---------------------------------------------------------------------
-- 1. DEPARTMENTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.departments (
  dept_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    bigint REFERENCES public.hotels(property_id),
  code           text NOT NULL,                       -- kitchen | spa | activities | front_office | housekeeping | maintenance | purchasing | sales_marketing | finance | hr | gm
  name           text NOT NULL,
  name_lo        text,
  parent_dept_id uuid REFERENCES ops.departments(dept_id),
  hod_user_id    uuid REFERENCES auth.users(id),
  budget_owner   uuid REFERENCES auth.users(id),
  cost_center    text,
  is_active      boolean DEFAULT true,
  raw            jsonb DEFAULT '{}'::jsonb,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE (property_id, code)
);

INSERT INTO ops.departments (property_id, code, name, name_lo) VALUES
  (260955,'kitchen',       'Restaurant Kitchen',  'ຄົວ'),
  (260955,'roots_service', 'Roots Service',       NULL),
  (260955,'spa',           'Spa',                 'ສປາ'),
  (260955,'activities',    'Activities',          'ກິດຈະກຳ'),
  (260955,'front_office',  'Front Office',        'ຫ້ອງຮັບແຂກ'),
  (260955,'housekeeping',  'Housekeeping',        'ແມ່ບ້ານ'),
  (260955,'maintenance',   'Maintenance',         'ຊ່າງ'),
  (260955,'purchasing',    'Purchasing',          'ຈັດຊື້'),
  (260955,'sales_marketing','Sales & Marketing',  NULL),
  (260955,'finance',       'Finance',             NULL),
  (260955,'hr',            'HR',                  NULL),
  (260955,'gm',            'General Management',  NULL)
ON CONFLICT (property_id, code) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. STAFF (operational view of profiles + employment metadata)
-- profiles already exists; this adds employment-specific fields.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.staff_employment (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id       bigint REFERENCES public.hotels(property_id),
  dept_id           uuid REFERENCES ops.departments(dept_id),
  employee_code     text,
  employment_type   text CHECK (employment_type IN ('full_time','part_time','casual','contract','intern','external')),
  contract_doc_id   uuid REFERENCES docs.documents(doc_id),
  monthly_salary    numeric,
  salary_currency   text DEFAULT 'LAK',
  start_date        date,
  end_date          date,
  termination_reason text,
  is_active         boolean DEFAULT true,
  raw               jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (user_id, start_date)
);
CREATE INDEX IF NOT EXISTS idx_employment_dept ON ops.staff_employment(dept_id) WHERE is_active = true;

-- ---------------------------------------------------------------------
-- 3. SHIFTS / ROTAS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.shift_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   bigint REFERENCES public.hotels(property_id),
  dept_id       uuid REFERENCES ops.departments(dept_id),
  code          text,                                  -- AM_06_14 | PM_14_22 | NIGHT
  name          text NOT NULL,
  start_time    time,
  end_time      time,
  break_min     int DEFAULT 0,
  is_active     boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS ops.shifts (
  shift_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   bigint REFERENCES public.hotels(property_id),
  user_id       uuid REFERENCES auth.users(id),
  dept_id       uuid REFERENCES ops.departments(dept_id),
  shift_date    date NOT NULL,
  template_id   uuid REFERENCES ops.shift_templates(id),
  start_at      timestamptz,
  end_at        timestamptz,
  status        text DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','in_progress','completed','no_show','cancelled','gap')),
  is_overtime   boolean DEFAULT false,
  swap_with_user_id uuid REFERENCES auth.users(id),
  notes         text,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON ops.shifts(user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_dept_date ON ops.shifts(dept_id, shift_date);

CREATE TABLE IF NOT EXISTS ops.timeclock (
  id           bigserial PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id),
  shift_id     uuid REFERENCES ops.shifts(shift_id),
  clock_in_at  timestamptz,
  clock_out_at timestamptz,
  method       text,                                   -- biometric | mobile | manual
  notes        text,
  created_at   timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 4. ASSETS REGISTER (FF&E + OS&E)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.assets (
  asset_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       bigint REFERENCES public.hotels(property_id),
  asset_code        text,
  name              text NOT NULL,
  category          text,                              -- ffe | ose | it | vehicle | building | grounds
  subcategory       text,
  location          text,                              -- room number, area
  room_id           text REFERENCES public.rooms(room_id),
  serial_number     text,
  manufacturer      text,
  model             text,
  purchase_date     date,
  purchase_amount   numeric,
  purchase_currency text DEFAULT 'USD',
  vendor_id         uuid,
  warranty_until    date,
  depreciation_method text,
  useful_life_months int,
  status            text DEFAULT 'in_service' CHECK (status IN ('in_service','in_repair','retired','disposed','missing')),
  raw               jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assets_status ON ops.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_room ON ops.assets(room_id);

-- ---------------------------------------------------------------------
-- 5. MAINTENANCE TICKETS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.maintenance_tickets (
  ticket_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      bigint REFERENCES public.hotels(property_id),
  ticket_number    text,
  title            text NOT NULL,
  description      text,
  kind             text CHECK (kind IN ('corrective','preventive','inspection','request')),
  priority         text DEFAULT 'med' CHECK (priority IN ('low','med','high','urgent')),
  status           text DEFAULT 'open' CHECK (status IN ('open','assigned','in_progress','awaiting_parts','resolved','closed','wont_fix')),
  reported_by      uuid REFERENCES auth.users(id),
  assigned_to      uuid REFERENCES auth.users(id),
  asset_id         uuid REFERENCES ops.assets(asset_id),
  room_id          text REFERENCES public.rooms(room_id),
  reported_at      timestamptz DEFAULT now(),
  due_at           timestamptz,
  resolved_at      timestamptz,
  closed_at        timestamptz,
  resolution_notes text,
  parts_cost       numeric,
  labor_minutes    int,
  evidence_doc_ids uuid[] DEFAULT '{}'::uuid[],
  raw              jsonb DEFAULT '{}'::jsonb,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_open ON ops.maintenance_tickets(status, priority) WHERE status NOT IN ('closed','wont_fix');
CREATE INDEX IF NOT EXISTS idx_tickets_room ON ops.maintenance_tickets(room_id);

CREATE TABLE IF NOT EXISTS ops.preventive_schedule (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     bigint REFERENCES public.hotels(property_id),
  asset_id        uuid REFERENCES ops.assets(asset_id),
  task_name       text NOT NULL,
  cadence         text,                                 -- daily | weekly | monthly | quarterly | annual | custom
  cadence_days    int,
  last_done_at    timestamptz,
  next_due_at     timestamptz,
  assigned_to     uuid REFERENCES auth.users(id),
  sop_doc_id      uuid REFERENCES docs.documents(doc_id),
  is_active       boolean DEFAULT true
);

-- ---------------------------------------------------------------------
-- 6. VENDORS & PURCHASE ORDERS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.vendors (
  vendor_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      bigint REFERENCES public.hotels(property_id),
  name             text NOT NULL,
  legal_name       text,
  category         text,
  contact_name     text,
  email            text,
  phone            text,
  whatsapp         text,
  country          text,
  city             text,
  payment_terms    text,
  default_currency text DEFAULT 'LAK',
  tax_id           text,
  bank_details     jsonb,
  rating           numeric,
  total_spend_ytd  numeric DEFAULT 0,
  is_active        boolean DEFAULT true,
  raw              jsonb DEFAULT '{}'::jsonb,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON ops.vendors(category) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS ops.purchase_orders (
  po_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     bigint REFERENCES public.hotels(property_id),
  po_number       text,
  vendor_id       uuid REFERENCES ops.vendors(vendor_id),
  dept_id         uuid REFERENCES ops.departments(dept_id),
  status          text DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','sent','partial','received','closed','cancelled')),
  total_amount    numeric,
  currency        text DEFAULT 'LAK',
  ordered_at      timestamptz,
  expected_at     date,
  received_at     timestamptz,
  approved_by     uuid REFERENCES auth.users(id),
  approved_at     timestamptz,
  category        text,                                 -- ffe | ose | fb | spa | maintenance | other
  source_doc_id   uuid REFERENCES docs.documents(doc_id),
  notes           text,
  raw             jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS ops.purchase_order_lines (
  id            bigserial PRIMARY KEY,
  po_id         uuid NOT NULL REFERENCES ops.purchase_orders(po_id) ON DELETE CASCADE,
  line_number   int,
  description   text,
  quantity      numeric,
  unit          text,
  unit_price    numeric,
  line_total    numeric,
  received_qty  numeric DEFAULT 0,
  notes         text
);

-- ---------------------------------------------------------------------
-- 7. CONNECTORS (integration registry — Settings page)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.connectors (
  connector_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   bigint REFERENCES public.hotels(property_id),
  code          text UNIQUE NOT NULL,
  name          text NOT NULL,
  category      text,                                   -- pms | pos | accounting | drive | email | reviews | bank | social | warehouse
  status        text DEFAULT 'off' CHECK (status IN ('live','stale','off','error','planned')),
  config        jsonb DEFAULT '{}'::jsonb,              -- non-secret config; secrets in Vault
  last_sync_at  timestamptz,
  sync_cadence  text,
  health_notes  text,
  is_secret_set boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

INSERT INTO ops.connectors (property_id, code, name, category, status, sync_cadence) VALUES
  (260955,'cloudbeds',     'Cloudbeds',           'pms',         'live',   'every 15 min'),
  (260955,'siteminder',    'SiteMinder',          'channel_mgr', 'planned','every 15 min'),
  (260955,'poster_pos',    'Poster POS',          'pos',         'planned','daily'),
  (260955,'quickbooks',    'QuickBooks',          'accounting',  'planned','daily'),
  (260955,'google_drive',  'Google Drive',        'drive',       'planned','realtime'),
  (260955,'gmail_book',    'Gmail · book@',       'email',       'planned','realtime'),
  (260955,'booking_reviews','Booking.com Reviews','reviews',     'planned','hourly'),
  (260955,'supabase',      'Supabase',            'warehouse',   'live',   'realtime'),
  (260955,'bank_feed',     'Bank Feed',           'bank',        'off',    NULL),
  (260955,'youtube',       'YouTube · Social',    'social',      'off',    NULL),
  (260955,'instagram',     'Instagram',           'social',      'off',    NULL),
  (260955,'whatsapp_biz',  'WhatsApp Business',   'messaging',   'off',    NULL),
  (260955,'docusign',      'DocuSign',            'esign',       'off',    NULL)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ops.connector_health (
  id              bigserial PRIMARY KEY,
  connector_id    uuid NOT NULL REFERENCES ops.connectors(connector_id),
  checked_at      timestamptz DEFAULT now(),
  status          text,
  latency_ms      int,
  records_synced  int,
  error_message   text,
  raw             jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_connector_health_recent ON ops.connector_health(connector_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS ops.webhook_events (
  id            bigserial PRIMARY KEY,
  connector_id  uuid REFERENCES ops.connectors(connector_id),
  event_type    text,
  payload       jsonb,
  signature_ok  boolean,
  received_at   timestamptz DEFAULT now(),
  processed_at  timestamptz,
  status        text DEFAULT 'pending' CHECK (status IN ('pending','processed','failed','ignored','replay_pending')),
  error_message text
);
CREATE INDEX IF NOT EXISTS idx_webhook_pending ON ops.webhook_events(status, received_at) WHERE status = 'pending';

-- ---------------------------------------------------------------------
-- 8. RLS + grants + triggers
-- ---------------------------------------------------------------------
ALTER TABLE ops.departments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.staff_employment   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.shift_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.shifts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.timeclock          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.assets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.preventive_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.vendors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.purchase_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.connectors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.connector_health   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.webhook_events     ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_departments_updated ON ops.departments;
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON ops.departments
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_employment_updated ON ops.staff_employment;
CREATE TRIGGER trg_employment_updated BEFORE UPDATE ON ops.staff_employment
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_shifts_updated ON ops.shifts;
CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON ops.shifts
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_assets_updated ON ops.assets;
CREATE TRIGGER trg_assets_updated BEFORE UPDATE ON ops.assets
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_tickets_updated ON ops.maintenance_tickets;
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON ops.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_vendors_updated ON ops.vendors;
CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON ops.vendors
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_pos_updated ON ops.purchase_orders;
CREATE TRIGGER trg_pos_updated BEFORE UPDATE ON ops.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS trg_connectors_updated ON ops.connectors;
CREATE TRIGGER trg_connectors_updated BEFORE UPDATE ON ops.connectors
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

GRANT USAGE ON SCHEMA ops TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA ops TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA ops TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA ops TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA ops GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA ops GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA ops GRANT ALL ON SEQUENCES TO service_role;
