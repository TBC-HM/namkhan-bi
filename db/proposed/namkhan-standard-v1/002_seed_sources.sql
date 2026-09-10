INSERT INTO standards.sources (source_key, title, doc_id, authority, version)
VALUES
  ('slh_mystery_2026', 'SLH Mystery Inspection 2026 - The Namkhan',
   'a1c2e6d0-5b7f-4e93-9d21-2026081900aa', 'SLH', '2026'),
  ('slh_mystery_2025', 'SLH Mystery Inspection 2025 - The Namkhan',
   '0fed077c-3dc5-423b-8e18-f7e07a413fca', 'SLH', '2025'),
  ('asean_green',      'ASEAN Green Hotel Standard',
   '654ac145-3745-430f-89a6-28557a8df764', 'ASEAN', '2022'),
  ('travelife',        'Travelife Certification Requirements v1.0',
   '66bf6a86-0523-4b7b-bbba-3774f3c50084', 'Travelife', '1.0'),
  ('gstc',             'GSTC Industry Criteria for Hotels with SDGs',
   '0d2182ca-f13f-451a-94a4-88740ee8c9ee', 'GSTC', 'v3'),
  ('slh_minimum',      'SLH Minimum Standards Chart',
   'ae55777a-a467-4302-9aed-993476913d8e', 'SLH', 'current')
ON CONFLICT (source_key) DO NOTHING;
