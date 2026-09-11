/**
 * The card people see when the link is shared.
 *
 * It used to be the hero's forest still — a handsome photograph that says
 * nothing about whose workshop it is. This composes a real card from one of
 * Джейля's own pieces, in the site's own typefaces, at the 1.91:1 that
 * Facebook, Instagram and Messenger crop to.
 *
 *   node tools/make-og.mjs        → public/media/og.jpg
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const b64 = async (p, mime) => `data:${mime};base64,${(await readFile(join(root, p))).toString('base64')}`;

const [display, sans, photo, logo] = await Promise.all([
  b64('node_modules/@fontsource/playfair-display/files/playfair-display-cyrillic-500-normal.woff2', 'font/woff2'),
  b64('node_modules/@fontsource-variable/manrope/files/manrope-cyrillic-wght-normal.woff2', 'font/woff2'),
  b64('public/media/her/chiniya.webp', 'image/webp'),
  b64('public/media/logo-djeilya.png', 'image/png'),
]);

const html = `<!doctype html><meta charset="utf-8">
<style>
  @font-face { font-family: 'PD'; src: url('${display}') format('woff2'); font-weight: 500; }
  @font-face { font-family: 'MR'; src: url('${sans}') format('woff2'); font-weight: 400 700; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; }
  /* The work gets its own panel rather than sitting behind the words. */
  .card { position: relative; width: 1200px; height: 630px; background: #0E2117; }
  .card img.bg {
    position: absolute; top: 0; right: 0; width: 500px; height: 630px;
    object-fit: cover;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 26%);
    mask-image: linear-gradient(90deg, transparent, #000 26%);
  }
  .scrim { position: absolute; inset: 0; background: linear-gradient(90deg, #0E2117 44%, transparent 66%); }
  .in { position: absolute; inset: 0; padding: 70px 76px; display: flex; flex-direction: column; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 16px; }
  .brand img { width: 56px; height: 56px; border-radius: 50%; }
  .brand span { font-family: 'MR'; font-size: 20px; letter-spacing: 0.16em; text-transform: uppercase; color: #C9D8B6; font-weight: 700; }
  h1 { font-family: 'PD'; font-weight: 500; font-size: 74px; line-height: 1.06; color: #F4EEE2; }
  h1 em { font-style: normal; color: #A8C48A; }
  p { font-family: 'MR'; font-size: 25px; color: rgba(244,238,226,0.78); margin-top: 20px; line-height: 1.45; }
  .foot { font-family: 'MR'; font-size: 22px; color: #C9D8B6; letter-spacing: 0.02em; display: flex; gap: 28px; align-items: center; }
  .dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(201,216,182,0.6); }
</style>
<div class="card">
  <img class="bg" src="${photo}">
  <div class="scrim"></div>
  <div class="in">
    <div class="brand"><img src="${logo}"><span>Работилница с Джейля</span></div>
    <div>
      <h1>Направи си<br><em>нещо свое</em></h1>
      <p>Два часа с глина,<br>без бързане и без опит.</p>
    </div>
    <div class="foot">
      <span>Гоце Делчев</span><span class="dot"></span>
      <span>25 € · всичко включено</span><span class="dot"></span>
      <span>Записване онлайн</span>
    </div>
  </div>
</div>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();

const out = join(root, 'public/media/og.jpg');
await writeFile(out, await sharp(png).resize(1200, 630).jpeg({ quality: 86, mozjpeg: true }).toBuffer());
const { size } = await import('node:fs').then((m) => m.promises.stat(out));
console.log(`public/media/og.jpg — 1200×630, ${(size / 1024).toFixed(0)} KB`);
