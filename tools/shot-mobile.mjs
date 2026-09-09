/** Per-section mobile captures: node tools/shot-mobile.mjs <sel> <out.png> */
import { chromium } from 'playwright';
const [sel, out] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
});
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.evaluate(async () => {
  document.documentElement.style.scrollBehavior = 'auto';
  document.querySelectorAll('img[loading="lazy"]').forEach(i => (i.loading = 'eager'));
  for (let y = 0, g = 0; y <= document.documentElement.scrollHeight && g < 500; y += innerHeight * 0.6, g++) {
    scrollTo(0, y); await new Promise(r => setTimeout(r, 90));
  }
});
await p.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
await p.evaluate((s) => {
  const el = document.querySelector(s);
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 20);
}, sel);
await p.waitForTimeout(1300);
await p.locator(sel).screenshot({ path: out });
await b.close();
console.log('wrote', out);
