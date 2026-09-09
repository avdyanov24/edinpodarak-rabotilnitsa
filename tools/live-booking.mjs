/**
 * Books a real seat on the live site, then checks the seat count actually
 * moved — the one thing that cannot be verified from the code alone.
 *
 *   CHECK_URL=https://... node tools/live-booking.mjs
 *
 * It leaves a booking behind on purpose, named so it is obvious in the panel:
 * "Проверка (изтрий ме)". Delete it there when you are done.
 */
import { chromium } from 'playwright';

const B = process.env.CHECK_URL || 'http://localhost:4321';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const results = [];
const ok = (n, pass, d = '') => results.push({ n, pass, d });

await p.goto(`${B}/`, { waitUntil: 'networkidle' });

// Book the first workshop that still has room — which is not necessarily the
// first card — and compare that same card afterwards.
const button = p.locator('.card button[data-signup]:not([disabled])').first();
const eventId = await button.getAttribute('data-signup');
const card = () => p.locator(`.card:has(button[data-signup="${eventId}"])`).first();
const text = async () => (await card().locator('.seats__label').innerText()).trim();
const before = await text();

await button.click();
await p.waitForTimeout(600);
ok('the dialog opens', await p.locator('[data-signup-dialog]').isVisible());

const note = await p.locator('.su__small--note').count();
ok('online booking is on (no email fallback note)', note === 0);

const stamp = Date.now().toString().slice(-6);
await p.fill('input[name="full_name"]', `Проверка ${stamp} (изтрий ме)`);
await p.fill('input[name="phone"]', '0888000000');
await p.fill('input[name="email"]', `proverka+${stamp}@example.com`);
await p.check('input[name="consent"]');
await p.click('[data-su-submit]');
await p.waitForTimeout(3500);

const msg = (await p.locator('.su__status').innerText().catch(() => '')).replace(/\s+/g, ' ');
ok('the booking is confirmed', /мястото е твое|при чакащите/.test(msg), msg.slice(0, 90));

// cache-busted so this measures the server, not the browser cache
await p.goto(`${B}/?v=${Date.now()}`, { waitUntil: 'networkidle' });
const after = await text();
// "Остават 3 места" → "Остава последно място" → "Изчерпано": not always a
// number, so compare the label itself.
ok('the seats shown went down', before !== after, `"${before}" → "${after}"`);

await b.close();
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  — ' + r.d : ''}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
