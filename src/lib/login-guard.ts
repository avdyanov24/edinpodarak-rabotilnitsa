import { admin } from './db/supabase';
import { hasSupabase } from './env';

/**
 * How many wrong passwords the login will take before it stops listening.
 *
 * Two limits, because they stop different attacks: one address grinding
 * through passwords, and a spread of addresses all guessing one account.
 * A correct password clears both, so the owner fumbling their own password
 * cannot lock themselves out for the rest of the window.
 */
export const WINDOW_MINUTES = 15;
const IP_MAX = 8;
const EMAIL_MAX = 5;

export interface Throttle {
  locked: boolean;
  /** seconds until the door opens again */
  retryAfter: number;
}

const open: Throttle = { locked: false, retryAfter: 0 };

// ---------------------------------------------------------------- local ---
// Development only. Memory is not somewhere to keep this on a real deploy:
// serverless instances each hold their own, and a cold start wipes it.
type Attempt = { ip: string; email: string; at: number };
const memory: Attempt[] = [];

function memoryCheck(ip: string, email: string): Throttle {
  const since = Date.now() - WINDOW_MINUTES * 60_000;
  const recent = memory.filter((a) => a.at > since);
  const ipFails = recent.filter((a) => a.ip === ip);
  const emFails = recent.filter((a) => a.email === email.toLowerCase());
  if (ipFails.length >= IP_MAX || emFails.length >= EMAIL_MAX) {
    const last = Math.max(...[...ipFails, ...emFails].map((a) => a.at));
    return { locked: true, retryAfter: Math.max(Math.ceil((last + WINDOW_MINUTES * 60_000 - Date.now()) / 1000), 1) };
  }
  return open;
}

// ------------------------------------------------------------------ api ---

/** Is this address, or this account, currently locked out? */
export async function checkLogin(ip: string, email: string): Promise<Throttle> {
  // The in-memory count runs whatever else happens. On its own it is weak -
  // serverless instances each keep their own and a cold start wipes it - but
  // it is the backstop for the case below where the database cannot answer,
  // which would otherwise leave the door completely unguarded.
  const local = memoryCheck(ip, email);
  if (!hasSupabase()) return local;

  try {
    const { data, error } = await admin().rpc('login_throttle', { p_ip: ip, p_email: email });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return local;
    const remote = { locked: Boolean(row.locked), retryAfter: Number(row.retry_after ?? 0) };
    return remote.locked ? remote : local;
  } catch {
    // A throttle that cannot be read must not become a door that cannot be
    // opened - the password check still stands behind it, and the count above
    // still bites within this instance.
    return local;
  }
}

/** Write down what happened, so the next attempt knows about it. */
export async function recordLogin(ip: string, email: string, ok: boolean): Promise<void> {
  // Always kept, Supabase or not: see the backstop in checkLogin.
  if (ok) {
    for (let i = memory.length - 1; i >= 0; i--) {
      if (memory[i].ip === ip || memory[i].email === email.toLowerCase()) memory.splice(i, 1);
    }
  } else {
    memory.push({ ip, email: email.toLowerCase(), at: Date.now() });
    // never let a stream of attempts grow the process
    if (memory.length > 500) memory.splice(0, memory.length - 500);
  }
  if (!hasSupabase()) return;

  try {
    await admin().rpc('record_login_attempt', { p_ip: ip, p_email: email, p_ok: ok });
  } catch {
    // never let bookkeeping break the sign-in itself
  }
}

/** "след 12 минути" / "след малко" — for the message on the page. */
export function retryPhrase(seconds: number): string {
  const m = Math.ceil(seconds / 60);
  if (m <= 1) return 'след минута';
  return `след ${m} минути`;
}
