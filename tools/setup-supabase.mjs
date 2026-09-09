/**
 * Creates the Supabase project, applies the migrations, seeds the demo
 * content and creates the admin login — end to end, through the Management
 * API, so nothing depends on a database password being typed anywhere.
 *
 *   npx supabase login          (once, in a terminal — needs a browser)
 *   node tools/setup-supabase.mjs
 *
 * Safe to re-run: it reuses a project of the same name, the migrations are
 * written to be idempotent, and the seed upserts by slug.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.supabase.com/v1';

const NAME = process.env.SUPABASE_PROJECT_NAME || 'edinpodarak-rabotilnitsa';
const REGION = process.env.SUPABASE_REGION || 'eu-central-1'; // Frankfurt
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@edinpodarak.com';

async function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;

  // `supabase login` puts the token in the macOS keychain when it can, and in
  // a file when it cannot. Read whichever exists, so logging in is the only
  // thing anyone has to do by hand.
  try {
    const { execFileSync } = await import('node:child_process');
    const out = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-w'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (out) return out;
  } catch {}

  for (const p of [join(homedir(), '.supabase/access-token'), join(homedir(), '.config/supabase/access-token')]) {
    try { return (await readFile(p, 'utf8')).trim(); } catch {}
  }
  throw new Error(
    'No Supabase access token.\n' +
    'Run `npx supabase login` in a terminal, or set SUPABASE_ACCESS_TOKEN\n' +
    '(https://supabase.com/dashboard/account/tokens).',
  );
}

const TOKEN = await accessToken();

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  return body;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (m) => console.log(`\n▸ ${m}`);

// ---------------------------------------------------------------- project ---
step('Finding the project');
const projects = await api('/projects');
let project = projects.find((p) => p.name === NAME);
let dbPassword = null;

if (project) {
  console.log(`  reusing ${project.name} (${project.id}) in ${project.region}`);
} else {
  const orgs = await api('/organizations');
  if (!orgs.length) throw new Error('No Supabase organization on this account.');
  const org = orgs[0];
  dbPassword = randomBytes(24).toString('base64url');
  console.log(`  creating "${NAME}" in ${org.name} · ${REGION}`);
  project = await api('/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: NAME,
      organization_id: org.id,
      region: REGION,
      db_pass: dbPassword,
    }),
  });
  console.log(`  database password (store it — Supabase will not show it again):\n    ${dbPassword}`);
}

const ref = project.id;

step('Waiting for the database to come up');
for (let i = 0; i < 60; i++) {
  const p = await api(`/projects/${ref}`);
  process.stdout.write(`  ${p.status}\r`);
  if (p.status === 'ACTIVE_HEALTHY') { console.log(`  ${p.status}        `); break; }
  if (p.status === 'INACTIVE' || String(p.status).includes('FAILED')) throw new Error(`project status ${p.status}`);
  await sleep(5000);
}

// ------------------------------------------------------------------- keys ---
step('Reading the API keys');
const keys = await api(`/projects/${ref}/api-keys`);
const keyOf = (name) => keys.find((k) => k.name === name)?.api_key;
const anon = keyOf('anon');
const service = keyOf('service_role');
if (!anon || !service) throw new Error(`could not read anon/service_role keys: ${JSON.stringify(keys).slice(0, 200)}`);
const url = `https://${ref}.supabase.co`;
console.log(`  ${url}`);

// ------------------------------------------------------------- migrations ---
step('Applying the migrations');
const dir = join(root, 'supabase/migrations');
for (const file of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
  const query = await readFile(join(dir, file), 'utf8');
  await api(`/projects/${ref}/database/query`, { method: 'POST', body: JSON.stringify({ query }) });
  console.log(`  ${file}`);
}

const rows = await api(`/projects/${ref}/database/query`, {
  method: 'POST',
  body: JSON.stringify({ query: "select count(*)::int as n from public.events" }),
});
console.log(`  events table reachable — ${JSON.stringify(rows)}`);

// ------------------------------------------------------------------- seed ---
step('Seeding the demo workshops');
const { build } = await import('esbuild');
const bundle = join(root, `.seed-${process.pid}.mjs`);
await build({
  entryPoints: [join(root, 'src/data/events.ts')],
  outfile: bundle, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent',
});
const { seedEvents } = await import(`file://${bundle}`);
const { rm } = await import('node:fs/promises');
await rm(bundle, { force: true });

const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(url, service, { auth: { persistSession: false } });

for (const e of seedEvents) {
  const { seats_taken, ...row } = e;           // seats_taken is derived, not stored
  const { error } = await sb.from('events').upsert(row, { onConflict: 'slug' });
  if (error) throw new Error(`seeding ${e.slug}: ${error.message}`);
  console.log(`  ${e.slug}`);
}

// The demo seat counts have to be real rows, or the page would claim seats
// that nothing is holding.
step('Seeding the demo bookings that back the seat counts');
for (const e of seedEvents) {
  if (!e.seats_taken) continue;
  const { data: ev } = await sb.from('events').select('id').eq('slug', e.slug).single();
  const { count } = await sb.from('registrations').select('id', { count: 'exact', head: true }).eq('event_id', ev.id);
  if (count && count > 0) { console.log(`  ${e.slug}: already has ${count}`); continue; }
  const rows = Array.from({ length: e.seats_taken }, (_, i) => ({
    event_id: ev.id,
    full_name: `Резервирано ${i + 1} (демо)`,
    email: `demo${i + 1}@example.com`,
    phone: '0000000000',
    people_count: 1,
    status: 'confirmed',
    consent_at: new Date().toISOString(),
  }));
  const { error } = await sb.from('registrations').insert(rows);
  if (error) throw new Error(`seeding bookings for ${e.slug}: ${error.message}`);
  console.log(`  ${e.slug}: ${rows.length} demo bookings`);
}

// ------------------------------------------------------------ admin login ---
step('Creating the admin login');
const adminPassword = process.env.ADMIN_PASSWORD || randomBytes(12).toString('base64url');
const mk = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: adminPassword, email_confirm: true }),
});
const mkBody = await mk.json().catch(() => ({}));
if (mk.ok) {
  console.log(`  ${ADMIN_EMAIL}`);
  console.log(`  password (shown once): ${adminPassword}`);
} else if (JSON.stringify(mkBody).includes('already been registered')) {
  console.log(`  ${ADMIN_EMAIL} already exists — password unchanged`);
} else {
  throw new Error(`creating the admin user: ${JSON.stringify(mkBody).slice(0, 300)}`);
}

// ------------------------------------------------------------------ done ---
step('Set these on the host, then redeploy');
console.log([
  `SUPABASE_URL=${url}`,
  `SUPABASE_ANON_KEY=${anon}`,
  `SUPABASE_SERVICE_ROLE_KEY=${service}`,
  `ADMIN_EMAIL=${ADMIN_EMAIL}`,
].join('\n'));
console.log('\nThe service-role key bypasses every access rule. Host environment only.');
