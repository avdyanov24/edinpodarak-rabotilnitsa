import { chromium } from 'playwright';
const BASE = process.env.CHECK_URL || 'http://localhost:4331/edinpodarak-rabotilnitsa';
const b = await chromium.launch({ channel: 'chrome' });
const problems = [];
for (const [name, w, h] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [], bad = [];
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('response', (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);

  const cards = await page.locator('.card').count();
  const brokenImgs = await page.evaluate(() =>
    [...document.images].filter((i) => (i.currentSrc || i.getAttribute('src')) && i.complete && i.naturalWidth === 0)
      .map((i) => i.currentSrc || i.src));
  if (cards !== 3) problems.push(`${name}: ${cards} event cards, expected 3`);
  if (brokenImgs.length) problems.push(`${name}: broken images ${brokenImgs.join(', ')}`);
  if (errs.length) problems.push(`${name}: console ${errs.join(' | ')}`);
  if (bad.length) problems.push(`${name}: failed requests ${bad.join(' | ')}`);
  await page.screenshot({ path: `shots/pages-${name}.png` });

  // sign-up fallback
  await page.locator('button[data-signup]:not([disabled])').first().click();
  await page.waitForTimeout(500);
  // The dialog behaves differently depending on whether there is a database
  // behind it. Read which mode the page is in rather than assuming.
  const online = await page.evaluate(() =>
    JSON.parse(document.querySelector('[data-su-brand]').textContent).online);
  const noteSeen = await page.locator('.su__small--note').first().isVisible().catch(() => false);
  if (online === noteSeen) {
    problems.push(`${name}: online=${online} but the email-fallback note ${noteSeen ? 'is' : 'is not'} shown`);
  }
  await page.screenshot({ path: `shots/pages-${name}-dialog.png` });

  // Only exercise the submit when it cannot reach a database — otherwise this
  // would book a real seat on a live site every time it runs. Booking against
  // a live database is tools/live-booking.mjs, deliberately separate.
  if (online) { await ctx.close(); continue; }

  // the email fallback: fill it in and make sure it reports honestly
  await page.fill('input[name="full_name"]', 'Мария Петрова');
  await page.fill('input[name="phone"]', '0888 123 456');
  await page.fill('input[name="email"]', 'maria@example.com');
  await page.check('input[name="consent"]');
  const mailto = new Promise((res) => {
    page.on('framenavigated', () => {});
    page.context().on('page', () => {});
    res(null);
  });
  await mailto;
  await page.click('[data-su-submit]');
  await page.waitForTimeout(600);
  const ok = await page.locator('.su__msg--ok').first().textContent().catch(() => '');
  if (!ok || !ok.includes('имейл')) problems.push(`${name}: email fallback did not confirm (got "${ok}")`);
  const stillHasFields = await page.locator('.su__fields').first().isVisible().catch(() => false);
  if (stillHasFields) problems.push(`${name}: form stayed open after the fallback`);
  await ctx.close();
}
await b.close();
console.log(problems.length ? problems.map((p) => '  ✗ ' + p).join('\n') : 'static export: no console errors, no failed requests, cards and dialog OK');
process.exit(problems.length ? 1 : 0);
