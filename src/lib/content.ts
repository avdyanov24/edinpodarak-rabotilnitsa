import { db } from './db';
import { faq as faqDefaults, testimonials as testimonialDefaults } from '../data/site';

/**
 * Page copy that Джейля can change herself. Everything else lives in
 * src/data/site.ts and is a developer job.
 *
 * The defaults are the fallback, so an empty database renders the same site
 * it does today.
 */

export interface FaqItem { q: string; a: string }
export interface Testimonial { quote: string; name: string; detail: string }

export interface EditableContent {
  faq: FaqItem[];
  testimonials: Testimonial[];
}

const clean = <T>(rows: unknown, keys: (keyof T)[]): T[] =>
  Array.isArray(rows)
    ? (rows as T[]).filter((r) => r && keys.every((k) => typeof (r as any)[k] === 'string' && (r as any)[k].trim()))
    : [];

export async function getContent(): Promise<EditableContent> {
  let stored: Record<string, unknown> = {};
  try {
    stored = await db.getSiteContent();
  } catch {
    // a content read must never take the page down
  }

  const faq = clean<FaqItem>(stored.faq, ['q', 'a']);
  const testimonials = clean<Testimonial>(stored.testimonials, ['quote', 'name']);

  return {
    faq: faq.length ? faq : faqDefaults.items,
    testimonials: testimonials.length ? testimonials : testimonialDefaults.items,
  };
}

export async function saveContent(content: Partial<EditableContent>) {
  const current = await db.getSiteContent();
  await db.saveSiteContent({ ...current, ...content });
}
