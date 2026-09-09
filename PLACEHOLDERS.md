# What in here is real, and what is invented

Everything visual is real. Most of the *words and numbers* are placeholders that
Джейля has to confirm before this can go public. Do not show a client a site
whose data looks authoritative without saying which parts you made up.

## Real

- **All product photography** — pulled from her own shop (`edinpodarak.com`) and
  her Instagram grid. These are her actual pieces.
- **Her logo**, phone, email, Instagram and Facebook links.
- **The moss/forest footage and the workshop-atmosphere photos** — Pexels, free
  licence, see `CREDITS.md`. These are stock and should be replaced with photos
  from her own workshops the moment she sends them; her IG "Работилници"
  highlight already has them.

## Invented — must be confirmed

| Where | What is made up |
|---|---|
| `src/data/events.ts` | All three workshops: titles, dates, prices, durations, capacities, what's included |
| `src/data/events.ts` | The venue — "Ателие „Джейля“, ул. „Иван Вазов“ 12, Пловдив" is fictional |
| `src/data/site.ts` | The three testimonials — plausible, but nobody said them |
| `src/data/site.ts` | That workshops run in Пловдив, monthly |
| `src/data/site.ts` | The four process steps, **including the clock times on the timeline** (0:00 / 0:10 / 0:30 / 1:50) |
| `src/data/site.ts` | Everything in "Какво е включено" |
| `src/data/site.ts` | The group sizes under "За групи" (6–25 души) |
| `src/pages/poveritelnost.astro` | Legal identity is `[ТЪРГОВСКО НАИМЕНОВАНИЕ]`, `[ЕИК]`, `[АДРЕС]` |
| `src/pages/usloviya.astro` | The cancellation terms |

Prices are shown in EUR, which matches her shop.

## Backend status

The Supabase schema, booking function, RLS and admin panel are built and tested,
but **no Supabase project exists yet** — that needs an account, so it is one of
the handover steps. Follow `SUPABASE.md`.

Until then the site runs off `.data/db.json`, seeded from `src/data/events.ts`.
The admin panel shows a yellow banner saying so. Anything entered there before
Supabase is connected stays on that one machine.

## Blocking before launch

1. **Jump.bg DNS access** — without it there is no subdomain.
2. **Legal identity** (trader name, ЕИК, registered address) — the privacy
   notice is not valid without it. Her shop publishes none of this either,
   which is worth telling her.
3. **Real workshop photos** to replace the stock ones.
4. **Real event details** for at least the next date.
5. **A Supabase project** (`SUPABASE.md`), and her login created in it.
6. **A native Bulgarian read of every string.** The copy has had a calque pass
   but register cannot be guaranteed by anyone who is not a native speaker —
   Джейля is the right reader, and it is her voice on the page.
