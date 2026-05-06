-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505172037
-- Name:    phase_3_8_marketing_role_aware_tenant_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


DROP POLICY IF EXISTS activities_catalog_read ON marketing.activities_catalog;
CREATE POLICY activities_catalog_tenant_read ON marketing.activities_catalog
  FOR SELECT TO authenticated USING (core.has_property_access(property_id));
CREATE POLICY activities_catalog_service ON marketing.activities_catalog
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS bp_read ON marketing.booking_policies;
CREATE POLICY bp_tenant_read ON marketing.booking_policies
  FOR SELECT TO authenticated USING (core.has_property_access(property_id));
CREATE POLICY bp_service ON marketing.booking_policies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cert_read ON marketing.certifications;
CREATE POLICY cert_tenant_read ON marketing.certifications
  FOR SELECT TO authenticated USING (core.has_property_access(property_id));
CREATE POLICY cert_service ON marketing.certifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS facilities_read ON marketing.facilities;
CREATE POLICY facilities_tenant_read ON marketing.facilities
  FOR SELECT TO authenticated USING (core.has_property_access(property_id));
CREATE POLICY facilities_service ON marketing.facilities
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS meeting_packages_read ON marketing.meeting_packages;
CREATE POLICY meeting_packages_tenant_read ON marketing.meeting_packages
  FOR SELECT TO authenticated USING (core.has_property_access(property_id));
CREATE POLICY meeting_packages_service ON marketing.meeting_packages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS meeting_rooms_read ON marketing.meeting_rooms;
CREATE POLICY meeting_rooms_tenant_read ON marketing.meeting_rooms
  FOR SELECT TO authenticated USING (core.has_property_access(property_id));
CREATE POLICY meeting_rooms_service ON marketing.meeting_rooms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS contact_read ON marketing.property_contact;
CREATE POLICY contact_tenant_read ON marketing.property_contact
  FOR SELECT TO authenticated USING (core.has_property_access(property_id));
CREATE POLICY contact_service ON marketing.property_contact
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS profile_read ON marketing.property_profile;
CREATE POLICY profile_tenant_read ON marketing.property_profile
  FOR SELECT TO authenticated USING (core.has_property_access(property_id));
CREATE POLICY profile_service ON marketing.property_profile
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS retreat_programs_read ON marketing.retreat_programs;
CREATE POLICY retreat_programs_tenant_read ON marketing.retreat_programs
  FOR SELECT TO authenticated USING (core.has_property_access(property_id));
CREATE POLICY retreat_programs_service ON marketing.retreat_programs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS rtc_read ON marketing.room_type_content;
CREATE POLICY rtc_tenant_read ON marketing.room_type_content
  FOR SELECT TO authenticated USING (core.has_property_access(property_id));
CREATE POLICY rtc_service ON marketing.room_type_content
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS seasons_read ON marketing.seasons;
CREATE POLICY seasons_tenant_read ON marketing.seasons
  FOR SELECT TO authenticated USING (core.has_property_access(property_id));
CREATE POLICY seasons_service ON marketing.seasons
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- retreat_pricing FK is retreat_id → retreat_programs.retreat_id
DROP POLICY IF EXISTS retreat_pricing_read ON marketing.retreat_pricing;
CREATE POLICY retreat_pricing_tenant_read ON marketing.retreat_pricing
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM marketing.retreat_programs rp
    WHERE rp.retreat_id = retreat_pricing.retreat_id
      AND core.has_property_access(rp.property_id)
  ));
CREATE POLICY retreat_pricing_service ON marketing.retreat_pricing
  FOR ALL TO service_role USING (true) WITH CHECK (true);
