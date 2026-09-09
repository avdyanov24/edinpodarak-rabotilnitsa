import type { APIRoute } from 'astro';
import { db, DbError } from '../../lib/db';
import { confirmationEmail, noticeEmail, deliver, ownerAddress } from '../../lib/email';

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

    return json({ status: result.status, cancel_token: result.cancel_token });
  } catch (e) {
    const code = e instanceof DbError ? e.code : 'register_failed';
    const status = code === 'unknown_event' ? 404
      : code === 'registrations_closed' || code === 'event_not_published' ? 409
      : 500;
    return json({ error: code }, status);
  }
};
