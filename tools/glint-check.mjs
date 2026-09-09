/** Samples the name's brightness across the sweep — the glint must show up. */
import { chromium } from 'playwright';
import sharp from 'sharp';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await p.waitForTimeout(120);
const r = await p.locator('.st__word').boundingBox();
const clip = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };

const means = [];
for (let i = 0; i < 16; i++) {
  const buf = await p.screenshot({ clip });
  const { channels } = await sharp(buf).stats();
  means.push(Number(((channels[0].mean + channels[1].mean + channels[2].mean) / 3).toFixed(1)));
  await p.waitForTimeout(120);
}
await b.close();
const base = Math.min(...means);
const peak = Math.max(...means);
console.log('brightness over the sweep:', means.join(' '));
console.log(`base ${base} -> peak ${peak}  (lift ${(peak - base).toFixed(1)})`);
console.log(peak - base >= 4 ? 'glint is visible' : 'GLINT TOO SUBTLE');
