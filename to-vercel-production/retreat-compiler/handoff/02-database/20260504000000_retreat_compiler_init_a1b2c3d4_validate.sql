-- =====================================================================
-- Validate: retreat-compiler init
-- Run AFTER forward DDL + seed.
-- Returns one row per check; "expected" column shows what should be true.
-- =====================================================================

SELECT 'schemas exist' AS check_name, count(*)::text AS actual, '6' AS expected
FROM information_schema.schemata
WHERE schema_name IN ('catalog','pricing','compiler','book','web','content')
UNION ALL
SELECT 'tables created · catalog', count(*)::text, '10'
FROM information_schema.tables WHERE table_schema = 'catalog' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'tables created · pricing', count(*)::text, '4'
FROM information_schema.tables WHERE table_schema = 'pricing' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'tables created · compiler', count(*)::text, '4'
FROM information_schema.tables WHERE table_schema = 'compiler' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'tables created · book', count(*)::text, '4'
FROM information_schema.tables WHERE table_schema = 'book' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'tables created · web', count(*)::text, '15'
FROM information_schema.tables WHERE table_schema = 'web' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'tables created · content', count(*)::text, '4'
FROM information_schema.tables WHERE table_schema = 'content' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'RLS enabled on all new tables', count(*)::text,
       (SELECT count(*)::text FROM pg_tables WHERE schemaname IN ('catalog','pricing','compiler','book','web','content'))
FROM pg_tables p
JOIN pg_class c ON c.oid = (quote_ident(p.schemaname)||'.'||quote_ident(p.tablename))::regclass
WHERE p.schemaname IN ('catalog','pricing','compiler','book','web','content')
  AND c.relrowsecurity = true
UNION ALL
SELECT 'view · catalog.v_rooms_compilable',
       count(*)::text, '1'
FROM information_schema.views WHERE table_schema='catalog' AND table_name='v_rooms_compilable'
UNION ALL
SELECT 'rpc · web.capture_lead', count(*)::text, '1'
FROM pg_proc WHERE proname='capture_lead' AND pronamespace='web'::regnamespace
UNION ALL
SELECT 'rpc · web.track_event', count(*)::text, '1'
FROM pg_proc WHERE proname='track_event' AND pronamespace='web'::regnamespace
UNION ALL
SELECT 'seed · content.series', count(*)::text, '4' FROM content.series
UNION ALL
SELECT 'seed · content.usali_categories', count(*)::text, '11' FROM content.usali_categories
UNION ALL
SELECT 'seed · content.legal_pages', count(*)::text, '4' FROM content.legal_pages
UNION ALL
SELECT 'seed · content.lunar_events 2026-2030', count(*)::text, '~120-130'
FROM content.lunar_events WHERE event_date BETWEEN '2026-01-01' AND '2030-12-31'
UNION ALL
SELECT 'seed · catalog.vendors', count(*)::text, '9' FROM catalog.vendors
UNION ALL
SELECT 'seed · web.sites root', count(*)::text, '1'
FROM web.sites WHERE site_type='root'
UNION ALL
SELECT 'seed · pricing.seasons', count(*)::text, '4' FROM pricing.seasons
UNION ALL
SELECT 'seed · pricing.fx_locks', count(*)::text, '1' FROM pricing.fx_locks
UNION ALL
SELECT 'pgrst.db_schemas includes new', exposed, 'should include catalog,pricing,compiler,book,web,content'
FROM (
  SELECT array_to_string(setconfig, ' | ') AS exposed
  FROM pg_db_role_setting drs JOIN pg_roles r ON r.oid = drs.setrole
  WHERE r.rolname = 'authenticator'
) s;
