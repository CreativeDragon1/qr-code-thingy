-- ===========================================================================
-- Example seed data for local testing. Do NOT run this against the real event
-- database — replace the emails with addresses you actually control first,
-- otherwise the "send tickets" button will mail strangers.
-- ===========================================================================

insert into attendees (idnum, name, email) values
  ('10423', 'Aarav Mehta',    'aarav.test@example.com'),
  ('10424', 'Priya Raghavan', 'priya.test@example.com'),
  ('10425', 'Daniel Okafor',  'daniel.test@example.com')
on conflict (idnum) do nothing;

-- One attendee pre-registered, so you can test the "already used" red screen
-- immediately without having to scan twice.
update attendees set registered_at = now() where idnum = '10425';

-- The QR codes to test with are:
--   sus://10423   -> valid, unused
--   sus://10424   -> valid, unused
--   sus://10425   -> valid, already registered (red screen in registration mode)
--   sus://99999   -> valid format, not in the database (red "not found")
--   hello world   -> invalid format (red "invalid code", never hits the database)
