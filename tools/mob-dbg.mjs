import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.evaluate(() => { const e = document.querySelector('#kak-protica'); scrollTo(0, e.getBoundingClientRect().top + scrollY - 20); });
await p.waitForTimeout(900);
console.log(await p.evaluate(() => JSON.stringify({
  stepPositionCtx: [...document.querySelectorAll('.pr__step')].map(s => getComputedStyle(s).position),
  markBoxes: [...document.querySelectorAll('.pr__mark')].map(m => {
    const r = m.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  }),
  atVisible: [...document.querySelectorAll('.pr__at')].map(a => {
    const r = a.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), text: a.textContent };
  }),
}, null, 1)));
await b.close();
