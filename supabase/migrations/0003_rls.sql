-- ============================================================================
-- Row level security.
--
-- The rule that matters: nothing anonymous can ever read `registrations`.
-- Names, phones and emails leave the database only through the admin panel,
-- which is authenticated, or through the server using the service role.
-- ============================================================================

alter table public.events        enable row level security;
alter table public.registrations enable row level security;
alter table public.site_content  enable row level security;

-- ------------------------------------------------------------- events ------
drop policy if exists events_public_read on public.events;
create policy events_public_read
  on public.events for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists events_admin_all on public.events;
create policy events_admin_all
  on public.events for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------ registrations ------
-- No anon policy at all: no policy means no access.
drop policy if exists registrations_admin_all on public.registrations;
create policy registrations_admin_all
  on public.registrations for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------- site content ------
drop policy if exists site_content_public_read on public.site_content;
create policy site_content_public_read
  on public.site_content for select
  to anon, authenticated
  using (true);

drop policy if exists site_content_admin_write on public.site_content;
create policy site_content_admin_write
  on public.site_content for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------ storage ------
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

drop policy if exists event_images_public_read on storage.objects;
create policy event_images_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'event-images');

drop policy if exists event_images_admin_write on storage.objects;
create policy event_images_admin_write
  on storage.objects for all
  to authenticated
  using (bucket_id = 'event-images')
  with check (bucket_id = 'event-images');
