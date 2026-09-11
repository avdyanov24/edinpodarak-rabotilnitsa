# What in here is real, and what is invented

The subject changed late: these are **ceramics** workshops in **Гоце Делчев**,
not moss art in Пловдив. Everything on the site was rewritten for that, but
most of the specifics are still guesses. Do not show a client a site whose data
looks authoritative without saying which parts you made up.

## Real — confirmed from her own Facebook

- **The brand** — „Подари с Джейля“: logo, phone, email, Instagram, Facebook,
  and the shop at edinpodarak.com.
- **The three workshop titles.** They are hers, taken from her event pages:
  „Глина и лимонада“, „Направи своя керамична чаша“ (that one is at edition #7),
  „Природа, глина, лимонада“ — ботаническа чиния (edition #5).
- **The town and street** — гр. Гоце Делчев, ул. „Брегалница“ 3.
- **One line of the hero copy** is her own, from a post of hers:
  *„Понякога най-хубавите вечери не са пред екрана, а с чаша в ръце, която сам
  си създал.“* It is lightly adapted. If she would rather it stayed hers alone,
  it is one line to change.

## Invented — must be confirmed

| Where | What is made up |
|---|---|
| `src/data/events.ts` | All dates, times, prices, durations, capacities and seat counts |
| `src/data/events.ts` | The venue is called „Ателие „Джейля““ — the street is right, the name is a guess |
| `src/data/site.ts` | **That the piece is collected later.** Clay has to dry and be fired twice, so the site says she writes when it is ready. Standard for ceramics, but confirm how long it takes and whether people collect or she posts them |
| `src/data/site.ts` | The four steps of „Как протича“ and the clock times on them |
| `src/data/site.ts` | Everything under „Какво е включено“, including that glazing and both firings are in the price |
| `src/data/site.ts` | The three testimonials — plausible, but nobody said them |
| `src/data/site.ts` | The age limit (12) and the group sizes under „За групи“ (6–25) |
| `src/pages/poveritelnost.astro` | Legal identity is `[ТЪРГОВСКО НАИМЕНОВАНИЕ]`, `[ЕИК]`, `[АДРЕС]` |
| `src/pages/usloviya.astro` | The cancellation terms |

**Every photograph is Pexels stock** — see `CREDITS.md`. Her own photos of the
ceramics workshops should replace all of them.

Prices are shown in EUR, which matches her shop.

## Worth asking her

- Her Facebook post says *„местата за първите **ни** работилници“* — **ни**, not
  **ми**. If she runs these with someone, the whole site is in the wrong
  person: it is written throughout as „аз“ — „показвам“, „пиша ти“, „пиши ми“.
- Do the moss workshops still happen at all? The site now says nothing about
  them; the shop link in the footer is the only trace.
- Is „Работилница по керамика #7“ a numbering she wants shown on the site?

## Backend status

Live. Supabase is connected, the migrations are applied, bookings are taken and
counted, and the retention job runs nightly. The three workshops above are
seeded into it with synthetic bookings named `Резервирано N (демо)` so the seat
counts add up — **delete those when the real dates go in.**

## Blocking before launch

1. **Jump.bg DNS access** — without it there is no subdomain.
2. **Legal identity** (trader name, ЕИК, registered address) for the privacy notice.
3. **Her own photos** of the ceramics workshops.
4. **Real dates, prices and durations**, and the demo rows deleted.
5. **How the firing and collection actually work** — the site currently promises
   something plausible rather than something she confirmed.
6. **Her own login** in Supabase → Authentication → Users, and the shared admin
   password changed.
7. **A native Bulgarian read of every string**, by her.
