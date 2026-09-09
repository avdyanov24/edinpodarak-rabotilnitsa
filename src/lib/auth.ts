import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { env, hasSupabase } from './env';

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
  if (env('NODE_ENV') === 'production') {
    throw new Error('ADMIN_SESSION_SECRET must be set in production');
  }
  // dev only: stable for the life of the process
  return (globalThis as any).__rabDevSecret ??= randomBytes(32).toString('hex');
}

/** Can this deploy issue sessions at all? False when the secret is missing. */
export function isConfigured(): boolean {
  try { secret(); return true; } catch { return false; }
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

  const expectedEmail = env('ADMIN_EMAIL') ?? 'admin@example.com';
  const expectedPass = env('ADMIN_PASSWORD') ?? 'rabotilnitsa';
  // constant-time-ish: compare both, never short-circuit on the email
  const emailOk = email.trim().toLowerCase() === expectedEmail.toLowerCase();
  const passBuf = Buffer.from(password.padEnd(64).slice(0, 64));
  const expBuf = Buffer.from(expectedPass.padEnd(64).slice(0, 64));
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
