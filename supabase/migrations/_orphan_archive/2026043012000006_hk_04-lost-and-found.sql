-- Gap-H4 ops.lost_and_found
create table if not exists ops.lost_and_found (
  id            uuid primary key default gen_random_uuid(),
  property_id   text not null,
  intake_date   date not null,
  found_in_room text,
  item          text not null,
  description   text,
  finder_id     text,
  matched_reservation_id text,
  status        text not null default 'unclaimed'
    check (status in ('unclaimed','contacted','claimed','disposed','donated')),
  notes         text,
  created_at    timestamptz default now()
);
alter table ops.lost_and_found enable row level security;
create policy lf_read on ops.lost_and_found for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
create policy lf_write on ops.lost_and_found for insert
  with check (auth.jwt() ->> 'role' in ('staff','manager','owner'));
