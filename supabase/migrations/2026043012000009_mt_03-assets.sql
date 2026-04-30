-- Gap-M2 ops.assets (initial census ~140 assets — manual one-time effort)
create table if not exists ops.assets (
  id            uuid primary key default gen_random_uuid(),
  property_id   text not null,
  category      text not null,
  sub_category  text,
  room_no       text,
  area          text,
  manufacturer  text,
  model         text,
  install_date  date,
  warranty_end  date,
  mtbf_months   int,
  replacement_cost_usd numeric(10,2),
  supplier      text,
  notes         text
);
alter table ops.assets enable row level security;
create policy a_read on ops.assets for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
create policy a_write on ops.assets for insert
  with check (auth.jwt() ->> 'role' in ('manager','owner'));

-- Add FK from tickets.asset_id (now that assets exists)
alter table ops.maintenance_tickets
  add constraint mt_asset_fk foreign key (asset_id) references ops.assets(id);
