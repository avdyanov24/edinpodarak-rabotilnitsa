# Connecting Supabase

The site runs without it — everything falls back to a local file — so do this
when you are ready to put it online. Roughly 20 minutes.

## 1. Create the project

supabase.com → New project. Free tier. Pick the Frankfurt region (closest to
Bulgaria). Save the database password somewhere; you will not see it again.

## 2. Run the migrations

SQL Editor → New query. Paste and run each file **in order**:

```
supabase/migrations/0001_schema.sql
supabase/migrations/0002_functions.sql
supabase/migrations/0003_rls.sql
supabase/migrations/0004_retention.sql
```

They are safe to re-run.

Verify it took:

```sql
select * from list_published_events();      -- empty, no error
select count(*) from events;                 -- 0
```

## 3. Create her login

Authentication → Users → Add user. Use her real email and a password she
chooses. Tick "Auto Confirm User" so she does not need to click a link.

Add a second user for yourself.

There is no public sign-up: `authenticated` means admin here, and the only way
to become authenticated is for you to create the account.

## 4. Keys

Project settings → API:

| Key | Where it goes |
|---|---|
| Project URL | `SUPABASE_URL` |
| `anon` public | `SUPABASE_ANON_KEY` |
| `service_role` secret | `SUPABASE_SERVICE_ROLE_KEY` |

**The service-role key bypasses every security rule.** It belongs in the server
environment only. It must never appear in a `PUBLIC_` variable, in client-side
code, or in the repository.

## 5. Point the site at it

Set the variables from `.env.example` in your host (Vercel → Settings →
Environment Variables), plus:

```
ADMIN_SESSION_SECRET=<openssl rand -hex 32>
```

Redeploy. The yellow "working on the local file" banner in the panel
disappears once it is talking to Supabase.

## 6. Move the demo content over

The local file is only seed data. Either re-enter the real workshops through
the panel, or, once she has confirmed the real details, insert them with SQL.

## 7. Email (optional)

Bookings work without it; people just do not get a confirmation.

1. resend.com → add the domain `mail.edinpodarak.com`
2. Add the SPF/DKIM records it gives you at Jump.bg — a subdomain, so her
   existing mail is untouched
3. Set `RESEND_API_KEY`, `MAIL_FROM`, `OWNER_EMAIL`

## 8. Retention

The privacy notice promises registrations are deleted 12 months after the
workshop. Turn that promise on — Database → Extensions → enable `pg_cron`, then:

```sql
select cron.schedule(
  'purge-registrations', '0 3 * * *',
  $$select public.purge_old_registrations()$$
);
```

## What is protected, and how

- **`registrations` has no anonymous policy at all.** No policy means no
  access: names, phones and emails cannot be read from the browser, with any
  key, ever. They are reachable only through the authenticated panel.
- **Bookings go through `register_for_event`**, which is `security definer`
  and takes a row lock on the event. Two people taking the last seat at the
  same moment is serialised — the second becomes a waiting-list entry.
  This is covered by `node tools/sql-test.mjs`, which fires ten concurrent
  bookings at four free seats against a real Postgres.
- **Seat counts are exposed as an aggregate**, never as rows, so the public
  page can say "остават 3 места" without leaking who booked.
- **Drafts are invisible**: the read policy is `status = 'published'`.
