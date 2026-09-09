/**
 * Reads configuration from Astro's import.meta.env when running under Vite,
 * and from process.env everywhere else (scripts, tests, the built server).
 */
export function env(key: string): string | undefined {
  const viteEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
  return viteEnv?.[key] || process.env[key] || undefined;
}

export const hasSupabase = () =>
  Boolean(env('SUPABASE_URL') && env('SUPABASE_SERVICE_ROLE_KEY'));
