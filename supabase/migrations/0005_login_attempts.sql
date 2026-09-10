-- ============================================================================
-- Работилница · Джейля — brute-force protection for the admin login
--
-- The panel holds every attendee's name, phone and email, so the login is the
-- one door worth locking properly. Counting attempts in memory does not work
-- here: the site runs on serverless instances that each hold their own
-- memory and are recycled constantly, so an attacker gets a fresh allowance
-- with every cold start. The count has to live in the database.
-- ============================================================================

create table if not exists public.login_attempts (
  id         bigserial   primary key,
  ip         text        not null,
  email      text        not null default '',
  ok         boolean     not null default false,
  at         timestamptz not null default now()
);

create index if not exists login_attempts_ip_at  on public.login_attempts (ip, at desc);
create index if not exists login_attempts_em_at  on public.login_attempts (lower(email), at desc);
create index if not exists login_attempts_at     on public.login_attempts (at desc);

alter table public.login_attempts enable row level security;
-- No policies at all: nothing but service_role can read or write this.

-- ---------------------------------------------------------------- throttle --
-- Two separate limits, because they stop different attacks:
--   per IP    — one machine grinding through passwords
--   per email — a spread of machines all guessing the same account
create or replace function public.login_throttle(p_ip text, p_email text)
returns table (locked boolean, retry_after int, ip_fails int, email_fails int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window   interval := interval '15 minutes';
  v_ip_max   int := 8;
  v_em_max   int := 5;
  v_ip_n     int;
  v_em_n     int;
  v_last     timestamptz;
begin
  select count(*), max(a.at) into v_ip_n, v_last
  from public.login_attempts a
  where a.ip = p_ip and not a.ok and a.at > now() - v_window;

  select count(*) into v_em_n
  from public.login_attempts a
  where lower(a.email) = lower(p_email) and not a.ok and a.at > now() - v_window;

  if v_ip_n >= v_ip_max or v_em_n >= v_em_max then
    -- locked until the window has passed since the most recent failure
    return query select
      true,
      greatest(extract(epoch from (coalesce(v_last, now()) + v_window - now()))::int, 1),
      v_ip_n,
      v_em_n;
  else
    return query select false, 0, v_ip_n, v_em_n;
  end if;
end;
$$;

-- ------------------------------------------------------------------ record --
create or replace function public.record_login_attempt(p_ip text, p_email text, p_ok boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.login_attempts (ip, email, ok) values (p_ip, p_email, p_ok);

  -- A success clears the slate for that account and that address, so the
  -- owner getting their own password wrong a few times cannot lock the
  -- account for the rest of the window once they get it right.
  if p_ok then
    delete from public.login_attempts
    where not ok
      and (ip = p_ip or lower(email) = lower(p_email));
  end if;

  -- keep the table small; nothing here is interesting after a day
  delete from public.login_attempts where at < now() - interval '24 hours';
end;
$$;

revoke all on function public.login_throttle(text, text) from public, anon, authenticated;
revoke all on function public.record_login_attempt(text, text, boolean) from public, anon, authenticated;
grant execute on function public.login_throttle(text, text) to service_role;
grant execute on function public.record_login_attempt(text, text, boolean) to service_role;
