-- AUDIT COPY — applied live as standards_pm_source_v1 (Plan B Task 4).
-- 71 preventive-maintenance tasks become requirements. Only 11 carried an SOP link, which
-- is a direct contributor to the 2.6% PM completion rate: a technician gets a task and no
-- procedure.
--
-- DEPT RESOLUTION TRAP: ops.task_catalog.dept_id is a uuid FK to ops.departments.dept_id.
-- Plan A cast it to text and compared it against a dept code, which returned ZERO for every
-- department, silently. ops.departments.code already holds the live lowercase codes, so the
-- correct join needs no alias table at all.
INSERT INTO standards.sources (source_key, title, doc_id, authority, version)
VALUES ('pm_catalog', 'Namkhan Preventive Maintenance Catalogue', NULL, 'PM', '2026-09')
ON CONFLICT (source_key) DO NOTHING;

INSERT INTO standards.requirements
  (source_id, section, subsection, question_no, text, dept_code, dept_hint, category)
SELECT (SELECT source_id FROM standards.sources WHERE source_key='pm_catalog'),
       'Preventive Maintenance', d.name, NULL,
       left(t.title || CASE WHEN coalesce(t.description,'') <> '' THEN ' — ' || t.description ELSE '' END, 600),
       d.code, 'preventive maintenance ' || d.code, 'safety'
FROM ops.task_catalog t
JOIN ops.departments d ON d.dept_id = t.dept_id
WHERE t.is_active AND t.property_id = 260955
  AND NOT EXISTS (SELECT 1 FROM standards.requirements r
                  WHERE r.source_id = (SELECT source_id FROM standards.sources WHERE source_key='pm_catalog')
                    AND r.text = left(t.title || CASE WHEN coalesce(t.description,'') <> '' THEN ' — ' || t.description ELSE '' END, 600));
