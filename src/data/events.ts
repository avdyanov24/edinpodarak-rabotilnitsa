/**
 * Seed content. Used to fill the file-backed store the first time the site
 * runs without Supabase, and as the demo data for the client walk-through.
 * Once Supabase is connected this file is no longer read at runtime.
 *
 * The three titles are her real Facebook events. The dates, prices,
 * durations and capacities are placeholders — see PLACEHOLDERS.md.
 */
import type { WorkshopEvent } from '../lib/db/types';

export type { WorkshopEvent } from '../lib/db/types';

export const seedEvents: WorkshopEvent[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    gallery: [],
    currency: 'EUR',
    slug: 'glina-i-limonada-oktomvri',
    status: 'published',
    registrations_open: true,
    title: 'Глина и лимонада',
    summary:
      'Два вечерни часа с буца глина, чаша домашна лимонада и маса, на която никой не бърза.',
    description:
      'Започваме с глината — каква е на пипане, докъде се разтяга и защо прощава. После всеки сяда пред своята буца: оформяш чаша, изтъняваш стените, правиш дръжката. Минавам покрай всеки и помагам, но формата си е изцяло твоя. Накрая избираш глеч и оставяш чашата при мен — глината минава два пъти през пещта и си я вземаш, щом е готова.',
    cover_image: '/media/gallery/chashi-raft.webp',
    starts_at: '2026-10-16T19:00:00+03:00',
    duration_minutes: 120,
    venue_name: 'Ателие „Джейля“',
    venue_address: 'ул. „Брегалница“ 3, Гоце Делчев',
    venue_map_url: 'https://maps.google.com/?q=ул.+Брегалница+3,+Гоце+Делчев',
    city: 'Гоце Делчев',
    price_cents: 3100,
    price_note: 'Глината, глечта, изпичането и лимонадата са включени.',
    capacity: 12,
    seats_taken: 8,
    min_age: 12,
    includes: [
      'Глина, колкото ти трябва',
      'Глеч по избор',
      'Инструменти и престилка',
      'Двете печения след работилницата',
      'Чаша домашна лимонада',
    ],
    bring_note: 'Ела с дрехи, които не ти е жал да изцапаш.',
    host_note: 'Води Джейля',
    waitlist_enabled: true,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    gallery: [],
    currency: 'EUR',
    slug: 'napravi-svoya-keramichna-chasha-noemvri',
    status: 'published',
    registrations_open: true,
    title: 'Направи своя керамична чаша',
    summary:
      'По-дълга работилница за тези, които искат чашата да е точно по тяхната ръка.',
    description:
      'Три часа само върху чашата: формата, дебелината на стените, дръжката и накрая украсата. Показвам ти как се държи глината и как се поправя, когато тръгне накриво. Избираш глеч, аз поемам пещта и ти пиша, щом чашата е готова за прибиране.',
    cover_image: '/media/gallery/chasha-risuvana.webp',
    starts_at: '2026-11-08T18:30:00+02:00',
    duration_minutes: 180,
    venue_name: 'Ателие „Джейля“',
    venue_address: 'ул. „Брегалница“ 3, Гоце Делчев',
    venue_map_url: 'https://maps.google.com/?q=ул.+Брегалница+3,+Гоце+Делчев',
    city: 'Гоце Делчев',
    price_cents: 4500,
    price_note: 'Глината, глечта и изпичането са включени.',
    capacity: 10,
    seats_taken: 3,
    min_age: 12,
    includes: [
      'Глина и глеч по избор',
      'Инструменти и престилка',
      'Двете печения след работилницата',
      'Кафе, чай или лимонада',
    ],
    bring_note: null,
    host_note: 'Води Джейля',
    waitlist_enabled: true,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    gallery: [],
    currency: 'EUR',
    slug: 'botanicheska-chiniya-dekemvri',
    status: 'published',
    registrations_open: true,
    title: 'Природа, глина, лимонада',
    summary:
      'Създаваш своя ботаническа чиния — с листа и цветя, отпечатани направо в глината.',
    description:
      'Разточваме глината на плоско и отпечатваме в нея листа, треви и цветя. После я оформяме в чиния и я оставяме да съхне. Всяка чиния излиза различна, защото няма две еднакви листа. Глечта и двете печения са включени — пиша ти, щом е готова.',
    cover_image: '/media/gallery/chinii-i-chashi.webp',
    starts_at: '2026-12-06T17:00:00+02:00',
    duration_minutes: 150,
    venue_name: 'Ателие „Джейля“',
    venue_address: 'ул. „Брегалница“ 3, Гоце Делчев',
    venue_map_url: 'https://maps.google.com/?q=ул.+Брегалница+3,+Гоце+Делчев',
    city: 'Гоце Делчев',
    price_cents: 3600,
    price_note: 'Глината, глечта и изпичането са включени.',
    capacity: 14,
    seats_taken: 14,
    min_age: 12,
    includes: [
      'Глина и глеч по избор',
      'Листа и треви за отпечатване',
      'Инструменти и престилка',
      'Двете печения след работилницата',
      'Чаша домашна лимонада',
    ],
    bring_note: null,
    host_note: 'Води Джейля',
    waitlist_enabled: true,
  },
];

/** Kept so older imports keep working. */
export const events = seedEvents;
