import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.evaluate(() => {
  const el = document.querySelector('#vaprosi');
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 40);
});
await p.waitForTimeout(600);
const items = p.locator('.faq__item');
const open = async () => p.evaluate(() => [...document.querySelectorAll('.faq__item')].map(d => d.open));
console.log('initial open state:', await open());
await items.nth(0).locator('summary').click();
await p.waitForTimeout(600);
console.log('after opening #1:', await open());
await items.nth(2).locator('summary').click();
await p.waitForTimeout(700);
console.log('after opening #3 (only one may stay open):', await open());
await p.screenshot({ path: 'shots/faq-open.png' });
await items.nth(2).locator('summary').click();
await p.waitForTimeout(700);
console.log('after clicking #3 again:', await open());
// keyboard reachable?
await p.keyboard.press('Tab');
console.log('focused tag after Tab:', await p.evaluate(() => document.activeElement.tagName));
await b.close();
