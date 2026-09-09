/**
 * Full-page capture by stitching real viewport frames while scrolling down.
 * Chrome's own fullPage mode resizes the viewport, which re-fires every
 * scroll-driven animation and captures them in their re-armed state —
 * so scroll-linked sections come out blank. This sees what a visitor sees.
 *
 *   node tools/scrollshot.mjs [url] [out.png] [width] [height]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';

const [url = 'http://localhost:4321/', out = 'shots/scroll-full.png',
       width = '1440', height = '900'] = process.argv.slice(2);

const W = Number(width), H = Number(height);
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.goto(url, { waitUntil: 'networkidle' });
await p.evaluate(() => {
  document.documentElement.style.scrollBehavior = 'auto';
  document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
});
await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
await p.waitForTimeout(600);

const total = await p.evaluate(() => document.documentElement.scrollHeight);
const frames = [];
for (let y = 0; y < total; y += H) {
  await p.evaluate((v) => window.scrollTo(0, v), y);
  await p.waitForTimeout(700); // let entrances for this screenful finish
  const actual = await p.evaluate(() => window.scrollY);
  frames.push({ y: actual, buf: await p.screenshot() });
  // the fixed bar would otherwise be stamped into every stitch seam
  if (frames.length === 1) {
    await p.addStyleTag({ content: '.hdr, .sticky { visibility: hidden !important; }' });
  }
  if (actual + H >= total) break;
}

await sharp({ create: { width: W, height: total, channels: 4, background: '#FBF8F1' } })
  .composite(frames.map((f) => ({ input: f.buf, top: f.y, left: 0 })))
  .toFile(out);
await b.close();
console.log(`${out} — ${W}x${total} from ${frames.length} frames`);
