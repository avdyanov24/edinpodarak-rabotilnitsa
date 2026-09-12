/**
 * The cancellation link, in all four states it can be in.
 *
 * The link lives in an email people keep. Opening it a second time used to ask
 * „Сигурен ли си?“ about a place that had already been given away, and a
 * mistyped link asked the same about a booking that never existed - because
 * the page only ever looked the token up on POST.
 *
 * Local store only; it books and cancels for real.
 */
import { chromium } from 'playwright';
import { readFile, rm } from 'node:fs/promises';

const B = process.env.CHECK_URL || 'http://localhost:4321';
if (!B.includes('localhost')) {
  console.log('cancel-check only runs against localhost');
  process.exit(0);
}
await rm('.data/db.json', { force: true });

const b = await chromium.launch({ channel: 'chrome' });
const results = [];
const ok = (n, pass, d = '') => results.push({ n, pass, d });
const h1 = async (p) => (await p.locator('h1').innerText()).trim();

async function book() {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(B, { waitUntil: 'networkidle' });
  await p.locator('[data-signup]').first().click();
  await p.waitForTimeout(500);
  await p.fill('[name="full_name"]', 'Мария Петрова');
  await p.fill('[name="phone"]', '0888123456');
  await p.fill('[name="email"]', 'maria@example.com');
  await p.check('[name="consent"]');
  await p.locator('[data-su-submit]').click();
  await p.waitForSelector('.su__msg', { timeout: 8000 });
  await p.close();
  const db = JSON.parse(await readFile('.data/db.json', 'utf8'));
  return db.registrations[db.registrations.length - 1].cancel_token;
}

const seats = async () => {
  const db = JSON.parse(await readFile('.data/db.json', 'utf8'));
  return db.registrations.filter((r) => r.status === 'confirmed').length;
};

// --- a link that points at nothing ------------------------------------------
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`${B}/otkazhi/ne-e-token`, { waitUntil: 'networkidle' });
  ok('a link that matches no booking says so straight away',
    (await h1(p)).includes('Не намирам'), await h1(p));
  ok('and does not offer to cancel anything',
    (await p.locator('form button[type="submit"]').count()) === 0);
  await p.close();
}

// --- a live booking ----------------------------------------------------------
const token = await book();
const before = await seats();
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`${B}/otkazhi/${token}`, { waitUntil: 'networkidle' });
  ok('a live booking asks before releasing the place', (await h1(p)).includes('Сигурен'), await h1(p));
  const lede = await p.locator('.cx__lede').first().innerText();
  ok('and says which workshop it is about',
    // \w is ASCII-only in JavaScript, so a Cyrillic month needs \p{L}
    lede.includes('Работилница по керамика') && /\d{1,2}\s+\p{L}+/u.test(lede),
    lede.replace(/\n/g, ' ').slice(0, 80));
  ok('no double full stop after the time', !lede.includes('ч..'));

  // opening the link must not release the seat on its own - mail scanners
  // and link previews issue GETs
  ok('merely opening the link changes nothing', (await seats()) === before, `${await seats()} confirmed`);

  await p.locator('form button[type="submit"]').click();
  await p.waitForLoadState('networkidle');
  ok('confirming releases the place', (await h1(p)).includes('Готово'), await h1(p));
  ok('the seat comes back', (await seats()) === before - 1, `${before} -> ${await seats()}`);
  await p.close();
}

// --- the same link, opened again ---------------------------------------------
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`${B}/otkazhi/${token}`, { waitUntil: 'networkidle' });
  ok('opening it again says it is already done', (await h1(p)).includes('Вече е отказано'), await h1(p));
  ok('and does not ask a second time',
    (await p.locator('form button[type="submit"]').count()) === 0);
  await p.close();
}

await rm('.data/db.json', { force: true });
await b.close();
let failed = 0;
for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? `  - ${r.d}` : ''}`); }
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
