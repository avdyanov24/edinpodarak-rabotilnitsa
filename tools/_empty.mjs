import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
for (const [name, w, h] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.querySelector('#rabotilnitsi').scrollIntoView());
  await p.waitForTimeout(1200);
  await p.locator('#rabotilnitsi').screenshot({ path: `shots/empty-${name}.png` });
  const txt = (await p.locator('#rabotilnitsi').innerText()).replace(/\s+/g, ' ').slice(0, 260);
  console.log(`${name}: ${txt}`);
  // is the sticky bar sane with no events?
  console.log(`  sticky bar shown: ${await p.locator('[data-sticky]').isVisible()}`);
  console.log(`  hero ticker shown: ${await p.locator('.ticker').isVisible().catch(() => false)}`);
  await ctx.close();
}
await b.close();
