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
  const lum = (c) => {
    const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && !bg.includes('rgba(0, 0, 0, 0)') && !/,\s*0\)$/.test(bg)) return parse(bg);
      n = n.parentElement;
    }
    return [251, 248, 241];
  };
  const out = [];
  document.querySelectorAll('p, li, dd, dt, span, a, h1, h2, h3, summary, figcaption, small, strong').forEach(el => {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
    const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (txt.length < 4) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.5) return;
    const fg = parse(cs.color), bg = bgOf(el);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize);
    const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) out.push({
      cls: (el.className || el.tagName).toString().slice(0, 34),
      ratio: ratio.toFixed(2), need, px: px.toFixed(0), text: txt.slice(0, 42),
    });
  });
  return out;
});
await b.close();
if (!rows.length) console.log('all text meets WCAG AA');
else { console.log(`${rows.length} below AA:`); rows.forEach(r => console.log(`  ${r.ratio} (needs ${r.need})  ${r.px}px  ${r.cls}  "${r.text}"`)); }
