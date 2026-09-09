import type { APIRoute } from 'astro';
import { readSession } from '../../../lib/auth';
import { db } from '../../../lib/db';

export const prerender = false;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!readSession(cookies)) {
    return new Response(JSON.stringify({ error: 'unauthorised' }), { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'no_file' }), { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return new Response(JSON.stringify({ error: 'bad_type' }), { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return new Response(JSON.stringify({ error: 'too_big' }), { status: 413 });
  }

  try {
    const url = await db.uploadImage(file);
    return new Response(JSON.stringify({ url }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'upload_failed' }), { status: 500 });
  }
};
