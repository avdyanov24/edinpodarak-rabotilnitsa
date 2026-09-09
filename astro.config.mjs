import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

/**
 * Default — Vercel. Everything works: the booking endpoint, the admin panel,
 * pages rendered on demand so a workshop published in the panel shows up
 * immediately.
 *
 * PAGES=1 — a static export with no server behind it, kept for a preview
 * build. tools/build-pages.mjs sets it and leaves /admin and /api out.
 */
const pages = process.env.PAGES === '1';
const base = process.env.PAGES_BASE || '/edinpodarak-rabotilnitsa';

export default defineConfig({
  // Overridden by SITE_URL so the Vercel URL is correct before DNS moves.
  site: pages
    ? 'https://avdyanov24.github.io'
    : process.env.SITE_URL || 'https://rabotilnitsa.edinpodarak.com',
  ...(pages ? { base } : {}),
  // The legal pages are prerendered; anything that reads the database
  // (home, event pages, sitemap, /api, /admin) is rendered on demand.
  ...(pages ? {} : { adapter: vercel() }),
  image: { service: { entrypoint: 'astro/assets/services/sharp' } },
  // Pages has no rewrite rules: with directory output every internal link
  // costs a 301 to add the trailing slash, and the canonical then disagrees
  // with the URL that was linked. File output is served directly.
  build: { inlineStylesheets: 'auto', ...(pages ? { format: 'file' } : {}) },
  devToolbar: { enabled: false },
  vite: {
    // Readable from both server code and the browser bundles, so one flag
    // drives prerendering, link prefixes and the sign-up fallback.
    define: { 'import.meta.env.PUBLIC_PAGES': JSON.stringify(pages) },
  },
});
