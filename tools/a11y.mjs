import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
const r = await p.evaluate(() => {
  const imgs = [...document.images];
  return {
    lang: document.documentElement.lang,
    h1: document.querySelectorAll('h1').length,
    imagesWithoutAlt: imgs.filter(i => !i.hasAttribute('alt')).length,
    decorativeImages: imgs.filter(i => i.alt === '').length,
    buttonsWithoutName: [...document.querySelectorAll('button')]
      .filter(b => !b.textContent.trim() && !b.getAttribute('aria-label')).length,
    linksWithoutName: [...document.querySelectorAll('a')]
      .filter(a => !a.textContent.trim() && !a.getAttribute('aria-label')).length,
    skipLink: !!document.querySelector('.skip'),
    landmarks: ['header','main','footer','nav'].filter(t => document.querySelector(t)).join(','),
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
