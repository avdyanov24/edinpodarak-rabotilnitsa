/**
 * Runs the migrations against a real Postgres (PGlite = Postgres in WASM) and
 * exercises the booking logic, including concurrent bookings for the last seat.
 * Supabase-only objects (storage, roles) are stubbed so the rest can run.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
const results = [];
const ok = (n, pass, d = '') => results.push({ n, pass, d });

// --- stubs for things only Supabase provides -------------------------------
await db.exec(`
  create schema if not exists storage;
  create table if not exists storage.buckets (id text primary key, name text, public boolean);
  create table if not exists storage.objects (id uuid default gen_random_uuid(), bucket_id text);
  do $$ begin
    if not exists (select from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select from pg_roles where rolname = 'service_role') then create role service_role; end if;
  end $$;
`);

for (const f of ['0001_schema', '0002_functions', '0003_rls', '0004_retention', '0005_login_attempts', '0006_manual_bookings', '0007_minimum']) {
  try {
    await db.exec(readFileSync(`supabase/migrations/${f}.sql`, 'utf8'));
    ok(`migration ${f} applies`, true);
  } catch (e) {
    ok(`migration ${f} applies`, false, e.message);
    console.log(results.map(r => `${r.pass ? 'PASS' : 'FAIL'}  ${r.n}  ${r.d}`).join('\n'));
    process.exit(1);
  }
}

// --- a 12-seat workshop with 8 already taken -------------------------------
const ev = await db.query(`
  insert into events (slug, status, title, starts_at, capacity, waitlist_enabled, price_cents)
  values ('test', 'published', 'Глина и лимонада', now() + interval '30 days', 12, true, 3100)
  returning id`);
const id = ev.rows[0].id;

const book = (n, name = 'Тест') =>
  db.query(`select * from register_for_event($1, $2, $3, $4, $5, null)`,
           [id, name, `${name}@example.com`, '0888123456', n]);

await book(8, 'Осем');
let r = await db.query(`select * from list_published_events()`);
ok('seats_taken is aggregated', r.rows[0].seats_taken === 8, `taken ${r.rows[0].seats_taken}`);

// --- the last seats, taken concurrently ------------------------------------
// Four seats left; ten people press the button at the same moment.
const attempts = await Promise.all(
  Array.from({ length: 10 }, (_, i) => book(1, `Едновременен${i}`))
);
const statuses = attempts.map(a => a.rows[0].status);
const confirmed = statuses.filter(s => s === 'confirmed').length;
const waitlisted = statuses.filter(s => s === 'waitlist').length;

r = await db.query(`select * from list_published_events()`);
ok('never oversold', r.rows[0].seats_taken <= 12, `taken ${r.rows[0].seats_taken} of 12`);
ok('exactly the free seats confirmed', confirmed === 4, `${confirmed} confirmed`);
ok('the rest went to the waiting list', waitlisted === 6, `${waitlisted} waitlisted`);

// --- refusals ---------------------------------------------------------------
const fails = async (fn, code) => { try { await fn(); return false; } catch (e) { return e.message.includes(code); } };
ok('rejects an unknown event',
   await fails(() => db.query(`select * from register_for_event(gen_random_uuid(),'A','a@b.co','0888123456',1,null)`), 'unknown_event'));
await db.query(`update events set registrations_open = false where id = $1`, [id]);
ok('rejects a closed event',
   await fails(() => book(1), 'registrations_closed'));
await db.query(`update events set registrations_open = true where id = $1`, [id]);
ok('rejects a silly party size',
   await fails(() => book(99), 'invalid_people_count'));

// --- a full event with the waiting list switched off ------------------------
const ev2 = await db.query(`
  insert into events (slug, status, title, starts_at, capacity, waitlist_enabled)
  values ('full', 'published', 'Пълна', now() + interval '10 days', 2, false) returning id`);
const id2 = ev2.rows[0].id;
await db.query(`select * from register_for_event($1,'Двама','d@e.co','0888123456',2,null)`, [id2]);
const over = await db.query(`select * from register_for_event($1,'Трети','t@e.co','0888123456',1,null)`, [id2]);
ok('reports full when there is no waiting list', over.rows[0].status === 'full', over.rows[0].status);

// --- cancelling promotes the waiting list -----------------------------------
const first = await db.query(
  `select cancel_token from registrations where event_id = $1 and status = 'confirmed' order by created_at limit 1`, [id]);
const cancelled = await db.query(`select * from cancel_registration($1)`, [first.rows[0].cancel_token]);
ok('cancellation succeeds', cancelled.rows[0].status === 'cancelled', cancelled.rows[0].status);
ok('a waiting-list place is promoted', cancelled.rows[0].promoted >= 1, `promoted ${cancelled.rows[0].promoted}`);

r = await db.query(`select * from list_published_events() where slug = 'test'`);
ok('still not oversold after promotion', r.rows[0].seats_taken <= 12, `taken ${r.rows[0].seats_taken}`);

const again = await db.query(`select * from cancel_registration($1)`, [first.rows[0].cancel_token]);
ok('cancelling twice is harmless', again.rows[0].status === 'already_cancelled', again.rows[0].status);

// --- draft events stay invisible --------------------------------------------
await db.query(`insert into events (slug, status, title, starts_at) values ('draft','draft','Чернова', now() + interval '5 days')`);
r = await db.query(`select count(*)::int as n from list_published_events() where slug = 'draft'`);
ok('drafts are not published', r.rows[0].n === 0);

// --- retention ---------------------------------------------------------------
await db.query(`
  insert into events (slug, status, title, starts_at, capacity)
  values ('old','published','Стара', now() - interval '18 months', 10)`);
await db.query(`
  insert into registrations (event_id, full_name, email, phone)
  select id, 'Стар', 'old@e.co', '0888123456' from events where slug = 'old'`);
const purged = await db.query(`select public.purge_old_registrations() as n`);
ok('purges registrations older than 12 months', purged.rows[0].n === 1, `deleted ${purged.rows[0].n}`);

// --- the login throttle -------------------------------------------------------
// The panel holds every attendee's name, phone and email. This is the SQL the
// live site runs; the browser test exercises the in-memory stand-in instead,
// so without this the real path would go untested.
const throttle = async (ip, email) =>
  (await db.query(`select * from public.login_throttle($1, $2)`, [ip, email])).rows[0];
const record = (ip, email, okFlag) =>
  db.query(`select public.record_login_attempt($1, $2, $3)`, [ip, email, okFlag]);

ok('a clean address is not locked', (await throttle('10.0.0.1', 'a@e.co')).locked === false);

// five wrong passwords for one account
for (let i = 0; i < 5; i++) await record('10.0.0.1', 'a@e.co', false);
const emailLock = await throttle('10.0.0.1', 'a@e.co');
ok('five failures lock that account', emailLock.locked === true, `ip=${emailLock.ip_fails} email=${emailLock.email_fails}`);
ok('the lock says how long to wait', Number(emailLock.retry_after) > 0, `${emailLock.retry_after}s`);

// a different account from the same address is still allowed — until the
// address itself has had enough
ok('another account from the same address still works', (await throttle('10.0.0.1', 'b@e.co')).locked === false);
for (let i = 0; i < 3; i++) await record('10.0.0.1', `c${i}@e.co`, false);
ok('eight failures lock the whole address', (await throttle('10.0.0.1', 'b@e.co')).locked === true);

// somebody else is unaffected
ok('a different address is untouched', (await throttle('10.0.0.9', 'b@e.co')).locked === false);

// getting it right clears the slate
await record('10.0.0.1', 'a@e.co', true);
ok('a correct password clears the lock', (await throttle('10.0.0.1', 'a@e.co')).locked === false);

// and the table does not grow forever
await db.query(`update public.login_attempts set at = now() - interval '2 days'`);
await record('10.0.0.2', 'd@e.co', false);
const left = await db.query(`select count(*)::int as n from public.login_attempts where at < now() - interval '24 hours'`);
ok('old attempts are cleaned up', left.rows[0].n === 0, `${left.rows[0].n} stale rows left`);

// --- bookings she takes herself ----------------------------------------------
// Most of her places still go by phone or Instagram. Those rows have to count
// against capacity like any other, but they carry no consent ticked here and
// may have neither an email nor a phone.
{
  const ev3 = await db.query(`
    insert into events (slug, status, title, starts_at, capacity, waitlist_enabled)
    values ('rachno', 'draft', 'На ръка', now() + interval '20 days', 3, true) returning id`);
  const id3 = ev3.rows[0].id;
  const manual = (n, name, email = null, phone = null) =>
    db.query(`select * from register_manual($1, $2, $3, $4, $5, null)`, [id3, name, email, phone, n]);

  let r3 = await manual(2, 'Донка Иванова', null, '0888555111');
  ok('a booking she types is confirmed', r3.rows[0].status === 'confirmed', r3.rows[0].status);
  ok('and it counts against the seats', r3.rows[0].seats_left === 1, `${r3.rows[0].seats_left} left`);

  ok('no email and no phone is allowed for those rows',
     (await manual(1, 'Само Име')).rows[0].status === 'confirmed');

  const consent = await db.query(
    `select count(*)::int as n from registrations where source = 'manual' and consent_at is not null`);
  ok('and none of them claims a consent that was never given', consent.rows[0].n === 0,
     `${consent.rows[0].n} manual rows with a consent timestamp`);

  r3 = await manual(1, 'Закъснял');
  ok('past capacity she is told they are on the waiting list', r3.rows[0].status === 'waitlist', r3.rows[0].status);

  // a draft workshop is fine by hand - she is writing down people who have
  // already told her they are coming - but the form still refuses one
  ok('the public form still refuses a workshop that is not published',
     await fails(() => db.query(
       `select * from register_for_event($1,'Външен','a@b.co','0888123456',1,null)`, [id3]), 'event_not_published'));

  ok('a manual booking still needs a name',
     await fails(() => manual(1, 'X'), 'invalid_name'));
  ok('and a sane number of places',
     await fails(() => manual(99, 'Много хора'), 'invalid_people_count'));

  // the checks that protect rows coming from the site are untouched
  ok('rows from the site still need a real email',
     await fails(() => db.query(
       `insert into registrations (event_id, full_name, email, phone) values ($1,'Тест','няма-маймунка','0888123456')`,
       [id3]), 'registrations_email_check'));
}

// --- the smallest group she will run a workshop for --------------------------
// Three people, her rule. The number must never stand between somebody and a
// seat - a date gets to three precisely by letting people book below it.
{
  const ev4 = await db.query(`
    insert into events (slug, status, title, starts_at, capacity)
    values ('minimum', 'published', 'Минимум', now() + interval '14 days', 8) returning id`);
  const id4 = ev4.rows[0].id;

  const row = (await db.query(`select * from list_published_events() where slug = 'minimum'`)).rows[0];
  ok('a workshop starts with her minimum of three', row.min_participants === 3, String(row.min_participants));
  ok('and the public list carries it, or the site cannot say it',
     Object.prototype.hasOwnProperty.call(row, 'min_participants'));

  const first = await db.query(
    `select * from register_for_event($1,'Първа','a@b.co','0888123456',1,null)`, [id4]);
  ok('the first person can book a workshop that is below the minimum',
     first.rows[0].status === 'confirmed', first.rows[0].status);

  await db.query(`update events set min_participants = 5 where id = $1`, [id4]);
  const changed = (await db.query(`select min_participants from events where id = $1`, [id4])).rows[0];
  ok('she can set a different minimum per workshop', changed.min_participants === 5);

  ok('but not a minimum of nobody',
     await fails(() => db.query(`update events set min_participants = 0 where id = $1`, [id4]),
                 'min_participants_check'));

  // anon reads the list; the grant has to survive the function being replaced
  const granted = await db.query(
    `select has_function_privilege('anon', 'public.list_published_events()', 'execute') as ok`);
  ok('anon can still read the published list after 0007 replaced it', granted.rows[0].ok === true);
}

await db.close();
let failed = 0;
for (const x of results) { if (!x.pass) failed++; console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.n}${x.d ? `  — ${x.d}` : ''}`); }
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
