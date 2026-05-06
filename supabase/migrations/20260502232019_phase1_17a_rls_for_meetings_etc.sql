-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502232019
-- Name:    phase1_17a_rls_for_meetings_etc
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE POLICY meeting_rooms_read ON marketing.meeting_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY meeting_rooms_write ON marketing.meeting_rooms FOR ALL TO authenticated
  USING (app.has_role(ARRAY['owner','gm','marketing_lead']))
  WITH CHECK (app.has_role(ARRAY['owner','gm','marketing_lead']));

CREATE POLICY meeting_packages_read ON marketing.meeting_packages FOR SELECT TO authenticated USING (true);
CREATE POLICY meeting_packages_write ON marketing.meeting_packages FOR ALL TO authenticated
  USING (app.has_role(ARRAY['owner','gm','marketing_lead']))
  WITH CHECK (app.has_role(ARRAY['owner','gm','marketing_lead']));

CREATE POLICY retreat_programs_read ON marketing.retreat_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY retreat_programs_write ON marketing.retreat_programs FOR ALL TO authenticated
  USING (app.has_role(ARRAY['owner','gm','marketing_lead']))
  WITH CHECK (app.has_role(ARRAY['owner','gm','marketing_lead']));

CREATE POLICY retreat_pricing_read ON marketing.retreat_pricing FOR SELECT TO authenticated USING (true);
CREATE POLICY retreat_pricing_write ON marketing.retreat_pricing FOR ALL TO authenticated
  USING (app.has_role(ARRAY['owner','gm','marketing_lead']))
  WITH CHECK (app.has_role(ARRAY['owner','gm','marketing_lead']));

CREATE POLICY seasons_read ON marketing.seasons FOR SELECT TO authenticated USING (true);
CREATE POLICY seasons_write ON marketing.seasons FOR ALL TO authenticated
  USING (app.has_role(ARRAY['owner','gm']))
  WITH CHECK (app.has_role(ARRAY['owner','gm']));

CREATE POLICY facilities_read ON marketing.facilities FOR SELECT TO authenticated USING (true);
CREATE POLICY facilities_write ON marketing.facilities FOR ALL TO authenticated
  USING (app.has_role(ARRAY['owner','gm','marketing_lead']))
  WITH CHECK (app.has_role(ARRAY['owner','gm','marketing_lead']));

CREATE POLICY activities_catalog_read ON marketing.activities_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY activities_catalog_write ON marketing.activities_catalog FOR ALL TO authenticated
  USING (app.has_role(ARRAY['owner','gm','marketing_lead']))
  WITH CHECK (app.has_role(ARRAY['owner','gm','marketing_lead']));