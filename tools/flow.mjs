/**
 * End-to-end check of the booking flow, with screenshots as evidence.
 *
 * It books, and it fills a workshop to the last seat to reach the waiting
 * list — so it starts from a clean seed, or the second run would find nothing
 * left to book. Only ever against the local file store; it will not touch a
 * deployed database.
 */
import { chromium } from 'playwright';
import { rm } from 'node:fs/promises';

const base = 'http://localhost:4321';
if (base.includes('localhost')) {
  await rm('.data/db.json', { force: true });
  await fetch(base).catch(() => {});   // reseeds from src/data/events.ts
}
const out = 'shots';
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); };

// ---------- desktop: open dialog, validate, submit ----------
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(base, { waitUntil: 'networkidle' });

await page.locator('[data-signup]').first().click();
await page.waitForTimeout(600);
ok('dialog opens', await page.locator('[data-signup-dialog]').isVisible());
ok('dialog shows the right event',
  (await page.locator('[data-su-title]').innerText()).includes('Работилница по керамика'),
  await page.locator('[data-su-title]').innerText());
ok('seats shown in dialog', /места|място/.test(await page.locator('[data-su-seats]').innerText()),
  await page.locator('[data-su-seats]').innerText());
// Three people is the smallest group she will run a workshop for. Whoever
// books the first place has to be told that here, not by telephone later.
ok('the dialog says how many it takes for the workshop to run',
  await page.locator('[data-su-min]').isVisible()
  && /3 записани/.test(await page.locator('[data-su-min]').innerText()),
  await page.locator('[data-su-min]').innerText().catch(() => 'hidden'));
await page.screenshot({ path: `${out}/flow-1-dialog.png` });

// submit empty -> Bulgarian errors, no request
await page.locator('[data-su-submit]').click();
await page.waitForTimeout(400);
const nameErr = await page.locator('[data-err="full_name"]').innerText();
ok('validation blocks empty submit', nameErr.length > 0, nameErr);
await page.screenshot({ path: `${out}/flow-2-validation.png` });

// bad phone
await page.fill('[name="full_name"]', 'Мария Петрова');
await page.fill('[name="phone"]', '123');
await page.fill('[name="email"]', 'not-an-email');
await page.locator('[data-su-submit]').click();
await page.waitForTimeout(300);
ok('phone validation', (await page.locator('[data-err="phone"]').innerText()).length > 0);
ok('email validation', (await page.locator('[data-err="email"]').innerText()).length > 0);

// consent required
await page.fill('[name="phone"]', '0888123456');
await page.fill('[name="email"]', 'maria@example.com');
await page.locator('[data-su-submit]').click();
await page.waitForTimeout(300);
ok('consent required', (await page.locator('[data-err="consent"]').innerText()).length > 0,
  await page.locator('[data-err="consent"]').innerText());

// valid submit
await page.check('[name="consent"]');
await page.locator('[data-su-submit]').click();
await page.waitForSelector('.su__msg', { timeout: 8000 });
let msg = await page.locator('.su__msg').innerText();
const msgAfter = () => msg;
ok('booking confirmed', /мястото е твое/i.test(msg), msg.replace(/\n/g, ' ').slice(0, 90));
// The whole success path sits inside the request's try/catch, so a bug in it
// shows the visitor „Нещо се обърка.“ over a booking that actually went
// through. Assert the state, not just that some message appeared.
ok('the confirmation is the success panel, not the error one',
  (await page.locator('.su__msg').getAttribute('class'))?.includes('su__msg--ok'),
  await page.locator('.su__msg').getAttribute('class'));
ok('and it is styled rather than bare text',
  await page.locator('.su__msg').evaluate((el) => {
    const cs = getComputedStyle(el);
    return parseFloat(cs.paddingTop) > 8 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
  }));
ok('the seat count corrects itself straight away',
  /7/.test(await page.locator('[data-su-seats]').innerText()),
  await page.locator('[data-su-seats]').innerText());
ok('form hidden after success', await page.locator('.su__fields').isHidden());
ok('and the confirmation is honest that the date is not certain yet',
  /тръгва при 3 записани/.test(msgAfter()) && /ще преместим датата/.test(msgAfter()),
  msgAfter().replace(/\n/g, ' ').slice(0, 140));
await page.screenshot({ path: `${out}/flow-3-success.png` });

// ---------- gallery lightbox ----------
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.locator('[data-lb]').first().scrollIntoViewIfNeeded();
await page.locator('[data-lb]').first().click();
await page.waitForTimeout(500);
ok('lightbox opens', await page.locator('[data-lb-dialog]').isVisible());
ok('lightbox counts the set', /1 \/ 9/.test(await page.locator('[data-lb-count]').innerText()),
  await page.locator('[data-lb-count]').innerText());
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(400);
ok('arrow keys move through the wall', /2 \/ 9/.test(await page.locator('[data-lb-count]').innerText()));
await page.screenshot({ path: `${out}/flow-4-lightbox.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// ---------- process timeline ----------
await page.locator('#kak-protica').scrollIntoViewIfNeeded();
await page.waitForTimeout(1200);
ok('timeline steps light up on scroll',
  (await page.locator('.pr__step.is-on').count()) > 0,
  `${await page.locator('.pr__step.is-on').count()} of 4 lit`);
ok('step photos wipe open',
  (await page.locator('.pr__step.is-on').count()) > 0);

// ---------- included: the list drives the picture ----------
await page.locator('.inc').scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
// hover twice: the first settles any scrolling, the second lands on the
// row where it actually ended up
await page.locator('[data-item="4"] button').hover();
await page.waitForTimeout(400);
await page.locator('[data-item="4"] button').hover();
await page.waitForTimeout(700);
ok('hovering a row swaps the photo',
  await page.locator('[data-layer="4"]').evaluate((el) => el.classList.contains('is-shown')));
ok('only one photo shown at a time',
  (await page.locator('.inc__photo.is-shown').count()) === 1);

// ---------- faq accordion ----------
await page.locator('#vaprosi').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.locator('.faq__item').nth(0).locator('summary').click();
await page.waitForTimeout(600);
await page.locator('.faq__item').nth(2).locator('summary').click();
await page.waitForTimeout(700);
ok('faq keeps only one answer open',
  (await page.locator('.faq__item[open]').count()) === 1,
  `${await page.locator('.faq__item[open]').count()} open`);

// ---------- waitlist on a sold-out event ----------
// Fill the workshop by writing the local store directly. Booking eight seats
// through /api/register would trip its own rate limit — which is the limiter
// doing its job, not something to work around by loosening it.
{
  const { readFile, writeFile } = await import('node:fs/promises');
  const { randomUUID } = await import('node:crypto');
  let db;
  try {
    db = JSON.parse(await readFile('.data/db.json', 'utf8'));
  } catch {
    await page.request.get(`${base}/`);       // force a seed
    db = JSON.parse(await readFile('.data/db.json', 'utf8').catch(() => 'null'));
  }
  if (db) {
    const ev = db.events.find((e) => e.status === 'published');
    const taken = db.registrations.filter((r) => r.event_id === ev.id && r.status === 'confirmed').length;
    for (let i = taken; i < ev.capacity; i++) {
      db.registrations.push({
        id: randomUUID(), event_id: ev.id, full_name: `Пълнеж ${i + 1} (тест)`,
        email: `pylnezh${i + 1}@example.com`, phone: '0888000000', people_count: 1,
        note: null, status: 'confirmed', consent_at: new Date().toISOString(),
        cancel_token: randomUUID(), created_at: new Date().toISOString(),
      });
    }
    await writeFile('.data/db.json', JSON.stringify(db, null, 2));
  }
}
await page.reload({ waitUntil: 'networkidle' });
const wl = page.locator('[data-waitlist="1"]').first();
ok('a sold-out workshop offers a waitlist', await wl.count() > 0);
if (await wl.count()) {
  await wl.scrollIntoViewIfNeeded();
  await wl.click();
  await page.waitForTimeout(500);
  const heading = await page.locator('#su-title').innerText();
  ok('waitlist wording differs', /чакащи/i.test(heading), heading);
  await page.screenshot({ path: `${out}/flow-5-waitlist.png` });
}
await page.close();

// ---------- mobile menu ----------
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await m.goto(base, { waitUntil: 'networkidle' });
await m.locator('[data-menu-toggle]').click();
await m.waitForTimeout(700);
ok('mobile menu opens', await m.locator('[data-menu]').isVisible());
await m.screenshot({ path: `${out}/flow-6-mobile-menu.png` });
await m.locator('.menu__link').first().click();
await m.waitForTimeout(500);
ok('mobile menu closes on nav', await m.locator('[data-menu]').isHidden());
await m.close();

// ---------- event page ----------
const e = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await e.goto(`${base}/rabotilnitsa/rabotilnitsa-po-keramika-17-septemvri`, { waitUntil: 'networkidle' });
ok('event page renders', (await e.locator('h1').innerText()).includes('Работилница по керамика'));
const ld = await e.locator('script[type="application/ld+json"]').innerText();
const parsed = JSON.parse(ld);
ok('Event JSON-LD present', parsed['@type'] === 'Event', `${parsed['@type']} / ${parsed.startDate}`);
ok('offer priced in EUR', parsed.offers?.priceCurrency === 'EUR', String(parsed.offers?.price));

// The same honesty on the page people reach from her story link. By now the
// booking above has taken one of the eight places, so two are still missing.
const minLine = e.locator('[data-min-note]');
const minText = await minLine.innerText().catch(() => '');
const seated = await e.locator('.ev__heroText .seats__stool.is-taken').count();
ok('the workshop page says whether the date is happening',
  await minLine.isVisible() && /(тръгва при 3 записани|Групата е събрана)/.test(minText),
  minText.slice(0, 120));
// The sentence and the stools drawn beside it are two views of one number.
ok('and it agrees with the seats drawn next to it',
  seated >= 3 ? /Групата е събрана/.test(minText) : /тръгва при 3 записани/.test(minText),
  `${seated} seated · ${minText.slice(0, 60)}`);
ok('and it reads as something to act on, not as body text',
  await minLine.evaluate((el) => getComputedStyle(el).color !== getComputedStyle(el.closest('.ev__heroText').querySelector('.ev__summary')).color));
await e.close();

await browser.close();

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
