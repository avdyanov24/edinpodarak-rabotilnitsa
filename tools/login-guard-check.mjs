/**
 * Tries to break into the panel, and requires that it stops working.
 *
 * The panel holds every attendee's name, phone and email, so the login is
 * the one door worth locking properly. Counting attempts in memory does not
 * survive serverless — the count lives in the database, and this proves it
 * actually bites.
 *
 * NOTE: this deliberately locks the login out, which is the whole point. Run
 * it LAST — anything after it that tries to sign in will be refused for the
 * next 15 minutes. Locally that clears when the dev server restarts; against
 * the live site it does not, so wait it out or clear `login_attempts`.
 */
import { chromium } from 'playwright';

const B = process.env.CHECK_URL || 'http://localhost:4321';
const GOOD_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const GOOD_PASS = process.env.ADMIN_PASSWORD || 'rabotilnitsa';

const b = await chromium.launch({ channel: 'chrome' });
const results = [];
const ok = (n, pass, d = '') => results.push({ n, pass, d });

const fresh = async () => {
  const c = await b.newContext();
  return { c, p: await c.newPage() };
};

async function attempt(page, email, password) {
  await page.goto(`${B}/admin/vhod`, { waitUntil: 'networkidle' });
  const disabled = await page.locator('button[type=submit]').isDisabled();
  await page.fill('#email', email);
  await page.fill('#password', password);
  const text0 = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  if (disabled) return { blocked: true, inside: false, text: text0 };
  await page.click('button[type=submit]');
  await page.waitForTimeout(350);
  return {
    blocked: false,
    inside: new URL(page.url()).pathname === '/admin',
    text: (await page.locator('body').innerText()).replace(/\s+/g, ' '),
  };
}

const isLocked = (t) => /Твърде много опити|Заключено за кратко/.test(t);

// --- a wrong password answers with a refusal, not 200 OK ---
{
  const { c, p } = await fresh();
  const res = await p.request.post(`${B}/admin/vhod`, {
    form: { email: 'prazno@example.com', password: 'nope' },
    headers: { Origin: B },
    maxRedirects: 0,
  });
  ok('a failed login does not answer 200 OK', [401, 429].includes(res.status()), `HTTP ${res.status()}`);
  await c.close();
}

// --- grinding one account locks that account ---
let emailLockedAt = null;
{
  const { c, p } = await fresh();
  for (let i = 1; i <= 7; i++) {
    const r = await attempt(p, 'ednakriv@example.com', `guess-${i}`);
    if (isLocked(r.text)) { emailLockedAt = i; break; }
  }
  await c.close();
}
ok('grinding one account locks that account', emailLockedAt !== null,
   emailLockedAt ? `locked on attempt ${emailLockedAt}` : 'never locked in 7 tries');

// --- keep going, spreading across accounts, and the address itself locks ---
let ipLockedAt = null;
let lockText = '';
{
  const { c, p } = await fresh();
  for (let i = 1; i <= 12; i++) {
    const r = await attempt(p, `raznikrivi${i}@example.com`, `guess-${i}`);
    lockText = r.text;
    if (isLocked(r.text)) { ipLockedAt = i; break; }
  }
  await c.close();
}
ok('spreading the guesses across accounts still locks the address', ipLockedAt !== null,
   ipLockedAt ? `locked on attempt ${ipLockedAt}` : 'never locked in 12 tries');
ok('the lockout says when to come back', /след .{1,12}минут/.test(lockText), lockText.match(/Твърде много опити[^.]*\./)?.[0] ?? lockText.slice(0, 70));

// --- while the address is locked, even the real password is refused ---
{
  const { c, p } = await fresh();
  const r = await attempt(p, GOOD_EMAIL, GOOD_PASS);
  ok('while locked, even the correct password is refused', !r.inside,
     r.inside ? 'GOT IN' : 'refused');
  await c.close();
}

// --- headers ---
{
  const { c, p } = await fresh();
  const h = (await p.request.get(`${B}/admin/vhod`)).headers();
  ok('the panel is not cacheable', /no-store/.test(h['cache-control'] ?? ''), h['cache-control']);
  ok('the panel cannot be framed', (h['x-frame-options'] ?? '').toUpperCase() === 'DENY', h['x-frame-options']);
  ok('no referrer leaks out of the panel', (h['referrer-policy'] ?? '') === 'no-referrer', h['referrer-policy']);
  const pub = (await p.request.get(`${B}/`)).headers();
  ok('the public site sets nosniff', pub['x-content-type-options'] === 'nosniff', pub['x-content-type-options']);
  ok('the public site cannot be framed', (pub['x-frame-options'] ?? '').toUpperCase() === 'DENY', pub['x-frame-options']);
  await c.close();
}

await b.close();
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  — ' + r.d : ''}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
console.log('\nThe login is now locked from this address for 15 minutes — that is the');
console.log('point of the test. Restart the dev server to clear it locally.');
process.exit(failed ? 1 : 0);
