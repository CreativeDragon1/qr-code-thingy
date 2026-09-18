-- ===========================================================================
-- QR Registration & Food-Collection System — full schema
-- Run once against a fresh Supabase project (SQL Editor -> paste -> Run).
-- Safe to re-run: every statement is guarded.
-- ===========================================================================

-- attendees: one row per person, one QR code (idnum) each
create table if not exists attendees (
  id uuid primary key default gen_random_uuid(),
  idnum text unique not null,          -- matches the {idnum} in sus://{idnum}
  name text not null,
  email text not null,
  registered_at timestamptz,           -- null until scanned in "registration" mode
  food_collected_at timestamptz,       -- null until scanned in "food" mode
  qr_sent_at timestamptz,              -- set when the ticket email goes out
  created_at timestamptz default now()
);

-- Which committee/group the attendee belongs to (e.g. "S4-32 — Reclaimed Land &
-- Coastal Protection") and where that committee is located on the GIIS campus.
-- Both nullable: not every attendee has a location on file yet.
alter table attendees add column if not exists committee text;
alter table attendees add column if not exists location text;

-- scan_logs: audit trail of every scan attempt, valid or not.
-- NOTE: for result = 'invalid_format' there is no real attendee id, so the
-- idnum column holds the raw scanned string (truncated). That is deliberate —
-- it is what makes a batch of misprinted QR codes diagnosable after the event.
create table if not exists scan_logs (
  id uuid primary key default gen_random_uuid(),
  idnum text,
  mode text check (mode in ('registration','food')),
  result text check (result in ('success','already_used','not_found','invalid_format')),
  scanned_at timestamptz default now()
);

-- app_settings: single-row config store.
-- The scanner mode is tracked per-device in localStorage, so 'active_mode'
-- below is NOT read by the app. It is kept as the place to put any future
-- event-wide setting, and as the switch to flip if you ever move the mode
-- toggle back to being shared across all devices.
create table if not exists app_settings (
  key text primary key,
  value text
);

insert into app_settings (key, value)
values ('active_mode', 'registration')
on conflict (key) do nothing;


-- --- Indexes ---------------------------------------------------------------
-- idnum already has a unique index from the column constraint above.
create index if not exists scan_logs_scanned_at_idx on scan_logs (scanned_at desc);
create index if not exists scan_logs_idnum_idx on scan_logs (idnum);
create index if not exists attendees_qr_sent_at_idx on attendees (qr_sent_at);


-- --- Row Level Security ----------------------------------------------------
-- The app talks to Postgres only through server-side API routes using the
-- service role key, which bypasses RLS. Turning RLS on with no policies means
-- the public anon key (which ships in any Supabase project) can read nothing
-- and write nothing. Do not add permissive policies unless you intend for
-- browsers to query these tables directly.
alter table attendees enable row level security;
alter table scan_logs enable row level security;
alter table app_settings enable row level security;
