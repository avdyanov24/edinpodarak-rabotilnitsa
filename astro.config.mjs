import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

/**
 * Two deploy targets from one source tree.
 *
 * Default — a Node server (Vercel, Fly, a VPS). Everything works: the
 * booking endpoint, the admin panel, pages rendered on demand so a newly
 * published workshop shows up immediately.
 *
 * PAGES=1 — a static export for GitHub Pages, which has no server. The
 * public pages are baked at build time and the sign-up form falls back to
 * email. tools/build-pages.mjs sets this and keeps /admin and /api out of
 * the build entirely.
 */
const pages = process.env.PAGES === '1';
const base = process.env.PAGES_BASE || '/edinpodarak-rabotilnitsa';

export default defineConfig({
  site: pages ? 'https://avdyanov24.github.io' : 'https://rabotilnitsa.edinpodarak.com',
  ...(pages ? { base } : {}),
  // The legal pages are prerendered; anything that reads the database
  // (home, event pages, sitemap, /api, /admin) is rendered on demand.
  ...(pages ? {} : { adapter: node({ mode: 'standalone' }) }),
  image: { service: { entrypoint: 'astro/assets/services/sharp' } },
  build: { inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
  vite: {
    // Readable from both server code and the browser bundles, so one flag
    // drives prerendering, link prefixes and the sign-up fallback.
    define: { 'import.meta.env.PUBLIC_PAGES': JSON.stringify(pages) },
  },
});
