/**
 * Reads configuration from Astro's import.meta.env when running under Vite,
 * and from process.env everywhere else (scripts, tests, the built server).
 */
export function env(key: string): string | undefined {
  const viteEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
  return viteEnv?.[key] || process.env[key] || undefined;
}

/** Running on a host, rather than on someone's laptop. */
export const isDeployed = () =>
  Boolean(env('VERCEL') || env('NODE_ENV') === 'production');

export const hasSupabase = () =>
  Boolean(env('SUPABASE_URL') && env('SUPABASE_SERVICE_ROLE_KEY'));

/**
 * Whether a booking taken right now would still be there tomorrow.
 *
 * Supabase always is. The file-backed stand-in only is when there is a real
 * disk under it — on Vercel there is not: the filesystem is read-only apart
 * from /tmp, which belongs to one instance and is thrown away. Rather than
 * lose someone's seat, the form falls back to email until Supabase is set up.
 */
export const bookingsPersist = () => hasSupabase() || !isDeployed();
