/**
 * The mobile menu.
 *
 * It used to hold the page still with `body { overflow: hidden }`, which
 * Safari on iOS ignores: the page scrolled on behind the menu and closing it
 * left you somewhere else. And `inset: 0` on a fixed element is the layout
 * viewport, which on iOS extends behind the browser bars — so the button at
 * the bottom of the menu was under them.
 */
import { chromium } from 'playwright';

const B = process.env.CHECK_URL || 'http://localhost:4321';
const b = await chromium.launch({ channel: 'chrome' });
const results = [];
const ok = (n, pass, d = '') => results.push({ n, pass, d });

for (const [label, w, h] of [['phone 390×844', 390, 844], ['small 360×740', 360, 740]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  await p.goto(`${B}/`, { waitUntil: 'networkidle' });

  // open it from part-way down the page, which is where people actually are
  await p.evaluate(() => window.scrollTo(0, 1800));
  await p.waitForTimeout(400);
  const before = await p.evaluate(() => Math.round(scrollY));

  await p.locator('[data-menu-toggle]').click();
  await p.waitForTimeout(500);

  const open = await p.evaluate(() => {
    const menu = document.querySelector('[data-menu]');
    const foot = document.querySelector('.menu__foot');
    const r = menu.getBoundingClientRect();
    return {
      covers: Math.round(r.top) === 0 && Math.round(r.height) >= innerHeight - 1,
      footInView: foot.getBoundingClientRect().bottom <= innerHeight + 1,
      pinned: getComputedStyle(document.body).position === 'fixed',
      canScroll: document.documentElement.scrollHeight > innerHeight + 1,
    };
  });
  ok(`${label}: the menu covers the screen`, open.covers);
  ok(`${label}: the button at the bottom is reachable`, open.footInView);
  ok(`${label}: the page underneath is pinned`, open.pinned);
  ok(`${label}: nothing behind it can scroll`, !open.canScroll);

  // scroll hard, let it settle, then close — the realistic sequence
  await p.mouse.move(w / 2, h / 2);
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 400); await p.waitForTimeout(60); }
  const during = await p.evaluate(() => Math.round(scrollY));
  ok(`${label}: scrolling does nothing while it is open`, during === 0, `scrollY ${during}`);

  await p.waitForTimeout(500);
  await p.locator('[data-menu-toggle]').click();
  await p.waitForTimeout(700);
  const after = await p.evaluate(() => Math.round(scrollY));
  ok(`${label}: closing puts you back where you were`, Math.abs(after - before) <= 2, `${before} → ${after}`);

  // a link closes the menu and jumps
  await p.locator('[data-menu-toggle]').click();
  await p.waitForTimeout(400);
  await p.locator('.menu__link').first().click();
  await p.waitForTimeout(700);
  const closed = await p.evaluate(() => ({
    hidden: document.querySelector('[data-menu]').hidden,
    pinned: getComputedStyle(document.body).position === 'fixed',
  }));
  ok(`${label}: following a link closes it`, closed.hidden);
  ok(`${label}: and unpins the page`, !closed.pinned);

  // escape
  await p.locator('[data-menu-toggle]').click();
  await p.waitForTimeout(400);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  ok(`${label}: Escape closes it`, await p.evaluate(() => document.querySelector('[data-menu]').hidden));

  const t = await p.locator('[data-menu-toggle]').boundingBox();
  ok(`${label}: the toggle is a thumb-sized target`, t.width >= 40 && t.height >= 40,
     `${Math.round(t.width)}×${Math.round(t.height)}`);

  await ctx.close();
}

await b.close();
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  — ' + r.d : ''}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
