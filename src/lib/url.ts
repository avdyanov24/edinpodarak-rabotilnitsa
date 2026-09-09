/**
 * GitHub Pages serves a project site from a sub-path (/edinpodarak-rabotilnitsa/),
 * so every absolute link and asset has to carry that prefix. On the real
 * deploy BASE_URL is "/" and both helpers are pass-throughs.
 */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

/** Prefix an absolute site path. Leaves tel:, mailto: and full URLs alone. */
export function u(path: string): string {
  return path.startsWith('/') ? `${BASE}${path}` : path;
}

/** Absolute URL for canonicals, OG tags and JSON-LD. */
export function abs(path: string, site: URL | undefined): string {
  return `${site ? site.origin : ''}${u(path)}`;
}

/** Origin + base, with no trailing slash — the site's public root. */
export function root(site: URL | undefined): string {
  return `${site ? site.origin : ''}${BASE}`;
}
