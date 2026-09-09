/** Captures the credit at its four moments, finding the glint's real peak. */
import { chromium } from 'playwright';
import sharp from 'sharp';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });

const box = async () => {
  const r = await p.locator('.ft__credit').boundingBox();
  return { x: r.x - 30, y: r.y - 30, width: r.width + 60, height: r.height + 58 };
};

const replay = async () => {
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(900);
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
};

await replay();
await p.waitForTimeout(240);
await p.screenshot({ path: 'shots/credit-1-arriving.png', clip: await box() });

// hunt the brightest frame of the sweep rather than guessing at a delay
await replay();
const clip = await box();
let best = { mean: -1, buf: null };
for (let i = 0; i < 18; i++) {
  const buf = await p.screenshot({ clip });
  const { channels } = await sharp(buf).stats();
  const mean = (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
  if (mean > best.mean) best = { mean, buf };
  await p.waitForTimeout(90);
}
await sharp(best.buf).toFile('shots/credit-2-glint.png');

await p.waitForTimeout(1500);
await p.screenshot({ path: 'shots/credit-3-rest.png', clip: await box() });
await p.locator('[data-studio]').hover();
await p.waitForTimeout(500);
await p.screenshot({ path: 'shots/credit-4-hover.png', clip: await box() });
await b.close();
console.log(`captured; glint peak mean ${best.mean.toFixed(1)}`);
