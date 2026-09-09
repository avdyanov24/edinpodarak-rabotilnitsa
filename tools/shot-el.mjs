/** Screenshot one element: node tools/shot-el.mjs <selector> <out.png> [width] */
import { chromium } from 'playwright';
const [sel, out, w = '1440', mode = 'inview'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: Number(w), height: 1000 } });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.evaluate(async () => {
  document.documentElement.style.scrollBehavior = 'auto';
  document.querySelectorAll('img[loading="lazy"]').forEach(i => (i.loading = 'eager'));
  for (let y = 0, g = 0; y <= document.documentElement.scrollHeight && g < 400; y += innerHeight * 0.6, g++) {
    scrollTo(0, y); await new Promise(r => setTimeout(r, 100));
  }
});
await p.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
if (mode === 'top') {
  await p.evaluate(() => window.scrollTo(0, 0));
} else {
  // land where a visitor would when the section comes up
  await p.evaluate((s) => {
    const el = document.querySelector(s);
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 40);
  }, sel);
}
await p.waitForTimeout(1400);
await p.waitForTimeout(700);
await p.locator(sel).screenshot({ path: out });
await b.close();
console.log('wrote', out);
