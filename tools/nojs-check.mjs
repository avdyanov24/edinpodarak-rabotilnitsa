import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });

// with JS
const on = await b.newPage({ viewport: { width: 1440, height: 900 } });
await on.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await on.waitForTimeout(2500);
const piece = await on.evaluate(() => {
  const el = document.querySelector('.hang--near');
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return { opacity: cs.opacity, display: cs.display, w: Math.round(r.width), h: Math.round(r.height) };
});
console.log('hero piece (JS on):', JSON.stringify(piece));

// without JS — the page must still be readable
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
const off = await ctx.newPage();
await off.goto('http://localhost:4321/', { waitUntil: 'load' });
await off.waitForTimeout(1200);
const noJs = await off.evaluate(() => {
  const words = [...document.querySelectorAll('.man__w')];
  const revealed = [...document.querySelectorAll('[data-reveal]')];
  return {
    manifestoWordColor: words.length ? getComputedStyle(words[0]).color : 'n/a',
    revealHidden: revealed.filter(e => getComputedStyle(e).opacity === '0').length,
    revealTotal: revealed.length,
    processPhotosHidden: [...document.querySelectorAll('.pr__media')]
      .filter(e => getComputedStyle(e).clipPath !== 'none').length,
  };
});
console.log('no-JS:', JSON.stringify(noJs, null, 1));
await b.close();
