-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504150754
-- Name:    staff_master_list_hire_dates
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


UPDATE ops.staff_employment se
SET
  hire_date = COALESCE(se.hire_date, src.hire_date),
  position_title = CASE WHEN COALESCE(se.position_title,'') = '' OR se.position_title IS NULL THEN src.position ELSE se.position_title END
FROM (VALUES
  ('707e2b37-4639-4e3f-a205-e66e8630a3fb'::uuid, '2018-01-01'::date, 'Director #1'),
  ('fe4f929b-72d9-4d36-bce4-79547b14465e'::uuid, '2018-01-01'::date, 'Director #2'),
  ('b28c33d1-86c8-44f6-bc5b-6f0e9d1e13a8'::uuid, '2026-01-26'::date, 'Finance Manager'),
  ('e5160843-cc53-4c36-95f2-70aea14beae4'::uuid, '2023-04-13'::date, 'Reservation Manager'),
  ('a8216a46-80f4-4383-b8ed-133287de4b80'::uuid, '2024-03-12'::date, 'Human Resource Manager'),
  ('934fa019-c4c5-4586-ac2e-b63cf1bd0559'::uuid, '2023-02-17'::date, 'Boat Manager'),
  ('19b0a7ac-1e13-4abd-9b87-f29aca765ee8'::uuid, '2023-03-09'::date, 'Boat Captain'),
  ('24a20751-9520-4230-9922-90de5e7e4389'::uuid, '2025-12-06'::date, 'Receptionist'),
  ('d4f53da4-ee65-46f6-b36a-548ae11889be'::uuid, '2023-07-14'::date, 'Driver'),
  ('939495ac-901b-4066-8abd-b236acdbf15d'::uuid, '2022-10-17'::date, 'Security Guard'),
  ('e59e72cb-f83e-4695-ac9b-7c18ac9ba461'::uuid, '2022-12-01'::date, 'Restaurant Manager'),
  ('0dc77468-b318-4fbb-9298-3f7c7ce4dd94'::uuid, '2021-12-18'::date, 'Restaurant Supervisor'),
  ('1c366637-9fde-4bf6-b2dd-63efb76307e9'::uuid, '2024-02-19'::date, 'Waitress-Parttime'),
  ('e415a0da-2cea-4ee6-9f36-a2148d9f574b'::uuid, '2022-12-07'::date, 'bakery/Chef de Partie'),
  ('00e94cc6-dfe3-4747-b759-f5bd9613f3e6'::uuid, '2021-06-15'::date, 'Senior Cook'),
  ('515143e0-6f85-4afa-8ff6-e96e5af96b08'::uuid, '2025-12-14'::date, 'Cook'),
  ('8b45f8bf-d815-462d-9b2c-3bc95e4e367a'::uuid, '2023-09-02'::date, 'Cook'),
  ('78e0754e-bd88-43c9-b966-237364780e4b'::uuid, '2019-10-01'::date, 'Gouvernante'),
  ('02c32410-12ad-46f8-8d89-4f664556a5e1'::uuid, '2019-09-18'::date, 'Head HK Rooms'),
  ('bcc038f9-e087-4430-bc69-c6e836276182'::uuid, '2022-10-01'::date, 'Head HK Rooms 2'),
  ('0b7f2d75-60e7-41d0-b92d-13139d91cdc3'::uuid, '2022-09-01'::date, 'Head HK Tent'),
  ('d6333ac2-ce73-4e00-8269-2c5475d3810c'::uuid, '2022-09-01'::date, 'Housekeeper'),
  ('05a43d3e-ff25-42f7-abb0-c3ad8074a62f'::uuid, '2023-11-02'::date, 'Housekeeper'),
  ('54f63063-cd66-4c04-bd23-ec7a04f77961'::uuid, '2024-06-01'::date, 'Housekeeper'),
  ('a01b0128-51e4-4be0-af17-50e75fd0551c'::uuid, '2024-03-05'::date, 'Housekeeper'),
  ('d47658e8-068a-449c-8443-a561d40eb4d9'::uuid, '2024-05-01'::date, 'Laundry'),
  ('4edae26e-cf5f-4ffa-b3d2-ecd44a7f0df3'::uuid, '2022-09-10'::date, 'Tour Guide'),
  ('ba306b35-d956-4b4f-a4a7-d2f3a95d872b'::uuid, '2024-06-01'::date, 'Carpenter'),
  ('87d2f90e-473c-481c-98bd-64fdc4028428'::uuid, '2025-09-25'::date, 'Gardener'),
  ('fb8f7852-dd27-4608-8ccb-db922da48a1e'::uuid, '2023-06-03'::date, 'Gardener'),
  ('67732bd6-e8d8-4b0c-81e3-9637e9eb68e7'::uuid, '2018-09-01'::date, 'Building Manager'),
  ('4becf65f-e358-4f59-9e57-cf06303b81a6'::uuid, '2022-06-06'::date, 'Pet Sitter'),
  ('f0968a94-c6ab-4e37-b9a9-d7a1a349bcf4'::uuid, '2022-08-14'::date, 'Gardener'),
  ('5cc475ec-9ea1-4951-a3ba-8dc13dbfda31'::uuid, '2023-10-01'::date, 'BUILDING'),
  ('703abc2c-2b2f-49c6-b75c-9bc1c0af633b'::uuid, '2023-05-21'::date, 'BUILDING'),
  ('4883d4ce-c018-41f4-9470-a50077613e26'::uuid, '2023-05-20'::date, 'BUILDING'),
  ('45d8ef41-bd4c-4fdb-a0cc-6c4cdbc4da10'::uuid, '2026-02-01'::date, 'Assistant Spa Manager'),
  ('4dcb6e4c-fd52-4c96-afe5-28ccf96883fc'::uuid, '2026-02-15'::date, 'Terapist')
) AS src(staff_id, hire_date, position)
WHERE se.id = src.staff_id;
