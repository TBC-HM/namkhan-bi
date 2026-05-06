-- Gap-M7 ops.vendors
create table if not exists ops.vendors (
  id              uuid primary key default gen_random_uuid(),
  property_id     text not null,
  name            text not null,
  category        text,
  response_sla_hours int,
  allow_listed    boolean default false,
  contact_phone   text,
  contact_email   text,
  notes           text
);
alter table ops.vendors enable row level security;
create policy v_read on ops.vendors for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
create policy v_write on ops.vendors for insert
  with check (auth.jwt() ->> 'role' in ('manager','owner'));
