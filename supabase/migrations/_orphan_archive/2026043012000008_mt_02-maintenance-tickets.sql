-- Gap-M1 ops.maintenance_tickets (CRITICAL)
create table if not exists ops.maintenance_tickets (
  id              uuid primary key default gen_random_uuid(),
  property_id     text not null,
  ticket_no       int generated always as identity,
  asset_id        uuid,
  room_no         text,
  area            text,
  category        text not null,
  priority        text not null check (priority in ('urgent','high','medium','low','ppm')),
  description     text not null,
  reported_by     text,
  reported_at     timestamptz not null default now(),
  sla_breach_at   timestamptz generated always as (
    reported_at + case priority
      when 'urgent' then interval '4 hours'
      when 'high' then interval '24 hours'
      when 'medium' then interval '48 hours'
      when 'low' then interval '7 days'
      when 'ppm' then interval '7 days'
    end
  ) stored,
  assigned_to     text,
  vendor_id       uuid references ops.vendors(id),
  resolved_at     timestamptz,
  cost_usd        numeric(10,2),
  guest_affecting boolean default false,
  source          text default 'portal'
    check (source in ('portal','whatsapp','cloudbeds_note','phone'))
);
create index if not exists ix_mt_open
  on ops.maintenance_tickets (property_id, sla_breach_at)
  where resolved_at is null;
alter table ops.maintenance_tickets enable row level security;
create policy mt_read on ops.maintenance_tickets for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
create policy mt_write on ops.maintenance_tickets for insert
  with check (auth.jwt() ->> 'role' in ('staff','manager','owner'));
create policy mt_update on ops.maintenance_tickets for update
  using (auth.jwt() ->> 'role' in ('manager','owner'));
