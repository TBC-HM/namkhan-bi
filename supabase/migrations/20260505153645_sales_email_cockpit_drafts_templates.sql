-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505153645
-- Name:    sales_email_cockpit_drafts_templates
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Email cockpit: drafts + templates
create table if not exists sales.email_drafts (
  id uuid primary key default gen_random_uuid(),
  property_id int8 not null,
  thread_id text,
  in_reply_to_message_id text,
  reply_to_email_message_id uuid,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  subject text,
  body_md text,
  generator text not null check (generator in ('human','agent','template')),
  agent_name text,
  template_key text,
  status text not null default 'draft' check (status in ('draft','approved','sent','discarded')),
  created_at timestamptz not null default now(),
  created_by text,
  approved_at timestamptz,
  sent_at timestamptz,
  gmail_msg_id text,
  metadata jsonb default '{}'::jsonb
);
create index if not exists email_drafts_status_idx on sales.email_drafts (property_id, status, created_at desc);
create index if not exists email_drafts_thread_idx on sales.email_drafts (thread_id);

create table if not exists sales.email_templates (
  key text primary key,
  name text not null,
  subject text not null,
  body_md text not null,
  description text,
  variables text[] default '{}',
  applies_to text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

insert into sales.email_templates (key, name, subject, description, variables, applies_to, body_md) values
('booking-confirm','Booking confirmation','Your stay at The Namkhan is confirmed','Standard confirmation after deposit received',array['guest_name','date_in','date_out','nights','room_name'],'fit',
$body$Dear {{guest_name}},

Thank you for choosing The Namkhan. We are delighted to confirm your reservation:

  • Arrival: {{date_in}}
  • Departure: {{date_out}}
  • Nights: {{nights}}
  • Accommodation: {{room_name}}

Our airport transfer service is available from Luang Prabang International Airport — please share your flight details and we will arrange a private pickup.

If you have any dietary preferences, anniversary occasions, or accessibility needs, simply reply to this email and our team will personalise your stay accordingly.

We look forward to welcoming you to the riverside.

Warm regards,
The Namkhan Reservations Team
$body$),
('retreat-info','Retreat enquiry — info pack','Your retreat at The Namkhan — programme & rates','Reply to retreat enquiries with structured info',array['guest_name','retreat_type','date_in','date_out','pax'],'retreat',
$body$Dear {{guest_name}},

Thank you for your interest in our {{retreat_type}} retreat at The Namkhan.

For your dates ({{date_in}} → {{date_out}}, {{pax}} guests), we offer:

  • Accommodation in our riverside rooms
  • Daily group sessions led by our resident teacher
  • Two nourishing meals per day, sourced from the farm
  • One private session and one in-room treatment included

A short questionnaire helps us tailor the experience — would you be happy to share a few notes on your practice, intentions, and any health considerations?

The full rate card is attached. Bookings before {{date_in}} secure the early-bird tier.

With warmth,
The Namkhan Wellness Team
$body$),
('polite-decline','Polite decline / no availability','Regret — no availability for your dates','When the request can''t be honoured',array['guest_name','date_in','date_out'],'fit',
$body$Dear {{guest_name}},

Thank you for thinking of The Namkhan for {{date_in}} → {{date_out}}.

I am sorry to share that we are fully committed for those nights. If your dates are flexible, the {{date_in}}-shoulder window opens space mid-week and we would be glad to hold a courtesy option for you.

If a different month suits, our quieter retreat windows in {{retreat_window}} may also align with what you have in mind.

Warm regards,
The Namkhan Reservations Team
$body$),
('soft-followup','Soft follow-up (no reply)','Following up on your enquiry','When 3 days have passed with no reply',array['guest_name'],'fit',
$body$Dear {{guest_name}},

A gentle follow-up — I want to make sure my earlier note about your stay reached you. If the dates no longer suit or if you''d like a different option, please let me know and we''ll reshape the proposal.

If you''d prefer to speak directly, I am available on WhatsApp.

Warm regards,
The Namkhan Reservations Team
$body$),
('b2b-counter','B2B / DMC counter-offer','Counter-proposal on your contract terms','When agent asks for over-floor discount',array['agent_name','property','discount_pct','floor_pct'],'b2b',
$body$Dear {{agent_name}},

Thank you for the request on {{property}}. Our contract floor for the season is {{floor_pct}}, and we are unable to publish below it without affecting parity across the rest of the partner book.

I can offer the following counter:

  • {{floor_pct}} net rate — same as your current contract
  • +1 complimentary upgrade per group of 6+
  • Late-checkout 14:00 on the last night

If volume is the lever, a committed minimum of 30 room-nights for the period would unlock an additional 1.5%.

Best regards,
The Namkhan B2B Team
$body$),
('payment-received','Payment / deposit confirmation','Deposit received — thank you','When manual or wire deposit clears',array['guest_name','amount','currency','date_in'],'fit',
$body$Dear {{guest_name}},

We are pleased to confirm receipt of {{currency}} {{amount}} towards your stay arriving {{date_in}}. Your reservation is now fully secured.

A reminder that the balance is due on arrival in cash (LAK or USD) or by card.

We''re looking forward to your visit.

Warm regards,
The Namkhan Reservations Team
$body$)
on conflict (key) do update set
  name = excluded.name,
  subject = excluded.subject,
  body_md = excluded.body_md,
  description = excluded.description,
  variables = excluded.variables,
  applies_to = excluded.applies_to,
  updated_at = now();

-- Convenience view: unanswered inbound (last message inbound, no outbound after)
create or replace view sales.v_unanswered_threads as
with last_msg as (
  select distinct on (thread_id)
    thread_id, property_id, intended_mailbox, direction, received_at, subject, from_email, from_name
  from sales.email_messages
  where thread_id is not null
  order by thread_id, received_at desc
)
select thread_id, property_id, intended_mailbox, received_at, subject, from_email, from_name
from last_msg
where direction = 'inbound';

grant select on sales.v_unanswered_threads to service_role, authenticated, anon;
grant all on sales.email_drafts to service_role;
grant select on sales.email_drafts to authenticated, anon;
grant select on sales.email_templates to service_role, authenticated, anon;
