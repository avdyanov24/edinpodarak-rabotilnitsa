/**
 * Static export for GitHub Pages.
 *
 * Pages has no server, so three route groups cannot exist there: /api
 * (the booking endpoint), /admin (the panel) and /otkazhi (self-service
 * cancellation, which has to read the database). Astro has no way to
 * exclude a route from a build, but it does ignore anything in src/pages
 * whose name starts with "_" — so we move them aside for the build and put
 * them back afterwards, including when the build fails.
 */
import { rename, writeFile, readFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES_BASE = process.env.PAGES_BASE || '/edinpodarak-rabotilnitsa';
const ORIGIN = process.env.PAGES_ORIGIN || 'https://avdyanov24.github.io';

const serverOnly = ['admin', 'api', 'otkazhi'];
const moved = [];

/**
 * Astro decides prerendering by looking for a literal
 * `export const prerender = <boolean>` in the page source. It reads this
 * before Vite runs, so no plugin, env flag or variable can change it — and
 * when it cannot read a literal it quietly prerenders everything. The
 * checked-in value is the one the Node deploy needs (on demand, so a newly
 * published workshop is live immediately); for the static export we flip it
 * on disk for the length of the build and put it back afterwards.
 */
const flipPrerender = [
  'src/pages/index.astro',
  'src/pages/rabotilnitsa/[slug].astro',
  'src/pages/sitemap.xml.ts',
];
const originals = new Map();

const exists = (p) => access(p).then(() => true, () => false);

async function hide() {
  for (const name of serverOnly) {
    const from = join(root, 'src/pages', name);
    const to = join(root, 'src/pages', `_${name}`);
    if (await exists(from)) {
      await rename(from, to);
      moved.push([to, from]);
    }
  }
}

async function patch() {
  for (const rel of flipPrerender) {
    const p = join(root, rel);
    const before = await readFile(p, 'utf8');
    originals.set(p, before);
    const after = before.replace(/export const prerender = false;/g, 'export const prerender = true;');
    if (after === before) throw new Error(`${rel}: no "export const prerender = false;" to flip`);
    await writeFile(p, after);
  }
}

async function restore() {
  for (const [p, before] of originals) await writeFile(p, before);
  originals.clear();
  for (const [from, to] of moved.reverse()) {
    if (await exists(from)) await rename(from, to);
  }
  moved.length = 0;
}

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

let failed = null;
try {
  await hide();
  await patch();
  await run('npx', ['astro', 'build'], { PAGES: '1', PAGES_BASE, PAGES_ORIGIN: ORIGIN });
} catch (err) {
  failed = err;
} finally {
  await restore();
}
if (failed) { console.error(failed.message); process.exit(1); }

const dist = join(root, 'dist');

// Without this, Pages runs the output through Jekyll, which drops any file
// or directory starting with an underscore — including Astro's _astro/.
await writeFile(join(dist, '.nojekyll'), '');

// The published robots.txt still points at the production domain.
const robots = await readFile(join(dist, 'robots.txt'), 'utf8');
await writeFile(
  join(dist, 'robots.txt'),
  robots.replace(/^Sitemap: .*$/m, `Sitemap: ${ORIGIN}${PAGES_BASE}/sitemap.xml`),
);

console.log(`\nStatic export ready in dist/ for ${ORIGIN}${PAGES_BASE}/`);
