/** node tools/hover-shot.mjs <hoverSelector> <captureSelector> <out.png> */
import { chromium } from 'playwright';
const [hoverSel, capSel, out] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.evaluate(async () => {
  document.documentElement.style.scrollBehavior = 'auto';
  document.querySelectorAll('img[loading="lazy"]').forEach(i => (i.loading = 'eager'));
  for (let y = 0, g = 0; y <= document.documentElement.scrollHeight && g < 400; y += innerHeight * 0.6, g++) {
    scrollTo(0, y); await new Promise(r => setTimeout(r, 90));
  }
});
await p.evaluate((s) => {
  const el = document.querySelector(s);
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 40);
}, capSel);
await p.waitForTimeout(900);
await p.locator(hoverSel).hover();
await p.waitForTimeout(1100);
await p.locator(capSel).screenshot({ path: out });
await b.close();
console.log('wrote', out);
