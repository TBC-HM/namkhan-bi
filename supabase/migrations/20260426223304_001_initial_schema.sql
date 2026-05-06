-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260426223304
-- Name:    001_initial_schema
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

create extension if not exists "uuid-ossp";

create table if not exists sync_runs (
    id            uuid primary key default uuid_generate_v4(),
    entity        text not null,
    started_at    timestamptz not null default now(),
    finished_at   timestamptz,
    status        text not null default 'running' check (status in ('running','success','partial','failed')),
    rows_upserted integer default 0,
    rows_failed   integer default 0,
    error_message text,
    metadata      jsonb default '{}'::jsonb
);
create index if not exists idx_sync_runs_entity on sync_runs(entity);
create index if not exists idx_sync_runs_started on sync_runs(started_at desc);

create table if not exists hotels (
    property_id        bigint primary key,
    organization_id    bigint,
    property_name      text not null,
    property_image     text,
    property_description text,
    property_timezone  text,
    property_currency  jsonb,
    property_address   jsonb,
    raw                jsonb,
    synced_at          timestamptz not null default now(),
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create table if not exists room_types (
    room_type_id       bigint primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    room_type_name     text not null,
    room_type_name_short text,
    room_type_description text,
    max_guests         integer,
    max_adults         integer,
    max_children       integer,
    base_rate          numeric(12,2),
    quantity           integer,
    raw                jsonb,
    synced_at          timestamptz not null default now(),
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index if not exists idx_room_types_property on room_types(property_id);

create table if not exists rooms (
    room_id            bigint primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    room_type_id       bigint references room_types(room_type_id),
    room_name          text,
    room_description   text,
    is_active          boolean default true,
    raw                jsonb,
    synced_at          timestamptz not null default now(),
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index if not exists idx_rooms_property on rooms(property_id);
create index if not exists idx_rooms_type on rooms(room_type_id);

create table if not exists rate_plans (
    rate_id            bigint primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    rate_name          text,
    rate_description   text,
    rate_type          text,
    is_active          boolean default true,
    raw                jsonb,
    synced_at          timestamptz not null default now(),
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index if not exists idx_rate_plans_property on rate_plans(property_id);

create table if not exists rate_inventory (
    id                 bigserial primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    room_type_id       bigint references room_types(room_type_id),
    rate_id            bigint references rate_plans(rate_id),
    inventory_date     date not null,
    rate               numeric(12,2),
    available_rooms    integer,
    minimum_stay       integer,
    closed_to_arrival  boolean default false,
    closed_to_departure boolean default false,
    stop_sell          boolean default false,
    raw                jsonb,
    synced_at          timestamptz not null default now(),
    unique(property_id, room_type_id, rate_id, inventory_date)
);
create index if not exists idx_rate_inv_property_date on rate_inventory(property_id, inventory_date);
create index if not exists idx_rate_inv_room_type on rate_inventory(room_type_id);

create table if not exists reservations (
    reservation_id     text primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    booking_id         text,
    status             text,
    source             text,
    source_name        text,
    guest_name         text,
    guest_email        text,
    guest_country      text,
    check_in_date      date,
    check_out_date     date,
    nights             integer,
    adults             integer,
    children           integer,
    total_amount       numeric(12,2),
    paid_amount        numeric(12,2),
    balance            numeric(12,2),
    currency           text,
    booking_date       timestamptz,
    cancellation_date  timestamptz,
    is_cancelled       boolean generated always as (status = 'cancelled') stored,
    market_segment     text,
    rate_plan          text,
    room_type_name     text,
    raw                jsonb,
    synced_at          timestamptz not null default now(),
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index if not exists idx_reservations_property on reservations(property_id);
create index if not exists idx_reservations_dates on reservations(check_in_date, check_out_date);
create index if not exists idx_reservations_status on reservations(status);
create index if not exists idx_reservations_source on reservations(source);
create index if not exists idx_reservations_booking_date on reservations(booking_date desc);

create table if not exists reservation_rooms (
    id                 bigserial primary key,
    reservation_id     text references reservations(reservation_id) on delete cascade,
    room_type_id       bigint,
    room_id            bigint,
    night_date         date not null,
    rate               numeric(12,2),
    raw                jsonb,
    synced_at          timestamptz not null default now(),
    unique(reservation_id, room_id, night_date)
);
create index if not exists idx_res_rooms_reservation on reservation_rooms(reservation_id);
create index if not exists idx_res_rooms_night on reservation_rooms(night_date);

create table if not exists transactions (
    transaction_id     text primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    reservation_id     text references reservations(reservation_id),
    transaction_date   timestamptz,
    transaction_type   text,
    category           text,
    description        text,
    amount             numeric(12,2),
    currency           text,
    method             text,
    raw                jsonb,
    synced_at          timestamptz not null default now()
);
create index if not exists idx_tx_property on transactions(property_id);
create index if not exists idx_tx_reservation on transactions(reservation_id);
create index if not exists idx_tx_date on transactions(transaction_date desc);
create index if not exists idx_tx_type on transactions(transaction_type);

create table if not exists daily_metrics (
    id                  bigserial primary key,
    property_id         bigint references hotels(property_id) on delete cascade,
    metric_date         date not null,
    rooms_available     integer,
    rooms_sold          integer,
    rooms_oos           integer default 0,
    occupancy_pct       numeric(6,3),
    adr                 numeric(12,2),
    revpar              numeric(12,2),
    rooms_revenue       numeric(14,2),
    fb_revenue          numeric(14,2),
    other_revenue       numeric(14,2),
    total_revenue       numeric(14,2),
    arrivals            integer default 0,
    departures          integer default 0,
    stayovers           integer default 0,
    cancellations       integer default 0,
    no_shows            integer default 0,
    pace_index          numeric(6,3),
    is_actual           boolean default true,
    raw                 jsonb,
    synced_at           timestamptz not null default now(),
    unique(property_id, metric_date)
);
create index if not exists idx_daily_metrics_date on daily_metrics(metric_date desc);
create index if not exists idx_daily_metrics_property_date on daily_metrics(property_id, metric_date desc);

create table if not exists channel_metrics (
    id                  bigserial primary key,
    property_id         bigint references hotels(property_id) on delete cascade,
    metric_date         date not null,
    source              text not null,
    bookings_count      integer default 0,
    room_nights         integer default 0,
    gross_revenue       numeric(14,2),
    commission_amount   numeric(14,2),
    net_revenue         numeric(14,2),
    avg_adr             numeric(12,2),
    synced_at           timestamptz not null default now(),
    unique(property_id, metric_date, source)
);
create index if not exists idx_channel_metrics_date on channel_metrics(metric_date desc, source);

create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

do $$
declare
    t text;
begin
    foreach t in array array['hotels','room_types','rooms','rate_plans','reservations']
    loop
        execute format('drop trigger if exists trg_set_updated_at on %I; create trigger trg_set_updated_at before update on %I for each row execute function set_updated_at();', t, t);
    end loop;
end$$;

create or replace view v_last_7_days as
select metric_date, property_id, rooms_sold, rooms_available, occupancy_pct, adr, revpar, total_revenue
from daily_metrics
where metric_date >= current_date - interval '7 days' and metric_date <= current_date
order by metric_date desc;

create or replace view v_otb_pace as
select rr.night_date, r.property_id,
    count(distinct r.reservation_id) filter (where r.status not in ('cancelled','no_show')) as confirmed_rooms,
    sum(rr.rate) filter (where r.status not in ('cancelled','no_show')) as confirmed_revenue,
    count(distinct r.reservation_id) filter (where r.status = 'cancelled') as cancelled_rooms
from reservation_rooms rr
join reservations r on r.reservation_id = rr.reservation_id
where rr.night_date >= current_date and rr.night_date <= current_date + interval '120 days'
group by rr.night_date, r.property_id
order by rr.night_date;

create or replace view v_channel_mix_30d as
select property_id, source,
    sum(bookings_count) as bookings,
    sum(room_nights) as room_nights,
    sum(gross_revenue) as gross_revenue,
    sum(net_revenue) as net_revenue,
    case when sum(room_nights) > 0 then sum(gross_revenue) / sum(room_nights) else 0 end as avg_adr
from channel_metrics
where metric_date >= current_date - interval '30 days'
group by property_id, source
order by gross_revenue desc;