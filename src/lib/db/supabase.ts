import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Db, WorkshopEvent, Registration, RegistrationStatus,
  RegisterInput, RegisterResult, CancelResult,
  ManualInput,
} from './types';
import { DbError } from './types';
import { env } from '../env';

/**
 * The service-role client. It bypasses RLS, so it must only ever run on the
 * server — never imported into anything that ships to the browser.
 */
export function admin(): SupabaseClient {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new DbError('missing_env', 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const IMAGE_BUCKET = 'event-images';

function rowToEvent(r: Record<string, any>): WorkshopEvent {
  return {
    ...r,
    gallery: Array.isArray(r.gallery) ? r.gallery : [],
    includes: Array.isArray(r.includes) ? r.includes : [],
    seats_taken: r.seats_taken ?? 0,
    // A database that has not had 0007 yet returns nothing for this.
    min_participants: r.min_participants ?? 3,
  } as WorkshopEvent;
}

export const supabaseDb: Db = {
  kind: 'supabase',

  async listPublishedEvents() {
    const { data, error } = await admin().rpc('list_published_events');
    if (error) throw new DbError('list_failed', error.message);
    return (data ?? []).map(rowToEvent);
  },

  async register(input: RegisterInput): Promise<RegisterResult> {
    const { data, error } = await admin().rpc('register_for_event', {
      p_event_id: input.event_id,
      p_full_name: input.full_name,
      p_email: input.email,
      p_phone: input.phone,
      p_people_count: input.people_count,
      p_note: input.note ?? null,
    });
    if (error) {
      // the function raises these by name; pass the reason through
      const code = ['unknown_event', 'event_not_published', 'registrations_closed', 'invalid_people_count']
        .find((c) => error.message.includes(c)) ?? 'register_failed';
      throw new DbError(code, error.message);
    }
    const row = Array.isArray(data) ? data[0] : data;
    return { status: row.status, cancel_token: row.cancel_token, seats_left: row.seats_left };
  },

  async lookupToken(token: string) {
    // Two plain queries rather than a nested select, so this does not depend
    // on how PostgREST happens to name the relationship.
    const { data: reg, error } = await admin()
      .from('registrations')
      .select('status, event_id')
      .eq('cancel_token', token)
      .maybeSingle();
    if (error || !reg) return null;
    const { data: ev } = await admin()
      .from('events')
      .select('title, starts_at')
      .eq('id', reg.event_id)
      .maybeSingle();
    if (!ev) return null;
    return { status: reg.status, event_title: ev.title, starts_at: ev.starts_at };
  },

  async cancelByToken(token: string): Promise<CancelResult> {
    const { data, error } = await admin().rpc('cancel_registration', { p_token: token });
    if (error) {
      throw new DbError(error.message.includes('unknown_token') ? 'unknown_token' : 'cancel_failed', error.message);
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      status: row.status,
      event_title: row.event_title,
      starts_at: row.starts_at,
      promoted: row.promoted ?? 0,
    };
  },

  async adminListEvents() {
    const { data, error } = await admin().from('events').select('*').order('starts_at', { ascending: false });
    if (error) throw new DbError('list_failed', error.message);

    // seat counts are not on the table; fold in the confirmed totals
    const { data: regs } = await admin()
      .from('registrations').select('event_id, people_count, status')
      .in('status', ['confirmed', 'attended']);
    const taken = new Map<string, number>();
    for (const r of regs ?? []) taken.set(r.event_id, (taken.get(r.event_id) ?? 0) + r.people_count);

    return (data ?? []).map((r) => rowToEvent({ ...r, seats_taken: taken.get(r.id) ?? 0 }));
  },

  async adminGetEvent(id: string) {
    const { data, error } = await admin().from('events').select('*').eq('id', id).maybeSingle();
    if (error) throw new DbError('get_failed', error.message);
    if (!data) return null;
    const { data: regs } = await admin()
      .from('registrations').select('people_count')
      .eq('event_id', id).in('status', ['confirmed', 'attended']);
    const seats = (regs ?? []).reduce((n, r) => n + r.people_count, 0);
    return rowToEvent({ ...data, seats_taken: seats });
  },

  async adminSaveEvent(event) {
    const { seats_taken, created_at, updated_at, ...row } = event as Record<string, any>;
    const q = row.id
      ? admin().from('events').update(row).eq('id', row.id).select().single()
      : admin().from('events').insert(row).select().single();
    const { data, error } = await q;
    if (error) {
      throw new DbError(error.code === '23505' ? 'duplicate_slug' : 'save_failed', error.message);
    }
    return rowToEvent({ ...data, seats_taken: seats_taken ?? 0 });
  },

  async adminDeleteEvent(id: string) {
    const { error } = await admin().from('events').delete().eq('id', id);
    if (error) throw new DbError('delete_failed', error.message);
  },

  async adminListRegistrations(eventId?: string) {
    let q = admin().from('registrations').select('*').order('created_at', { ascending: true });
    if (eventId) q = q.eq('event_id', eventId);
    const { data, error } = await q;
    if (error) throw new DbError('list_failed', error.message);
    return (data ?? []) as Registration[];
  },

  async adminAddRegistration(input: ManualInput) {
    const { data, error } = await admin().rpc('register_manual', {
      p_event_id: input.event_id,
      p_full_name: input.full_name,
      p_email: input.email ?? null,
      p_phone: input.phone ?? null,
      p_people_count: input.people_count,
      p_note: input.note ?? null,
    });
    if (error) {
      const msg = error.message ?? '';
      const code = ['invalid_name', 'invalid_people_count', 'unknown_event']
        .find((c) => msg.includes(c)) ?? 'manual_failed';
      throw new DbError(code, msg);
    }
    const row = Array.isArray(data) ? data[0] : data;
    return { status: row.status, seats_left: row.seats_left };
  },

  async adminSetRegistrationStatus(id: string, status: RegistrationStatus) {
    const { error } = await admin().from('registrations').update({ status }).eq('id', id);
    if (error) throw new DbError('update_failed', error.message);
  },

  async getSiteContent() {
    const { data, error } = await admin().from('site_content').select('data').eq('id', true).maybeSingle();
    if (error) throw new DbError('content_failed', error.message);
    return (data?.data ?? {}) as Record<string, unknown>;
  },

  async saveSiteContent(data) {
    const { error } = await admin().from('site_content').upsert({ id: true, data });
    if (error) throw new DbError('content_save_failed', error.message);
  },

  async uploadImage(file: File, kind: { type: string; ext: string }) {
    // Both the name and the served Content-Type come from the sniffed bytes.
    // The bucket is public, so a file that claimed to be text/html would be
    // a page hosted under the project's own storage domain.
    const name = `${crypto.randomUUID()}.${kind.ext}`;
    const { error } = await admin().storage.from(IMAGE_BUCKET)
      .upload(name, file, { contentType: kind.type, upsert: false });
    if (error) throw new DbError('upload_failed', error.message);
    const { data } = admin().storage.from(IMAGE_BUCKET).getPublicUrl(name);
    return data.publicUrl;
  },
};
