/**
 * The seam between the pages and whatever is storing the data.
 * Everything above this line is unaware of Supabase.
 */
import { db, type WorkshopEvent } from './db';

export type { WorkshopEvent };

export async function getPublishedEvents(): Promise<WorkshopEvent[]> {
  return db.listPublishedEvents();
}

/** Upcoming only — a finished workshop should not head the page. */
export async function getUpcomingEvents(now = new Date()): Promise<WorkshopEvent[]> {
  const all = await getPublishedEvents();
  return all.filter((e) => new Date(e.starts_at).getTime() >= now.getTime());
}

export async function getEventBySlug(slug: string): Promise<WorkshopEvent | undefined> {
  const all = await getPublishedEvents();
  return all.find((e) => e.slug === slug);
}

export async function getNextEvent(now = new Date()): Promise<WorkshopEvent | undefined> {
  const upcoming = await getUpcomingEvents(now);
  // prefer one that can still be booked; fall back to the nearest date
  return upcoming.find((e) => e.registrations_open && e.seats_taken < e.capacity) ?? upcoming[0];
}
