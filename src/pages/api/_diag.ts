// TEMPORARY: confirms which host Astro reconstructs behind Vercel's proxy.
// Deleted as soon as the origin check is verified.
import type { APIRoute } from 'astro';
export const prerender = false;
export const GET: APIRoute = ({ request, url }) => new Response(JSON.stringify({
  astroOrigin: url.origin,
  host: request.headers.get('host'),
  xForwardedHost: request.headers.get('x-forwarded-host'),
  xForwardedProto: request.headers.get('x-forwarded-proto'),
}, null, 2), { headers: { 'Content-Type': 'application/json' } });
