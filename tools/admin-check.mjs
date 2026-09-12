/** Drives the whole admin panel the way Джейля would. */
import { chromium } from 'playwright';
const B = 'http://localhost:4321';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const results = [];
const ok = (n, pass, d = '') => results.push({ n, pass, d });

// ---------- the panel is not open to the public ----------
await p.goto(`${B}/admin`, { waitUntil: 'networkidle' });
ok('unauthenticated visitors are sent to the login', p.url().includes('/admin/vhod'), p.url());

const reg = await p.request.post(`${B}/api/admin/upload`, { multipart: { file: { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('x') } } });
ok('upload endpoint refuses without a session', reg.status() === 401, `HTTP ${reg.status()}`);

// ---------- signing in ----------
await p.fill('#email', 'admin@example.com');
await p.fill('#password', 'wrong-password');
await p.click('button[type=submit]');
await p.waitForTimeout(400);
ok('a wrong password is refused', (await p.locator('.note--bad').count()) > 0);

await p.fill('#email', 'admin@example.com');
await p.fill('#password', 'rabotilnitsa');
await p.click('button[type=submit]');
await p.waitForURL('**/admin', { timeout: 8000 });
ok('correct credentials get in', p.url().endsWith('/admin'));
ok('the seeded workshops are listed', (await p.locator('a.ev').count()) >= 3,
   `${await p.locator('a.ev').count()} listed`);

// ---------- creating a workshop ----------
// An interrupted run leaves the test workshop behind, and the slug is unique,
// so the next run would fail on the duplicate. Clear it first.
await removeTestWorkshop();

await p.click('text=+ Нова работилница');
await p.waitForSelector('#title');
await p.fill('#title', 'Пролетна работилница');
await p.fill('#summary', 'Правим композиция от мъх и пролетни цветя.');
await p.fill('#description', 'Два часа, в които сглобяваш своя пролетна рамка.');
await p.fill('#starts_at', '2027-04-18T18:30');
await p.fill('#capacity', '6');
// Her rule: three at the table at least. A new workshop should arrive with it
// already filled in, so she never has to think about the number again.
ok('a new workshop starts at her minimum of three',
   (await p.inputValue('#min_participants')) === '3', await p.inputValue('#min_participants'));
await p.fill('#min_participants', '2');
await p.fill('#price', '35');
await p.fill('#venue_address', 'ул. „Тестова“ 1');
await p.fill('#includes', 'Рамка\nМъх\nЦветя');
await p.selectOption('#status', 'published');
await p.click('button[value=save]');
await p.waitForURL((u) => u.searchParams.get('zapazeno') === '1', { timeout: 8000 });
ok('a new workshop saves', p.url().includes('zapazeno=1'));
ok('the slug is derived from the Cyrillic title',
   (await p.inputValue('#slug')) === 'proletna-rabotilnitsa', await p.inputValue('#slug'));
ok('the hour survives the round trip',
   (await p.inputValue('#starts_at')) === '2027-04-18T18:30', await p.inputValue('#starts_at'));
const editUrl = p.url();
const eventId = editUrl.split('/rabotilnitsa/')[1].split('?')[0];

// ---------- it shows up on the public site ----------
const pub = await p.request.get(`${B}/`);
ok('it appears on the public page', (await pub.text()).includes('Пролетна работилница'));

// ---------- someone books it ----------
const book = (n, name) => p.request.post(`${B}/api/register`, {
  data: { event_id: eventId, full_name: name, email: `${encodeURIComponent(name)}@example.com`,
          phone: '0888123456', people_count: n, consent: true },
});
const r1 = await book(4, 'Първа');
ok('a booking is confirmed', (await r1.json()).status === 'confirmed', JSON.stringify(await r1.json()));
const r2 = await book(4, 'Втора');
ok('overflow goes to the waiting list', (await r2.json()).status === 'waitlist');

// ---------- she sees them ----------
await p.goto(`${B}/admin/zapisvaniya/${eventId}`, { waitUntil: 'networkidle' });
ok('registrations are listed', (await p.locator('tbody tr').count()) === 2,
   `${await p.locator('tbody tr').count()} rows`);
ok('seats are counted in the header',
   (await p.locator('.sub').first().innerText()).includes('4 от 6'),
   await p.locator('.sub').first().innerText());
ok('the waiting list is a separate group', (await p.locator('text=Чакащи').count()) > 0);
// „4 / 6“ does not tell her whether the date is on. The line under it does.
ok('the panel says the minimum is together',
   /Минимумът от 2 души е събран/.test(await p.locator('.minline').innerText()),
   await p.locator('.minline').innerText());
ok('and the edit form kept the minimum she typed',
   await p.request.get(`${B}/admin/rabotilnitsa/${eventId}`).then(async (r) =>
     /id="min_participants"[^>]*value="2"/.test(await r.text())));

// ---------- the CSV she takes to the venue ----------
const csv = await p.request.get(`${B}/admin/zapisvaniya/${eventId}?csv=1`);
const text = await csv.text();
ok('CSV downloads', csv.headers()['content-type'].includes('text/csv'), csv.headers()['content-type']);
ok('CSV has a BOM so Excel reads Cyrillic', text.charCodeAt(0) === 0xfeff);
ok('CSV contains the bookings', text.includes('Първа') && text.includes('Втора'));
ok('CSV headers are Bulgarian', text.includes('Име') && text.includes('Телефон'));

// ---------- marking someone off ----------
await p.locator('button[value=attended]').first().click();
await p.waitForLoadState('networkidle');
ok('a person can be marked as attended', (await p.locator('text=Присъствали').count()) > 0);

// ---------- repeating a workshop ----------
await p.goto(`${B}/admin/rabotilnitsa/nova?ot=${eventId}`, { waitUntil: 'networkidle' });
ok('“repeat” copies the details', (await p.inputValue('#title')) === 'Пролетна работилница');
ok('“repeat” starts as a draft again', (await p.inputValue('#status')) === 'draft');
ok('“repeat” clears the slug so it cannot clash', (await p.inputValue('#slug')) === '');

// ---------- content editor ----------
await p.goto(`${B}/admin/sadarzhanie`, { waitUntil: 'networkidle' });
const before = await p.locator('input[name=faq_q]').count();
await p.click('[data-add=faq]');
await p.waitForTimeout(200);
ok('a question can be added', (await p.locator('input[name=faq_q]').count()) === before + 1);
await p.locator('input[name=faq_q]').last().fill('Мога ли да платя с карта?');
await p.locator('textarea[name=faq_a]').last().fill('Да, на място.');
await p.click('button[type=submit]');
await p.waitForURL((u) => u.searchParams.get('zapazeno') === '1', { timeout: 8000 });
const home = await (await p.request.get(`${B}/`)).text();
ok('the new question reaches the public page', home.includes('Мога ли да платя с карта?'));

// ---------- deleting it again ----------
const gone = await removeTestWorkshop();
ok('a workshop can be deleted', gone, gone ? 'removed' : 'delete control did not work');
{
  const home = await (await p.request.get(`${B}/?v=${Date.now()}`)).text();
  ok('it disappears from the public page', !home.includes('Пролетна работилница'));
}

// ---------- signing out ----------
await p.goto(`${B}/admin/izhod`, { waitUntil: 'networkidle' });
ok('signing out returns to the login', p.url().includes('/admin/vhod'));
await p.goto(`${B}/admin/zapisvaniya/${eventId}`, { waitUntil: 'networkidle' });
ok('personal data is unreachable once signed out', p.url().includes('/admin/vhod'), p.url());

/**
 * Deletes the workshop this check creates, through the panel's own delete
 * button. Returns false if there was nothing to delete.
 */
async function removeTestWorkshop() {
  await p.goto(`${B}/admin`, { waitUntil: 'networkidle' });
  const row = p.locator('a.ev', { hasText: 'Пролетна работилница' }).first();
  if (!(await row.count())) return false;
  await row.click();
  await p.waitForSelector('#title');
  p.once('dialog', (d) => d.accept());
  await p.click('button[value=delete]');
  await p.waitForTimeout(1200);
  return (await p.locator('a.ev', { hasText: 'Пролетна работилница' }).count()) === 0;
}

await b.close();
let failed = 0;
for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? `  — ${r.d}` : ''}`); }
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
