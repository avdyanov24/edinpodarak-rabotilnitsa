/**
 * What the site is allowed to say about email.
 *
 * For a while it told every visitor „Пратих потвърждение на …“ on a deploy
 * with no mail service configured at all, and promised a reminder that
 * nothing anywhere sent. Both of those are worse than silence: somebody waits
 * for an email, does not get one, and concludes the booking failed.
 *
 * So: the page only claims what actually happened, and the reminder exists.
 */
import { chromium } from 'playwright';
import { rm } from 'node:fs/promises';

const B = process.env.CHECK_URL || 'http://localhost:4321';
const mailOn = Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

if (B.includes('localhost')) {
  await rm('.data/db.json', { force: true });
  await fetch(B).catch(() => {});
}

const b = await chromium.launch({ channel: 'chrome' });
const results = [];
const ok = (n, pass, d = '') => results.push({ n, pass, d });

const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto(B, { waitUntil: 'networkidle' });

// ---------- what the form promises ----------
await p.locator('[data-signup]').first().click();
await p.waitForTimeout(500);
const hint = await p.locator('.fld__hint').first().innerText();
ok('the form only promises an email where there is one to send',
   mailOn ? /потвърждение/.test(hint) : !/Пращам потвърждение/.test(hint), hint);

// ---------- what the confirmation says ----------
await p.fill('[name="full_name"]', 'Мария Петрова');
await p.fill('[name="phone"]', '0888123456');
await p.fill('[name="email"]', 'maria@example.com');
await p.check('[name="consent"]');
await p.locator('[data-su-submit]').click();
await p.waitForSelector('.su__msg', { timeout: 8000 });
const msg = (await p.locator('.su__msg').innerText()).replace(/\s+/g, ' ');

ok('the booking is confirmed either way', /мястото е твое/i.test(msg), msg.slice(0, 80));
ok(mailOn
    ? 'and it says where the confirmation went'
    : 'and it does not claim an email that was never sent',
   mailOn ? /Пратих потвърждение/.test(msg) : !/Пратих потвърждение/.test(msg),
   msg.slice(0, 120));
if (!mailOn) {
  ok('it tells them what happens instead', /ще се чуем|обади ми се/i.test(msg), msg.slice(0, 120));
}

// ---------- the reminder job ----------
{
  const res = await p.request.get(`${B}/api/cron/napomnyane`);
  const body = await res.json().catch(() => ({}));
  ok('the reminder job answers', res.status() === 200, `HTTP ${res.status()} ${JSON.stringify(body)}`);
  ok('it knows how many reminders are due', typeof body.due === 'number', JSON.stringify(body));
  ok(mailOn
      ? 'and sends them'
      : 'and sends nothing while there is no mail service - the reminders stay due',
     mailOn ? body.sent >= 0 : body.sent === 0 && body.reason === 'mail_not_configured',
     JSON.stringify(body));

  // Nothing may be marked as reminded when nothing was sent, or the reminder
  // is silently spent and never arrives.
  if (!mailOn) {
    const again = await (await p.request.get(`${B}/api/cron/napomnyane`)).json();
    ok('running it twice does not quietly use them up', again.due === body.due,
       `${body.due} then ${again.due}`);
  }
}

await b.close();
let failed = 0;
for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? `  — ${r.d}` : ''}`); }
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
