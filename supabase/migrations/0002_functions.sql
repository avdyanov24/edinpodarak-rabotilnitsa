-- ============================================================================
-- Seat counting, booking and cancellation.
--
-- All of these are SECURITY DEFINER on purpose: the public site must be able
-- to learn how many seats are left and to take one, without ever being able
-- to read a single row of `registrations`. The functions expose aggregates
-- and nothing else.
-- ============================================================================

-- ------------------------------------------------ published events + seats --
create or replace function public.list_published_events()
returns table (
  id uuid, slug text, status text, registrations_open boolean,
  title text, summary text, description text, cover_image text, gallery jsonb,
  starts_at timestamptz, duration_minutes int,
  venue_name text, venue_address text, venue_map_url text, city text,
  price_cents int, currency text, price_note text,
  capacity int, seats_taken int,
  min_age int, includes text[], bring_note text, host_note text,
  waitlist_enabled boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id, e.slug, e.status, e.registrations_open,
    e.title, e.summary, e.description, e.cover_image, e.gallery,
    e.starts_at, e.duration_minutes,
    e.venue_name, e.venue_address, e.venue_map_url, e.city,
    e.price_cents, e.currency, e.price_note,
    e.capacity,
    coalesce((
      select sum(r.people_count)::int
      from public.registrations r
      where r.event_id = e.id and r.status in ('confirmed', 'attended')
    ), 0) as seats_taken,
    e.min_age, e.includes, e.bring_note, e.host_note,
    e.waitlist_enabled
  from public.events e
  where e.status = 'published'
  order by e.starts_at;
$$;

-- ------------------------------------------------------------- booking -----
-- Takes a seat, or a place on the waiting list, atomically.
--
-- The `for update` on the event row is the whole point: two people pressing
-- "Запиши се" in the same second are serialised, so the last seat cannot be
-- sold twice.
create or replace function public.register_for_event(
  p_event_id     uuid,
  p_full_name    text,
  p_email        text,
  p_phone        text,
  p_people_count int  default 1,
  p_note         text default null
)
returns table (status text, cancel_token uuid, seats_left int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event  public.events%rowtype;
  v_taken  int;
  v_left   int;
  v_status text;
  v_token  uuid;
begin
  if p_people_count is null or p_people_count < 1 or p_people_count > 10 then
    raise exception 'invalid_people_count' using errcode = '22023';
  end if;

  select e.* into v_event from public.events e where e.id = p_event_id for update;

  if not found then
    raise exception 'unknown_event' using errcode = 'P0002';
  end if;
  if v_event.status <> 'published' then
    raise exception 'event_not_published' using errcode = 'P0002';
  end if;
  if not v_event.registrations_open then
    raise exception 'registrations_closed' using errcode = 'P0002';
  end if;

  select coalesce(sum(r.people_count), 0) into v_taken
  from public.registrations r
  where r.event_id = p_event_id and r.status in ('confirmed', 'attended');

  v_left := greatest(v_event.capacity - v_taken, 0);

  if p_people_count <= v_left then
    v_status := 'confirmed';
  elsif v_event.waitlist_enabled then
    v_status := 'waitlist';
  else
    return query select 'full'::text, null::uuid, v_left;
    return;
  end if;

  insert into public.registrations
    (event_id, full_name, email, phone, people_count, note, status)
  values
    (p_event_id, btrim(p_full_name), btrim(lower(p_email)), btrim(p_phone),
     p_people_count, nullif(btrim(coalesce(p_note, '')), ''), v_status)
  returning public.registrations.cancel_token into v_token;

  return query select
    v_status,
    v_token,
    greatest(v_left - (case when v_status = 'confirmed' then p_people_count else 0 end), 0);
end $$;

-- -------------------------------------------------------- cancellation -----
-- Releases a seat from the link in the confirmation email, then moves people
-- off the waiting list in the order they joined — which is what the FAQ on
-- the site promises.
create or replace function public.cancel_registration(p_token uuid)
returns table (status text, event_title text, starts_at timestamptz, promoted int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg      public.registrations%rowtype;
  v_event    public.events%rowtype;
  v_taken    int;
  v_left     int;
  v_promoted int := 0;
  v_row      public.registrations%rowtype;
begin
  select r.* into v_reg from public.registrations r where r.cancel_token = p_token;
  if not found then
    raise exception 'unknown_token' using errcode = 'P0002';
  end if;

  select e.* into v_event from public.events e where e.id = v_reg.event_id for update;

  if v_reg.status = 'cancelled' then
    -- already released; say so without changing anything
    return query select 'already_cancelled'::text, v_event.title, v_event.starts_at, 0;
    return;
  end if;

  update public.registrations r set status = 'cancelled' where r.id = v_reg.id;

  -- promote from the waiting list, oldest first, only whole bookings that fit
  select coalesce(sum(r.people_count), 0) into v_taken
  from public.registrations r
  where r.event_id = v_event.id and r.status in ('confirmed', 'attended');

  v_left := greatest(v_event.capacity - v_taken, 0);

  for v_row in
    select r.* from public.registrations r
    where r.event_id = v_event.id and r.status = 'waitlist'
    order by r.created_at
  loop
    exit when v_left <= 0;
    if v_row.people_count <= v_left then
      update public.registrations r set status = 'confirmed' where r.id = v_row.id;
      v_left := v_left - v_row.people_count;
      v_promoted := v_promoted + 1;
    end if;
  end loop;

  return query select 'cancelled'::text, v_event.title, v_event.starts_at, v_promoted;
end $$;

-- ------------------------------------------------------------- grants ------
-- Revoking from PUBLIC is not enough. Supabase sets default privileges that
-- grant EXECUTE on new functions to anon and authenticated *explicitly*, and
-- an explicit grant survives a revoke from PUBLIC. Both of these are
-- security definer, so leaving anon able to call them would let anyone
-- holding the publishable key book seats straight past the API — past the
-- rate limit, the honeypot and every validation rule.
revoke all on function public.register_for_event(uuid, text, text, text, int, text) from public, anon, authenticated;
revoke all on function public.cancel_registration(uuid) from public, anon, authenticated;

grant execute on function public.list_published_events() to anon, authenticated;
-- The site calls these from the server with the service role, never from the
-- browser, so anon deliberately gets no execute grant on the writes.
grant execute on function public.register_for_event(uuid, text, text, text, int, text) to service_role;
grant execute on function public.cancel_registration(uuid) to service_role;
