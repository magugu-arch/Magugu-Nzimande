-- Move a booking to a new slot, atomically. Same rules as reserve_booking:
-- lapsed holds give way, anything active that overlaps (other than this
-- booking itself) blocks the move, and the exclusion constraint backs it up.
-- Returns the updated row, or no row if the new slot is taken.
create or replace function public.reschedule_booking(p_id uuid, p_date date, p_time time)
returns setof public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings;
  v_start   timestamptz;
  v_end     timestamptz;
begin
  select * into v_booking from bookings where id = p_id for update;
  if not found then return; end if;

  v_start := (p_date + p_time) at time zone 'Africa/Johannesburg';
  v_end   := v_start + make_interval(mins => v_booking.duration_minutes);
  perform pg_advisory_xact_lock(hashtext('bookings:' || p_date::text));

  update bookings set status = 'expired'
   where id <> p_id and status = 'pending_payment' and hold_expires_at <= now()
     and tstzrange(starts_at, ends_at, '[)') && tstzrange(v_start, v_end, '[)');

  if exists (
    select 1 from bookings
     where id <> p_id and status in ('pending_payment', 'confirmed')
       and tstzrange(starts_at, ends_at, '[)') && tstzrange(v_start, v_end, '[)')
  ) then
    return;
  end if;

  return query
  update bookings set date = p_date, time = p_time, starts_at = v_start, ends_at = v_end
   where id = p_id
  returning *;
exception when exclusion_violation then
  return;
end $$;

revoke all on function public.reschedule_booking from public, anon, authenticated;
