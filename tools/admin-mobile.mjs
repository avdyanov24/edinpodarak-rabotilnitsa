/**
 * The panel on a phone. Джейля will add a workshop from her phone, and until
 * now nothing here had ever been laid out for one — the header ran 63px off
 * the side of a 360px screen.
 */
import { chromium } from 'playwright';

const B = process.env.CHECK_URL || 'http://localhost:4321';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const PASS = process.env.ADMIN_PASSWORD || 'rabotilnitsa';

const b = await chromium.launch({ channel: 'chrome' });
const problems = [];

for (const [device, w, h] of [['iPhone', 390, 844], ['small', 360, 740]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  await p.goto(`${B}/admin/vhod`, { waitUntil: 'networkidle' });
  await p.fill('#email', EMAIL);
  await p.fill('#password', PASS);
  await p.click('button[type=submit]');
  await p.waitForURL((u) => u.pathname === '/admin', { timeout: 10000 });

  const first = await p.locator('a.ev').first().getAttribute('href');
  const id = first.split('/').pop();
  const pages = ['/admin', `/admin/rabotilnitsa/${id}`, '/admin/rabotilnitsa/nova', `/admin/zapisvaniya/${id}`, '/admin/sadarzhanie'];

  for (const path of pages) {
    await p.goto(`${B}${path}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(300);
    const found = await p.evaluate((vw) => {
      const out = [];
      if (document.documentElement.scrollWidth > vw + 1) {
        out.push(`page scrolls sideways: ${document.documentElement.scrollWidth}px in ${vw}px`);
      }
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.right <= vw + 1.5) continue;
        let clipped = false;
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const o = getComputedStyle(a);
          if (['hidden', 'clip', 'auto', 'scroll'].includes(o.overflowX)) { clipped = true; break; }
        }
        if (!clipped) out.push(`sticks out ${Math.round(r.right - vw)}px: ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
      }
      const seen = new Set();
      for (const el of document.querySelectorAll('a, button, select, input:not([type=hidden]), textarea')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const key = `${el.tagName}.${String(el.className).split(' ')[0]}`;
        if (seen.has(key)) continue;
        // a checkbox inside a label is as big as the label you can tap
        const box = el.closest('label') ? el.closest('label').getBoundingClientRect() : r;
        if (box.height < 40) { seen.add(key); out.push(`tap target ${Math.round(box.width)}×${Math.round(box.height)}: ${key} "${(el.textContent || el.value || '').trim().slice(0, 20)}"`); }
      }
      return out;
    }, w);
    for (const f of found) problems.push(`[${device} ${path}] ${f}`);
  }
  await ctx.close();
}

await b.close();
if (!problems.length) { console.log('admin panel on mobile: clean'); process.exit(0); }
console.log(`${problems.length} finding(s):`);
for (const x of problems) console.log('  ✗ ' + x);
process.exit(1);
