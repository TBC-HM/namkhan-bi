-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260426223352
-- Name:    002_extended_schema
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

create table if not exists guests (
    guest_id           text primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    first_name         text,
    last_name          text,
    email              text,
    phone              text,
    country            text,
    city               text,
    address            text,
    document_type      text,
    document_number    text,
    date_of_birth      date,
    gender             text,
    language           text,
    is_repeat          boolean default false,
    total_stays        integer default 0,
    total_spent        numeric(14,2),
    last_stay_date     date,
    raw                jsonb,
    synced_at          timestamptz not null default now(),
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index if not exists idx_guests_email on guests(email);
create index if not exists idx_guests_country on guests(country);
create index if not exists idx_guests_repeat on guests(is_repeat);

create table if not exists adjustments (
    adjustment_id      text primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    reservation_id     text references reservations(reservation_id),
    adjustment_type    text,
    description        text,
    amount             numeric(12,2),
    currency           text,
    is_taxable         boolean,
    posted_date        timestamptz,
    posted_by          text,
    raw                jsonb,
    synced_at          timestamptz not null default now()
);
create index if not exists idx_adjustments_property on adjustments(property_id);
create index if not exists idx_adjustments_reservation on adjustments(reservation_id);
create index if not exists idx_adjustments_date on adjustments(posted_date desc);

create table if not exists tax_fee_records (
    id                 bigserial primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    reservation_id     text references reservations(reservation_id),
    tax_or_fee_name    text,
    tax_type           text,
    amount             numeric(12,2),
    currency           text,
    rate_pct           numeric(6,3),
    posted_date        timestamptz,
    raw                jsonb,
    synced_at          timestamptz not null default now()
);
create index if not exists idx_tax_property on tax_fee_records(property_id);
create index if not exists idx_tax_reservation on tax_fee_records(reservation_id);

create table if not exists add_ons (
    id                 bigserial primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    reservation_id     text references reservations(reservation_id),
    item_name          text,
    item_category      text,
    quantity           integer,
    unit_price         numeric(12,2),
    total_amount       numeric(12,2),
    currency           text,
    posted_date        timestamptz,
    raw                jsonb,
    synced_at          timestamptz not null default now()
);
create index if not exists idx_addon_property on add_ons(property_id);
create index if not exists idx_addon_reservation on add_ons(reservation_id);
create index if not exists idx_addon_category on add_ons(item_category);

create table if not exists housekeeping_status (
    id                 bigserial primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    room_id            bigint references rooms(room_id) on delete cascade,
    status             text,
    is_clean           boolean,
    is_inspected       boolean,
    is_occupied        boolean,
    last_cleaned_at    timestamptz,
    last_cleaned_by    text,
    notes              text,
    snapshot_date      date not null default current_date,
    raw                jsonb,
    synced_at          timestamptz not null default now(),
    unique(property_id, room_id, snapshot_date)
);
create index if not exists idx_hk_property_date on housekeeping_status(property_id, snapshot_date desc);

create table if not exists communications (
    communication_id   text primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    reservation_id     text references reservations(reservation_id),
    direction          text check (direction in ('outbound','inbound')),
    channel            text,
    subject            text,
    body               text,
    sent_at            timestamptz,
    is_read            boolean,
    raw                jsonb,
    synced_at          timestamptz not null default now()
);
create index if not exists idx_comm_property on communications(property_id);
create index if not exists idx_comm_reservation on communications(reservation_id);
create index if not exists idx_comm_sent on communications(sent_at desc);

create table if not exists market_segments (
    segment_id         text primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    name               text not null,
    is_active          boolean default true,
    raw                jsonb,
    synced_at          timestamptz not null default now()
);

create table if not exists custom_fields (
    id                 bigserial primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    entity_type        text,
    entity_id          text,
    field_name         text,
    field_value        text,
    raw                jsonb,
    synced_at          timestamptz not null default now()
);
create index if not exists idx_custom_entity on custom_fields(entity_type, entity_id);

create table if not exists data_insights_snapshots (
    id                 bigserial primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    insight_type       text not null,
    snapshot_date      date not null,
    period_start       date,
    period_end         date,
    payload            jsonb,
    synced_at          timestamptz not null default now(),
    unique(property_id, insight_type, snapshot_date, period_start, period_end)
);
create index if not exists idx_insights_type_date on data_insights_snapshots(insight_type, snapshot_date desc);

create table if not exists reservation_modifications (
    id                 bigserial primary key,
    reservation_id     text references reservations(reservation_id) on delete cascade,
    property_id        bigint references hotels(property_id),
    modification_type  text,
    modified_at        timestamptz not null,
    modified_by        text,
    field_changed      text,
    old_value          text,
    new_value          text,
    raw                jsonb,
    synced_at          timestamptz not null default now()
);
create index if not exists idx_mods_reservation on reservation_modifications(reservation_id);
create index if not exists idx_mods_at on reservation_modifications(modified_at desc);

create table if not exists sources (
    source_id          text primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    name               text not null,
    category           text,
    is_active          boolean default true,
    commission_pct     numeric(6,3),
    raw                jsonb,
    synced_at          timestamptz not null default now()
);

create table if not exists groups (
    group_id           text primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    group_name         text,
    contact_name       text,
    contact_email      text,
    contact_phone      text,
    block_size         integer,
    pickup             integer,
    pickup_pct         numeric(6,3),
    arrival_date       date,
    departure_date     date,
    cutoff_date        date,
    status             text,
    raw                jsonb,
    synced_at          timestamptz not null default now()
);
create index if not exists idx_groups_property on groups(property_id);
create index if not exists idx_groups_arrival on groups(arrival_date);

create table if not exists room_blocks (
    id                 bigserial primary key,
    group_id           text references groups(group_id) on delete cascade,
    property_id        bigint references hotels(property_id),
    room_type_id       bigint references room_types(room_type_id),
    block_date         date not null,
    rooms_blocked      integer,
    rooms_picked_up    integer,
    rate               numeric(12,2),
    raw                jsonb,
    synced_at          timestamptz not null default now()
);
create index if not exists idx_blocks_group on room_blocks(group_id);
create index if not exists idx_blocks_date on room_blocks(block_date);

create table if not exists house_accounts (
    house_account_id   text primary key,
    property_id        bigint references hotels(property_id) on delete cascade,
    account_name       text,
    account_type       text,
    balance            numeric(12,2),
    currency           text,
    is_active          boolean default true,
    raw                jsonb,
    synced_at          timestamptz not null default now()
);

create or replace view v_lead_time_buckets as
select property_id,
    case
        when extract(day from (check_in_date::timestamp - booking_date)) < 0 then 'walk_in_or_after'
        when extract(day from (check_in_date::timestamp - booking_date)) <= 1 then '0-1d'
        when extract(day from (check_in_date::timestamp - booking_date)) <= 7 then '2-7d'
        when extract(day from (check_in_date::timestamp - booking_date)) <= 30 then '8-30d'
        when extract(day from (check_in_date::timestamp - booking_date)) <= 90 then '31-90d'
        else '90+d'
    end as lead_bucket,
    count(*) as bookings,
    avg(total_amount) as avg_value
from reservations
where booking_date >= current_date - interval '90 days' and status not in ('cancelled','no_show')
group by property_id, lead_bucket
order by property_id, lead_bucket;

create or replace view v_cancellation_rate as
with t30 as (
    select property_id, count(*) filter (where status = 'cancelled') as cancelled, count(*) as total
    from reservations where booking_date >= current_date - interval '30 days' group by property_id
),
t90 as (
    select property_id, count(*) filter (where status = 'cancelled') as cancelled, count(*) as total
    from reservations where booking_date >= current_date - interval '90 days' group by property_id
)
select coalesce(t30.property_id, t90.property_id) as property_id,
    t30.cancelled as cancelled_30d, t30.total as total_30d,
    case when t30.total > 0 then round(t30.cancelled::numeric / t30.total * 100, 2) else 0 end as cancel_rate_30d,
    t90.cancelled as cancelled_90d, t90.total as total_90d,
    case when t90.total > 0 then round(t90.cancelled::numeric / t90.total * 100, 2) else 0 end as cancel_rate_90d
from t30 full outer join t90 on t30.property_id = t90.property_id;

create or replace view v_alos_30d as
select property_id, avg(nights) as avg_nights, count(*) as bookings
from reservations
where booking_date >= current_date - interval '30 days' and status not in ('cancelled','no_show') and nights > 0
group by property_id;

create or replace view v_country_mix_30d as
select property_id, coalesce(guest_country, 'Unknown') as country,
    count(*) as bookings, sum(nights) as room_nights, sum(total_amount) as revenue,
    round(avg(total_amount), 2) as avg_booking_value
from reservations
where booking_date >= current_date - interval '30 days' and status not in ('cancelled','no_show')
group by property_id, guest_country
order by revenue desc nulls last;

create or replace view v_repeat_guests as
select property_id,
    count(*) filter (where is_repeat) as repeat_count,
    count(*) as total_guests,
    case when count(*) > 0 then round(count(*) filter (where is_repeat)::numeric / count(*) * 100, 2) else 0 end as repeat_pct
from guests group by property_id;