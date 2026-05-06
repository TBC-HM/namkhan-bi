-- Gap-M5 ops.ppm_templates + ops.ppm_tasks
create table if not exists ops.ppm_templates (
  id            uuid primary key default gen_random_uuid(),
  property_id   text not null,
  asset_category text not null,
  task_name     text not null,
  frequency_days int not null,
  est_cost_usd  numeric(8,2),
  vendor_id     uuid references ops.vendors(id)
);
create table if not exists ops.ppm_tasks (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references ops.ppm_templates(id),
  asset_id      uuid references ops.assets(id),
  scheduled_for date not null,
  done_at       timestamptz,
  done_by       text,
  cost_usd      numeric(8,2),
  ticket_id     uuid references ops.maintenance_tickets(id)
);
create or replace view ops.v_ppm_overdue as
  select * from ops.ppm_tasks
  where done_at is null and scheduled_for < current_date;
alter table ops.ppm_templates enable row level security;
alter table ops.ppm_tasks enable row level security;
create policy pt_read on ops.ppm_templates for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
create policy ppmt_read on ops.ppm_tasks for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
