/**
 * Design review captures. Usage:
 *   node tools/shoot.mjs [url] [label]
 * Writes desktop full-page, desktop sections, and a mobile full-page shot.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://localhost:4321/';
const label = process.argv[3] ?? 'home';
const out = 'shots';
await mkdir(out, { recursive: true });

// Uses the Chrome already on this machine, so no extra browser download.
const browser = await chromium.launch({ channel: 'chrome' });

async function settle(page) {
  // A fullPage capture triggers neither lazy loading nor reveal-on-scroll,
  // so both are forced here before the shutter.
  await page.evaluate(() => {
    // smooth scrolling makes a scripted pass non-deterministic
    document.documentElement.style.scrollBehavior = 'auto';
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
  });

  // Walk the page until every reveal element has fired, re-reading the height
  // each pass because loading images make the document grow.
  for (let pass = 0; pass < 4; pass++) {
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.6;
      for (let y = 0, guard = 0; y <= document.documentElement.scrollHeight && guard < 400; y += step, guard++) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
    });
    const hidden = await page.evaluate(() => document.querySelectorAll('[data-reveal]:not(.is-in)').length);
    if (hidden === 0) break;
    if (pass === 3) console.warn(`  ! ${hidden} reveal elements still hidden`);
  }

  await page.evaluate(() =>
    Promise.all(Array.from(document.images).map((i) => i.decode().catch(() => {})))
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
}

// --- desktop ---
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await desktop.goto(url, { waitUntil: 'networkidle' });
await settle(desktop);
await desktop.screenshot({ path: `${out}/${label}-desktop-full.png`, fullPage: true });

const sections = await desktop.evaluate(() =>
  Array.from(document.querySelectorAll('main > section, footer')).map((el) => ({
    id: el.id || el.className.split(' ')[0],
    top: Math.round(el.getBoundingClientRect().top + window.scrollY),
    height: Math.round(el.getBoundingClientRect().height),
  }))
);
let i = 0;
for (const s of sections) {
  i += 1;
  await desktop.evaluate((y) => window.scrollTo(0, y), Math.max(0, s.top - 8));
  await desktop.waitForTimeout(450);
  await desktop.screenshot({ path: `${out}/${label}-d${String(i).padStart(2, '0')}-${s.id}.png` });
}
await desktop.close();

// --- mobile ---
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await mobile.goto(url, { waitUntil: 'networkidle' });
await settle(mobile);
await mobile.screenshot({ path: `${out}/${label}-mobile-full.png`, fullPage: true });
await mobile.close();

await browser.close();
console.log(`sections: ${sections.map((s) => s.id).join(', ')}`);
