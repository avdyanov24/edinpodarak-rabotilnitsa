/**
 * Seed content. Used to fill the file-backed store the first time the site
 * runs without Supabase, and as the demo data for the client walk-through.
 * Once Supabase is connected this file is no longer read at runtime.
 *
 * Dates, prices and the venue are placeholders — see PLACEHOLDERS.md.
 */
import type { WorkshopEvent } from '../lib/db/types';

export type { WorkshopEvent } from '../lib/db/types';

export const seedEvents: WorkshopEvent[] = [
] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    gallery: [],
    currency: 'EUR',
    slug: 'muh-i-vino-plovdiv-oktomvri',
    status: 'published',
    registrations_open: true,
    title: 'Мъх и вино',
    summary:
      'Два вечерни часа, в които правиш своя картина от жив скандинавски мъх — с чаша вино в другата ръка.',
    description:
      'Започваме с кратък разказ за скандинавския мъх — откъде идва, защо не се полива и как остава зелен с години. После всеки сяда пред своята рамка: избираш цветовете, редиш мъха, добавяш сухи цветя и естествена кожа. Минавам покрай всеки и помагам, но творбата си е изцяло твоя. Тръгваш си с готова картина в ръка.',
    cover_image: '/media/gallery/ramka-buket.webp',
    starts_at: '2026-10-16T19:00:00+03:00',
    duration_minutes: 120,
    venue_name: 'Ателие „Джейля“',
    venue_address: 'ул. „Иван Вазов“ 12, Пловдив',
    venue_map_url: 'https://maps.google.com/?q=Пловдив+център',
    city: 'Пловдив',
    price_cents: 3100,
    price_note: 'Всички материали, рамка А4 и чаша вино са включени.',
    capacity: 12,
    seats_taken: 8,
    min_age: 18,
    includes: [
      'Рамка формат А4',
      'Скандинавски мъх в четири цвята',
      'Сухи цветя и естествена кожа',
      'Лепило и инструменти',
      'Чаша вино и нещо леко за хапване',
    ],
    bring_note: 'Само добро настроение. Престилки има на място.',
    host_note: 'Води Джейля',
    waitlist_enabled: true,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    gallery: [],
    currency: 'EUR',
    slug: 'chasovnik-ot-muh-noemvri',
    status: 'published',
    registrations_open: true,
    title: 'Часовник от мъх',
    summary:
      'По-дълга работилница за тези, които искат да си тръгнат с нещо, което освен това показва и часа.',
    description:
      'Правим кръгъл стенен часовник с рамка от жив скандинавски мъх. Показвам ти как се подрежда мъхът в кръг така, че да изглежда естествено, и как се сглобява механизмът. Три часа, защото не бързаме.',
    cover_image: '/media/gallery/chasovnik-1.webp',
    starts_at: '2026-11-08T18:30:00+02:00',
    duration_minutes: 180,
    venue_name: 'Ателие „Джейля“',
    venue_address: 'ул. „Иван Вазов“ 12, Пловдив',
    venue_map_url: 'https://maps.google.com/?q=Пловдив+център',
    city: 'Пловдив',
    price_cents: 4500,
    price_note: 'Часовниковият механизъм и всички материали са включени.',
    capacity: 10,
    seats_taken: 3,
    min_age: 16,
    includes: [
      'Основа и часовников механизъм',
      'Скандинавски мъх по избор',
      'Декоративни природни елементи',
      'Инструменти и лепило',
      'Кафе или чай',
    ],
    bring_note: null,
    host_note: 'Води Джейля',
    waitlist_enabled: true,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    gallery: [],
    currency: 'EUR',
    slug: 'koledna-rabotilnitsa-dekemvri',
    status: 'published',
    registrations_open: true,
    title: 'Коледна работилница',
    summary:
      'Правим коледен венец или малка композиция от мъх — подаръкът е готов преди празниците.',
    description:
      'Най-топлата работилница в годината. Избираш между венец за врата и настолна композиция, а материалите са зимни — мъх, шишарки, канела, сушени портокали. Идеална, ако искаш да дойдеш с приятелка или с детето (от 12 години нагоре, с придружител).',
    cover_image: '/media/gallery/buket-rozi.webp',
    starts_at: '2026-12-06T17:00:00+02:00',
    duration_minutes: 150,
    venue_name: 'Ателие „Джейля“',
    venue_address: 'ул. „Иван Вазов“ 12, Пловдив',
    venue_map_url: 'https://maps.google.com/?q=Пловдив+център',
    city: 'Пловдив',
    price_cents: 3600,
    price_note: 'Всички материали и топъл греян сок са включени.',
    capacity: 14,
    seats_taken: 14,
    min_age: 12,
    includes: [
      'Основа за венец или композиция',
      'Мъх, шишарки, канела, сушени плодове',
      'Панделки и декорация',
      'Инструменти и лепило',
      'Греян сок и сладко',
    ],
    bring_note: 'Ако идваш с дете под 16 години, ела с него.',
    host_note: 'Води Джейля',
    waitlist_enabled: true,
  },
];

/** Kept so older imports keep working. */
export const events = seedEvents;
