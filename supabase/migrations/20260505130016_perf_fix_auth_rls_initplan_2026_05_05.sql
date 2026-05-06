-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505130016
-- Name:    perf_fix_auth_rls_initplan_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Audit finding 2026-05-05: 47 RLS policies call auth.uid()/auth.role()/auth.jwt()
-- per-row. PostgREST evaluates the function once per scanned row instead of once
-- per query. Wrapping in (SELECT auth.uid()) makes the planner treat it as an
-- initplan -> evaluated once. Behaviorally identical, faster.
--
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- NOT INCLUDED in this migration:
--  - sales.* policies (use current_setting on JWT claim, different optimization path)
--  - storage.objects policies (need Supabase-managed approach, separate migration)
-- Sales schema has its own structural problem (qual=true on most tables) — separate fix.

-- ===== app =====
DROP POLICY IF EXISTS profiles_self_read ON app.profiles;
CREATE POLICY profiles_self_read ON app.profiles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS profiles_self_update ON app.profiles;
CREATE POLICY profiles_self_update ON app.profiles
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS ur_self_read ON app.user_roles;
CREATE POLICY ur_self_read ON app.user_roles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notif_own ON app.notifications;
CREATE POLICY notif_own ON app.notifications
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS media_write ON app.media;
CREATE POLICY media_write ON app.media
  FOR ALL TO authenticated
  USING (app.is_top_level() OR (uploaded_by = (SELECT auth.uid())))
  WITH CHECK (app.is_top_level() OR (uploaded_by = (SELECT auth.uid())));

DROP POLICY IF EXISTS tasks_read ON app.tasks;
CREATE POLICY tasks_read ON app.tasks
  FOR SELECT TO authenticated
  USING (
    (assigned_to = (SELECT auth.uid()))
    OR (created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = ANY (watchers))
    OR app.is_top_level()
    OR ((dept_code IS NOT NULL) AND (dept_code = ANY (app.my_dept_codes())))
  );

DROP POLICY IF EXISTS tasks_top ON app.tasks;
CREATE POLICY tasks_top ON app.tasks
  FOR UPDATE TO authenticated
  USING (app.is_top_level() OR (assigned_to = (SELECT auth.uid())) OR (created_by = (SELECT auth.uid())))
  WITH CHECK (app.is_top_level() OR (assigned_to = (SELECT auth.uid())) OR (created_by = (SELECT auth.uid())));

-- ===== compiler =====
DROP POLICY IF EXISTS compiler_authenticated_select_own ON compiler.runs;
CREATE POLICY compiler_authenticated_select_own ON compiler.runs
  FOR SELECT TO authenticated
  USING ((operator_id = (SELECT auth.uid())) OR ((SELECT auth.role()) = 'service_role'));

-- ===== docs =====
DROP POLICY IF EXISTS docs_read ON docs.documents;
CREATE POLICY docs_read ON docs.documents
  FOR SELECT TO authenticated
  USING (
    (sensitivity = 'public') OR (sensitivity = 'internal')
    OR (owner_user_id = (SELECT auth.uid()))
    OR app.is_top_level()
    OR ((sensitivity = 'confidential') AND app.has_role(ARRAY['owner','gm','hod','auditor']))
  );

DROP POLICY IF EXISTS docs_top ON docs.documents;
CREATE POLICY docs_top ON docs.documents
  FOR ALL TO authenticated
  USING (app.is_top_level() OR (owner_user_id = (SELECT auth.uid())))
  WITH CHECK (app.is_top_level() OR (owner_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS chunks_read ON docs.chunks;
CREATE POLICY chunks_read ON docs.chunks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM docs.documents d
    WHERE d.doc_id = chunks.doc_id
      AND (
        d.sensitivity IN ('public','internal')
        OR d.owner_user_id = (SELECT auth.uid())
        OR app.is_top_level()
        OR (d.sensitivity = 'confidential' AND app.has_role(ARRAY['owner','gm','hod','auditor']))
      )
  ));

-- ===== fa =====
DROP POLICY IF EXISTS fa_cat_read ON fa.categories;
CREATE POLICY fa_cat_read ON fa.categories FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS fa_assets_read ON fa.assets;
CREATE POLICY fa_assets_read ON fa.assets FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS fa_mov_read ON fa.asset_movements;
CREATE POLICY fa_mov_read ON fa.asset_movements FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS fa_mlog_read ON fa.maintenance_log;
CREATE POLICY fa_mlog_read ON fa.maintenance_log FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS fa_docs_read ON fa.documents;
CREATE POLICY fa_docs_read ON fa.documents FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS fa_capex_read ON fa.capex_pipeline;
CREATE POLICY fa_capex_read ON fa.capex_pipeline FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);

-- ===== inv =====
DROP POLICY IF EXISTS inv_cat_read ON inv.categories;
CREATE POLICY inv_cat_read ON inv.categories FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS inv_unit_read ON inv.units;
CREATE POLICY inv_unit_read ON inv.units FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS inv_loc_read ON inv.locations;
CREATE POLICY inv_loc_read ON inv.locations FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS inv_item_read ON inv.items;
CREATE POLICY inv_item_read ON inv.items FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS inv_par_read ON inv.par_levels;
CREATE POLICY inv_par_read ON inv.par_levels FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS inv_bal_read ON inv.stock_balance;
CREATE POLICY inv_bal_read ON inv.stock_balance FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS inv_mov_read ON inv.movements;
CREATE POLICY inv_mov_read ON inv.movements FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS inv_cnt_read ON inv.counts;
CREATE POLICY inv_cnt_read ON inv.counts FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS inv_cl_read ON inv.count_lines;
CREATE POLICY inv_cl_read ON inv.count_lines FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS inv_ph_read ON inv.photos;
CREATE POLICY inv_ph_read ON inv.photos FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);

-- ===== proc =====
DROP POLICY IF EXISTS proc_cfg_read ON proc.config;
CREATE POLICY proc_cfg_read ON proc.config FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS proc_pr_read ON proc.requests;
CREATE POLICY proc_pr_read ON proc.requests FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS proc_pri_read ON proc.request_items;
CREATE POLICY proc_pri_read ON proc.request_items FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS proc_prop_read ON proc.new_item_proposals;
CREATE POLICY proc_prop_read ON proc.new_item_proposals FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS proc_po_read ON proc.purchase_orders;
CREATE POLICY proc_po_read ON proc.purchase_orders FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS proc_poi_read ON proc.po_items;
CREATE POLICY proc_poi_read ON proc.po_items FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS proc_recv_read ON proc.receipts;
CREATE POLICY proc_recv_read ON proc.receipts FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS proc_alog_read ON proc.approval_log;
CREATE POLICY proc_alog_read ON proc.approval_log FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);

-- ===== suppliers =====
DROP POLICY IF EXISTS suppliers_read ON suppliers.suppliers;
CREATE POLICY suppliers_read ON suppliers.suppliers FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS supplier_alt_read ON suppliers.alternates;
CREATE POLICY supplier_alt_read ON suppliers.alternates FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS supplier_contacts_read ON suppliers.contacts;
CREATE POLICY supplier_contacts_read ON suppliers.contacts FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS supplier_prices_read ON suppliers.price_history;
CREATE POLICY supplier_prices_read ON suppliers.price_history FOR SELECT TO public USING ((SELECT auth.uid()) IS NOT NULL);
