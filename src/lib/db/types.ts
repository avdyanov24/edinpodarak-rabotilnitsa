/** Mirrors the `events` table plus the seat count the RPC adds. */
export interface WorkshopEvent {
  id: string;
  slug: string;
  status: 'draft' | 'published' | 'cancelled';
  registrations_open: boolean;
  title: string;
  summary: string;
  description: string;
  cover_image: string | null;
  gallery: string[];
  starts_at: string;
  duration_minutes: number;
  venue_name: string;
  venue_address: string;
  venue_map_url: string | null;
  city: string;
  price_cents: number;
  currency: string;
  price_note: string;
  capacity: number;
  seats_taken: number;
  /** Below this many people the workshop does not run. Never blocks a booking. */
  min_participants: number;
  min_age: number | null;
  includes: string[];
  bring_note: string | null;
  host_note: string | null;
  waitlist_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export type RegistrationStatus = 'confirmed' | 'waitlist' | 'cancelled' | 'attended';

export interface Registration {
  id: string;
  event_id: string;
  full_name: string;
  email: string;
  phone: string;
  people_count: number;
  note: string | null;
  status: RegistrationStatus;
  /** Null for a booking she entered herself: no consent was ticked here. */
  consent_at: string | null;
  cancel_token: string;
  created_at: string;
  /** Where the booking came from - the form, or her hand. */
  source: 'site' | 'manual';
}

/** A booking she takes by phone or on Instagram and types into the panel. */
export interface ManualInput {
  event_id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  people_count: number;
  note?: string | null;
}

export interface RegisterInput {
  event_id: string;
  full_name: string;
  email: string;
  phone: string;
  people_count: number;
  note?: string | null;
}

export interface RegisterResult {
  status: 'confirmed' | 'waitlist' | 'full';
  cancel_token: string | null;
  seats_left: number;
}

export interface CancelResult {
  status: 'cancelled' | 'already_cancelled';
  event_title: string;
  starts_at: string;
  promoted: number;
}

/** What a cancellation link points at, without changing anything. */
export interface TokenLookup {
  status: Registration['status'];
  event_title: string;
  starts_at: string;
}

/** Both backends implement exactly this. */
export interface Db {
  readonly kind: 'supabase' | 'local';

  listPublishedEvents(): Promise<WorkshopEvent[]>;
  register(input: RegisterInput): Promise<RegisterResult>;
  cancelByToken(token: string): Promise<CancelResult>;
  /** Read-only: what state is this cancellation link in? */
  lookupToken(token: string): Promise<TokenLookup | null>;

  adminListEvents(): Promise<WorkshopEvent[]>;
  adminGetEvent(id: string): Promise<WorkshopEvent | null>;
  adminSaveEvent(event: Partial<WorkshopEvent> & { id?: string }): Promise<WorkshopEvent>;
  adminDeleteEvent(id: string): Promise<void>;

  adminListRegistrations(eventId?: string): Promise<Registration[]>;
  adminSetRegistrationStatus(id: string, status: RegistrationStatus): Promise<void>;
  /** Add a booking she took herself. Respects capacity; sends nothing. */
  adminAddRegistration(input: ManualInput): Promise<{ status: 'confirmed' | 'waitlist'; seats_left: number }>;

  getSiteContent(): Promise<Record<string, unknown>>;
  saveSiteContent(data: Record<string, unknown>): Promise<void>;

  uploadImage(file: File): Promise<string>;
}

/** Errors the booking RPC raises, mapped to something the UI can show. */
export class DbError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}
