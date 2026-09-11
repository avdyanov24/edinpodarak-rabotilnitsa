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
    cover_image: '/media/her/chasha-sinya.webp',
    starts_at: '2026-10-16T19:00:00+03:00',
    duration_minutes: 120,
    venue_name: 'Магазин „Джейля“',
    venue_address: 'ул. „Брегалница“ 1, Гоце Делчев',
    venue_map_url: 'https://maps.google.com/?q=ул.+Брегалница+1,+Гоце+Делчев',
    city: 'Гоце Делчев',
    price_cents: 2500,
    price_note: 'Всичко е включено — материали, изпичане и домашна лимонада.',
    capacity: 8,
    seats_taken: 5,
    min_age: 12,
    includes: [
      'Работилница със Злата Златкова',
      'Всички материали и инструменти',
      'Изработка на собствена чаша',
      'Изпичане и глазиране',
      'Домашна лимонада и почерпка',
    ],
    bring_note: 'Ела с дрехи, които не ти е жал да изцапаш.',
    host_note: 'Води Злата Златкова, майстор керамик',
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
    cover_image: '/media/her/momiche.webp',
    starts_at: '2026-11-08T18:30:00+02:00',
    duration_minutes: 120,
    venue_name: 'Магазин „Джейля“',
    venue_address: 'ул. „Брегалница“ 1, Гоце Делчев',
    venue_map_url: 'https://maps.google.com/?q=ул.+Брегалница+1,+Гоце+Делчев',
    city: 'Гоце Делчев',
    price_cents: 2500,
    price_note: 'Всичко е включено — материали, изпичане и домашна лимонада.',
    capacity: 8,
    seats_taken: 2,
    min_age: 12,
    includes: [
      'Работилница със Злата Златкова',
      'Всички материали и инструменти',
      'Изработка на собствена чаша',
      'Изпичане и глазиране',
      'Домашна лимонада и почерпка',
    ],
    bring_note: null,
    host_note: 'Води Злата Златкова, майстор керамик',
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
    cover_image: '/media/her/chiniya.webp',
    starts_at: '2026-12-06T17:00:00+02:00',
    duration_minutes: 120,
    venue_name: 'Магазин „Джейля“',
    venue_address: 'ул. „Брегалница“ 1, Гоце Делчев',
    venue_map_url: 'https://maps.google.com/?q=ул.+Брегалница+1,+Гоце+Делчев',
    city: 'Гоце Делчев',
    price_cents: 2500,
    price_note: 'Всичко е включено — материали, изпичане и домашна лимонада.',
    capacity: 8,
    seats_taken: 8,
    min_age: 12,
    includes: [
      'Работилница със Злата Златкова',
      'Листа и треви за отпечатване',
      'Всички материали и инструменти',
      'Изпичане и глазиране',
      'Домашна лимонада и почерпка',
    ],
    bring_note: null,
    host_note: 'Води Злата Златкова, майстор керамик',
    waitlist_enabled: true,
  },
];

/** Kept so older imports keep working. */
export const events = seedEvents;
