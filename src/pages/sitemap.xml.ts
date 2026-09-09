import type { APIRoute } from 'astro';
import { getPublishedEvents } from '../lib/events';
import { root } from '../lib/url';

/**
 * Written by hand because the workshop pages are rendered on demand — the
 * sitemap integration only ever sees prerendered routes, so it would list
 * the static pages and silently drop every event.
 */
export const prerender = false;

const STATIC: { path: string; priority: string; freq: string }[] = [
  { path: '/', priority: '1.0', freq: 'weekly' },
  { path: '/poveritelnost', priority: '0.2', freq: 'yearly' },
  { path: '/usloviya', priority: '0.2', freq: 'yearly' },
];

export const GET: APIRoute = async ({ site }) => {
  const origin = root(site ?? new URL('https://rabotilnitsa.edinpodarak.com'));
  const events = await getPublishedEvents();

  const url = (loc: string, lastmod: string | undefined, freq: string, priority: string) =>
    `  <url>\n    <loc>${origin}${loc}</loc>\n` +
    (lastmod ? `    <lastmod>${lastmod.slice(0, 10)}</lastmod>\n` : '') +
    `    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...STATIC.map((s) => url(s.path, undefined, s.freq, s.priority)),
    ...events.map((e) => url(`/rabotilnitsa/${e.slug}`, e.updated_at, 'daily', '0.8')),
    '</urlset>',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      ...(import.meta.env.PUBLIC_PAGES ? {} : { 'Cache-Control': 'public, max-age=600' }),
    },
  });
};
