/**
 * Guards the scroll animations that are easy to break silently:
 * they must start hidden with JS on, finish visible after scrolling,
 * and be fully visible with JS off.
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass, detail });

// --- with JS ---
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.waitForTimeout(600);

const dim = (i) => p.evaluate((n) => {
  const w = document.querySelectorAll('.man__w');
  return getComputedStyle(w[n]).color;
}, i);

const faintStart = await dim(0);
ok('manifesto starts faint', /0\.16|, 0\.16\)/.test(faintStart) || faintStart.includes('0.16'), faintStart);

// scroll the manifesto through the viewport, then check the words lit in order
await p.evaluate(() => {
  const el = document.querySelector('.man__text');
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.15);
});
await p.waitForTimeout(900);
const lit = await p.evaluate(() => document.querySelectorAll('.man__w.is-lit').length);
const total = await p.evaluate(() => document.querySelectorAll('.man__w').length);
ok('manifesto lights word by word', lit > 0 && lit <= total, `${lit}/${total} lit mid-scroll`);

await p.evaluate(() => {
  const el = document.querySelector('.man__text');
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + el.offsetHeight);
});
await p.waitForTimeout(900);
const litEnd = await p.evaluate(() => document.querySelectorAll('.man__w.is-lit').length);
ok('manifesto fully lit once passed', litEnd === total, `${litEnd}/${total}`);

// process photo wipe must be armed (clipped) before its step is reached
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(500);
const clipped = await p.evaluate(() =>
  [...document.querySelectorAll('.pr__media')].filter(e => getComputedStyle(e).clipPath !== 'none').length);
ok('process wipe armed', clipped === 4, `${clipped}/4 clipped`);

await p.evaluate(() => {
  const el = document.querySelector('#kak-protica');
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + 400);
});
await p.waitForTimeout(1400);
const opened = await p.evaluate(() => document.querySelectorAll('.pr__step.is-on').length);
ok('process wipe opens on scroll', opened > 0, `${opened}/4 opened`);
await p.close();

// --- without JS: nothing may stay hidden ---
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
const off = await ctx.newPage();
await off.goto('http://localhost:4321/', { waitUntil: 'load' });
await off.waitForTimeout(1000);
const noJs = await off.evaluate(() => ({
  faintWords: [...document.querySelectorAll('.man__w')]
    .filter(w => getComputedStyle(w).color.includes('0.16')).length,
  hiddenReveals: [...document.querySelectorAll('[data-reveal]')]
    .filter(e => getComputedStyle(e).opacity === '0').length,
  clippedPhotos: [...document.querySelectorAll('.pr__media')]
    .filter(e => getComputedStyle(e).clipPath !== 'none').length,
}));
ok('no-JS: manifesto readable', noJs.faintWords === 0, `${noJs.faintWords} faint`);
ok('no-JS: nothing hidden', noJs.hiddenReveals === 0, `${noJs.hiddenReveals} hidden`);
ok('no-JS: photos not clipped', noJs.clippedPhotos === 0, `${noJs.clippedPhotos} clipped`);

await b.close();
let failed = 0;
for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`); }
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
