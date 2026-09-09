/** WCAG contrast of every visible text node against what is actually behind it. */
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.evaluate(async () => {
  document.documentElement.style.scrollBehavior = 'auto';
  for (let y = 0, g = 0; y <= document.documentElement.scrollHeight && g < 400; y += innerHeight * 0.6, g++) {
    scrollTo(0, y); await new Promise(r => setTimeout(r, 80));
  }
  scrollTo(0, 0);
});
await p.waitForTimeout(900);

const rows = await p.evaluate(() => {
  /**
   * Colours here come back from getComputedStyle as `oklab(... / 0.45)`,
   * because the design is built on color-mix(). Reading the numbers out of
   * that string as if they were RGB gives nonsense — which is what this
   * check used to do, reporting 36 failures that did not exist and hiding
   * any real one among them. Painting the colour onto a canvas lets the
   * browser do the conversion, and compositing the text over its background
   * handles the alpha the same way the eye does.
   */
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const lum = (c) => {
    const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const PAPER = 'rgb(251, 248, 241)';

  /**
   * Every painted layer between the text and the page, bottom-up. Several of
   * them are semi-transparent (a 12%-cream ticker over a dark hero, a 26%
   * clay pill), so the ground has to be composited, not read off one element.
   */
  const groundOf = (el) => {
    const layers = [];
    let n = el, overImage = false;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') overImage = true;
      if (n.querySelector && n.querySelector(':scope > video, :scope > picture, :scope > img')) overImage = true;
      const bg = cs.backgroundColor;
      if (bg && !/rgba?\([^)]*,\s*0\)$/.test(bg) && bg !== 'transparent') layers.push(bg);
      if (n.tagName === 'BODY') break;
      n = n.parentElement;
    }
    // Only the page's own background between the text and the bottom means
    // nothing in between painted anything — on this site that is the hero
    // video or a section photograph, and it cannot be measured from here.
    if (layers.length <= 1) overImage = true;
    return { layers: layers.reverse(), overImage };
  };

  const stack = (layers, textCss) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, 1, 1);
    for (const c of layers) { ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); }
    const bgPx = ctx.getImageData(0, 0, 1, 1).data;
    const bg = [bgPx[0], bgPx[1], bgPx[2]];
    ctx.fillStyle = textCss;
    ctx.fillRect(0, 0, 1, 1);
    const fgPx = ctx.getImageData(0, 0, 1, 1).data;
    return { bg, fg: [fgPx[0], fgPx[1], fgPx[2]] };
  };

  const out = [];
  document.querySelectorAll('p, li, dd, dt, span, a, h1, h2, h3, summary, figcaption, small, strong').forEach(el => {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
    const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (txt.length < 4) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.5) return;

    const ground = groundOf(el);
    const { bg, fg } = stack(ground.layers, cs.color);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize);
    const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) out.push({
      cls: (el.className || el.tagName).toString().slice(0, 34),
      ratio: ratio.toFixed(2), need, px: px.toFixed(0), text: txt.slice(0, 42),
      overImage: ground.overImage,
    });
  });
  return out;
});
await b.close();
// Text sitting on a photograph or video cannot be measured this way — the
// ground is whatever pixel happens to be behind it. Those are listed apart,
// to be judged by eye, so the AA list stays trustworthy.
const solid = rows.filter((r) => !r.overImage);
const onMedia = rows.filter((r) => r.overImage);

if (!solid.length) console.log('all text on solid ground meets WCAG AA');
else {
  console.log(`${solid.length} below AA:`);
  solid.forEach(r => console.log(`  ${r.ratio} (needs ${r.need})  ${r.px}px  ${r.cls}  "${r.text}"`));
}
if (onMedia.length) {
  console.log(`\n${onMedia.length} over a photo or video — check by eye, not measurable here:`);
  onMedia.forEach(r => console.log(`  ${r.px}px  ${r.cls}  "${r.text}"`));
}
process.exit(solid.length ? 1 : 0);
