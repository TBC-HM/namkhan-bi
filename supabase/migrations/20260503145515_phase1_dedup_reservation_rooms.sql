-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503145515
-- Name:    phase1_dedup_reservation_rooms
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- 1.1 Snapshot before destructive op
CREATE TABLE IF NOT EXISTS public.reservation_rooms_backup_20260503 AS 
SELECT * FROM public.reservation_rooms;

-- 1.2 Dedup: keep latest synced row per (reservation_id, room_type_id, night_date)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY reservation_id, room_type_id, night_date
      ORDER BY synced_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.reservation_rooms
)
DELETE FROM public.reservation_rooms 
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 1.3 Drop old unique constraint (NULL-permissive) and replace with NULL-safe one
ALTER TABLE public.reservation_rooms 
  DROP CONSTRAINT IF EXISTS reservation_rooms_reservation_id_room_id_night_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS reservation_rooms_uniq_logical
  ON public.reservation_rooms (
    reservation_id, 
    room_type_id, 
    night_date, 
    COALESCE(room_id, '__unassigned__')
  );
