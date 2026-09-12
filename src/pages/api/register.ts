import type { APIRoute } from 'astro';
import { availability } from '../../lib/format';
import { db, DbError } from '../../lib/db';
import { confirmationEmail, noticeEmail, deliver, ownerAddress } from '../../lib/email';
import { bookingsPersist } from '../../lib/env';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Coarse per-IP throttle in front of the database.
const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 6;
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const isPhone = (v: string) => /^(\+359|0)[0-9]{8,9}$/.test(v.replace(/[\s()-]/g, ''));

export const POST: APIRoute = async ({ request, clientAddress, url }) => {
  if (tooMany(clientAddress ?? 'unknown')) return json({ error: 'rate_limited' }, 429);

  // Deployed without a database behind it. The form already offers email
  // instead; this covers anything posting here directly. Better a clear
  // refusal than a seat that disappears with the instance that took it.
  if (!bookingsPersist()) return json({ error: 'no_storage' }, 503);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const full_name = String(body.full_name ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const email = String(body.email ?? '').trim();
  const event_id = String(body.event_id ?? '');
  const people_count = Math.min(10, Math.max(1, Number(body.people_count ?? 1)));
  const note = body.note ? String(body.note).slice(0, 1000) : null;

  if (full_name.length < 2) return json({ error: 'name' }, 422);
  if (!isPhone(phone)) return json({ error: 'phone' }, 422);
  if (!isEmail(email)) return json({ error: 'email' }, 422);
  if (body.consent !== true) return json({ error: 'consent' }, 422);

  try {
    const result = await db.register({ event_id, full_name, email, phone, people_count, note });
    if (result.status === 'full') return json({ status: 'full' });

    // Emails must never take the booking down with them.
    const event = (await db.listPublishedEvents()).find((e) => e.id === event_id);
    if (event && result.cancel_token) {
      const cancelUrl = new URL(`/otkazhi/${result.cancel_token}`, url.origin).toString();
      const waitlisted = result.status === 'waitlist';
      await Promise.allSettled([
        deliver(email, confirmationEmail(event, full_name, cancelUrl, waitlisted)),
        deliver(ownerAddress(), noticeEmail(event, { full_name, email, phone, people_count, note }, result.status)),
      ]);
    }

    // The seat count travels back with the answer so the page can correct
    // itself: without it the dialog still said „Свободни 8 места“ next to
    // „Готово, мястото е твое“, and so did the card behind it.
    const seats = event
      ? availability(event.capacity, event.capacity - result.seats_left, event.registrations_open)
      : null;

    return json({
      status: result.status,
      cancel_token: result.cancel_token,
      seats_left: result.seats_left,
      seats: seats && {
        label: seats.label,
        left: seats.left,
        scarce: seats.scarce,
        full: seats.full,
      },
    });
  } catch (e) {
    const code = e instanceof DbError ? e.code : 'register_failed';
    const status = code === 'unknown_event' ? 404
      : code === 'registrations_closed' || code === 'event_not_published' ? 409
      : 500;
    return json({ error: code }, status);
  }
};
