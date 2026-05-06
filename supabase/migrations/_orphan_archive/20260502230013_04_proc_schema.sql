-- ============================================================================
-- Migration: 04_proc_schema  (Procurement workflow — PR, PO, proposals)
-- Version:   20260502230013
-- Date:      2026-05-02
-- DEPENDS ON: inv (items, locations), suppliers (suppliers)
-- ============================================================================
-- Implements pages: /ops/inventory/shop  (HOD request UI)
--                   /ops/inventory/requests
--                   /ops/inventory/orders
--                   /ops/inventory/catalog (admin)
-- Includes RPCs: proc.proc_pr_submit, proc.proc_pr_decide
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS proc;
COMMENT ON SCHEMA proc IS 'Procurement workflow — Purchase Requests, Purchase Orders, catalog proposals.';

-- ============================================================================
-- APPROVAL THRESHOLDS  (single-row config table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS proc.config (
  id                INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- enforce single row
  auto_approve_under_usd  NUMERIC(12,2) NOT NULL DEFAULT 500.00,
  gm_approval_under_usd   NUMERIC(12,2) NOT NULL DEFAULT 5000.00,
  -- amounts >= gm_approval_under_usd require owner
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID DEFAULT auth.uid()
);
INSERT INTO proc.config (id) VALUES (1) ON CONFLICT DO NOTHING;
COMMENT ON TABLE proc.config IS 'Single-row config. Edit auto_approve / gm thresholds via UPDATE.';

-- ============================================================================
-- 1. proc.requests  (Purchase Requests — HOD-initiated)
-- ============================================================================
CREATE TABLE IF NOT EXISTS proc.requests (
  pr_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_number             TEXT UNIQUE,                   -- "PR-2026-038", populated on submit
  pr_title              TEXT NOT NULL,
  requesting_dept       TEXT,                          -- e.g. 'fb','hk','spa','engineering'
  delivery_location_id  BIGINT REFERENCES inv.locations(location_id) ON DELETE SET NULL,
  needed_by_date        DATE,
  priority              TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  total_estimated_lak   NUMERIC(14,2),
  total_estimated_usd   NUMERIC(12,2),
  fx_rate_used          NUMERIC(14,4),
  business_justification TEXT,
  -- Workflow
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','auto_approved','pending_gm','pending_owner','approved','sent_back','rejected','cancelled','converted_to_po','closed')),
  required_approver_role TEXT,                         -- 'auto','gm','owner' — set by proc_pr_submit
  submitted_at          TIMESTAMPTZ,
  approved_at           TIMESTAMPTZ,
  approved_by           UUID,
  rejected_at           TIMESTAMPTZ,
  rejected_by           UUID,
  rejection_reason      TEXT,
  -- PO linkage when converted
  converted_to_po_id    UUID,                          -- FK in proc.purchase_orders, set after conversion
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID DEFAULT auth.uid(),
  updated_by            UUID DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS idx_proc_pr_status   ON proc.requests(status);
CREATE INDEX IF NOT EXISTS idx_proc_pr_dept     ON proc.requests(requesting_dept);
CREATE INDEX IF NOT EXISTS idx_proc_pr_date     ON proc.requests(submitted_at);
CREATE INDEX IF NOT EXISTS idx_proc_pr_creator  ON proc.requests(created_by);

-- ============================================================================
-- 2. proc.request_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS proc.request_items (
  pr_item_id            BIGSERIAL PRIMARY KEY,
  pr_id                 UUID NOT NULL REFERENCES proc.requests(pr_id) ON DELETE CASCADE,
  item_id               UUID REFERENCES inv.items(item_id) ON DELETE SET NULL,  -- null when item is a new proposal
  proposed_item_name    TEXT,                          -- populated when item_id is null
  proposed_category_id  BIGINT REFERENCES inv.categories(category_id) ON DELETE SET NULL,
  uom_id                BIGINT REFERENCES inv.units(unit_id) ON DELETE SET NULL,
  quantity              NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_cost_lak         NUMERIC(12,2),
  unit_cost_usd         NUMERIC(10,2),
  fx_rate_used          NUMERIC(14,4),
  total_lak             NUMERIC(14,2) GENERATED ALWAYS AS (quantity * COALESCE(unit_cost_lak, 0)) STORED,
  total_usd             NUMERIC(14,2) GENERATED ALWAYS AS (quantity * COALESCE(unit_cost_usd, 0)) STORED,
  preferred_supplier_id UUID REFERENCES suppliers.suppliers(supplier_id) ON DELETE SET NULL,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proc_pr_items_pr   ON proc.request_items(pr_id);
CREATE INDEX IF NOT EXISTS idx_proc_pr_items_item ON proc.request_items(item_id) WHERE item_id IS NOT NULL;

-- ============================================================================
-- 3. proc.new_item_proposals  (Page 6 catalog admin)
-- ============================================================================
CREATE TABLE IF NOT EXISTS proc.new_item_proposals (
  proposal_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_name         TEXT NOT NULL,
  proposed_description  TEXT,
  category_id           BIGINT REFERENCES inv.categories(category_id) ON DELETE SET NULL,
  uom_id                BIGINT REFERENCES inv.units(unit_id) ON DELETE SET NULL,
  estimated_unit_cost_usd NUMERIC(10,2),
  likely_vendor_id      UUID REFERENCES suppliers.suppliers(supplier_id) ON DELETE SET NULL,
  expected_monthly_usage NUMERIC(12,3),
  justification         TEXT NOT NULL,
  photo_storage_path    TEXT,
  -- Workflow
  status                TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected','more_info_needed')),
  proposed_by           UUID DEFAULT auth.uid(),
  proposed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewer_id           UUID,
  reviewed_at           TIMESTAMPTZ,
  approved_item_id      UUID REFERENCES inv.items(item_id) ON DELETE SET NULL,
  reviewer_notes        TEXT,
  -- Linkage to triggering PR (if any)
  origin_pr_id          UUID REFERENCES proc.requests(pr_id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proc_proposals_status ON proc.new_item_proposals(status);

-- ============================================================================
-- 4. proc.purchase_orders
-- ============================================================================
CREATE TABLE IF NOT EXISTS proc.purchase_orders (
  po_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number             TEXT UNIQUE,                   -- "PO-2026-024"
  source_pr_id          UUID REFERENCES proc.requests(pr_id) ON DELETE SET NULL,
  vendor_id             UUID NOT NULL REFERENCES suppliers.suppliers(supplier_id) ON DELETE RESTRICT,
  delivery_location_id  BIGINT REFERENCES inv.locations(location_id) ON DELETE SET NULL,
  expected_delivery_date DATE,
  total_lak             NUMERIC(14,2),
  total_usd             NUMERIC(12,2),
  fx_rate_used          NUMERIC(14,4),
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partially_received','received','invoiced','closed','cancelled')),
  -- QB linkage when invoiced
  qb_bill_ref           TEXT,
  qb_billed_date        DATE,
  notes                 TEXT,
  issued_at             TIMESTAMPTZ,
  issued_by             UUID,
  closed_at             TIMESTAMPTZ,
  closed_by             UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID DEFAULT auth.uid(),
  updated_by            UUID DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS idx_proc_po_status     ON proc.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_proc_po_vendor     ON proc.purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_proc_po_pr         ON proc.purchase_orders(source_pr_id) WHERE source_pr_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proc_po_qb         ON proc.purchase_orders(qb_bill_ref) WHERE qb_bill_ref IS NOT NULL;

-- ============================================================================
-- 5. proc.po_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS proc.po_items (
  po_item_id            BIGSERIAL PRIMARY KEY,
  po_id                 UUID NOT NULL REFERENCES proc.purchase_orders(po_id) ON DELETE CASCADE,
  item_id               UUID NOT NULL REFERENCES inv.items(item_id) ON DELETE RESTRICT,
  quantity_ordered      NUMERIC(12,3) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received     NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost_lak         NUMERIC(12,2),
  unit_cost_usd         NUMERIC(10,2),
  fx_rate_used          NUMERIC(14,4),
  total_lak             NUMERIC(14,2) GENERATED ALWAYS AS (quantity_ordered * COALESCE(unit_cost_lak,0)) STORED,
  total_usd             NUMERIC(14,2) GENERATED ALWAYS AS (quantity_ordered * COALESCE(unit_cost_usd,0)) STORED,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proc_po_items_po   ON proc.po_items(po_id);
CREATE INDEX IF NOT EXISTS idx_proc_po_items_item ON proc.po_items(item_id);

-- ============================================================================
-- 6. proc.receipts  (PO receipt log — operator records goods inwards)
-- ============================================================================
CREATE TABLE IF NOT EXISTS proc.receipts (
  receipt_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id                 UUID NOT NULL REFERENCES proc.purchase_orders(po_id) ON DELETE RESTRICT,
  po_item_id            BIGINT NOT NULL REFERENCES proc.po_items(po_item_id) ON DELETE RESTRICT,
  received_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_qty          NUMERIC(12,3) NOT NULL CHECK (received_qty > 0),
  batch_code            TEXT,
  expiry_date           DATE,
  quality_check_passed  BOOLEAN,
  rejected_qty          NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (rejected_qty >= 0),
  rejection_reason      TEXT,
  -- Auto-generated inv.movements row id for cross-reference
  movement_id           BIGINT,
  notes                 TEXT,
  received_by           UUID DEFAULT auth.uid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proc_recv_po       ON proc.receipts(po_id);
CREATE INDEX IF NOT EXISTS idx_proc_recv_at       ON proc.receipts(received_at);

-- ============================================================================
-- 7. proc.approval_log  (audit trail for spec's "Approval log" panel)
-- ============================================================================
CREATE TABLE IF NOT EXISTS proc.approval_log (
  log_id                BIGSERIAL PRIMARY KEY,
  pr_id                 UUID REFERENCES proc.requests(pr_id) ON DELETE CASCADE,
  po_id                 UUID REFERENCES proc.purchase_orders(po_id) ON DELETE CASCADE,
  action                TEXT NOT NULL,                 -- 'submitted','auto_approved','approve','reject','send_back','convert_to_po','close'
  actor_id              UUID,
  actor_role            TEXT,
  decision              TEXT,
  notes                 TEXT,
  occurred_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proc_alog_pr ON proc.approval_log(pr_id) WHERE pr_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proc_alog_po ON proc.approval_log(po_id) WHERE po_id IS NOT NULL;

-- ============================================================================
-- VIEW: v_proc_open_requests  (Overview decisions panel)
-- ============================================================================
CREATE OR REPLACE VIEW proc.v_proc_open_requests AS
SELECT
  r.pr_id,
  r.pr_number,
  r.pr_title,
  r.requesting_dept,
  r.priority,
  r.status,
  r.required_approver_role,
  r.total_estimated_usd,
  r.needed_by_date,
  r.submitted_at,
  r.created_by,
  EXTRACT(EPOCH FROM (now() - r.submitted_at)) / 86400.0 AS days_pending,
  (SELECT count(*) FROM proc.request_items WHERE pr_id = r.pr_id) AS line_count
FROM proc.requests r
WHERE r.status IN ('submitted','pending_gm','pending_owner','sent_back')
ORDER BY
  CASE r.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
  r.submitted_at;

-- ============================================================================
-- RPC: proc.proc_pr_submit
-- ----------------------------------------------------------------------------
-- Called by Shop UI on submit. Generates pr_number, sets total, routes.
-- Returns one of: 'auto_approved' | 'pending_gm' | 'pending_owner'
-- ============================================================================
CREATE OR REPLACE FUNCTION proc.proc_pr_submit(p_pr_id UUID, p_actor_id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = proc, inv, suppliers, public
AS $$
DECLARE
  v_total_usd       NUMERIC(12,2);
  v_auto_thresh     NUMERIC(12,2);
  v_gm_thresh       NUMERIC(12,2);
  v_status          TEXT;
  v_role            TEXT;
  v_pr_number       TEXT;
  v_actor           UUID := COALESCE(p_actor_id, auth.uid());
BEGIN
  SELECT auto_approve_under_usd, gm_approval_under_usd
    INTO v_auto_thresh, v_gm_thresh
  FROM proc.config WHERE id = 1;

  -- Aggregate total from items if not already set
  SELECT COALESCE(SUM(total_usd), 0) INTO v_total_usd
  FROM proc.request_items WHERE pr_id = p_pr_id;

  IF v_total_usd IS NULL OR v_total_usd <= 0 THEN
    RAISE EXCEPTION 'PR % has no priced line items — cannot submit.', p_pr_id;
  END IF;

  -- Decide status + required approver
  IF v_total_usd < v_auto_thresh THEN
    v_status := 'auto_approved';
    v_role   := 'auto';
  ELSIF v_total_usd < v_gm_thresh THEN
    v_status := 'pending_gm';
    v_role   := 'gm';
  ELSE
    v_status := 'pending_owner';
    v_role   := 'owner';
  END IF;

  -- Generate PR number "PR-YYYY-NNN"
  SELECT 'PR-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad((COALESCE(MAX(NULLIF(regexp_replace(pr_number, '^PR-\d{4}-', ''), ''))::int, 0) + 1)::text, 3, '0')
    INTO v_pr_number
  FROM proc.requests
  WHERE pr_number LIKE 'PR-' || to_char(CURRENT_DATE, 'YYYY') || '-%';

  UPDATE proc.requests
     SET pr_number = COALESCE(pr_number, v_pr_number),
         total_estimated_usd = v_total_usd,
         status = v_status,
         required_approver_role = v_role,
         submitted_at = COALESCE(submitted_at, now()),
         approved_at = CASE WHEN v_status = 'auto_approved' THEN now() ELSE approved_at END,
         approved_by = CASE WHEN v_status = 'auto_approved' THEN v_actor    ELSE approved_by END,
         updated_at = now()
   WHERE pr_id = p_pr_id;

  INSERT INTO proc.approval_log (pr_id, action, actor_id, decision, notes)
       VALUES (p_pr_id, 'submitted', v_actor, v_status, 'auto-routed by proc_pr_submit');

  RETURN v_status;
END;
$$;
REVOKE ALL ON FUNCTION proc.proc_pr_submit(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION proc.proc_pr_submit(UUID, UUID) TO authenticated, service_role;

-- ============================================================================
-- RPC: proc.proc_pr_decide
-- ----------------------------------------------------------------------------
-- Called from Page 4 (Approve / Send back / Reject buttons).
-- Validates actor has the required role for this PR's level.
-- Returns the new status.
-- ============================================================================
CREATE OR REPLACE FUNCTION proc.proc_pr_decide(
  p_pr_id      UUID,
  p_actor_id   UUID,
  p_actor_role TEXT,
  p_decision   TEXT,                                  -- 'approve' | 'send_back' | 'reject'
  p_notes      TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = proc, public
AS $$
DECLARE
  v_required TEXT;
  v_current  TEXT;
  v_new      TEXT;
BEGIN
  IF p_decision NOT IN ('approve','send_back','reject') THEN
    RAISE EXCEPTION 'p_decision must be one of approve/send_back/reject (got %)', p_decision;
  END IF;

  SELECT required_approver_role, status INTO v_required, v_current
  FROM proc.requests WHERE pr_id = p_pr_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PR % not found', p_pr_id;
  END IF;

  IF v_current NOT IN ('submitted','pending_gm','pending_owner','sent_back') THEN
    RAISE EXCEPTION 'PR % not in approvable state (current = %)', p_pr_id, v_current;
  END IF;

  -- Authorization: actor role must satisfy required level (owner can do anything; gm can do gm-or-below).
  IF p_decision = 'approve' THEN
    IF NOT (
         p_actor_role = 'owner'
      OR (p_actor_role = 'gm'    AND v_required IN ('gm','auto'))
    ) THEN
      RAISE EXCEPTION 'Actor role % cannot approve PR requiring %', p_actor_role, v_required;
    END IF;
    v_new := 'approved';
    UPDATE proc.requests
       SET status = v_new, approved_at = now(), approved_by = p_actor_id, updated_at = now()
     WHERE pr_id = p_pr_id;
  ELSIF p_decision = 'send_back' THEN
    v_new := 'sent_back';
    UPDATE proc.requests
       SET status = v_new, updated_at = now()
     WHERE pr_id = p_pr_id;
  ELSE  -- reject
    v_new := 'rejected';
    UPDATE proc.requests
       SET status = v_new, rejected_at = now(), rejected_by = p_actor_id, rejection_reason = p_notes, updated_at = now()
     WHERE pr_id = p_pr_id;
  END IF;

  INSERT INTO proc.approval_log (pr_id, action, actor_id, actor_role, decision, notes)
       VALUES (p_pr_id, p_decision, p_actor_id, p_actor_role, v_new, p_notes);

  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION proc.proc_pr_decide(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION proc.proc_pr_decide(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE proc.config              ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc.requests            ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc.request_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc.new_item_proposals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc.purchase_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc.po_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc.receipts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc.approval_log        ENABLE ROW LEVEL SECURITY;

CREATE POLICY proc_cfg_read   ON proc.config             FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY proc_cfg_write  ON proc.config             FOR ALL    USING (app.is_top_level()) WITH CHECK (app.is_top_level());

CREATE POLICY proc_pr_read    ON proc.requests           FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY proc_pr_write   ON proc.requests           FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));

CREATE POLICY proc_pri_read   ON proc.request_items      FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY proc_pri_write  ON proc.request_items      FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));

CREATE POLICY proc_prop_read  ON proc.new_item_proposals FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY proc_prop_write ON proc.new_item_proposals FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));

CREATE POLICY proc_po_read    ON proc.purchase_orders    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY proc_po_write   ON proc.purchase_orders    FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));

CREATE POLICY proc_poi_read   ON proc.po_items           FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY proc_poi_write  ON proc.po_items           FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));

CREATE POLICY proc_recv_read  ON proc.receipts           FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY proc_recv_write ON proc.receipts           FOR ALL    USING (app.is_top_level() OR app.has_role(ARRAY['hod'])) WITH CHECK (app.is_top_level() OR app.has_role(ARRAY['hod']));

CREATE POLICY proc_alog_read  ON proc.approval_log       FOR SELECT USING (auth.uid() IS NOT NULL);
-- approval_log is INSERT-only via RPCs; lock direct writes
CREATE POLICY proc_alog_write ON proc.approval_log       FOR ALL    USING (app.is_top_level()) WITH CHECK (app.is_top_level());

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT USAGE  ON SCHEMA proc TO authenticated, anon, service_role;
GRANT SELECT ON ALL TABLES    IN SCHEMA proc TO authenticated;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA proc TO authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA proc TO authenticated;
GRANT USAGE  ON ALL SEQUENCES IN SCHEMA proc TO authenticated;
GRANT ALL    ON ALL TABLES    IN SCHEMA proc TO service_role;
GRANT USAGE  ON ALL SEQUENCES IN SCHEMA proc TO service_role;

-- end 04_proc_schema
