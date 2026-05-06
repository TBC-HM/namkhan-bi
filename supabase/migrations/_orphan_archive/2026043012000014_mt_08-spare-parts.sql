-- Gap-M6 ops.spare_parts
create table if not exists ops.spare_parts (
  id            uuid primary key default gen_random_uuid(),
  property_id   text not null,
  sku           text not null,
  name          text not null,
  category      text,
  on_hand       int not null default 0,
  reorder_threshold int not null,
  lead_time_days int,
  unit_cost_usd numeric(8,2),
  supplier_id   uuid,
  unique (property_id, sku)
);
alter table ops.spare_parts enable row level security;
create policy sp_read on ops.spare_parts for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
