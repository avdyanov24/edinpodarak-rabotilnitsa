/**
 * Checks the page against the documented "AI slop / vibe-coded" tells.
 * Sources: developersdigest "16 patterns", solodesign "the tells",
 * 925studios AI-slop guide.
 */
import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';

const src = readdirSync('src/components').map(f => readFileSync(`src/components/${f}`, 'utf8')).join('\n')
  + readFileSync('src/styles/global.css', 'utf8');

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.waitForTimeout(600);

const dom = await p.evaluate(() => {
  const all = [...document.querySelectorAll('*')];
  const caps = all.filter(e => getComputedStyle(e).textTransform === 'uppercase'
    && (e.textContent || '').trim().length > 1 && e.children.length === 0);
  return {
    upperEls: caps.length,
    upperText: caps.slice(0, 8).map(e => (e.textContent || '').trim().slice(0, 20)),
    // "uppercase label with a thin line trailing after it"
    eyebrowChrome: all.filter(e => {
      const cs = getComputedStyle(e, '::after');
      return getComputedStyle(e).textTransform === 'uppercase'
        && cs.content !== 'none' && parseFloat(cs.width) > 12 && parseFloat(cs.height) <= 2;
    }).length,
    purple: all.filter(e => {
      const c = getComputedStyle(e).backgroundColor.match(/\d+/g);
      if (!c) return false;
      const [r, g, bl] = c.map(Number);
      return bl > r + 25 && bl > g + 40 && r > g;
    }).length,
    centeredHero: (() => {
      const h1 = document.querySelector('h1');
      return h1 ? getComputedStyle(h1).textAlign === 'center' : false;
    })(),
    heroItalicAccent: [...document.querySelectorAll('h1 *')]
      .some(e => getComputedStyle(e).fontStyle === 'italic'),
    glows: all.filter(e => {
      const sh = getComputedStyle(e).boxShadow;
      return sh !== 'none' && /rgb\((\d+), (\d+), (\d+)\)/.test(sh)
        && /blur|(\d{2,})px/.test(sh) && !/rgba?\([^)]*0\.\d/.test(sh);
    }).length,
    // distinct motion *ideas*, not elements: one effect staggered across
    // thirteen letters is a single idea, not thirteen
    loadAnimations: new Set(all
      .filter(e => getComputedStyle(e).animationIterationCount === '1')
      .map(e => getComputedStyle(e).animationName)
      .filter(a => a && a !== 'none')).size,
    // The tell is a decorative stat banner in a section's chrome. A card
    // listing its own date/place/price is data, so anything inside an
    // <article> is excluded — as is any strip nested in another.
    statRows: (() => {
      const strips = all.filter(e => {
        if (e.closest('article') || !e.offsetParent) return false;
        const pairs = [...e.children].filter(k =>
          !k.matches('article') && !k.querySelector('article')
          && k.querySelector('dt') && k.querySelector('dd'));
        if (pairs.length < 3) return false;
        const d = getComputedStyle(e).display;
        return d.includes('flex') || d.includes('grid');
      });
      return strips.filter(e => !strips.some(o => o !== e && o.contains(e))).length;
    })(),
  };
});
await b.close();

const numberedSeq = (src.match(/padStart\(2, '0'\)/g) || []).length;
const emDashPct = (() => {
  const t = readFileSync('src/data/site.ts', 'utf8') + readFileSync('src/data/events.ts', 'utf8');
  const strs = t.match(/'([^']{25,})'/g) || [];
  return Math.round(100 * strs.filter(s => s.includes('—')).length / Math.max(strs.length, 1));
})();

const checks = [
  ['eyebrow chrome (uppercase + trailing rule)', dom.eyebrowChrome, 0],
  ['all-caps text elements', dom.upperEls, 12],
  ['decorative 01/02/03 sequences', numberedSeq, 0],
  ['label-over-value stat strips on the page', dom.statRows, 1],
  ['vibecode-purple surfaces', dom.purple, 0],
  ['centered hero headline', dom.centeredHero ? 1 : 0, 0],
  ['serif-italic accent word in hero', dom.heroItalicAccent ? 1 : 0, 0],
  ['hard coloured glows', dom.glows, 0],
  ['distinct one-shot motion ideas', dom.loadAnimations, 8],
  ['em-dash density in copy (%)', emDashPct, 20],
];

let fails = 0;
for (const [name, got, limit] of checks) {
  const ok = got <= limit;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(44)} ${String(got).padStart(3)}  (max ${limit})`);
}
if (dom.upperText.length) console.log(`\n      all-caps still used for: ${dom.upperText.join(', ')}`);
console.log(`\n${checks.length - fails}/${checks.length} clean`);
process.exit(fails ? 1 : 0);
