/**
 * The panel's door, from the outside.
 *
 * It holds every attendee's name, telephone and email, and the password is
 * shared. So the things worth proving are not „can the right password get
 * in“ - admin-check does that - but what happens with a cookie somebody else
 * is holding, a forged one, a form posted from another site, and a file that
 * is not the picture it says it is.
 *
 * Run before login-guard-check, which deliberately locks the login.
 */
import { chromium } from 'playwright';
import { rm } from 'node:fs/promises';

const B = process.env.CHECK_URL || 'http://localhost:4321';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const PASS = process.env.ADMIN_PASSWORD || 'rabotilnitsa';

const b = await chromium.launch({ channel: 'chrome' });
const results = [];
const ok = (n, pass, d = '') => results.push({ n, pass, d });
const skip = (n, d = '') => results.push({ n, pass: true, skipped: true, d });

/** The dev server is not the deployed one, and two checks only exist there. */
const isLocal = /localhost|127\.0\.0\.1/.test(B);

const COOKIE = /^__Host-/.test(process.env.COOKIE_NAME ?? '') ? process.env.COOKIE_NAME : null;

async function signedIn() {
  const c = await b.newContext();
  const p = await c.newPage();
  await p.goto(`${B}/admin/vhod`, { waitUntil: 'networkidle' });
  await p.fill('#email', EMAIL);
  await p.fill('#password', PASS);
  await p.click('button[type=submit]');
  await p.waitForLoadState('networkidle');
  const cookie = (await c.cookies()).find((k) => /rab_admin/.test(k.name));
  return { c, p, cookie, inside: new URL(p.url()).pathname === '/admin' };
}

/** Does this cookie value still open the panel? Always in a brand-new browser. */
async function opens(cookie) {
  const c = await b.newContext();
  await c.addCookies([{
    name: cookie.name, value: cookie.value,
    domain: cookie.domain, path: cookie.path,
    httpOnly: cookie.httpOnly, secure: cookie.secure, sameSite: cookie.sameSite,
  }]);
  const p = await c.newPage();
  await p.goto(`${B}/admin`, { waitUntil: 'networkidle' });
  const inside = new URL(p.url()).pathname === '/admin';
  await c.close();
  return inside;
}

// ---------- the cookie itself ----------
const a = await signedIn();
ok('the right password gets in', a.inside, a.p.url());
ok('the session cookie is out of reach of any script', a.cookie?.httpOnly === true);
ok('and is not sent along on other sites’ requests', a.cookie?.sameSite === 'Lax', String(a.cookie?.sameSite));
ok('and is scoped to the whole site, not one path', a.cookie?.path === '/', String(a.cookie?.path));
// __Host- only applies where there is TLS; locally the plain name is correct.
ok('the cookie carries only a pointer, not the session itself',
   (a.cookie?.value ?? '').split('.').length === 2 && !/@/.test(a.cookie?.value ?? ''),
   (a.cookie?.value ?? '').slice(0, 24) + '…');

// ---------- forged cookies ----------
const [id, mac] = a.cookie.value.split('.');
const flip = (s) => s.slice(0, -1) + (s.at(-1) === 'a' ? 'b' : 'a');
ok('a cookie with a changed signature is refused',
   !(await opens({ ...a.cookie, value: `${id}.${flip(mac)}` })));
ok('a cookie pointing at another session is refused',
   !(await opens({ ...a.cookie, value: `11111111-1111-4111-8111-111111111111.${mac}` })));
ok('a made-up cookie is refused', !(await opens({ ...a.cookie, value: 'nonsense' })));

// ---------- the one that could not be taken back before ----------
const stolen = { ...a.cookie };
ok('a copy of a live cookie does open the panel', await opens(stolen));
await a.p.goto(`${B}/admin/izhod`, { waitUntil: 'networkidle' });
ok('after „Излез“ the same cookie is dead everywhere, not just in that browser',
   !(await opens(stolen)));
await a.c.close();

// ---------- signing out of the other devices ----------
const mine = await signedIn();
const other = await signedIn();
ok('two browsers can be signed in at once', mine.inside && other.inside);
const others = { ...other.cookie };

await mine.p.goto(`${B}/admin/pomosht`, { waitUntil: 'networkidle' });
ok('the panel lists the sign-ins',
   (await mine.p.locator('.sess__row').count()) >= 2,
   `${await mine.p.locator('.sess__row').count()} rows`);
ok('and marks which one is the browser looking at it',
   (await mine.p.locator('.sess__row.is-me').count()) === 1);

await mine.p.locator('.sess__form button').click();
await mine.p.waitForLoadState('networkidle');
ok('„Излез от всички други устройства“ ends the other one', !(await opens(others)));
await mine.p.goto(`${B}/admin`, { waitUntil: 'networkidle' });
ok('and leaves the browser that pressed it alone',
   new URL(mine.p.url()).pathname === '/admin', mine.p.url());

// ---------- posting from somewhere else ----------
// Astro's cross-site check lives in the adapter, not in the dev server, so
// locally these come back 302 and mean nothing. Against a deployed site they
// are the real thing. (The cookie is SameSite=Lax either way, which is what
// stops a browser sending it along with such a post in the first place.)
for (const [name, path, form] of [
  ['a login posted from another site is rejected', '/admin/vhod', { email: EMAIL, password: PASS }],
  ['and so is a signed-in action posted from another site', '/admin/pomosht', { action: 'revoke' }],
]) {
  if (isLocal) { skip(name, 'dev server does not run the origin check'); continue; }
  const res = await mine.p.request.post(`${B}${path}`, {
    form, headers: { Origin: 'https://evil.example' }, maxRedirects: 0,
  });
  ok(name, res.status() === 403, `HTTP ${res.status()}`);
}

// ---------- headers ----------
{
  const res = await mine.p.request.get(`${B}/admin`, { maxRedirects: 0 });
  const csp = res.headers()['content-security-policy'] ?? '';
  ok('the panel may not be framed', /frame-ancestors 'none'/.test(csp), csp.slice(0, 60));
  ok('may not load code from another origin', /script-src 'self'/.test(csp));
  ok('may not send anything to another origin', /connect-src 'self'/.test(csp));
  ok('may not have its forms redirected', /form-action 'self'/.test(csp));
  ok('is never indexed', /noindex/.test(res.headers()['x-robots-tag'] ?? ''));
  ok('and is never cached', /no-store/.test(res.headers()['cache-control'] ?? ''));
}

// ---------- the upload endpoint ----------
{
  const fresh = await b.newContext();
  const res = await fresh.request.post(`${B}/api/admin/upload`, {
    headers: { Origin: B },
    multipart: { file: { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') } },
  });
  ok('uploading without a session is refused', res.status() === 401, `HTTP ${res.status()}`);
  await fresh.close();
}
{
  // The declared type and the file name are both just strings the caller
  // chose. This one says PNG and is a web page.
  const res = await mine.p.request.post(`${B}/api/admin/upload`, {
    headers: { Origin: B },
    multipart: { file: { name: 'evil.png', mimeType: 'image/png', buffer: Buffer.from('<script>alert(1)</script>') } },
  });
  ok('a file that only claims to be an image is refused', res.status() === 415, `HTTP ${res.status()}`);
}
if (isLocal) {
  // A real PNG named .html must be stored as a .png and nothing else. Only
  // locally: against a deployed site this would leave a file in her bucket.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  const res = await mine.p.request.post(`${B}/api/admin/upload`, {
    headers: { Origin: B },
    multipart: { file: { name: 'evil.html', mimeType: 'text/html', buffer: png } },
  });
  const body = await res.json().catch(() => ({}));
  ok('a real picture is accepted whatever it is called', res.status() === 200, `HTTP ${res.status()}`);
  ok('and is stored under a name this side chose', /\.png$/.test(body.url ?? ''), String(body.url));
  if (body.url) await rm(`public${body.url}`, { force: true });
} else {
  skip('a real picture is accepted whatever it is called', 'not run against a deployed bucket');
}

await mine.c.close();
await other.c.close();
await b.close();

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  const tag = r.skipped ? 'SKIP' : r.pass ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${r.n}${r.d ? `  — ${r.d}` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
