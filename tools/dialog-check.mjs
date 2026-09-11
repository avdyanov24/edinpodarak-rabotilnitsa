/**
 * The booking dialog is the one screen the whole site exists for.
 *
 * It shipped with the form growing past the dialog's max-height and being
 * clipped by overflow:hidden, with nothing scrollable — so on a 900px-tall
 * display "Запиши ме" was off-screen and could not be reached with a mouse
 * at all. These checks are here so that cannot come back quietly.
 */
import { chromium } from 'playwright';

const B = process.env.CHECK_URL || 'http://localhost:4321';

// flow.mjs fills the workshop to its last seat to reach the waiting list, and
// leaves it that way. A sold-out event opens the dialog in waitlist form,
// which has no places selector — so run after it, these checks would fail on
// a dialog that is behaving perfectly. Start from a clean seed instead.
if (B.includes('localhost')) {
  const { rm } = await import('node:fs/promises');
  await rm('.data/db.json', { force: true });
  await fetch(B).catch(() => {});
}
const b = await chromium.launch({ channel: 'chrome' });
const results = [];
const ok = (n, pass, d = '') => results.push({ n, pass, d });

for (const [label, w, h] of [
  ['desktop 1440×900', 1440, 900],
  ['laptop 1280×720', 1280, 720],
  ['phone 390×844', 390, 844],
  ['small phone 360×740', 360, 740],
]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(`${B}/`, { waitUntil: 'networkidle' });
  await p.locator('.card button[data-signup]:not([disabled])').first().click();
  await p.waitForTimeout(600);

  const inView = async (sel) => {
    const box = await p.locator(sel).boundingBox();
    return Boolean(box) && box.y >= 0 && box.y + box.height <= h;
  };

  ok(`${label}: the submit button is visible without scrolling`, await inView('[data-su-submit]'));
  ok(`${label}: the name field is visible without scrolling`, await inView('input[name="full_name"]'));

  // a real person scrolls with the wheel, not with scrollTop
  await p.mouse.move(w / 2, h / 2);
  for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, 220); await p.waitForTimeout(50); }
  ok(`${label}: the consent box can be reached by scrolling`, await inView('input[name="consent"]'));
  ok(`${label}: the submit button stays put while scrolling`, await inView('[data-su-submit]'));

  if (w > 780) {
    const [phone, email] = await Promise.all([
      p.locator('input[name="phone"]').boundingBox(),
      p.locator('input[name="email"]').boundingBox(),
    ]);
    ok(`${label}: phone and email are the same width`, Math.abs(phone.width - email.width) < 2,
       `${Math.round(phone.width)} vs ${Math.round(email.width)}`);
    ok(`${label}: phone and email share a row`, Math.abs(phone.y - email.y) < 2);
  }

  // the running total
  const one = (await p.locator('[data-su-sum]').innerText()).trim();
  await p.selectOption('[data-su-people]', '2').catch(() => {});
  await p.waitForTimeout(150);
  const two = (await p.locator('[data-su-sum]').innerText()).trim();
  ok(`${label}: the total follows the number of places`, one !== two && /€/.test(two), `"${one}" → "${two}"`);

  // escape closes it and hands focus back
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  ok(`${label}: Escape closes it`, !(await p.locator('[data-signup-dialog]').isVisible()));

  await p.close();
}

await b.close();
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  — ' + r.d : ''}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
