import { chromium } from 'playwright';
const B = 'http://localhost:4321';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await p.goto(`${B}/admin/vhod`, { waitUntil: 'networkidle' });
await p.fill('#email', 'admin@example.com');
await p.fill('#password', 'rabotilnitsa');
await p.click('button[type=submit]');
await p.waitForURL('**/admin');
await p.waitForTimeout(500);
await p.screenshot({ path: 'shots/admin-1-spisak.png', fullPage: true });

const id = await p.locator('a.ev').first().getAttribute('href');
await p.goto(`${B}${id}`, { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/admin-2-redakcia.png', fullPage: true });

const eventId = id.split('/').pop();
await p.goto(`${B}/admin/zapisvaniya/${eventId}`, { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/admin-3-zapisvaniya.png', fullPage: true });
await b.close();
console.log('captured');
