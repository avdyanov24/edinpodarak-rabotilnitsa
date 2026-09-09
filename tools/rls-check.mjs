/**
 * Attacks the live database with the public (anon) key — the key that ships
 * to every visitor's browser — and asserts it cannot reach anything it
 * should not. Run after any change to the policies in 0003_rls.sql.
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node tools/rls-check.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
if (!url || !anon) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');

const sb = createClient(url, anon, { auth: { persistSession: false } });
const results = [];
const ok = (n, pass, d = '') => results.push({ n, pass, d });
const blocked = (error, data) => Boolean(error) || !data || data.length === 0;

// --- personal data ---
{
  const { data, error } = await sb.from('registrations').select('*').limit(5);
  ok('registrations cannot be read', blocked(error, data), error?.message ?? `returned ${data?.length} rows`);
}
{
  const { error } = await sb.from('registrations').insert({
    event_id: '11111111-1111-4111-8111-111111111111',
    full_name: 'Нахален', email: 'x@y.z', phone: '0888000000',
  });
  ok('registrations cannot be written', Boolean(error), error?.message ?? 'INSERT SUCCEEDED');
}

// --- events ---
{
  const { data } = await sb.from('events').select('slug,status');
  ok('only published workshops are visible',
     (data ?? []).every((e) => e.status === 'published'),
     `${data?.length ?? 0} rows: ${[...new Set((data ?? []).map((e) => e.status))].join(',')}`);
}
// PostgREST answers 204 for an UPDATE that row-level security filtered down
// to nothing — no error. So ask it which rows it touched and require none.
{
  const { data, error } = await sb.from('events').update({ title: 'Присвоено' }).eq('status', 'published').select();
  ok('workshops cannot be edited', Boolean(error) || (data ?? []).length === 0,
     error?.message ?? `changed ${data.length} rows`);
}
{
  const { data, error } = await sb.from('events').delete().neq('slug', '').select();
  ok('workshops cannot be deleted', Boolean(error) || (data ?? []).length === 0,
     error?.message ?? `deleted ${data.length} rows`);
}

// --- the booking function is server-only ---
{
  // the real signature, so this is refused by permissions and not by a typo
  const { error } = await sb.rpc('register_for_event', {
    p_event_id: '11111111-1111-4111-8111-111111111111',
    p_full_name: 'Нахален', p_email: 'x@y.z', p_phone: '0888000000',
    p_people_count: 1, p_note: null,
  });
  ok('booking cannot be called directly from the browser', Boolean(error), error?.message ?? 'RPC SUCCEEDED');
}

// --- what the page legitimately needs ---
{
  const { data, error } = await sb.rpc('list_published_events');
  const row = (data ?? [])[0];
  ok('the page can still read seat counts', !error && Array.isArray(data) && data.length > 0,
     error?.message ?? `${data?.length ?? 0} workshops`);
  ok('seat counts are a number, not a list of people',
     Boolean(row) && typeof row.seats_taken === 'number' && !('registrations' in row),
     row ? `seats_taken=${row.seats_taken}` : 'no rows');
}

// --- content ---
{
  const { data, error } = await sb.from('site_content').update({ data: {} }).eq('id', true).select();
  ok('site content cannot be rewritten', Boolean(error) || (data ?? []).length === 0,
     error?.message ?? `changed ${data.length} rows`);
}

// And nothing above actually altered anything.
{
  const { data } = await sb.from('events').select('slug,title');
  const stolen = (data ?? []).some((e) => e.title === 'Присвоено');
  ok('the workshops are still intact after all of that', !stolen && (data ?? []).length === 3,
     `${data?.length ?? 0} workshops, titles unchanged: ${!stolen}`);
}

for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  — ' + r.d : ''}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
