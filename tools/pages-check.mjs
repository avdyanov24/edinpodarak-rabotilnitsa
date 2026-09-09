/**
 * A project site on GitHub Pages lives under /<repo>/, so every absolute
 * link and asset needs that prefix. A missed one 404s silently and only in
 * production, which is the worst place to find it — so check the built
 * output instead: every internal reference must resolve to a real file.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const BASE = process.env.PAGES_BASE || '/edinpodarak-rabotilnitsa';

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const files = await walk(dist);
const html = files.filter((f) => f.endsWith('.html'));
const problems = [];
let checked = 0;

const exists = async (p) => stat(p).then((s) => s.isFile(), () => false);

async function resolves(ref) {
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return true;
  // dist/ IS the base directory once deployed, so strip the prefix
  const rel = clean.slice(BASE.length).replace(/^\//, '');
  const p = resolve(dist, rel);
  if (await exists(p)) return true;
  if (await exists(join(p, 'index.html'))) return true;
  return false;
}

for (const file of html) {
  const src = await readFile(file, 'utf8');
  const where = file.slice(dist.length) || '/index.html';

  // every absolute reference the browser will fetch or follow
  const refs = new Set();
  for (const m of src.matchAll(/(?:href|src|poster|content|data-src)="(\/[^"]*)"/g)) refs.add(m[1]);
  for (const m of src.matchAll(/url\((["']?)(\/[^)"']+)\1\)/g)) refs.add(m[2]);
  for (const m of src.matchAll(/"src":"(\/[^"]+)"/g)) refs.add(m[1]);

  for (const ref of refs) {
    checked++;
    if (!ref.startsWith(`${BASE}/`) && ref !== BASE) {
      problems.push(`${where}: missing base prefix → ${ref}`);
      continue;
    }
    if (!(await resolves(ref))) problems.push(`${where}: dead link → ${ref}`);
  }

  // things that must not survive into a static export
  if (src.includes('/api/register')) problems.push(`${where}: still posts to /api/register`);
  if (/href="[^"]*\/admin/.test(src)) problems.push(`${where}: links into /admin`);
}

const must = ['index.html', '404.html', 'sitemap.xml', 'robots.txt', '.nojekyll'];
for (const f of must) {
  if (!(await exists(join(dist, f)))) problems.push(`missing ${f}`);
}

// the canonical must point at where the page actually lives
for (const file of html) {
  const src = await readFile(file, 'utf8');
  const m = src.match(/<link rel="canonical" href="([^"]+)"/);
  const where = file.slice(dist.length);
  if (!m) problems.push(`${where}: no canonical`);
  else if (!m[1].includes(BASE)) problems.push(`${where}: canonical drops the base → ${m[1]}`);
}

console.log(`${html.length} pages · ${checked} internal references checked`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error('  ✗ ' + p);
  process.exit(1);
}
console.log('all internal links resolve, base prefix applied everywhere');
