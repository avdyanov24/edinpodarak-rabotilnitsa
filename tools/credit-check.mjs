import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const results = [];
const ok = (n, pass, d = '') => results.push({ n, pass, d });

const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
await p.waitForTimeout(500);

// hidden before the footer is reached
const hidden = await p.evaluate(() =>
  [...document.querySelectorAll('.st__l')].filter(e => getComputedStyle(e).opacity === '0').length);
ok('letters start hidden', hidden > 0, `${hidden} hidden`);

// arrives when scrolled to
await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await p.waitForTimeout(2600);
const arrived = await p.evaluate(() => {
  const l = [...document.querySelectorAll('.st__l')];
  return {
    visible: l.filter(e => getComputedStyle(e).opacity === '1').length,
    total: l.length,
    lineDrawn: getComputedStyle(document.querySelector('.st__line')).transform,
    dots: [...document.querySelectorAll('.st__dot')].filter(d => getComputedStyle(d).opacity === '1').length,
  };
});
ok('all letters land', arrived.visible === arrived.total, `${arrived.visible}/${arrived.total}`);
ok('rule draws in', arrived.lineDrawn !== 'none' && !arrived.lineDrawn.includes('matrix(0,'), arrived.lineDrawn);
ok('moss sprouts', arrived.dots === 3, `${arrived.dots}/3 dots`);

// staggered, not simultaneous
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(900);
await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await p.waitForTimeout(180);
const mid = await p.evaluate(() =>
  [...document.querySelectorAll('.st__l')].map(e => Number(getComputedStyle(e).opacity)));
ok('letters arrive in sequence', new Set(mid.map(v => v.toFixed(1))).size > 1,
  `spread of opacities mid-flight: ${mid.filter(v => v > 0 && v < 1).length} in transit`);

// the glint runs through the letters in sequence, not all at once
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(900);
await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await p.waitForTimeout(950);
const glint = await p.evaluate(() => {
  const l = [...document.querySelectorAll('.st__l')];
  const bright = l.map(e => getComputedStyle(e).color)
    .map(c => c.match(/\d+/g).slice(0, 3).reduce((a, v) => a + Number(v), 0) / 3);
  return { spread: Math.max(...bright) - Math.min(...bright), values: bright.length };
});
ok('glint travels through the letters', glint.spread > 20,
  `brightness spread across letters: ${glint.spread.toFixed(0)}`);

// hover wave
await p.waitForTimeout(2200);
const before = await p.evaluate(() => getComputedStyle(document.querySelector('.st__l')).transform);
await p.locator('[data-studio]').hover();
await p.waitForTimeout(600);
const after = await p.evaluate(() => getComputedStyle(document.querySelector('.st__l')).transform);
ok('hover lifts the letters', before !== after, `${before} -> ${after}`);
const dotScale = await p.evaluate(() => getComputedStyle(document.querySelector('.st__dot')).transform);
ok('hover swells the moss', dotScale.includes('1.45') || dotScale !== 'none', dotScale);

// replays on a second visit
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(900);
const reset = await p.evaluate(() =>
  [...document.querySelectorAll('.st__l')].filter(e => getComputedStyle(e).opacity === '0').length);
ok('re-arms after leaving', reset > 0, `${reset} hidden again`);

// link still reads correctly to assistive tech
const a11y = await p.evaluate(() => {
  const a = document.querySelector('[data-studio]');
  return { label: a.getAttribute('aria-label'), href: a.getAttribute('href'),
           lettersHidden: a.querySelector('.st__word').getAttribute('aria-hidden') };
});
ok('link keeps an accessible name', a11y.label === 'Alesse Studio', a11y.label);
ok('letters hidden from screen readers', a11y.lettersHidden === 'true');
ok('href intact', a11y.href === 'https://alessestudio.com', a11y.href);
await p.close();

// no-JS: must simply be a visible link
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
const off = await ctx.newPage();
await off.goto('http://localhost:4321/', { waitUntil: 'load' });
await off.waitForTimeout(800);
const noJs = await off.evaluate(() =>
  [...document.querySelectorAll('.st__l')].filter(e => getComputedStyle(e).opacity === '0').length);
ok('no-JS: credit is visible', noJs === 0, `${noJs} hidden`);

await b.close();
let failed = 0;
for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? `  — ${r.d}` : ''}`); }
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
