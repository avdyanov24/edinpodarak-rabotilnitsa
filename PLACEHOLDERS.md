# What in here is real, and what is invented

The subject changed late: these are **ceramics** workshops in **Гоце Делчев**,
not moss art in Пловдив. Everything on the site was rewritten for that, but
most of the specifics are still guesses. Do not show a client a site whose data
looks authoritative without saying which parts you made up.

## Real — read off her own event posters

Her four Facebook event covers are posters, and they carry the details. These
are no longer guesses:

- **Злата Златкова, майстор керамик, leads the workshops.** Джейля hosts them
  in her shop and takes the bookings. The site now says so — „Злата показва
  захвата“, „Води Злата Златкова“ — instead of implying Джейля teaches.
- **25 € per person, всичко включено.** Not the 31/45/36 I had invented.
- **8 places.** „САМО 8 МЕСТА“ on two of the posters.
- **Два часа**, evening starts (18:00) or afternoon (16:00).
- **Магазин „Джейля“**, and the posters give the address as
  **ул. „Брегалница“ 1** — see the conflict below.
- **What is included**, in her own words: работилница със Злата · всички
  материали и инструменти · изработка на собствена чаша · изпичане ·
  домашна лимонада и почерпка · много смях.
- **Booking today is by private message** — „Запази своето място с лично
  съобщение“. That is precisely the gap this site closes.
- **The three workshop titles** are hers: „Глина и лимонада“, „Направи своя
  керамична чаша“ (edition #7), „Природа, глина, лимонада“ — ботаническа
  чиния (edition #5).
- **The brand** — „Подари с Джейля“: logo, phone, email, Instagram, Facebook,
  and the shop, which her poster gives as edinpodarak.com.
- **One line of the hero copy** is her own, from a post of hers:
  *„Понякога най-хубавите вечери не са пред екрана, а с чаша в ръце, която сам
  си създал.“* It is lightly adapted. If she would rather it stayed hers alone,
  it is one line to change.

### One conflict to settle

Her posters say **ул. „Брегалница“ 1**. The place tag on her Facebook events
says **ул. Брегалница 3**. The site uses **1**, from the posters. Ask her.

## Invented — must be confirmed

| Where | What is made up |
|---|---|
| `src/data/events.ts` | **The dates and times.** The three on her posters — 1 август, 6 август, 28 август — have all passed, so the ones on the site are invented future dates |
| `src/data/events.ts` | The seat counts (how many are already taken) |
| `src/data/site.ts` | **That the piece is collected later.** Clay has to dry and be fired twice, so the site says she writes when it is ready. Standard for ceramics, but confirm how long it takes and whether people collect or she posts them |
| `src/data/site.ts` | The four steps of „Как протича“ and the clock times on them |
| `src/data/site.ts` | Everything under „Какво е включено“, including that glazing and both firings are in the price |
| `src/data/site.ts` | The three testimonials — plausible, but nobody said them |
| `src/data/site.ts` | The age limit (12) and the group sizes under „За групи“ (6–25) |
| `src/pages/poveritelnost.astro` | Legal identity is `[ТЪРГОВСКО НАИМЕНОВАНИЕ]`, `[ЕИК]`, `[АДРЕС]` |
| `src/pages/usloviya.astro` | The cancellation terms |

**Most of the photography is now hers**, cut out of her own event posters —
the botanical plate, the hand-painted blue cup, the leaf pressed into a slab,
her shop shelves, and the workshop table. They are small, because a poster is
all Facebook would give without a login: between 400px and 810px wide. Ask her
for the originals and they can go straight in.

The hero background and a few gallery tiles are still Pexels stock — see
`CREDITS.md`, which lists exactly which.

Prices are shown in EUR, which matches her shop.

## Worth asking her

- The „ни“ in her post is now explained: Злата leads, Джейля hosts. The site
  reflects that, but she should read it and confirm the division is right.
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
