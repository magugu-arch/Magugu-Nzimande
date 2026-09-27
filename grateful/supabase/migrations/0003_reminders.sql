-- Appointment reminders: the day before, once per booking.
-- reminder_sent_at is set when the reminder email has been handed to the
-- mail provider, so a re-run of the daily job never sends a second one.
alter table public.bookings add column if not exists reminder_sent_at timestamptz;
create index if not exists bookings_reminder_due_idx on public.bookings (date) where status = 'confirmed' and reminder_sent_at is null;
