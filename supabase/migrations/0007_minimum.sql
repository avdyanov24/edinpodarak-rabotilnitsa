-- ============================================================================
-- The smallest group she will run a workshop for.
--
-- Her rule, in her own words: eight people at the table at most, three at
-- least. The maximum was already the capacity; the minimum had nowhere to
-- live, so the site quietly promised every date would happen and she was the
-- one who had to ring two people and move it.
--
-- Nothing here blocks a booking. A workshop below the minimum still takes
-- people - that is how it gets to three. The number only makes the state
-- visible: to her in the panel, and to whoever books first, who deserves to
-- know that the date is not certain yet.
-- ============================================================================

alter table public.events
  add column if not exists min_participants int not null default 3
  check (min_participants >= 1);

comment on column public.events.min_participants is
  'Below this many confirmed people the workshop does not run. Never blocks a booking.';

-- ------------------------------------------------- published events + seats --
-- The return type gains a column, and Postgres will not let `create or
-- replace` change a function's signature, so it has to go and come back.
-- Dropping it takes its grants with it; they are re-issued below.
drop function if exists public.list_published_events();

create function public.list_published_events()
returns table (
  id uuid, slug text, status text, registrations_open boolean,
  title text, summary text, description text, cover_image text, gallery jsonb,
  starts_at timestamptz, duration_minutes int,
  venue_name text, venue_address text, venue_map_url text, city text,
  price_cents int, currency text, price_note text,
  capacity int, seats_taken int, min_participants int,
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
    e.min_participants,
    e.min_age, e.includes, e.bring_note, e.host_note,
    e.waitlist_enabled
  from public.events e
  where e.status = 'published'
  order by e.starts_at;
$$;

grant execute on function public.list_published_events() to anon, authenticated;
