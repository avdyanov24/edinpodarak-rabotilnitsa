import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.evaluate(async () => {
  document.querySelectorAll('img[loading="lazy"]').forEach(i => i.loading = 'eager');
  for (let y = 0, g = 0; y <= document.documentElement.scrollHeight && g < 400; y += innerHeight * 0.6, g++) {
    scrollTo(0, y); await new Promise(r => setTimeout(r, 100));
  }
});
await p.waitForTimeout(800);

// tops of the pieces in each row must line up on the rail
// offsetTop, not getBoundingClientRect: the frames are deliberately tilted,
// which nudges the visual bounding box by a couple of px.
const rows = await p.evaluate(() =>
  [...document.querySelectorAll('.gal__row')].map(row =>
    [...row.querySelectorAll('.gal__frame')].map(f => f.offsetTop)));
console.log('row top alignment (px):', JSON.stringify(rows));
rows.forEach((r, i) => {
  const spread = Math.max(...r) - Math.min(...r);
  console.log(`  row ${i + 1}: spread ${spread}px ${spread <= 2 ? 'OK' : 'MISALIGNED'}`);
});

// no fragment/overflow of a piece outside its row
const overflow = await p.evaluate(() => {
  const wall = document.querySelector('.gal__wall').getBoundingClientRect();
  return [...document.querySelectorAll('.gal__item')].filter(el => {
    const r = el.getBoundingClientRect();
    return r.left < wall.left - 2 || r.right > wall.right + 2;
  }).length;
});
console.log('items outside the wall bounds:', overflow);

// lightbox: open, arrow through, wrap around, close
await p.locator('[data-lb]').first().scrollIntoViewIfNeeded();
await p.locator('[data-lb]').first().click();
await p.waitForTimeout(400);
console.log('lightbox open:', await p.locator('[data-lb-dialog]').isVisible());
console.log('counter:', await p.locator('[data-lb-count]').innerText());
await p.keyboard.press('ArrowRight'); await p.waitForTimeout(350);
console.log('after ArrowRight:', await p.locator('[data-lb-count]').innerText());
await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(350);
await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(350);
console.log('wraps backwards to:', await p.locator('[data-lb-count]').innerText());
console.log('caption:', await p.locator('[data-lb-caption]').innerText());
await p.screenshot({ path: 'shots/gal-lightbox.png' });
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
console.log('closed:', await p.locator('[data-lb-dialog]').isHidden());
await b.close();
