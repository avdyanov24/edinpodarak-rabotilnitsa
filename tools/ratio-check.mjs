import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.evaluate(async () => {
  document.querySelectorAll('img[loading="lazy"]').forEach(i => (i.loading = 'eager'));
  for (let y = 0, g = 0; y <= document.documentElement.scrollHeight && g < 400; y += innerHeight * 0.6, g++) {
    scrollTo(0, y); await new Promise(r => setTimeout(r, 90));
  }
});
await p.waitForTimeout(700);
const rows = await p.evaluate(() =>
  [...document.images].filter(i => i.offsetParent !== null).map(i => {
    const cs = getComputedStyle(i);
    const r = i.getBoundingClientRect();
    return {
      cls: i.className || i.parentElement?.className || '(none)',
      wanted: cs.aspectRatio,
      got: (r.width / r.height).toFixed(2),
      box: `${Math.round(r.width)}x${Math.round(r.height)}`,
    };
  }));
const bad = rows.filter(r => {
  if (!r.wanted || r.wanted === 'auto') return false;
  const [a, bb] = r.wanted.split('/').map(Number);
  return Math.abs(a / bb - Number(r.got)) > 0.03;
});
console.log(`images with an aspect-ratio: ${rows.filter(r => r.wanted && r.wanted !== 'auto').length}`);
console.log(bad.length ? 'MISMATCHED:\n' + bad.map(r => `  ${r.cls}: wanted ${r.wanted}, got ${r.got} (${r.box})`).join('\n') : 'all aspect ratios honoured');
await b.close();
