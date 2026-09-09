import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
// stop part-way so the half-lit state is visible
await p.evaluate(() => {
  const el = document.querySelector('.man__text');
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.18);
});
await p.waitForTimeout(900);
console.log('lit:', await p.evaluate(() => `${document.querySelectorAll('.man__w.is-lit').length}/${document.querySelectorAll('.man__w').length}`));
await p.locator('.man').screenshot({ path: 'shots/manifesto-mid.png' });
await b.close();
