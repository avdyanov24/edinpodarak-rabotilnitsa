import { createHmac, timingSafeEqual, randomBytes, randomUUID } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { env, hasSupabase, isDeployed } from './env';

/**
 * Signing in, and staying signed in.
 *
 * With Supabase configured the password is checked by Supabase Auth; without
 * it, against ADMIN_EMAIL / ADMIN_PASSWORD so the panel can be demonstrated
 * before the project exists. Either way no Supabase token is put in the
 * browser - the cookie is ours.
 *
 * What the cookie holds is a signed pointer to a row in `admin_sessions`,
 * not the session itself. That is the whole difference: a self-contained
 * token cannot be taken back, so „Излез“ only ever cleared the browser it
 * was pressed in, a copy taken from anywhere else went on working for its
 * full twelve hours, and changing the password did nothing to it. A pointer
 * can be revoked - and the row also answers the question that matters once a
 * password has been shared: who has been in here, and when.
 */

const MAX_AGE = 60 * 60 * 12; // 12 hours

/**
 * Cookies are only marked Secure - and only get the __Host- prefix - where
 * there is TLS to rely on.
 *
 * The prefix matters more here than it looks: the site is going to live on a
 * subdomain of edinpodarak.com, whose parent is a hosted shop nobody here
 * controls. A cookie set for `.edinpodarak.com` would otherwise be able to
 * shadow this one. A browser refuses any __Host- cookie that carries a
 * Domain attribute, so the panel's session can only ever come from the
 * panel's own host.
 */
const SECURE = isDeployed() || env('NODE_ENV') === 'production';
const COOKIE = SECURE ? '__Host-rab_admin' : 'rab_admin';
/** Cookies written by earlier versions, cleared on sight. */
const LEGACY_COOKIES = ['rab_admin', '__Host-rab_admin'].filter((c) => c !== COOKIE);

export interface Session { id: string; email: string }

export interface SessionRecord {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
  ip: string;
  user_agent: string;
}

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
 * deployed site - see credentials() below.
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

/* -------------------------------------------------------------------------
 * Where the sessions live.
 *
 * Postgres when there is a Supabase behind the site. In memory otherwise -
 * which is development only: a deploy without Supabase cannot keep a booking
 * either, and says so.
 * ---------------------------------------------------------------------- */

interface Store {
  start(email: string, ip: string, agent: string): Promise<string>;
  touch(id: string): Promise<Session | null>;
  revoke(id: string): Promise<void>;
  revokeAll(email: string, except?: string): Promise<number>;
  recent(email: string): Promise<SessionRecord[]>;
}

type MemRow = SessionRecord & { email: string };
const memory = new Map<string, MemRow>();

const memoryStore: Store = {
  async start(email, ip, agent) {
    const id = randomUUID();
    const now = new Date();
    memory.set(id, {
      id, email: email.toLowerCase(),
      created_at: now.toISOString(), last_seen_at: now.toISOString(),
      expires_at: new Date(now.getTime() + MAX_AGE * 1000).toISOString(),
      revoked_at: null, ip, user_agent: agent,
    });
    return id;
  },
  async touch(id) {
    const row = memory.get(id);
    if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) return null;
    row.last_seen_at = new Date().toISOString();
    return { id, email: row.email };
  },
  async revoke(id) {
    const row = memory.get(id);
    if (row && !row.revoked_at) row.revoked_at = new Date().toISOString();
  },
  async revokeAll(email, except) {
    let n = 0;
    for (const row of memory.values()) {
      if (row.email !== email.toLowerCase() || row.revoked_at || row.id === except) continue;
      if (new Date(row.expires_at) < new Date()) continue;
      row.revoked_at = new Date().toISOString();
      n++;
    }
    return n;
  },
  async recent(email) {
    return [...memory.values()]
      .filter((r) => r.email === email.toLowerCase())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 8);
  },
};

/** Imported lazily so nothing drags the service-role client into dev builds. */
async function rpc() {
  const { admin } = await import('./db/supabase');
  return admin();
}

const dbStore: Store = {
  async start(email, ip, agent) {
    const { data, error } = await (await rpc()).rpc('admin_session_start', {
      p_email: email, p_ip: ip, p_agent: agent, p_hours: MAX_AGE / 3600,
    });
    if (error) throw error;
    return String(data);
  },
  async touch(id) {
    const { data, error } = await (await rpc()).rpc('admin_session_touch', { p_id: id });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row?.email ? { id, email: String(row.email) } : null;
  },
  async revoke(id) {
    await (await rpc()).rpc('admin_session_revoke', { p_id: id });
  },
  async revokeAll(email, except) {
    const { data } = await (await rpc()).rpc('admin_session_revoke_all', {
      p_email: email, p_except: except ?? null,
    });
    return Number(data ?? 0);
  },
  async recent(email) {
    const { data } = await (await rpc()).rpc('admin_sessions_recent', { p_email: email, p_limit: 8 });
    return (data ?? []) as SessionRecord[];
  },
};

const store = (): Store => (hasSupabase() ? dbStore : memoryStore);

/* ---------------------------------------------------------------- cookie -- */

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

/**
 * The signature is checked before the database is, so a made-up cookie costs
 * a hash rather than a query - there is no point letting anyone drive traffic
 * into Postgres by pasting nonsense.
 */
function unwrap(raw: string | undefined): string | null {
  if (!raw) return null;
  const [id, mac] = raw.split('.');
  if (!id || !mac) return null;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(id));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

export async function readSession(cookies: AstroCookies): Promise<Session | null> {
  const id = unwrap(cookies.get(COOKIE)?.value);
  if (!id) return null;
  try {
    return await store().touch(id);
  } catch {
    // The panel is the one place where a database that cannot answer has to
    // mean „no“. Everything in here is somebody's name and telephone number.
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

export async function setSession(
  cookies: AstroCookies, email: string, ip = '', agent = '',
): Promise<void> {
  const id = await store().start(email, ip, agent);
  for (const old of LEGACY_COOKIES) cookies.delete(old, { path: '/' });
  cookies.set(COOKIE, `${id}.${sign(id)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: SECURE,
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function clearSession(cookies: AstroCookies): Promise<void> {
  const id = unwrap(cookies.get(COOKIE)?.value);
  if (id) { try { await store().revoke(id); } catch { /* the cookie still goes */ } }
  cookies.delete(COOKIE, { path: '/' });
  for (const old of LEGACY_COOKIES) cookies.delete(old, { path: '/' });
}

/** „Излез от всички устройства“ - everything except the browser asking. */
export async function revokeOtherSessions(session: Session): Promise<number> {
  try {
    return await store().revokeAll(session.email, session.id);
  } catch {
    return 0;
  }
}

/** The sign-ins on this account, for her to look at. */
export async function recentSessions(email: string): Promise<SessionRecord[]> {
  try {
    return await store().recent(email);
  } catch {
    return [];
  }
}
