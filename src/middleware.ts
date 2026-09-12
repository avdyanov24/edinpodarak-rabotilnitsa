import { defineMiddleware } from 'astro:middleware';
import { isCanonicalHost } from './lib/env';

/**
 * Headers every response carries.
 *
 * Nothing here is exotic — it is the set that stops a page being framed by
 * somebody else's site, stops browsers guessing at content types, and keeps
 * the panel out of caches and out of referrer headers. The panel is the part
 * that matters: it holds every attendee's name, phone and email.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const h = response.headers;

  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

  // Vercel already sends this; sending it ourselves means it survives a move
  // to any other host.
  h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');

  /**
   * Content-Security-Policy.
   *
   * Two policies, because the two halves of the site are worth different
   * amounts to an attacker. The public pages get the shape of the thing -
   * nobody may frame us, submit our forms somewhere else, or rewrite where
   * relative URLs point. The panel gets the strict version: even if something
   * did manage to inject a script in there, it could not load code from
   * another origin and could not send a single attendee's telephone number
   * off to one.
   *
   * `unsafe-inline` on styles is unavoidable - Astro inlines small
   * stylesheets, and there are inline style attributes throughout. It is the
   * weakest line here and it is worth saying so rather than implying the
   * panel is sealed.
   */
  const admin = context.url.pathname.startsWith('/admin') || context.url.pathname.startsWith('/api/admin');
  h.set('Content-Security-Policy', admin
    ? [
        "default-src 'self'",
        "img-src 'self' data: blob: https://*.supabase.co",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self' 'unsafe-inline'",
        "connect-src 'self'",
        "font-src 'self'",
        "form-action 'self'",
        "base-uri 'none'",
        "object-src 'none'",
        "frame-ancestors 'none'",
      ].join('; ')
    : [
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'none'",
        "object-src 'none'",
      ].join('; '));

  // Only the real address is meant to be indexed. The *.vercel.app production
  // URL is temporary and the пробна link is work in progress — if either got
  // into Google it would sit next to her own site in the results, showing
  // half-finished copy and dates that may since have changed. The rule is by
  // hostname, so it stops being needed on its own the day DNS moves.
  if (!isCanonicalHost(context.url.hostname) || admin) {
    // The panel is never indexable, whatever hostname it is reached at.
    h.set('X-Robots-Tag', 'noindex, nofollow');
  }

  if (context.url.pathname.startsWith('/admin') || context.url.pathname.startsWith('/otkazhi')) {
    // Personal data: keep it out of a shared browser's cache, and do not hand
    // the address of a cancellation link to whatever site is linked from it.
    //
    // `same-origin` rather than `no-referrer`, deliberately: no-referrer makes
    // Chrome send `Origin: null` on a form post, which Astro's cross-site
    // check then rejects — it would have made the panel impossible to log
    // into. This still sends nothing to other sites.
    h.set('Cache-Control', 'no-store, max-age=0');
    h.set('Referrer-Policy', 'same-origin');
  }

  return response;
});
