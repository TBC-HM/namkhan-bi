-- Gap-M4 ops.energy_meters + readings (manual v0; IoT later)
create table if not exists ops.energy_meters (
  id          uuid primary key default gen_random_uuid(),
  property_id text not null,
  meter_code  text not null,
  area        text not null,
  unique (property_id, meter_code)
);
create table if not exists ops.energy_readings (
  meter_id    uuid not null references ops.energy_meters(id),
  read_at     timestamptz not null,
  kwh         numeric(12,3) not null,
  source      text default 'manual' check (source in ('manual','iot','api')),
  primary key (meter_id, read_at)
);
create table if not exists ops.water_meters (
  id          uuid primary key default gen_random_uuid(),
  property_id text not null,
  meter_code  text not null,
  area        text not null,
  unique (property_id, meter_code)
);
create table if not exists ops.water_readings (
  meter_id    uuid not null references ops.water_meters(id),
  read_at     timestamptz not null,
  m3          numeric(12,3) not null,
  source      text default 'manual' check (source in ('manual','iot','api')),
  primary key (meter_id, read_at)
);
create table if not exists ops.weather_norm (
  property_id text not null,
  date        date not null,
  avg_c       numeric(5,2),
  hdd         numeric(6,2),
  cdd         numeric(6,2),
  primary key (property_id, date)
);
create or replace view ops.v_energy_normalised as
  select
    em.area,
    date_trunc('day', er.read_at) as day,
    sum(er.kwh) as kwh
  from ops.energy_meters em
  join ops.energy_readings er on er.meter_id = em.id
  group by em.area, date_trunc('day', er.read_at);
alter table ops.energy_meters enable row level security;
alter table ops.energy_readings enable row level security;
alter table ops.water_meters enable row level security;
alter table ops.water_readings enable row level security;
create policy em_read on ops.energy_meters for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
create policy er_read on ops.energy_readings for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
create policy wm_read on ops.water_meters for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
create policy wr_read on ops.water_readings for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
