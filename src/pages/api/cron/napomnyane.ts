import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { reminderEmail, deliver, emailsConfigured } from '../../../lib/email';
import { env, isDeployed } from '../../../lib/env';

export const prerender = false;

/**
 * „Ден преди работилницата ще получиш напомняне.“ This is what sends it.
 *
 * Run once a day by Vercel's scheduler (see vercel.json). It looks a day and
 * a half ahead rather than exactly 24 hours, because a daily job cannot be
 * relied on to the minute and a reminder that arrives the morning before is
 * worth more than one skipped for being an hour out.
 *
 * A booking is only marked as reminded once an email has actually gone. If
 * the mail service is not configured - or is down - the reminder stays due,
 * which is the difference between a promise kept late and one silently
 * dropped.
 */
const WINDOW_FROM_HOURS = 10;
const WINDOW_TO_HOURS = 38;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request, url }) => {
  // Vercel sends CRON_SECRET as a bearer token on scheduled requests. On a
  // deployed site without one, refuse: an open endpoint that sends email is
  // somebody else's toy.
  const secret = env('CRON_SECRET');
  if (secret) {
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return json({ error: 'unauthorised' }, 401);
    }
  } else if (isDeployed()) {
    return json({ error: 'no_cron_secret' }, 503);
  }

  const now = Date.now();
  const from = new Date(now + WINDOW_FROM_HOURS * 3600_000).toISOString();
  const to = new Date(now + WINDOW_TO_HOURS * 3600_000).toISOString();

  let due;
  try {
    due = await db.remindersDue(from, to);
  } catch {
    return json({ error: 'lookup_failed' }, 500);
  }

  if (!emailsConfigured()) {
    // Nothing is marked, so these go out on the first run after the mail
    // service exists - as long as the workshop has not happened by then.
    return json({ due: due.length, sent: 0, reason: 'mail_not_configured' });
  }

  let sent = 0;
  for (const r of due) {
    const cancelUrl = new URL(`/otkazhi/${r.cancel_token}`, url.origin).toString();
    const result = await deliver(r.email, reminderEmail(r, cancelUrl));
    if (result.sent) {
      sent++;
      await db.reminderSent(r.id);
    }
  }

  return json({ due: due.length, sent });
};
