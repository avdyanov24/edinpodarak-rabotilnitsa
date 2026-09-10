/**
 * Scroll animations, judged the way a thumb sees them.
 *
 * A phone scrolls far faster than a mouse wheel, so a reveal tuned for a
 * desktop is still fading in as the content goes past. This walks down the
 * page in viewport-sized steps and requires that anything comfortably on
 * screen has actually arrived.
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
const bad = await p.evaluate(async () => {
  const problems = [];
  const step = innerHeight * 0.45;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    // 750ms: long enough for a reveal to finish (0.55s plus up to 140ms of
    // stagger), short enough that a sluggish one still fails.
    await new Promise(r => setTimeout(r, 750));
    for (const el of document.querySelectorAll('[data-reveal]')) {
      const r = el.getBoundingClientRect();
      // comfortably on screen: at least 60% of it inside the viewport
      const shown = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      if (r.height && shown / Math.min(r.height, innerHeight) > 0.6) {
        const cs = getComputedStyle(el);
        // What matters is whether a person can see it, not which class it
        // carries — the carousel cards are deliberately always visible.
        if (Number(cs.opacity) < 0.9) {
          problems.push(`y=${Math.round(y)} still faded on screen: .${String(el.className).split(' ')[0]} opacity=${Number(cs.opacity).toFixed(2)}`);
        }
      }
    }
    for (const el of document.querySelectorAll('.pr__media')) {
      const r = el.getBoundingClientRect();
      const shown = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      if (r.height && shown / Math.min(r.height, innerHeight) > 0.6) {
        const cp = getComputedStyle(el).clipPath;
        const hidden = Number((cp.match(/([\d.]+)%\)$/) || [0, 0])[1]);
        if (hidden > 8) problems.push(`y=${Math.round(y)} photo still ${hidden.toFixed(0)}% wiped shut on screen`);
      }
    }
  }
  return [...new Set(problems)];
});
await b.close();
if (!bad.length) { console.log('mobile animations: everything on screen has arrived'); process.exit(0); }
console.log(`${bad.length} thing(s) still not arrived while on screen:`);
bad.slice(0, 20).forEach((x) => console.log('  \u2717 ' + x));
process.exit(1);
