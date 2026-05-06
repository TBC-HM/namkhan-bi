-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505110140
-- Name:    poster_room_type_alias_v1
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Manager has been typing nicknames for room types in Poster's "client" field
-- (e.g. "Art Suite" instead of Cloudbeds' "Art Deluxe Suite"). Without an alias
-- table, room-type matching fails for ~85% of Charge-to-room receipts.
--
-- This table maps poster_client → cb_room_type_name. User reviews + extends.

CREATE TABLE IF NOT EXISTS pos.poster_room_type_alias (
  poster_client       text PRIMARY KEY,           -- the value as it appears in Poster
  cb_room_type_name   text NOT NULL,              -- canonical Cloudbeds room_type_name
  confidence          text NOT NULL DEFAULT 'auto',  -- 'auto' / 'manual' / 'review'
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

GRANT SELECT ON pos.poster_room_type_alias TO anon, authenticated;
GRANT ALL    ON pos.poster_room_type_alias TO service_role;

-- Seed initial aliases. 'auto' = my best guess, user should review.
INSERT INTO pos.poster_room_type_alias (poster_client, cb_room_type_name, confidence, notes) VALUES
  ('Art Suite',                  'Art Deluxe Suite',         'auto',  'name proximity'),
  ('Family Room',                'Art Deluxe Family Room',   'auto',  'only family room in CB'),
  ('Explorer Tent',              'Explorer Glamping',        'auto',  'tent = glamping in CB'),
  ('River Suite',                'Riverview Suite',          'auto',  'name proximity — verify'),
  ('Sunset Luang Prabang Villa', 'Sunset Luang Prabang Villa', 'manual', 'exact match'),
  ('Sunset Namkhan River Villa', 'Sunset Namkhan River Villa', 'manual', 'exact match'),
  ('Namkhan Deluxe',             'Namkhan Room',             'review', 'ambiguous — could be Namkhan Bungalow'),
  ('Namkhan Tent',               'Riverfront Glamping',      'review', 'ambiguous — guess based on river/tent'),
  ('River Side Villa',           'Riverfront Suite',         'review', 'no exact match — best guess')
ON CONFLICT (poster_client) DO NOTHING;