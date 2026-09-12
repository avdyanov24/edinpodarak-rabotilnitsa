import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type {
  Db, WorkshopEvent, Registration, RegistrationStatus,
  RegisterInput, RegisterResult, CancelResult,
} from './types';
import { DbError } from './types';
import { seedEvents } from '../../data/events';

/**
 * File-backed stand-in for Supabase, used whenever SUPABASE_URL is not set.
 *
 * It exists so the site and the admin panel are fully usable — and testable —
 * before anyone has created a Supabase project. It mirrors the SQL semantics
 * of register_for_event and cancel_registration deliberately; if you change
 * one, change the other.
 */

const FILE = '.data/db.json';
const UPLOADS = 'public/media/uploads';

interface Shape {
  events: WorkshopEvent[];
  registrations: Registration[];
  site_content: Record<string, unknown>;
}

let queue: Promise<unknown> = Promise.resolve();
/** Serialises read-modify-write so two bookings cannot clobber each other. */
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function read(): Promise<Shape> {
  try {
    return JSON.parse(await readFile(FILE, 'utf8'));
  } catch {
    // Seat counts are derived from registrations, never stored, so the demo
    // occupancy in the seed has to exist as actual bookings.
    const registrations: Registration[] = [];
    for (const e of seedEvents) {
      for (let i = 0; i < e.seats_taken; i++) {
        registrations.push({
          id: randomUUID(),
          event_id: e.id,
          full_name: `Резервирано ${i + 1} (демо)`,
          email: `demo${i + 1}@example.com`,
          phone: '0888000000',
          people_count: 1,
          note: null,
          status: 'confirmed',
          consent_at: new Date().toISOString(),
          cancel_token: randomUUID(),
          created_at: new Date(Date.now() - (e.seats_taken - i) * 60_000).toISOString(),
        });
      }
    }
    return {
      events: seedEvents.map((e) => ({ ...e, seats_taken: 0 })),
      registrations,
      site_content: {},
    };
  }
}

async function write(db: Shape) {
  await mkdir('.data', { recursive: true });
  await writeFile(FILE, JSON.stringify(db, null, 2), 'utf8');
}

const seatsTaken = (db: Shape, eventId: string) =>
  db.registrations
    .filter((r) => r.event_id === eventId && (r.status === 'confirmed' || r.status === 'attended'))
    .reduce((n, r) => n + r.people_count, 0);

const withSeats = (db: Shape, e: WorkshopEvent): WorkshopEvent =>
  ({ ...e, seats_taken: seatsTaken(db, e.id) });

export const localDb: Db = {
  kind: 'local',

  async listPublishedEvents() {
    const db = await read();
    return db.events
      .filter((e) => e.status === 'published')
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((e) => withSeats(db, e));
  },

  register(input: RegisterInput): Promise<RegisterResult> {
    return exclusive(async () => {
      const db = await read();
      if (input.people_count < 1 || input.people_count > 10) throw new DbError('invalid_people_count');

      const event = db.events.find((e) => e.id === input.event_id);
      if (!event) throw new DbError('unknown_event');
      if (event.status !== 'published') throw new DbError('event_not_published');
      if (!event.registrations_open) throw new DbError('registrations_closed');

      const left = Math.max(event.capacity - seatsTaken(db, event.id), 0);

      let status: RegistrationStatus;
      if (input.people_count <= left) status = 'confirmed';
      else if (event.waitlist_enabled) status = 'waitlist';
      else return { status: 'full', cancel_token: null, seats_left: left };

      const row: Registration = {
        id: randomUUID(),
        event_id: event.id,
        full_name: input.full_name.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        people_count: input.people_count,
        note: input.note?.trim() || null,
        status,
        consent_at: new Date().toISOString(),
        cancel_token: randomUUID(),
        created_at: new Date().toISOString(),
      };
      db.registrations.push(row);
      await write(db);

      return {
        status,
        cancel_token: row.cancel_token,
        seats_left: Math.max(left - (status === 'confirmed' ? input.people_count : 0), 0),
      };
    });
  },

  async lookupToken(token: string) {
    const db = await read();
    const reg = db.registrations.find((r) => r.cancel_token === token);
    if (!reg) return null;
    const event = db.events.find((e) => e.id === reg.event_id);
    if (!event) return null;
    return { status: reg.status, event_title: event.title, starts_at: event.starts_at };
  },

  cancelByToken(token: string): Promise<CancelResult> {
    return exclusive(async () => {
      const db = await read();
      const reg = db.registrations.find((r) => r.cancel_token === token);
      if (!reg) throw new DbError('unknown_token');
      const event = db.events.find((e) => e.id === reg.event_id)!;

      if (reg.status === 'cancelled') {
        return { status: 'already_cancelled', event_title: event.title, starts_at: event.starts_at, promoted: 0 };
      }

      reg.status = 'cancelled';

      // promote the waiting list, oldest first, only bookings that fit
      let left = Math.max(event.capacity - seatsTaken(db, event.id), 0);
      let promoted = 0;
      for (const r of db.registrations
        .filter((r) => r.event_id === event.id && r.status === 'waitlist')
        .sort((a, b) => a.created_at.localeCompare(b.created_at))) {
        if (left <= 0) break;
        if (r.people_count <= left) {
          r.status = 'confirmed';
          left -= r.people_count;
          promoted += 1;
        }
      }

      await write(db);
      return { status: 'cancelled', event_title: event.title, starts_at: event.starts_at, promoted };
    });
  },

  async adminListEvents() {
    const db = await read();
    return db.events
      .slice()
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      .map((e) => withSeats(db, e));
  },

  async adminGetEvent(id: string) {
    const db = await read();
    const e = db.events.find((x) => x.id === id);
    return e ? withSeats(db, e) : null;
  },

  adminSaveEvent(event) {
    return exclusive(async () => {
      const db = await read();
      const clash = db.events.find((e) => e.slug === event.slug && e.id !== event.id);
      if (clash) throw new DbError('duplicate_slug');

      if (event.id) {
        const i = db.events.findIndex((e) => e.id === event.id);
        if (i === -1) throw new DbError('unknown_event');
        db.events[i] = { ...db.events[i], ...event, updated_at: new Date().toISOString() } as WorkshopEvent;
        await write(db);
        return withSeats(db, db.events[i]);
      }

      const row = {
        id: randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        seats_taken: 0,
        ...event,
      } as WorkshopEvent;
      db.events.push(row);
      await write(db);
      return row;
    });
  },

  adminDeleteEvent(id: string) {
    return exclusive(async () => {
      const db = await read();
      db.events = db.events.filter((e) => e.id !== id);
      db.registrations = db.registrations.filter((r) => r.event_id !== id);
      await write(db);
    });
  },

  async adminListRegistrations(eventId?: string) {
    const db = await read();
    return db.registrations
      .filter((r) => !eventId || r.event_id === eventId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  adminSetRegistrationStatus(id: string, status: RegistrationStatus) {
    return exclusive(async () => {
      const db = await read();
      const r = db.registrations.find((x) => x.id === id);
      if (r) r.status = status;
      await write(db);
    });
  },

  async getSiteContent() {
    return (await read()).site_content;
  },

  saveSiteContent(data) {
    return exclusive(async () => {
      const db = await read();
      db.site_content = data;
      await write(db);
    });
  },

  async uploadImage(file: File) {
    await mkdir(UPLOADS, { recursive: true });
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const name = `${randomUUID()}.${ext}`;
    await writeFile(`${UPLOADS}/${name}`, Buffer.from(await file.arrayBuffer()));
    return `/media/uploads/${name}`;
  },
};
