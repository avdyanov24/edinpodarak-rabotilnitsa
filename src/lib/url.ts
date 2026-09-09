/**
 * GitHub Pages serves a project site from a sub-path (/edinpodarak-rabotilnitsa/),
 * so every absolute link and asset has to carry that prefix. On the real
 * deploy BASE_URL is "/" and both helpers are pass-throughs.
 */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

/**
 * Prefix an absolute site path. Leaves tel:, mailto: and full URLs alone —
 * and passes null through, because a workshop saved without a cover image
 * has none and Astro drops the attribute for us.
 */
export function u<T extends string | null | undefined>(path: T): T {
  return (typeof path === 'string' && path.startsWith('/') ? `${BASE}${path}` : path) as T;
}

/** Absolute URL for canonicals, OG tags and JSON-LD. */
export function abs(path: string, site: URL | undefined): string {
  return `${site ? site.origin : ''}${u(path)}`;
}

/** Origin + base, with no trailing slash — the site's public root. */
export function root(site: URL | undefined): string {
  return `${site ? site.origin : ''}${BASE}`;
}
