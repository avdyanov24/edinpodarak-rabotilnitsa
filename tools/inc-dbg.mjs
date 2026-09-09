import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
console.log('hover:hover matches ->', await p.evaluate(() => matchMedia('(hover: hover)').matches));
console.log('pointer:fine     ->', await p.evaluate(() => matchMedia('(pointer: fine)').matches));
await p.locator('.inc').scrollIntoViewIfNeeded();
await p.waitForTimeout(600);
await p.locator('[data-item="4"] button').hover();
await p.waitForTimeout(800);
console.log('shown layers:', await p.evaluate(() =>
  [...document.querySelectorAll('.inc__photo')].map((e, i) => e.classList.contains('is-shown') ? i : null).filter(v => v !== null)));
console.log('active rows:', await p.evaluate(() =>
  [...document.querySelectorAll('.inc__item')].map((e, i) => e.classList.contains('is-active') ? i : null).filter(v => v !== null)));
await b.close();
