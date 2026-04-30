-- Gap-M8 ops.compliance_log
create table if not exists ops.compliance_log (
  id            uuid primary key default gen_random_uuid(),
  property_id   text not null,
  cert_type     text not null,
  issuer        text,
  issue_date    date not null,
  expiry_date   date not null,
  document_url  text,
  next_action   text,
  status        text not null default 'valid'
    check (status in ('valid','expiring_soon','expired'))
);
alter table ops.compliance_log enable row level security;
create policy cl_read on ops.compliance_log for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
