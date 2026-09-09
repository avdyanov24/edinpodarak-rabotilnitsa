import type { Db } from './types';
import { localDb } from './local';
import { supabaseDb } from './supabase';
import { hasSupabase } from '../env';

/**
 * Supabase when it is configured, otherwise the file-backed stand-in so the
 * site still runs. Everything else in the app imports only this.
 */
export const db: Db = hasSupabase() ? supabaseDb : localDb;

export * from './types';
