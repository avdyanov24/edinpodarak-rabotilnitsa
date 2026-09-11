import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const failed = [];
p.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
for (const path of ['/', '/rabotilnitsa/glina-i-limonada-oktomvri', '/poveritelnost', '/usloviya']) {
  await p.goto('http://localhost:4321' + path, { waitUntil: 'networkidle' });
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.8) {
      scrollTo(0, y); await new Promise(r => setTimeout(r, 120));
    }
  });
  await p.waitForTimeout(900);
  const broken = await p.evaluate(() =>
    Array.from(document.images)
      // dialog/lightbox images have no src until opened — not a failure
      .filter(i => i.hasAttribute('src') && i.complete && i.naturalWidth === 0)
      .map(i => i.currentSrc || i.src));
  if (broken.length) failed.push(...broken.map(u => `broken img on ${path}: ${u}`));
}
await b.close();
console.log(failed.length ? failed.join('\n') : 'all images and requests OK');
