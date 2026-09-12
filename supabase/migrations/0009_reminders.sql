-- ============================================================================
-- The reminder the site has been promising.
--
-- „Пращам потвърждение и напомняне ден преди работилницата“ stood under the
-- booking form and in the confirmation, and nothing anywhere sent one. This
-- is the part that was missing: which bookings are due a reminder, and a mark
-- so nobody gets two.
--
-- The mark is only written once an email has actually gone out, so a day when
-- the mail service is not configured - or is down - leaves the reminder due
-- rather than silently spending it.
-- ============================================================================

alter table public.registrations
  add column if not exists reminded_at timestamptz;

comment on column public.registrations.reminded_at is
  'When the day-before reminder actually went out. Null = still due.';

-- --------------------------------------------------------------- due -------
-- Everything confirmed for a workshop starting inside the window, that has
-- not been reminded yet. The window is passed in rather than fixed here, so
-- the job can be run by hand for a specific day if a run is ever missed.
create or replace function public.reminders_due(p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, full_name text, email text, cancel_token uuid,
  event_title text, starts_at timestamptz, venue_name text, venue_address text,
  bring_note text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.full_name, r.email, r.cancel_token,
         e.title, e.starts_at, e.venue_name, e.venue_address, e.bring_note
  from public.registrations r
  join public.events e on e.id = r.event_id
  where r.status = 'confirmed'
    and r.reminded_at is null
    and position('@' in r.email) > 1
    and e.status = 'published'
    and e.starts_at >= p_from
    and e.starts_at <  p_to
  order by e.starts_at, r.created_at;
$$;

create or replace function public.reminder_sent(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.registrations set reminded_at = now()
  where id = p_id and reminded_at is null;
$$;

revoke all on function public.reminders_due(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.reminder_sent(uuid) from public, anon, authenticated;
grant execute on function public.reminders_due(timestamptz, timestamptz) to service_role;
grant execute on function public.reminder_sent(uuid) to service_role;
