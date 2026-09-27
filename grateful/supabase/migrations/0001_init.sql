-- Grateful — bookings, payments, enquiries and newsletter.
--
-- Access model: the browser never talks to these tables. Every read and write
-- goes through the API with the service-role key, which bypasses RLS. RLS is
-- enabled with no policies so the anon key, if it ever leaks, can do nothing.
--
-- Times: `date` + `time` are Africa/Johannesburg wall-clock values, which is
-- what people book and what the emails print. `starts_at`/`ends_at` are the
-- same moment as timestamptz, derived from them, and are what overlap checks
-- use. SAST is a fixed +02:00, so the derivation is exact.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- services
create table public.services (
  id               text primary key,
  slug             text not null unique,
  name             text not null,
  description      text not null default '',
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  price            numeric(10,2) check (price is null or price >= 0),          -- null = quote required
  deposit_amount   numeric(10,2) check (deposit_amount is null or deposit_amount >= 0),
  image            text not null default 'whiteGarment',
  sort_order       integer not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  check (deposit_amount is null or (price is not null and deposit_amount <= price))
);

-- ------------------------------------------------------------ availability
-- Opening windows. Bookable start times are derived from these per service.
create table public.availability (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  start_time  time not null,
  end_time    time not null,
  status      text not null default 'open' check (status in ('open', 'closed')),
  created_at  timestamptz not null default now(),
  check (end_time > start_time)
);
create index availability_date_idx on public.availability (date) where status = 'open';

-- ---------------------------------------------------------------- bookings
create table public.bookings (
  id                uuid primary key default gen_random_uuid(),
  service_id        text not null references public.services (id),
  client_name       text not null,
  email             text not null,
  phone             text not null,
  date              date not null,
  time              time not null,
  duration_minutes  integer not null,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  notes             text not null default '',
  status            text not null check (status in ('pending_payment', 'confirmed', 'cancelled', 'expired', 'needs_attention')),
  payment_status    text not null check (payment_status in ('not_required', 'pending', 'paid', 'failed', 'refunded', 'cancelled')),
  payment_reference text,
  hold_expires_at   timestamptz,
  created_at        timestamptz not null default now(),

  -- The hard guarantee against double booking. Holds are included; reserve_booking
  -- and confirm_payment expire lapsed holds inside the same transaction first,
  -- so a lapsed hold never blocks anyone. needs_attention is deliberately not
  -- here: by definition it overlaps the booking that actually holds the slot.
  constraint bookings_no_overlap exclude using gist (
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending_payment', 'confirmed'))
);
create index bookings_date_idx on public.bookings (date);

-- ---------------------------------------------------------------- payments
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null references public.bookings (id) on delete cascade,
  amount             numeric(10,2) not null check (amount > 0),
  currency           text not null default 'ZAR',
  option             text not null check (option in ('deposit', 'full')),
  provider           text not null,
  reference          text not null unique,   -- ours, sent to the gateway
  provider_reference text,                   -- the gateway's, from the verified notification
  status             text not null check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  created_at         timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id);

-- ------------------------------------------------------------ newsletter / contact
create table public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  consent    boolean not null,
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  phone      text not null default '',
  subject    text not null default '',
  message    text not null,
  status     text not null default 'new' check (status in ('new', 'replied', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.services               enable row level security;
alter table public.availability           enable row level security;
alter table public.bookings               enable row level security;
alter table public.payments               enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages       enable row level security;

-- ------------------------------------------------------------ reserve_booking
-- Atomically claim a slot. Returns the new booking row, or no row if the slot
-- is taken. Serialises per date with an advisory lock so two people choosing
-- the same slot at the same instant queue rather than race; the exclusion
-- constraint above backs that up regardless.
create or replace function public.reserve_booking(
  p_service_id text, p_client_name text, p_email text, p_phone text,
  p_date date, p_time time, p_duration_minutes integer, p_notes text,
  p_status text, p_payment_status text, p_hold_expires_at timestamptz
) returns setof public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz := (p_date + p_time) at time zone 'Africa/Johannesburg';
  v_end   timestamptz := v_start + make_interval(mins => p_duration_minutes);
begin
  perform pg_advisory_xact_lock(hashtext('bookings:' || p_date::text));

  update bookings set status = 'expired'
   where status = 'pending_payment' and hold_expires_at <= now()
     and tstzrange(starts_at, ends_at, '[)') && tstzrange(v_start, v_end, '[)');

  if exists (
    select 1 from bookings
     where status in ('pending_payment', 'confirmed')
       and tstzrange(starts_at, ends_at, '[)') && tstzrange(v_start, v_end, '[)')
  ) then
    return;
  end if;

  return query
  insert into bookings (service_id, client_name, email, phone, date, time, duration_minutes,
                        starts_at, ends_at, notes, status, payment_status, hold_expires_at)
  values (p_service_id, p_client_name, p_email, p_phone, p_date, p_time, p_duration_minutes,
          v_start, v_end, p_notes, p_status, p_payment_status, p_hold_expires_at)
  returning *;
exception when exclusion_violation then
  return;
end $$;

-- ------------------------------------------------------------ confirm_payment
-- Called only after the gateway notification has been verified server-side.
-- Idempotent: a repeated notification for a paid payment changes nothing.
-- Returns the outcome plus the ids so the caller can reload both rows.
create or replace function public.confirm_payment(p_reference text, p_provider_reference text)
returns table (outcome text, booking_id uuid, payment_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_payment payments;
  v_booking bookings;
  v_clash   boolean;
begin
  select * into v_payment from payments where reference = p_reference for update;
  if not found then return; end if;
  select * into v_booking from bookings where id = v_payment.booking_id for update;
  perform pg_advisory_xact_lock(hashtext('bookings:' || v_booking.date::text));

  if v_payment.status = 'paid' then
    return query select 'already_processed'::text, v_booking.id, v_payment.id;
    return;
  end if;

  update payments set status = 'paid', provider_reference = p_provider_reference where id = v_payment.id;

  -- Lapsed holds (this one included) give up their claim before we look for a clash.
  update bookings set status = 'expired'
   where id <> v_booking.id and status = 'pending_payment' and hold_expires_at <= now()
     and tstzrange(starts_at, ends_at, '[)') && tstzrange(v_booking.starts_at, v_booking.ends_at, '[)');

  select exists (
    select 1 from bookings o
     where o.id <> v_booking.id
       and o.status in ('confirmed', 'pending_payment')
       and tstzrange(o.starts_at, o.ends_at, '[)') && tstzrange(v_booking.starts_at, v_booking.ends_at, '[)')
  ) into v_clash;

  if not v_clash then
    update bookings set status = 'confirmed', payment_status = 'paid', payment_reference = p_reference where id = v_booking.id;
    return query select 'confirmed'::text, v_booking.id, v_payment.id;
  else
    -- Money taken for a slot someone else now holds. Keep the record, flag it, refund by hand.
    update bookings set status = 'needs_attention', payment_status = 'paid', payment_reference = p_reference where id = v_booking.id;
    return query select 'conflict'::text, v_booking.id, v_payment.id;
  end if;
end $$;

revoke all on function public.reserve_booking from public, anon, authenticated;
revoke all on function public.confirm_payment from public, anon, authenticated;
