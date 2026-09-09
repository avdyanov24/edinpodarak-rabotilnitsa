-- ============================================================================
-- Работилница · Джейля — schema
-- Run in the Supabase SQL editor, or `supabase db push`.
-- ============================================================================

-- gen_random_uuid() is in Postgres core since 13; no extension needed.

-- ---------------------------------------------------------------- events ---
create table if not exists public.events (
  id                 uuid primary key default gen_random_uuid(),
  slug               text        not null unique,
  status             text        not null default 'draft'
                                 check (status in ('draft', 'published', 'cancelled')),
  registrations_open boolean     not null default true,

  title              text        not null,
  summary            text        not null default '',
  description        text        not null default '',
  cover_image        text,
  gallery            jsonb       not null default '[]'::jsonb,

  starts_at          timestamptz not null,
  duration_minutes   int         not null default 120 check (duration_minutes > 0),

  venue_name         text        not null default '',
  venue_address      text        not null default '',
  venue_map_url      text,
  city               text        not null default 'Пловдив',

  price_cents        int         not null default 0 check (price_cents >= 0),
  currency           text        not null default 'EUR',
  price_note         text        not null default '',

  capacity           int         not null default 12 check (capacity > 0),
  min_age            int         check (min_age is null or min_age between 0 and 120),
  includes           text[]      not null default '{}',
  bring_note         text,
  host_note          text,
  waitlist_enabled   boolean     not null default true,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists events_status_starts_at_idx
  on public.events (status, starts_at);

-- --------------------------------------------------------- registrations ---
create table if not exists public.registrations (
  id           uuid        primary key default gen_random_uuid(),
  event_id     uuid        not null references public.events (id) on delete cascade,

  full_name    text        not null check (length(btrim(full_name)) >= 2),
  email        text        not null check (position('@' in email) > 1),
  phone        text        not null check (length(btrim(phone)) >= 6),
  people_count int         not null default 1 check (people_count between 1 and 10),
  note         text,

  status       text        not null default 'confirmed'
                           check (status in ('confirmed', 'waitlist', 'cancelled', 'attended')),

  -- proof of the consent ticked on the form, required under GDPR
  consent_at   timestamptz not null default now(),
  -- lets someone release their own seat from the confirmation email
  cancel_token uuid        not null default gen_random_uuid() unique,

  created_at   timestamptz not null default now()
);

create index if not exists registrations_event_status_idx
  on public.registrations (event_id, status);
create index if not exists registrations_created_idx
  on public.registrations (event_id, created_at);

-- ---------------------------------------------------------- site content ---
-- One row. Everything on the page that is not an event.
create table if not exists public.site_content (
  id         boolean     primary key default true check (id),
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.site_content (id, data)
values (true, '{}'::jsonb)
on conflict (id) do nothing;

-- ------------------------------------------------------------- updated_at --
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

drop trigger if exists site_content_touch on public.site_content;
create trigger site_content_touch before update on public.site_content
  for each row execute function public.touch_updated_at();
