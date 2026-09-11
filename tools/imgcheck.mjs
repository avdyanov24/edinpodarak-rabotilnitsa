import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const failed = [];
p.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
for (const path of ['/', '/rabotilnitsa/rabotilnitsa-po-keramika-17-septemvri', '/poveritelnost', '/usloviya']) {
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

/**
 * Two things that look like taste but are arithmetic.
 *
 * WRONG width/height: the gallery builds each frame from the `w`/`h` in
 * site.ts, so a number that disagrees with the file gives the frame the wrong
 * shape and object-fit silently crops the photograph to fit it. Two entries
 * had landscape and portrait swapped and the tiles had been cropped in half
 * for weeks without anything failing.
 *
 * UPSCALING: every photograph here was cut out of a Facebook poster, so none
 * is larger than about 800px. Shown wider than it really is, it turns to mush
 * — which is what the one workshop card did at full width.
 */
const problems = [];
{
  const { readFileSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  const src = readFileSync('src/data/site.ts', 'utf8');
  for (const m of src.matchAll(/\{ src: '([^']+)', w: (\d+), h: (\d+)/g)) {
    const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', `public${m[1]}`], { encoding: 'utf8' });
    const w = +out.match(/pixelWidth: (\d+)/)[1];
    const h = +out.match(/pixelHeight: (\d+)/)[1];
    if (w !== +m[2] || h !== +m[3]) {
      problems.push(`declared size is wrong: ${m[1]} says ${m[2]}x${m[3]}, file is ${w}x${h}`);
    }
  }
}
{
  const b2 = await chromium.launch({ channel: 'chrome' });
  // Every page, not just the home page: the event page had the same cover
  // stretched from 520px to 526 in a 4:5 frame and nothing caught it.
  const pages = ['/', '/rabotilnitsa/rabotilnitsa-po-keramika-17-septemvri'];
  for (const [label, width, height] of [['desktop', 1440, 900], ['tablet', 820, 1180], ['phone', 390, 844]])
  for (const page of pages) {
    const q = await b2.newPage({ viewport: { width, height } });
    await q.goto('http://localhost:4321' + page, { waitUntil: 'networkidle' });
    await q.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.8) {
        scrollTo(0, y); await new Promise(r => setTimeout(r, 110));
      }
    });
    await q.waitForTimeout(800);
    const up = await q.evaluate(() => Array.from(document.images)
      .filter((i) => i.naturalWidth && i.getBoundingClientRect().width / i.naturalWidth > 1.2)
      .map((i) => `${i.getAttribute('src')} is ${i.naturalWidth}px wide, shown at ${Math.round(i.getBoundingClientRect().width)}px`));
    problems.push(...up.map((u) => `upscaled on ${label}${page}: ${u}`));
    await q.close();
  }
  await b2.close();
}

const all = [...failed, ...problems];
console.log(all.length ? all.join('\n') : 'all images and requests OK');
process.exit(all.length ? 1 : 0);
