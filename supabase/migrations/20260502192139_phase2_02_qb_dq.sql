-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502192139
-- Name:    phase2_02_qb_dq
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE TABLE qb.dq_findings (
  finding_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint       text NOT NULL UNIQUE,
  rule_code         text NOT NULL,
  severity          text NOT NULL CHECK (severity IN ('low','med','high','critical')),
  ref_type          text CHECK (ref_type IN ('account','class','txn','period','upload','vendor')),
  ref_id            text,
  message           text NOT NULL,
  suggested_fix     text,
  impact_usd        numeric,
  status            text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','auto_resolved','dismissed')),
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz,
  dismissed_reason  text,
  dismissed_by      uuid,
  dismissed_at      timestamptz,
  source_upload_id  uuid REFERENCES qb.uploads(upload_id),
  CONSTRAINT dismissed_requires_reason CHECK (
    status <> 'dismissed' OR (dismissed_reason IS NOT NULL AND dismissed_by IS NOT NULL)
  )
);

CREATE INDEX ix_dq_findings_status   ON qb.dq_findings(status) WHERE status = 'open';
CREATE INDEX ix_dq_findings_severity ON qb.dq_findings(severity, impact_usd DESC NULLS LAST) WHERE status = 'open';
CREATE INDEX ix_dq_findings_rule     ON qb.dq_findings(rule_code, status);
CREATE INDEX ix_dq_findings_ref      ON qb.dq_findings(ref_type, ref_id);

CREATE TABLE qb.dq_findings_log (
  log_id        bigserial PRIMARY KEY,
  finding_id    uuid NOT NULL REFERENCES qb.dq_findings(finding_id),
  fingerprint   text NOT NULL,
  action        text NOT NULL
                CHECK (action IN ('created','reopened','auto_resolved','dismissed','last_seen_updated','unmuted')),
  old_status    text,
  new_status    text,
  reason        text,
  actor_id      uuid,
  actor_type    text NOT NULL CHECK (actor_type IN ('system','user','agent')),
  occurred_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_dq_log_finding     ON qb.dq_findings_log(finding_id, occurred_at);
CREATE INDEX ix_dq_log_fingerprint ON qb.dq_findings_log(fingerprint, occurred_at);
CREATE INDEX ix_dq_log_action      ON qb.dq_findings_log(action, occurred_at);

CREATE OR REPLACE FUNCTION qb.dq_fingerprint(
  p_rule_code text, p_ref_type text, p_ref_id text
) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(digest(coalesce(p_rule_code,'') || '|' || coalesce(p_ref_type,'') || '|' || coalesce(p_ref_id,''), 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION qb.dq_findings_upsert(
  p_rule_code text, p_severity text, p_ref_type text, p_ref_id text,
  p_message text, p_suggested_fix text, p_impact_usd numeric, p_upload_id uuid
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_fp text; v_existing qb.dq_findings%ROWTYPE; v_id uuid;
BEGIN
  v_fp := qb.dq_fingerprint(p_rule_code, p_ref_type, p_ref_id);
  SELECT * INTO v_existing FROM qb.dq_findings WHERE fingerprint = v_fp;
  IF v_existing.finding_id IS NULL THEN
    INSERT INTO qb.dq_findings (fingerprint, rule_code, severity, ref_type, ref_id, message, suggested_fix, impact_usd, source_upload_id)
    VALUES (v_fp, p_rule_code, p_severity, p_ref_type, p_ref_id, p_message, p_suggested_fix, p_impact_usd, p_upload_id)
    RETURNING finding_id INTO v_id;
    INSERT INTO qb.dq_findings_log (finding_id, fingerprint, action, new_status, actor_type)
    VALUES (v_id, v_fp, 'created', 'open', 'system');
    RETURN v_id;
  END IF;
  IF v_existing.status = 'dismissed' THEN RETURN v_existing.finding_id; END IF;
  IF v_existing.status = 'auto_resolved' THEN
    UPDATE qb.dq_findings SET status='open', last_seen_at=now(), resolved_at=NULL,
           message=p_message, suggested_fix=p_suggested_fix, impact_usd=p_impact_usd, source_upload_id=p_upload_id
     WHERE finding_id = v_existing.finding_id;
    INSERT INTO qb.dq_findings_log (finding_id, fingerprint, action, old_status, new_status, actor_type)
    VALUES (v_existing.finding_id, v_fp, 'reopened', 'auto_resolved', 'open', 'system');
    RETURN v_existing.finding_id;
  END IF;
  UPDATE qb.dq_findings SET last_seen_at=now(), message=p_message, suggested_fix=p_suggested_fix,
         impact_usd=p_impact_usd, source_upload_id=p_upload_id
   WHERE finding_id = v_existing.finding_id;
  INSERT INTO qb.dq_findings_log (finding_id, fingerprint, action, old_status, new_status, actor_type)
  VALUES (v_existing.finding_id, v_fp, 'last_seen_updated', 'open', 'open', 'system');
  RETURN v_existing.finding_id;
END $$;

CREATE OR REPLACE FUNCTION qb.dq_findings_auto_resolve(p_run_started_at timestamptz)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_count integer;
BEGIN
  WITH resolved AS (
    UPDATE qb.dq_findings SET status='auto_resolved', resolved_at=now()
     WHERE status='open' AND last_seen_at < p_run_started_at
    RETURNING finding_id, fingerprint
  ), logged AS (
    INSERT INTO qb.dq_findings_log (finding_id, fingerprint, action, old_status, new_status, actor_type)
    SELECT finding_id, fingerprint, 'auto_resolved', 'open', 'auto_resolved', 'system' FROM resolved
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM logged;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION qb.dq_finding_dismiss(p_finding_id uuid, p_reason text, p_actor_id uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_fp text;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Dismiss reason required (min 5 chars).';
  END IF;
  UPDATE qb.dq_findings SET status='dismissed', dismissed_reason=p_reason, dismissed_by=p_actor_id,
         dismissed_at=now(), resolved_at=now()
   WHERE finding_id=p_finding_id AND status='open' RETURNING fingerprint INTO v_fp;
  IF v_fp IS NULL THEN RETURN false; END IF;
  INSERT INTO qb.dq_findings_log (finding_id, fingerprint, action, old_status, new_status, reason, actor_id, actor_type)
  VALUES (p_finding_id, v_fp, 'dismissed', 'open', 'dismissed', p_reason, p_actor_id, 'user');
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION qb.dq_finding_unmute(p_finding_id uuid, p_actor_id uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_fp text;
BEGIN
  UPDATE qb.dq_findings SET status='auto_resolved', dismissed_reason=NULL, dismissed_by=NULL, dismissed_at=NULL
   WHERE finding_id=p_finding_id AND status='dismissed' RETURNING fingerprint INTO v_fp;
  IF v_fp IS NULL THEN RETURN false; END IF;
  INSERT INTO qb.dq_findings_log (finding_id, fingerprint, action, old_status, new_status, actor_id, actor_type)
  VALUES (p_finding_id, v_fp, 'unmuted', 'dismissed', 'auto_resolved', p_actor_id, 'user');
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION qb.dq_rule_01_not_specified(p_upload_id uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_count integer := 0; r record;
BEGIN
  FOR r IN
    SELECT period_yyyymm, sum(abs(amount_usd)) AS impact
      FROM qb.gl_entries g JOIN qb.accounts a ON a.account_id = g.account_id
     WHERE g.class_id = 'not_specified' AND a.is_pl GROUP BY period_yyyymm
  LOOP
    PERFORM qb.dq_findings_upsert('DQ-01-NOT-SPECIFIED', 'high', 'period', r.period_yyyymm,
      format('%s: $%s of P&L activity has no QB Class.', r.period_yyyymm, to_char(r.impact,'FM999,999,990.00')),
      'In QB → Transactions → filter by Class = blank → assign correct class → re-export.',
      r.impact, p_upload_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION qb.dq_rule_02_dirty_acct_id(p_upload_id uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_count integer := 0; r record;
BEGIN
  FOR r IN SELECT account_id, account_name FROM qb.accounts
     WHERE qb_account_number ~ '\.\.+$' OR qb_account_number ~ '\.$'
  LOOP
    PERFORM qb.dq_findings_upsert('DQ-02-DIRTY-ACCT-ID', 'med', 'account', r.account_id,
      format('Account %s "%s" has dirty QB account number (trailing dots).', r.account_id, r.account_name),
      'In QB → Settings → Chart of Accounts → edit account → fix the Account # → save.',
      NULL, p_upload_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION qb.dq_rule_03_duplicate_name(p_upload_id uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_count integer := 0; r record;
BEGIN
  FOR r IN SELECT trim(account_name) AS name, count(*) AS n, string_agg(account_id, ', ') AS ids
      FROM qb.accounts WHERE is_active GROUP BY trim(account_name) HAVING count(*) > 1
  LOOP
    PERFORM qb.dq_findings_upsert('DQ-03-DUPLICATE-NAME', 'med', 'account', r.name,
      format('Account name "%s" appears %s times (IDs: %s). Likely duplicate.', r.name, r.n, r.ids),
      'In QB → Settings → Chart of Accounts → merge duplicates → keep one canonical.',
      NULL, p_upload_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION qb.dq_rule_04_unmapped(p_upload_id uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_count integer := 0; r record;
BEGIN
  FOR r IN SELECT account_id, account_name, qb_type FROM qb.accounts
     WHERE is_pl AND is_active AND mapping_status = 'unmapped'
  LOOP
    PERFORM qb.dq_findings_upsert('DQ-04-UNMAPPED', 'high', 'account', r.account_id,
      format('Account %s "%s" (%s) has no USALI mapping.', r.account_id, r.account_name, r.qb_type),
      'Update qb.accounts.usali_subcategory + usali_line_code for this account.',
      NULL, p_upload_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION qb.dq_rule_05_class_total_mismatch(p_upload_id uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_count integer := 0; r record;
BEGIN
  FOR r IN
    WITH g AS (SELECT period_yyyymm, account_id, class_id, sum(amount_usd) AS gl_amt FROM qb.gl_entries GROUP BY 1,2,3),
    s AS (SELECT period_yyyymm, account_id, class_id, sum(amount_usd) AS pl_amt FROM qb.pl_summary_monthly GROUP BY 1,2,3)
    SELECT coalesce(g.period_yyyymm, s.period_yyyymm) AS period,
           coalesce(g.class_id, s.class_id) AS cls,
           coalesce(g.account_id, s.account_id) AS acct,
           coalesce(g.gl_amt, 0) AS gl_amt, coalesce(s.pl_amt, 0) AS pl_amt,
           abs(coalesce(g.gl_amt,0) - coalesce(s.pl_amt,0)) AS gap
      FROM g FULL OUTER JOIN s ON g.period_yyyymm=s.period_yyyymm AND g.account_id=s.account_id AND g.class_id=s.class_id
     WHERE abs(coalesce(g.gl_amt,0) - coalesce(s.pl_amt,0)) > greatest(abs(coalesce(s.pl_amt,0)) * 0.01, 1.00)
  LOOP
    PERFORM qb.dq_findings_upsert('DQ-05-PL-GL-MISMATCH', 'high', 'period',
      r.period || '|' || r.cls || '|' || r.acct,
      format('%s / class %s / acct %s: GL detail $%s vs P&L summary $%s — gap $%s.',
        r.period, r.cls, r.acct, to_char(r.gl_amt,'FM999,999,990.00'),
        to_char(r.pl_amt,'FM999,999,990.00'), to_char(r.gap,'FM999,999,990.00')),
      'Either txn detail or P&L summary export is incomplete. Re-export both for the period.',
      r.gap, p_upload_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION qb.dq_rule_06_undistributed_salary(p_upload_id uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_count integer := 0; r record;
BEGIN
  FOR r IN
    SELECT g.period_yyyymm, g.account_id, a.account_name, sum(g.amount_usd) AS amt
      FROM qb.gl_entries g JOIN qb.accounts a ON a.account_id = g.account_id
     WHERE g.class_id = 'undistributed' AND a.usali_subcategory = 'Payroll & Related' AND a.is_active
     GROUP BY g.period_yyyymm, g.account_id, a.account_name HAVING sum(g.amount_usd) > 0
  LOOP
    PERFORM qb.dq_findings_upsert('DQ-06-UNDIST-PAYROLL', 'med', 'period',
      r.period_yyyymm || '|' || r.account_id,
      format('%s: $%s of payroll on "%s" sits in Undistributed.', r.period_yyyymm, to_char(r.amt,'FM999,999,990.00'), r.account_name),
      'Allocate by department in QB or define an allocation policy in Supabase.',
      r.amt, p_upload_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION qb.dq_rule_07_revenue_no_class(p_upload_id uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_count integer := 0; r record;
BEGIN
  FOR r IN
    SELECT g.period_yyyymm, g.account_id, a.account_name, sum(abs(g.amount_usd)) AS amt
      FROM qb.gl_entries g JOIN qb.accounts a ON a.account_id = g.account_id
     WHERE g.class_id = 'not_specified' AND a.qb_type = 'Income'
     GROUP BY g.period_yyyymm, g.account_id, a.account_name
  LOOP
    PERFORM qb.dq_findings_upsert('DQ-07-REV-NO-CLASS', 'critical', 'period',
      r.period_yyyymm || '|' || r.account_id,
      format('%s: revenue $%s on "%s" has no class.', r.period_yyyymm, to_char(r.amt,'FM999,999,990.00'), r.account_name),
      'Reclass in QB urgently — revenue must always carry a department class.',
      r.amt, p_upload_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION qb.dq_rule_08_inactive_vendor_active(p_upload_id uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_count integer := 0; r record;
BEGIN
  FOR r IN
    SELECT v.vendor_id, v.vendor_name, count(*) AS n, sum(g.amount_usd) AS amt
      FROM qb.gl_entries g JOIN qb.vendors v ON v.vendor_id = g.vendor_id
     WHERE NOT v.is_active AND g.txn_date > now() - interval '90 days'
     GROUP BY v.vendor_id, v.vendor_name
  LOOP
    PERFORM qb.dq_findings_upsert('DQ-08-INACTIVE-VENDOR', 'low', 'vendor', r.vendor_id,
      format('Vendor "%s" is marked inactive but has %s txns in last 90d totaling $%s.',
        r.vendor_name, r.n, to_char(r.amt,'FM999,999,990.00')),
      'Reactivate vendor in QB or stop using it.', r.amt, p_upload_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION qb.dq_run_all(p_upload_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_started timestamptz := now(); v_results jsonb := '{}'::jsonb; v_n integer;
BEGIN
  v_n := qb.dq_rule_01_not_specified(p_upload_id);       v_results := v_results || jsonb_build_object('DQ-01-NOT-SPECIFIED', v_n);
  v_n := qb.dq_rule_02_dirty_acct_id(p_upload_id);       v_results := v_results || jsonb_build_object('DQ-02-DIRTY-ACCT-ID', v_n);
  v_n := qb.dq_rule_03_duplicate_name(p_upload_id);      v_results := v_results || jsonb_build_object('DQ-03-DUPLICATE-NAME', v_n);
  v_n := qb.dq_rule_04_unmapped(p_upload_id);            v_results := v_results || jsonb_build_object('DQ-04-UNMAPPED', v_n);
  v_n := qb.dq_rule_05_class_total_mismatch(p_upload_id);v_results := v_results || jsonb_build_object('DQ-05-PL-GL-MISMATCH', v_n);
  v_n := qb.dq_rule_06_undistributed_salary(p_upload_id);v_results := v_results || jsonb_build_object('DQ-06-UNDIST-PAYROLL', v_n);
  v_n := qb.dq_rule_07_revenue_no_class(p_upload_id);    v_results := v_results || jsonb_build_object('DQ-07-REV-NO-CLASS', v_n);
  v_n := qb.dq_rule_08_inactive_vendor_active(p_upload_id);v_results := v_results || jsonb_build_object('DQ-08-INACTIVE-VENDOR', v_n);
  v_n := qb.dq_findings_auto_resolve(v_started);         v_results := v_results || jsonb_build_object('auto_resolved', v_n);
  RETURN v_results;
END $$;