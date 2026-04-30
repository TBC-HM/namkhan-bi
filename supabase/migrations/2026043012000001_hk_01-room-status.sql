-- Gap-H1 ops.room_status (CRITICAL — blocks every panel)
create table if not exists ops.room_status (
  property_id        text not null,
  room_no            text not null,
  status             text not null check (status in ('clean','dirty','inspected','ooo','oos','dnd')),
  attendant_id       text,
  inspector_id       text,
  changed_at         timestamptz not null default now(),
  source             text not null default 'cloudbeds',
  notes              text,
  primary key (property_id, room_no, changed_at)
);
create index if not exists ix_room_status_current
  on ops.room_status (property_id, room_no, changed_at desc);
create or replace view ops.v_room_status_current as
  select distinct on (property_id, room_no) *
  from ops.room_status
  order by property_id, room_no, changed_at desc;
-- RLS
alter table ops.room_status enable row level security;
create policy rs_read on ops.room_status for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
create policy rs_write on ops.room_status for insert
  with check (auth.jwt() ->> 'role' in ('manager','owner'));
