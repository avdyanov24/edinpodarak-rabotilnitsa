-- ============================================================================
-- Sessions the panel can actually take back.
--
-- Until now a sign-in produced a self-contained signed cookie, good for
-- twelve hours, that nothing could revoke. „Излез“ deleted it from that one
-- browser; a copy taken from anywhere else went on working, and changing the
-- password did not touch it. There was also no way to answer the question
-- that matters after a password has been passed around: has anybody else
-- been in here?
--
-- So the cookie now carries nothing but a signed pointer to a row. The row
-- can be revoked, it records when it was last used and from where, and the
-- panel shows her the list.
--
-- No policies on the table: like login_attempts, it is service_role only.
-- ============================================================================

create table if not exists public.admin_sessions (
  id           uuid        primary key default gen_random_uuid(),
  email        text        not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  ip           text        not null default '',
  user_agent   text        not null default '',
  revoked_at   timestamptz
);

create index if not exists admin_sessions_email_idx on public.admin_sessions (lower(email), created_at desc);
create index if not exists admin_sessions_expiry_idx on public.admin_sessions (expires_at);

alter table public.admin_sessions enable row level security;

-- --------------------------------------------------------------- start -----
create or replace function public.admin_session_start(
  p_email text, p_ip text default '', p_agent text default '', p_hours int default 12
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  -- The row is the audit trail as much as the session, so it is kept a while
  -- after it dies - but not forever.
  delete from public.admin_sessions where expires_at < now() - interval '60 days';

  insert into public.admin_sessions (email, ip, user_agent, expires_at)
  values (
    lower(btrim(p_email)),
    left(coalesce(p_ip, ''), 60),
    left(coalesce(p_agent, ''), 300),
    now() + make_interval(hours => greatest(coalesce(p_hours, 12), 1))
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- --------------------------------------------------------------- touch -----
-- One call does both jobs: says whether the session is still good, and marks
-- it as used. A revoked or expired row simply returns nothing.
create or replace function public.admin_session_touch(p_id uuid)
returns table (email text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.admin_sessions s
     set last_seen_at = now()
   where s.id = p_id
     and s.revoked_at is null
     and s.expires_at > now()
  returning s.email, s.expires_at;
end;
$$;

-- -------------------------------------------------------------- revoke -----
create or replace function public.admin_session_revoke(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.admin_sessions set revoked_at = now()
  where id = p_id and revoked_at is null;
$$;

/** „Излез от всички устройства“. Returns how many were still alive. */
create or replace function public.admin_session_revoke_all(p_email text, p_except uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  update public.admin_sessions
     set revoked_at = now()
   where lower(email) = lower(btrim(p_email))
     and revoked_at is null
     and expires_at > now()
     and (p_except is null or id <> p_except);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------- list -----
-- What the panel shows her: the sign-ins on her account, newest first.
create or replace function public.admin_sessions_recent(p_email text, p_limit int default 8)
returns table (
  id uuid, created_at timestamptz, last_seen_at timestamptz,
  expires_at timestamptz, revoked_at timestamptz, ip text, user_agent text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.created_at, s.last_seen_at, s.expires_at, s.revoked_at, s.ip, s.user_agent
  from public.admin_sessions s
  where lower(s.email) = lower(btrim(p_email))
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 50);
$$;

-- Server only. Supabase grants EXECUTE to anon by default and a revoke from
-- PUBLIC does not take that away, so each one is revoked by name.
revoke all on function public.admin_session_start(text, text, text, int) from public, anon, authenticated;
revoke all on function public.admin_session_touch(uuid) from public, anon, authenticated;
revoke all on function public.admin_session_revoke(uuid) from public, anon, authenticated;
revoke all on function public.admin_session_revoke_all(text, uuid) from public, anon, authenticated;
revoke all on function public.admin_sessions_recent(text, int) from public, anon, authenticated;

grant execute on function public.admin_session_start(text, text, text, int) to service_role;
grant execute on function public.admin_session_touch(uuid) to service_role;
grant execute on function public.admin_session_revoke(uuid) to service_role;
grant execute on function public.admin_session_revoke_all(text, uuid) to service_role;
grant execute on function public.admin_sessions_recent(text, int) to service_role;
