-- ============================================================================
-- Retention. The privacy notice promises registrations are deleted 12 months
-- after the workshop; this is what actually does it.
--
-- Schedule with pg_cron in the Supabase dashboard (Database → Extensions →
-- pg_cron), or call it from any scheduler:
--
--   select cron.schedule('purge-registrations', '0 3 * * *',
--                        $$select public.purge_old_registrations()$$);
-- ============================================================================

create or replace function public.purge_old_registrations()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.registrations r
  using public.events e
  where r.event_id = e.id
    and e.starts_at < now() - interval '12 months';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end $$;

revoke all on function public.purge_old_registrations() from public;
grant execute on function public.purge_old_registrations() to service_role;
