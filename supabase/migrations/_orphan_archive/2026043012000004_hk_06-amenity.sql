-- Gap-H6 governance.amenity_budget + ops.amenity_loadouts
create table if not exists governance.amenity_budget (
  property_id    text not null,
  month          date not null,
  monthly_cap_usd numeric(10,2) not null,
  primary key (property_id, month)
);
create table if not exists ops.amenity_loadouts (
  id            uuid primary key default gen_random_uuid(),
  property_id   text not null,
  reservation_id text not null,
  room_no       text,
  loadout_json  jsonb not null,
  est_cost_usd  numeric(8,2),
  proposed_at   timestamptz default now(),
  approved_at   timestamptz,
  approved_by   text,
  delivered_at  timestamptz,
  status        text not null default 'proposed'
    check (status in ('proposed','approved','rejected','delivered','cancelled'))
);
alter table governance.amenity_budget enable row level security;
alter table ops.amenity_loadouts enable row level security;
create policy ab_read on governance.amenity_budget for select
  using (auth.jwt() ->> 'role' in ('manager','owner'));
create policy al_read on ops.amenity_loadouts for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
create policy al_write on ops.amenity_loadouts for update
  using (auth.jwt() ->> 'role' in ('manager','owner'));
