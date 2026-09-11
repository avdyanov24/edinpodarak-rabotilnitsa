/**
 * The clay slab.
 *
 * It is a canvas that people touch, which means it can fail in ways nothing
 * else on the site can: a mark that never appears, a mark that never settles,
 * a loop that keeps running after the section has scrolled away, or — worst —
 * a slab that swallows the page scroll on a phone so the thumb cannot get
 * past it.
 */
import { chromium } from 'playwright';

const B = process.env.CHECK_URL || 'http://localhost:4321';
const b = await chromium.launch({ channel: 'chrome' });
const results = [];
const ok = (n, pass, d = '') => results.push({ n, pass, d });

/**
 * Mean brightness difference between two reads of the canvas, 0-255.
 *
 * Read from the canvas itself rather than from a screenshot: a PNG buffer is
 * compressed, so comparing its bytes says nothing about the picture.
 */
const diff = (a, c) => {
  let sum = 0;
  const n = Math.min(a.length, c.length);
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - c[i]);
  return sum / n;
};
const pixels = (page) => page.evaluate(() => {
  const c = document.querySelector('[data-clay-canvas]');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const out = [];
  for (let i = 0; i < d.length; i += 4 * 31) out.push(d[i]);
  return out;
});

for (const [label, w, h, mob] of [['desktop 1440', 1440, 900, false], ['phone 390', 390, 844, true]]) {
  const p = await b.newPage({
    viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob,
    deviceScaleFactor: mob ? 2 : 1,
  });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });

  await p.goto(B, { waitUntil: 'networkidle' });
  await p.locator('.clay__slab').scrollIntoViewIfNeeded();
  await p.waitForTimeout(700);

  const slab = p.locator('.clay__slab');
  const size = await p.evaluate(() => {
    const c = document.querySelector('[data-clay-canvas]');
    const r = c.getBoundingClientRect();
    return { cw: c.width, ch: c.height, bw: Math.round(r.width), bh: Math.round(r.height) };
  });
  ok(`${label}: the canvas is sized to the slab`,
    size.cw > 0 && size.ch > 0 && Math.abs(size.cw / size.ch - size.bw / size.bh) < 0.05,
    `${size.cw}x${size.ch} backing for ${size.bw}x${size.bh}`);

  ok(`${label}: the whole section fits on one screen`,
    await p.evaluate(() => document.querySelector('.clay').getBoundingClientRect().height <= innerHeight + 40),
    `${await p.evaluate(() => Math.round(document.querySelector('.clay').getBoundingClientRect().height))}px of ${h}`);

  // the untouched slab already has something pressed into it
  const rest = await pixels(p);
  ok(`${label}: the slab is not blank before anyone touches it`,
    await p.evaluate(() => {
      const c = document.querySelector('[data-clay-canvas]');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let min = 255; let max = 0;
      for (let i = 0; i < d.length; i += 4001) { if (d[i] < min) min = d[i]; if (d[i] > max) max = d[i]; }
      return max - min > 30;
    }));

  ok(`${label}: the hint is showing and „Изглади“ is not`,
    !(await p.locator('[data-clay-hint]').evaluate((e) => e.classList.contains('is-gone')))
    && await p.locator('[data-clay-smooth]').evaluate((e) => e.hasAttribute('hidden')));

  // press a line across it
  const box = await slab.boundingBox();
  await p.mouse.move(box.x + box.width * 0.14, box.y + box.height * 0.5);
  await p.mouse.down();
  for (let i = 1; i <= 24; i++) {
    await p.mouse.move(
      box.x + box.width * (0.14 + (i / 24) * 0.4),
      box.y + box.height * (0.5 + Math.sin(i / 4) * 0.14),
    );
    await p.waitForTimeout(10);
  }
  await p.mouse.up();
  await p.waitForTimeout(200);

  const drawn = await pixels(p);
  // Mean brightness over the whole slab: a thin groove moves it a little, and
  // „Изглади“ puts it back to 0.000, so anything above 0.3 is a real mark.
  ok(`${label}: pressing leaves a mark`, diff(rest, drawn) > 0.3, `Δ ${diff(rest, drawn).toFixed(2)}`);
  ok(`${label}: the hint gets out of the way and „Изглади“ appears`,
    await p.locator('[data-clay-hint]').evaluate((e) => e.classList.contains('is-gone'))
    && !(await p.locator('[data-clay-smooth]').evaluate((e) => e.hasAttribute('hidden'))));

  // and settles on its own
  await p.mouse.move(box.x - 60, box.y - 60);
  await p.waitForTimeout(6500);
  const settled = await pixels(p);
  ok(`${label}: the mark settles out again`,
    diff(rest, settled) < diff(rest, drawn) * 0.75,
    `${diff(rest, drawn).toFixed(2)} from rest when pressed, ${diff(rest, settled).toFixed(2)} after six seconds`);

  // „Изглади“ puts it straight back
  await p.locator('[data-clay-smooth]').click();
  await p.waitForTimeout(300);
  ok(`${label}: „Изглади“ smooths it flat`,
    diff(rest, await pixels(p)) < 0.4
    && await p.locator('[data-clay-smooth]').evaluate((e) => e.hasAttribute('hidden')),
    `Δ ${diff(rest, await pixels(p)).toFixed(3)} from the untouched slab`);

  // Off screen it must stop repainting altogether — a settle loop left
  // running for the rest of the visit is a flat battery for no picture.
  await p.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6);
  await p.mouse.down(); await p.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4, { steps: 10 }); await p.mouse.up();
  await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await p.waitForTimeout(800);
  const off1 = await pixels(p);
  await p.waitForTimeout(1200);
  ok(`${label}: it stops repainting once it is off screen`,
    diff(off1, await pixels(p)) === 0,
    `Δ ${diff(off1, await pixels(p)).toFixed(4)} over 1.2s with the section out of view`);

  ok(`${label}: no script errors`, errs.length === 0, errs.join(' | '));
  await p.close();
}

// A phone must be able to scroll past it. `touch-action: pan-y` is what allows
// that while still letting a sideways drag draw.
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p.goto(B, { waitUntil: 'networkidle' });
  await p.locator('.clay__slab').scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  ok('phone: the slab lets the page scroll through it',
    (await p.locator('.clay__slab').evaluate((e) => getComputedStyle(e).touchAction)) === 'pan-y');
  const before = await p.evaluate(() => scrollY);
  const box = await p.locator('.clay__slab').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.wheel(0, 500);
  await p.waitForTimeout(400);
  ok('phone: scrolling over the slab moves the page',
    (await p.evaluate(() => scrollY)) > before);
  await p.close();
}

await b.close();
let failed = 0;
for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? `  — ${r.d}` : ''}`); }
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
