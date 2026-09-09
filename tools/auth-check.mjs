/**
 * The demo credentials (admin@example.com / rabotilnitsa) are published in
 * this repository. A deployed site must refuse them — the panel holds every
 * attendee's name, phone and email.
 *
 * Exercised directly rather than through a browser, so the environment can be
 * controlled: the point is what happens when ADMIN_EMAIL is *absent*.
 */
const results = [];
const ok = (n, pass, d = '') => results.push({ n, pass, d });

function reset(env) {
  for (const k of ['VERCEL', 'NODE_ENV', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    delete process.env[k];
  }
  process.env.ADMIN_SESSION_SECRET = 'test-secret';
  Object.assign(process.env, env);
}

// The source uses extensionless imports, which Node cannot resolve on its
// own; bundle it the way Astro would, then import the result.
import { build } from 'esbuild';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, `.auth-check-${process.pid}.mjs`);
await build({
  entryPoints: [join(root, 'src/lib/auth.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'node',
  external: ['@supabase/supabase-js', 'astro'],
  logLevel: 'silent',
});
const { signIn, isConfigured } = await import(`file://${out}`);
await rm(out, { force: true });

// --- deployed, nothing configured: the dangerous case ---
reset({ VERCEL: '1' });
ok('deployed + no credentials: demo pair refused', (await signIn('admin@example.com', 'rabotilnitsa')) === false);
ok('deployed + no credentials: anything else refused', (await signIn('someone@else.com', 'hunter2')) === false);
ok('deployed + no credentials: reports itself unconfigured', isConfigured() === false);

reset({ NODE_ENV: 'production' });
ok('production + no credentials: demo pair refused', (await signIn('admin@example.com', 'rabotilnitsa')) === false);

// --- deployed and configured properly ---
reset({ VERCEL: '1', ADMIN_EMAIL: 'dzheilya@example.com', ADMIN_PASSWORD: 'a-real-long-password' });
ok('configured: the right pair gets in', (await signIn('dzheilya@example.com', 'a-real-long-password')) === true);
ok('configured: the email is case-insensitive', (await signIn('Dzheilya@Example.com', 'a-real-long-password')) === true);
ok('configured: a wrong password is refused', (await signIn('dzheilya@example.com', 'nope')) === false);
ok('configured: the demo pair is still refused', (await signIn('admin@example.com', 'rabotilnitsa')) === false);
ok('configured: reports itself configured', isConfigured() === true);

// --- a laptop: the demo pair is the whole point ---
reset({});
ok('local dev: the demo pair works', (await signIn('admin@example.com', 'rabotilnitsa')) === true);
ok('local dev: a wrong password is still refused', (await signIn('admin@example.com', 'wrong')) === false);

// --- no signing secret: no sessions at all ---
reset({ VERCEL: '1', ADMIN_EMAIL: 'a@b.c', ADMIN_PASSWORD: 'x' });
delete process.env.ADMIN_SESSION_SECRET;
ok('no session secret: reports itself unconfigured', isConfigured() === false);

for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  — ' + r.d : ''}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
