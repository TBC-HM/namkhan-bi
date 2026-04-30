-- Gap-H2 ops.hk_assignments
create table if not exists ops.hk_assignments (
  property_id    text not null,
  shift_date     date not null,
  shift          text not null check (shift in ('AM','PM','Night')),
  room_no        text not null,
  attendant_id   text not null,
  priority_rank  int,
  assigned_at    timestamptz not null default now(),
  cleaned_at     timestamptz,
  inspected_at   timestamptz,
  primary key (property_id, shift_date, shift, room_no)
);
create or replace view ops.v_hk_minutes_per_clean as
  select property_id, shift_date, attendant_id, room_no,
    extract(epoch from (cleaned_at - assigned_at))/60.0 as minutes
  from ops.hk_assignments
  where cleaned_at is not null;
alter table ops.hk_assignments enable row level security;
create policy hka_read on ops.hk_assignments for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
