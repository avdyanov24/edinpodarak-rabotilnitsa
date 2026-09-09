// Slice a tall full-page PNG into readable strips.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [file, outPrefix, stripH = '1400'] = process.argv.slice(2);
const b64 = readFileSync(file).toString('base64');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.setContent(`<img id="i" src="data:image/png;base64,${b64}">`);
const { w, h } = await page.evaluate(() => new Promise((res) => {
  const i = document.getElementById('i');
  const done = () => res({ w: i.naturalWidth, h: i.naturalHeight });
  i.complete ? done() : (i.onload = done);
}));
const step = Number(stripH);
for (let n = 0, y = 0; y < h; y += step, n++) {
  await page.setViewportSize({ width: w, height: Math.min(step, h - y) });
  await page.evaluate((off) => { document.getElementById('i').style.marginTop = `-${off}px`; document.body.style.margin='0'; }, y);
  await page.screenshot({ path: `${outPrefix}-${String(n + 1).padStart(2, '0')}.png` });
}
await browser.close();
console.log(`${w}x${h} -> ${Math.ceil(h / step)} strips`);
