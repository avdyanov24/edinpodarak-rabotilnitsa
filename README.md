# Работилница · Джейля

Single-page site for the Scandinavian-moss workshops run by Джейля
(`edinpodarak.com`), built by Alesse Studio.

Bulgarian only. Intended to live at **rabotilnitsa.edinpodarak.com**.

## Run it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build
```

## What is where

```
src/
  data/site.ts        all page copy — becomes the `site_content` row in the CMS
  data/events.ts      mock events, shaped exactly like the `events` table
  lib/events.ts       the ONLY seam to the data source — swap this for Supabase
  lib/format.ts       Bulgarian dates, durations, prices, seat availability
  components/         one file per section
  pages/
    index.astro                  the single page
    rabotilnitsa/[slug].astro    per-event page (Event JSON-LD + OG image)
    api/register.ts              booking endpoint (on-demand rendered)
    poveritelnost / usloviya     legal pages
public/media/         images (WebP) and the hero video
tools/                screenshot + end-to-end check scripts
```

Everything is static except `/api/register`, which is marked
`prerender = false` and runs on the Node adapter.

## Checks

```bash
node tools/sql-test.mjs      # migrations + booking concurrency, on real Postgres
node tools/admin-check.mjs   # the admin panel, end to end
node tools/flow.mjs          # booking flow + section interactions
node tools/replay-check.mjs  # every scroll animation replays on a second pass
node tools/anim-check.mjs    # animations armed with JS, page readable without it
node tools/imgcheck.mjs      # no 4xx/5xx, no broken images, all four pages
node tools/ratio-check.mjs   # every CSS aspect-ratio is actually honoured
node tools/gallery-check.mjs # gallery rows align, lightbox navigates
node tools/faq-check.mjs     # accordion opens, closes, stays exclusive
node tools/slop-audit.mjs    # the generic-AI-design tells stay absent
node tools/contrast-check.mjs# WCAG AA on light backgrounds
node tools/shoot.mjs         # design screenshots into shots/
```

Run `npm run dev` in another terminal first — they all drive the dev server.

## Scroll animations

Reveals replay: an element re-arms once it is **completely** off screen, so the
animation plays again on the way back down. The thresholds give it hysteresis —
it reveals at 8% visible but only resets at 0% — so nothing fades out from under
a reader who is still on it. `REPLAY` in `src/layouts/Base.astro` switches the
whole page back to one-way reveals.

The manifesto lighting and the Как протича timeline are scroll-linked, so they
already track in both directions. The hero entrance restarts when the hero comes
back into view.

Anything that starts hidden for an animation is scoped to `html.js`, set by an
inline script before first paint, so a blocked script leaves a readable page.
Write those rules as `:global(html.js) .thing` — Astro scopes a bare `.js`
ancestor to the component and it will silently never match.

## Data

Two interchangeable backends behind one interface (`src/lib/db/`):

- **Supabase** whenever `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- **A local JSON file** (`.data/db.json`) otherwise, so the site and the admin
  panel are fully usable before the Supabase project exists

Both implement `src/lib/db/types.ts`. The local one deliberately mirrors the SQL
semantics of `register_for_event` and `cancel_registration` — change one, change
the other.

Schema, booking function, RLS and retention live in `supabase/migrations/`.
See **SUPABASE.md** to connect it.

## Admin panel

Bulgarian, at `/admin`.

| Route | What it does |
|---|---|
| `/admin/vhod` | Sign in |
| `/admin` | Every workshop, seats taken, waiting lists |
| `/admin/rabotilnitsa/[id]` | Add or edit; publish, repeat on a new date, delete |
| `/admin/zapisvaniya/[id]` | Who booked; mark attended or cancelled; CSV for the venue |
| `/admin/sadarzhanie` | The FAQ and the reviews shown on the site |

Sign-in checks the password against Supabase Auth when configured, otherwise
against `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Either way the browser only ever gets
our own signed, 12-hour session cookie — no Supabase tokens.

## Rendering

The legal pages are prerendered. Everything that reads the database — the home
page, event pages, the sitemap, `/api`, `/admin` — is rendered on demand, so a
workshop published in the panel is live immediately rather than at the next
deploy. Public pages send `max-age=60, stale-while-revalidate=600`.

## Deploying

Two targets, one source tree.

### Node — the real deploy

`npm run build` produces `dist/server` + `dist/client` for the standalone Node
adapter (Vercel, Fly, a VPS). This is the only target where the whole thing
works: `/api/register`, the admin panel, cancellation links, and pages rendered
per request.

DNS for `edinpodarak.com` sits at Jump.bg (`ns1/ns2.jumphosting01.com`), not at
Sellavi, so the subdomain is a single CNAME. Nothing in the build depends on the
final hostname — it can run on a `*.vercel.app` URL until DNS is sorted.

### GitHub Pages — the public preview

`npm run build:pages` produces a static `dist/`, published by
`.github/workflows/pages.yml` on every push to `main`.

**Pages has no server**, so three things cannot exist there and the build script
(`tools/build-pages.mjs`) leaves them out of the export entirely:

| | on Pages |
|---|---|
| `/api/register` | gone — the sign-up form composes an email to Джейля instead |
| `/admin` | gone — nothing to log in to, and no session secret in a public repo |
| `/otkazhi/[token]` | gone — cancellation needs to write to the database |

Everything else is real: the workshops, the per-event pages, the gallery,
the animations, the JSON-LD, the sitemap.

Two things about that build worth knowing before touching it:

- **Astro reads `export const prerender` as literal source text**, before Vite
  runs. An env flag or a variable there does not work — it silently prerenders
  everything, which on the Node deploy means a workshop published in the panel
  never appears. So the build script flips the literal on disk for the length
  of the build and puts it back in a `finally`.
- **A project site lives under `/<repo>/`**, so every absolute path needs that
  prefix (`src/lib/url.ts`). One missed prefix 404s only in production, so
  `tools/pages-check.mjs` walks the built HTML and fails the deploy if any
  internal reference is unprefixed or dead. `tools/serve-pages.mjs` serves
  `dist/` at the same sub-path locally.

When the real subdomain goes live, the Pages copy should either be taken down or
set to `noindex` — otherwise it competes with the production site in Google.
