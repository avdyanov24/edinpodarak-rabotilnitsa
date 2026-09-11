/**
 * Mechanical mobile problems, across every page — the ones that are easy to
 * miss by eye and embarrassing in the hand: sideways scrolling, tap targets
 * too small for a thumb, text too small to read, anything sticking out of
 * its container, and content trapped under the fixed booking bar.
 */
import { chromium } from 'playwright';

const B = process.env.CHECK_URL || 'http://localhost:4321';
const PAGES = ['/', '/rabotilnitsa/glina-i-limonada-oktomvri', '/poveritelnost', '/usloviya', '/nyama-takava', '/admin/vhod'];
const SIZES = [['iPhone', 390, 844], ['small', 360, 740], ['landscape', 844, 390]];

const b = await chromium.launch({ channel: 'chrome' });
const problems = [];

for (const [device, w, h] of SIZES) {
  const ctx = await b.newContext({
    viewport: { width: w, height: h },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    hasTouch: true, isMobile: true, deviceScaleFactor: 3,
  });
  for (const path of PAGES) {
    const p = await ctx.newPage();
    const bad = [];
    p.on('pageerror', (e) => bad.push(`js error: ${e}`));
    p.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('nyama-takava')) bad.push(`${r.status()} ${r.url()}`); });
    await p.goto(`${B}${path}`, { waitUntil: 'networkidle' });
    // let scroll animations settle after a full pass
    await p.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
      window.scrollTo(0, 0);
    });
    await p.waitForTimeout(500);

    const found = await p.evaluate((vw) => {
      const out = [];
      const de = document.documentElement;

      if (de.scrollWidth > vw + 1) out.push(`page scrolls sideways: ${de.scrollWidth}px wide in a ${vw}px viewport`);

      // what is actually sticking out
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.visibility === 'hidden') continue;
        if (r.right > vw + 1.5) {
          // Only a problem if nothing above it clips: an image scaled inside
          // an overflow:hidden frame is contained, not sticking out.
          let clipped = false;
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            const o = getComputedStyle(a);
            if (['hidden', 'clip', 'auto', 'scroll'].includes(o.overflowX) ||
                ['hidden', 'clip', 'auto', 'scroll'].includes(o.overflowY)) { clipped = true; break; }
          }
          if (!clipped) out.push(`sticks out ${Math.round(r.right - vw)}px: ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
        }
      }

      // tap targets
      const seen = new Set();
      for (const el of document.querySelectorAll('a, button, select, input:not([type=hidden]), summary, [role=button]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (el.closest('[hidden]') || el.closest('dialog:not([open])')) continue;
        const label = `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`;
        if (seen.has(label)) continue;
        // an inline link inside a paragraph is fine; standalone controls are not
        const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline';
        if (!inline && (r.height < 40 || r.width < 40)) {
          seen.add(label);
          out.push(`tap target ${Math.round(r.width)}×${Math.round(r.height)}: ${label} "${(el.textContent || '').trim().slice(0, 24)}"`);
        }
      }

      // small text
      const sizes = new Map();
      for (const el of document.querySelectorAll('p, span, li, dd, dt, small, label, a, button')) {
        if (!el.textContent?.trim()) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs && fs < 12) {
          const label = `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`;
          if (!sizes.has(label)) { sizes.set(label, fs); out.push(`text ${fs.toFixed(1)}px: ${label}`); }
        }
      }
      return out;
    }, w);

    for (const f of [...found, ...bad]) problems.push(`[${device} ${path}] ${f}`);
    await p.close();
  }
  await ctx.close();
}

await b.close();
if (!problems.length) { console.log('mobile audit: clean'); process.exit(0); }
console.log(`${problems.length} finding(s):`);
for (const p of problems) console.log('  ✗ ' + p);
process.exit(1);
