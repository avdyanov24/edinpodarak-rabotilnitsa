-- ============================================================================
-- Bookings she took herself.
--
-- Most of her places still get taken by phone or by a message on Instagram,
-- and until now there was nowhere to put those people: the seat counter on the
-- site showed eight free places for a workshop that was nearly full, and the
-- list she takes to the table was missing half the names.
--
-- Three things change:
--   * `source` records whether a row came from the site or from her hand, so
--     the panel and the exported list can tell them apart;
--   * email and phone stop being compulsory for the rows she types - somebody
--     who wrote on Instagram may have given neither;
--   * `consent_at` becomes nullable, because a row she typed carries no
--     consent ticked on this site and recording one would be a false claim.
-- ============================================================================

alter table public.registrations
  add column if not exists source text not null default 'site'
  check (source in ('site', 'manual'));

comment on column public.registrations.source is
  'site = booked through the form; manual = entered in the panel by her.';

-- The contact details were inline column checks, so Postgres named them
-- <table>_<column>_check. Both stay exactly as strict for anything arriving
-- from the form.
alter table public.registrations drop constraint if exists registrations_email_check;
alter table public.registrations drop constraint if exists registrations_phone_check;

alter table public.registrations
  add constraint registrations_email_check
  check (source = 'manual' or position('@' in email) > 1);

alter table public.registrations
  add constraint registrations_phone_check
  check (source = 'manual' or length(btrim(phone)) >= 6);

-- A booking the site took always has consent behind it; one she typed does not.
alter table public.registrations alter column consent_at drop not null;

-- --------------------------------------------------------- manual booking ---
-- The same `for update` on the event row as the public function, so a place
-- she types cannot collide with one somebody is taking on the site at that
-- moment.
--
-- Unlike the public one this does not care whether the workshop is published
-- or open: she is allowed to write down the people who have already told her
-- they are coming, whatever state the date is in. Capacity it does respect -
-- the whole reason the feature exists is that the counts should be true.
create or replace function public.register_manual(
  p_event_id     uuid,
  p_full_name    text,
  p_email        text default null,
  p_phone        text default null,
  p_people_count int  default 1,
  p_note         text default null
)
returns table (status text, seats_left int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event  public.events%rowtype;
  v_taken  int;
  v_left   int;
  v_status text;
begin
  if length(btrim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'invalid_name';
  end if;
  if p_people_count is null or p_people_count < 1 or p_people_count > 10 then
    raise exception 'invalid_people_count';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'unknown_event';
  end if;

  select coalesce(sum(r.people_count), 0)::int into v_taken
  from public.registrations r
  where r.event_id = v_event.id and r.status in ('confirmed', 'attended');

  v_left := greatest(v_event.capacity - v_taken, 0);

  if p_people_count <= v_left then
    v_status := 'confirmed';
  else
    v_status := 'waitlist';
  end if;

  insert into public.registrations
    (event_id, full_name, email, phone, people_count, note, status, consent_at, source)
  values
    (v_event.id,
     btrim(p_full_name),
     coalesce(btrim(lower(p_email)), ''),
     coalesce(btrim(p_phone), ''),
     p_people_count,
     nullif(btrim(coalesce(p_note, '')), ''),
     v_status,
     null,
     'manual');

  return query select
    v_status,
    greatest(v_left - (case when v_status = 'confirmed' then p_people_count else 0 end), 0);
end;
$$;

-- Only the server may call this. Supabase grants EXECUTE to anon by default,
-- and `revoke from public` does not take that away.
revoke all on function public.register_manual(uuid, text, text, text, int, text)
  from public, anon, authenticated;
