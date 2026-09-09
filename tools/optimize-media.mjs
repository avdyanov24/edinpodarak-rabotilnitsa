/**
 * One-off: shrink the raw photos pulled from the shop and Instagram.
 * Re-runnable — it skips anything already converted.
 */
import sharp from 'sharp';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';

const dirs = ['public/media/gallery', 'public/media/workshop', 'public/media/texture'];
const MAX = 1400;
let before = 0, after = 0;

for (const dir of dirs) {
  for (const name of await readdir(dir)) {
    const ext = extname(name).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) continue;
    const src = join(dir, name);
    const dest = join(dir, name.replace(/\.(png|jpe?g)$/i, '.webp'));
    before += (await stat(src)).size;
    await sharp(src)
      .resize({ width: MAX, withoutEnlargement: true })
      .webp({ quality: 78, effort: 5 })
      .toFile(dest);
    after += (await stat(dest)).size;
    await unlink(src);
  }
}

// the logo keeps alpha and stays a PNG (apple-touch-icon needs one)
const logo = 'public/media/logo-djeilya.png';
before += (await stat(logo)).size;
const buf = await sharp(logo).resize({ width: 320 }).png({ quality: 82, compressionLevel: 9 }).toBuffer();
await sharp(buf).toFile(logo);
after += (await stat(logo)).size;

const mb = (n) => (n / 1024 / 1024).toFixed(1);
console.log(`${mb(before)} MB -> ${mb(after)} MB`);
