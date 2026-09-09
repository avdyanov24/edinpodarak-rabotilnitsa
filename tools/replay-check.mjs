/**
 * Every scroll animation must play again on a second pass, not just on load.
 * Scrolls down, back to the top, then down again and re-checks each one.
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const results = [];
const ok = (n, pass, d = '') => results.push({ n, pass, d });

await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
await p.waitForTimeout(700);

const to = async (sel, off = -120) => {
  await p.evaluate(([s, o]) => {
    const el = document.querySelector(s);
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + o);
  }, [sel, off]);
  await p.waitForTimeout(1100);
};
const top = async () => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1100); };

const revealed = () => p.evaluate(() => document.querySelectorAll('[data-reveal].is-in').length);
const lit      = () => p.evaluate(() => document.querySelectorAll('.man__w.is-lit').length);
const stepsOn  = () => p.evaluate(() => document.querySelectorAll('.pr__step.is-on').length);
// fully open computes to inset(0px); still closed keeps a bottom inset
const wiped    = () => p.evaluate(() =>
  [...document.querySelectorAll('.pr__media')]
    .filter(e => /^inset\(0px\)$/.test(getComputedStyle(e).clipPath)).length);

// ---------- pass 1 ----------
await to('#galeriya');
const r1 = await revealed();
await to('.man__text', -200);
const l1 = await lit();
await to('#kak-protica', 400);
const s1 = await stepsOn();
const w1 = await wiped();
ok('pass 1: reveals fired', r1 > 0, `${r1} revealed`);
ok('pass 1: manifesto lit', l1 > 0, `${l1} words`);
ok('pass 1: timeline lit', s1 > 0, `${s1}/4 steps`);
ok('pass 1: photos wiped open', w1 > 0, `${w1}/4 open`);

// ---------- back to the top: everything must reset ----------
await top();
const r0 = await p.evaluate(() =>
  [...document.querySelectorAll('[data-reveal]')].filter(e => !e.classList.contains('is-in')).length);
const l0 = await lit();
const s0 = await stepsOn();
const w0 = await wiped();
ok('reset: reveals re-armed', r0 > 0, `${r0} hidden again`);
ok('reset: manifesto dimmed', l0 === 0, `${l0} still lit`);
ok('reset: timeline dark', s0 === 0, `${s0} still lit`);
ok('reset: photos re-clipped', w0 === 0, `${w0} still open`);

// hero entrance restarts
const heroReplayed = await p.evaluate(() => {
  const el = document.querySelector('.hero__eyebrow');
  const a = el.getAnimations();
  // a freshly restarted animation is near the beginning of its 1s run
  return a.length > 0 && a[0].currentTime !== null && a[0].currentTime < 2500;
});
ok('reset: hero entrance restarted', heroReplayed);

// ---------- pass 2 ----------
await to('#galeriya');
const r2 = await revealed();
await to('.man__text', -200);
const l2 = await lit();
await to('#kak-protica', 400);
const s2 = await stepsOn();
const w2 = await wiped();
ok('pass 2: reveals fired again', r2 > 0, `${r2} revealed`);
ok('pass 2: manifesto lit again', l2 > 0, `${l2} words`);
ok('pass 2: timeline lit again', s2 > 0, `${s2}/4 steps`);
ok('pass 2: photos wiped again', w2 > 0, `${w2}/4 open`);

// ---------- hysteresis: half-scrolled content must not fade out ----------
await to('.tm', -200);
await p.waitForTimeout(700);
const partial = await p.evaluate(() => {
  const card = document.querySelector('.tm__item');
  // park it half off the top of the screen
  const r = card.getBoundingClientRect();
  window.scrollTo(0, r.top + window.scrollY + r.height / 2);
  return true;
});
await p.waitForTimeout(800);
const stillIn = await p.evaluate(() => {
  const card = document.querySelector('.tm__item');
  const r = card.getBoundingClientRect();
  return {
    onScreen: r.bottom > 0 && r.top < window.innerHeight,
    revealed: card.classList.contains('is-in'),
    opacity: getComputedStyle(card).opacity,
  };
});
ok('half-visible content stays revealed',
  !stillIn.onScreen || (stillIn.revealed && stillIn.opacity === '1'),
  JSON.stringify(stillIn));

await b.close();
let failed = 0;
for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? `  — ${r.d}` : ''}`); }
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
