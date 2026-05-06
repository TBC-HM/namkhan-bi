-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505155718
-- Name:    phase_2_5_docs_rls_policies
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 2.5 — RLS for docs.* schema (retry without app.task_comments block)
-- =====================================================================

-- docs.documents
CREATE POLICY documents_tenant ON docs.documents
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));
CREATE INDEX IF NOT EXISTS documents_property_id_idx ON docs.documents(property_id);

-- docs.collections
CREATE POLICY collections_tenant ON docs.collections
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));
CREATE INDEX IF NOT EXISTS collections_property_id_idx ON docs.collections(property_id);

-- docs.bookmarks
CREATE POLICY bookmarks_tenant ON docs.bookmarks
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

-- docs.collection_items
CREATE POLICY collection_items_tenant ON docs.collection_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.collections c WHERE c.collection_id = collection_items.collection_id AND core.has_property_access(c.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.collections c WHERE c.collection_id = collection_items.collection_id AND core.has_property_access(c.property_id)));

-- All children FK to docs.documents
CREATE POLICY chunks_tenant ON docs.chunks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = chunks.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = chunks.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY versions_tenant ON docs.versions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = versions.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = versions.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY access_log_tenant_read ON docs.access_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = access_log.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY acknowledgments_tenant ON docs.acknowledgments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = acknowledgments.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = acknowledgments.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY signatures_tenant ON docs.signatures FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = signatures.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = signatures.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY expiry_alerts_tenant ON docs.expiry_alerts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = expiry_alerts.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = expiry_alerts.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY links_tenant ON docs.links FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = links.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = links.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY shares_tenant ON docs.shares FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = shares.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = shares.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY legal_meta_tenant ON docs.legal_meta FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = legal_meta.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = legal_meta.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY compliance_meta_tenant ON docs.compliance_meta FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = compliance_meta.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = compliance_meta.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY insurance_meta_tenant ON docs.insurance_meta FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = insurance_meta.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = insurance_meta.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY meeting_notes_tenant ON docs.meeting_notes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = meeting_notes.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = meeting_notes.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY kb_articles_tenant ON docs.kb_articles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = kb_articles.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = kb_articles.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY templates_tenant ON docs.templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = templates.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = templates.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY guest_docs_tenant ON docs.guest_docs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = guest_docs.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = guest_docs.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY vendor_docs_tenant ON docs.vendor_docs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = vendor_docs.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = vendor_docs.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY financial_docs_tenant ON docs.financial_docs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = financial_docs.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = financial_docs.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY hr_docs_tenant ON docs.hr_docs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = hr_docs.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = hr_docs.doc_id AND core.has_property_access(d.property_id)));

CREATE POLICY docs_alerts_tenant ON docs.alerts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = alerts.doc_id AND core.has_property_access(d.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM docs.documents d WHERE d.doc_id = alerts.doc_id AND core.has_property_access(d.property_id)));

-- docs.tag_catalog — keep global readable
CREATE POLICY tag_catalog_read ON docs.tag_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY tag_catalog_service_write ON docs.tag_catalog FOR ALL TO service_role USING (true) WITH CHECK (true);

-- docs.agent_prompt_history & overrides — service_role only
CREATE POLICY agent_prompt_history_service ON docs.agent_prompt_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY agent_prompt_overrides_service ON docs.agent_prompt_overrides FOR ALL TO service_role USING (true) WITH CHECK (true);

-- app.task_comments — FK to app.tasks(task_id) which has property_id
CREATE POLICY task_comments_tenant ON app.task_comments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM app.tasks t WHERE t.task_id = task_comments.task_id AND core.has_property_access(t.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM app.tasks t WHERE t.task_id = task_comments.task_id AND core.has_property_access(t.property_id)));
