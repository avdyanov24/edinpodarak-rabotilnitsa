import type { APIRoute } from 'astro';
import { readSession } from '../../../lib/auth';
import { db } from '../../../lib/db';

export const prerender = false;

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * What the file actually is, read from its first bytes.
 *
 * The browser's Content-Type and the file's name are both just strings the
 * caller chose, and the bucket they land in is served to the public. Trusting
 * either is how „snimka.jpg“ becomes an HTML page hosted under the project's
 * own storage domain. The type and the extension are decided here instead.
 */
function sniff(bytes: Uint8Array): { type: string; ext: string } | null {
  const at = (i: number, sig: number[]) => sig.every((b, k) => bytes[i + k] === b);
  const ascii = (i: number, s: string) =>
    [...s].every((c, k) => bytes[i + k] === c.charCodeAt(0));

  if (at(0, [0xff, 0xd8, 0xff])) return { type: 'image/jpeg', ext: 'jpg' };
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { type: 'image/png', ext: 'png' };
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return { type: 'image/webp', ext: 'webp' };
  if (ascii(4, 'ftyp') && (ascii(8, 'avif') || ascii(8, 'avis'))) return { type: 'image/avif', ext: 'avif' };
  return null;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await readSession(cookies))) {
    return new Response(JSON.stringify({ error: 'unauthorised' }), { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'no_file' }), { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return new Response(JSON.stringify({ error: 'too_big' }), { status: 413 });
  }

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const kind = sniff(head);
  if (!kind) {
    return new Response(JSON.stringify({ error: 'bad_type' }), { status: 415 });
  }

  try {
    const url = await db.uploadImage(file, kind);
    return new Response(JSON.stringify({ url }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'upload_failed' }), { status: 500 });
  }
};
