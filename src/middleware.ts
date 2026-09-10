import { defineMiddleware } from 'astro:middleware';

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
  h.set('Content-Security-Policy', "frame-ancestors 'none'");
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

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
