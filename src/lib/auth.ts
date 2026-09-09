import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { env, hasSupabase, isDeployed } from './env';

/**
 * One session cookie either way.
 *
 * With Supabase configured, the password is checked by Supabase Auth; without
 * it, against ADMIN_EMAIL / ADMIN_PASSWORD so the panel can be demonstrated
 * before the project exists. Either way what ends up in the cookie is our own
 * short-lived signed token — no Supabase tokens are put in the browser.
 */

const COOKIE = 'rab_admin';
const MAX_AGE = 60 * 60 * 12; // 12 hours

function secret(): string {
  const s = env('ADMIN_SESSION_SECRET');
  if (s) return s;
  if (isDeployed()) {
    throw new Error('ADMIN_SESSION_SECRET must be set on a deployed site');
  }
  // dev only: stable for the life of the process
  return (globalThis as any).__rabDevSecret ??= randomBytes(32).toString('hex');
}

/**
 * The demo pair, for running the panel on a laptop before Supabase exists.
 * It is published in this repository, so it must never be accepted by a
 * deployed site — see credentials() below.
 */
const DEV_ONLY = { email: 'admin@example.com', password: 'rabotilnitsa' };

/**
 * The email/password this deploy accepts, or null when there is none.
 *
 * A deployed site with no ADMIN_EMAIL / ADMIN_PASSWORD set refuses everyone
 * rather than falling back to DEV_ONLY: those two strings are in the repo,
 * so falling back would leave the panel open to anyone who has read it.
 */
function credentials(): { email: string; password: string } | null {
  const email = env('ADMIN_EMAIL');
  const password = env('ADMIN_PASSWORD');
  if (email && password) return { email, password };
  return isDeployed() ? null : DEV_ONLY;
}

/** Can this deploy sign anyone in? False when the secret or the login is missing. */
export function isConfigured(): boolean {
  try { secret(); } catch { return false; }
  return hasSupabase() || credentials() !== null;
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

function serialise(email: string): string {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readSession(cookies: AstroCookies): { email: string } | null {
  const raw = cookies.get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, mac] = raw.split('.');
  if (!payload || !mac) return null;

  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return { email: String(data.email) };
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<boolean> {
  if (hasSupabase()) {
    const url = env('SUPABASE_URL')!;
    const anon = env('SUPABASE_ANON_KEY');
    if (!anon) throw new Error('SUPABASE_ANON_KEY is required for admin sign-in');
    const client = createClient(url, anon, { auth: { persistSession: false } });
    const { error } = await client.auth.signInWithPassword({ email, password });
    return !error;
  }

  const expected = credentials();
  if (!expected) return false;
  // constant-time-ish: compare both, never short-circuit on the email
  const emailOk = email.trim().toLowerCase() === expected.email.toLowerCase();
  const passBuf = Buffer.from(password.padEnd(64).slice(0, 64));
  const expBuf = Buffer.from(expected.password.padEnd(64).slice(0, 64));
  return emailOk && timingSafeEqual(passBuf, expBuf);
}

export function setSession(cookies: AstroCookies, email: string) {
  cookies.set(COOKIE, serialise(email), {
    httpOnly: true,
    sameSite: 'lax',
    secure: env('NODE_ENV') === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export function clearSession(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: '/' });
}

/** Returns a redirect Response when not signed in, otherwise null. */
export function guard(cookies: AstroCookies, redirect: (path: string, status?: 302) => Response): Response | null {
  return readSession(cookies) ? null : redirect('/admin/vhod', 302);
}
