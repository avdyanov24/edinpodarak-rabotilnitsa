# What in here is real, and what is invented

The subject changed late: these are **ceramics** workshops in **Гоце Делчев**,
not moss art in Пловдив. Everything on the site was rewritten for that, but
most of the specifics are still guesses. Do not show a client a site whose data
looks authoritative without saying which parts you made up.

## Real - read off her own event posters

Her four Facebook event covers are posters, and they carry the details. These
are no longer guesses:

- **Злата Златкова, майстор керамик, leads the workshops.** Джейля hosts them
  in her shop and takes the bookings. The site now says so - „Злата показва
  захвата“, „Води Злата Златкова“ - instead of implying Джейля teaches.
- **25 € per person, всичко включено.** Not the 31/45/36 I had invented.
- **8 places.** „САМО 8 МЕСТА“ on two of the posters.
- **Два часа**, evening starts (18:00) or afternoon (16:00).
- **Магазин „Джейля“**, and the posters give the address as
  **ул. „Брегалница“ 1** - see the conflict below.
- **What is included**, in her own words: работилница със Злата · всички
  материали и инструменти · изработка на собствена чаша · изпичане ·
  домашна лимонада и почерпка · много смях.
- **Booking today is by private message** - „Запази своето място с лично
  съобщение“. That is precisely the gap this site closes.
- **The three workshop titles** are hers: „Глина и лимонада“, „Направи своя
  керамична чаша“ (edition #7), „Природа, глина, лимонада“ - ботаническа
  чиния (edition #5).
- **The brand** - „Подари с Джейля“: logo, phone, email, Instagram, Facebook,
  and the shop, which her poster gives as edinpodarak.com.
- **One line of the hero copy** is her own, from a post of hers:
  *„Понякога най-хубавите вечери не са пред екрана, а с чаша в ръце, която сам
  си създал.“* It is lightly adapted. If she would rather it stayed hers alone,
  it is one line to change.

### Settled by her

- **ул. „Брегалница“ 1, гр. Гоце Делчев.** She confirmed it in writing; the
  place tag on her Facebook events said 3, and it was wrong. She typed
  „Брегалница 1ц“ - read as a slip for „1,“. If it is really 1В or similar,
  it is one line in `src/data/events.ts`.
- **25 €** - confirmed.
- **Гоце Делчев** - confirmed.
- **От 3 до 8 души в работилница.** „максимум 8 човека може да съберем в
  работилница и минимум 3“, 12 September 2026. The maximum was already the
  capacity; the minimum is now a field on every workshop (`min_participants`,
  default 3) and is said out loud on the site, in the confirmation and in the
  terms. What is still unconfirmed is **how late she decides** - the site says
  „ако не се съберем, ще ти се обадя“ without naming a deadline.
- **The next workshop: четвъртък, 17 септември, 18:00.** It is live on the
  site and open for booking.

### Only one workshop is published

The other two are **drafts**. Invented dates that people could actually book
had to come off - someone turning up to a workshop that was never scheduled is
a real harm, not a cosmetic one. They stay in the panel with their photos and
descriptions ready, so giving one a date and pressing „Публикувана“ takes
under a minute.

## Invented - must be confirmed

| Where | What is made up |
|---|---|
| `src/data/events.ts` | The dates on the two **drafts**. They are past formats of hers, kept in the panel with invented dates so she can reuse them - they are not on the site |
| `src/data/events.ts` | The title of the 17 September workshop. She gave the date but not which format, so it is called plainly „Работилница по керамика“ - the words her own posters use |
| `src/data/site.ts` | **That the piece is collected later.** Clay has to dry and be fired twice, so the site says she writes when it is ready. Standard for ceramics, but confirm how long it takes and whether people collect or she posts them |
| `src/data/site.ts` | The four steps of „Как протича“ and the clock times on them |
| `src/data/site.ts` | Everything under „Какво е включено“, including that glazing and both firings are in the price |
| ~~`src/data/site.ts`~~ | ~~The three testimonials~~ - **removed.** They were invented, and the section now renders nothing until a real one is entered in the panel |
| `src/data/site.ts` | The age limit (12). „За групи“ no longer invents a range: it says up to eight in the shop (her number) and „за по-голяма група идвам при вас“ - but how large a group she will travel with is still unconfirmed |
| `src/pages/poveritelnost.astro` | Legal identity is still unknown, but it is no longer a code change: Панел → Съдържание → „Данни на търговеца“ fills it in, and the notice says it is unfinished until it is |
| `src/pages/usloviya.astro` | The cancellation terms. The minimum of three in them is hers; the wording „до деня преди“ is not |

**Most of the photography is now hers**, cut out of her own event posters -
the botanical plate, the hand-painted blue cup, the leaf pressed into a slab,
her shop shelves, and the workshop table. They are small, because a poster is
all Facebook would give without a login: between 400px and 810px wide. Ask her
for the originals and they can go straight in.

The hero background and a few gallery tiles are still Pexels stock - see
`CREDITS.md`, which lists exactly which.

Prices are shown in EUR, which matches her shop.

## Worth asking her

- The „ни“ in her post is now explained: Злата leads, Джейля hosts. The site
  reflects that, but she should read it and confirm the division is right.
- Do the moss workshops still happen at all? The site now says nothing about
  them; the shop link in the footer is the only trace.
- Is „Работилница по керамика #7“ a numbering she wants shown on the site?
- **Is there a potter's wheel?** The resting photograph in „Какво е включено“
  is stock, and it shows someone throwing on a wheel. Everything else on the
  site describes hand-building - „мачкаш, изтъняваш, вдигаш стените“. If the
  workshops do not use a wheel, that picture is promising the wrong evening
  and should be replaced with one of hers. One line in `Included.astro`.

## Backend status

Live. Supabase is connected, the migrations are applied, bookings are taken and
counted, and the retention job runs nightly. The three workshops above are
seeded into it with synthetic bookings named `Резервирано N (демо)` so the seat
counts add up - **delete those when the real dates go in.**

## Blocking before launch

1. **Jump.bg DNS access** - without it there is no subdomain.
2. **Legal identity** (trader name, ЕИК, registered address) for the privacy notice.
3. **Her own photos** of the ceramics workshops.
4. **Real dates, prices and durations**, and the demo rows deleted.
5. **How the firing and collection actually work** - the site currently promises
   something plausible rather than something she confirmed.
6. **Her own login** in Supabase → Authentication → Users, and the shared admin
   password changed.
7. **A native Bulgarian read of every string**, by her.
