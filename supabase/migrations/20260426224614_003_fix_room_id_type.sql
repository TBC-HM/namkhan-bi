-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260426224614
-- Name:    003_fix_room_id_type
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Cloudbeds rooms have IDs like "508412-0" (text). Migrate to text.
alter table reservation_rooms drop constraint if exists reservation_rooms_room_id_fkey;
alter table reservation_rooms drop constraint if exists reservation_rooms_room_type_id_fkey;
alter table housekeeping_status drop constraint if exists housekeeping_status_room_id_fkey;
alter table rooms drop constraint if exists rooms_room_type_id_fkey;
alter table rooms drop constraint if exists rooms_property_id_fkey;

-- rooms.room_id text
alter table rooms alter column room_id type text using room_id::text;
alter table reservation_rooms alter column room_id type text using room_id::text;
alter table housekeeping_status alter column room_id type text using room_id::text;

-- restore relevant FKs (room_id only)
alter table rooms add constraint rooms_property_id_fkey foreign key (property_id) references hotels(property_id) on delete cascade;
-- skip room_type_id FK because room_types in raw response can be string-like; keep loose
alter table housekeeping_status add constraint housekeeping_status_room_id_fkey foreign key (room_id) references rooms(room_id) on delete cascade;